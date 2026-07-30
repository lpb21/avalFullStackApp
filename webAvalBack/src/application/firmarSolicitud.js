const solicitudesRepo = require("../infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../infrastructure/repositories/aprobadoresRepository");
const sessionTokensRepo = require("../infrastructure/repositories/sessionTokensRepository");
const pdfStorageRepo = require("../infrastructure/repositories/pdfStorageRepository");
const { generarPdfEvidencia } = require("../infrastructure/pdfGenerator");
const { validarTurno, calcularEstadoSolicitud, ESTADOS_SOLICITUD, ESTADOS_APROBADOR } = require("../domain/maquinaEstados");
const { calcularHashGenesis, calcularHashFirma } = require("../domain/hashChain");

async function firmarSolicitud({ solicitudId, orden, firmaToken, accion }) {
  const token = await sessionTokensRepo.obtenerFirmaToken(firmaToken);
  const ahoraSegundos = Math.floor(Date.now() / 1000);

  if (
    !token ||
    token.solicitud_id !== solicitudId ||
    token.orden !== orden ||
    token.usado ||
    token.expira_en < ahoraSegundos
  ) {
    return {
      ok: false,
      status: 401,
      body: { codigo: "TOKEN_INVALIDO", mensaje: "Falta el token de firma o es inválido/expirado/ya usado" },
    };
  }

  const solicitud = await solicitudesRepo.obtenerSolicitudPorId(solicitudId);
  if (!solicitud) {
    return {
      ok: false,
      status: 400,
      body: { codigo: "SOLICITUD_NO_ENCONTRADA", mensaje: "La solicitud no existe" },
    };
  }

  const aprobadores = await aprobadoresRepo.listarAprobadoresPorSolicitud(solicitudId);

  const validacion = validarTurno(solicitud, aprobadores, orden);
  if (!validacion.permitido) {
    const status = validacion.error === "YA_FIRMADO" ? 409 : 403;
    return { ok: false, status, body: { codigo: validacion.error, mensaje: validacion.mensaje } };
  }

  try {
    await sessionTokensRepo.marcarFirmaTokenComoUsado(firmaToken);
  } catch (error) {
    return {
      ok: false,
      status: 401,
      body: { codigo: "TOKEN_INVALIDO", mensaje: "El token de firma ya fue utilizado" },
    };
  }

  const aprobadorActual = aprobadores.find((a) => a.orden === orden);
  const fechaFirma = Date.now();

  if (accion === "RECHAZAR") {
    try {
      await aprobadoresRepo.actualizarEstadoFirma({
        solicitudId,
        orden,
        nuevoEstado: ESTADOS_APROBADOR.RECHAZADO,
        fechaFirma,
        hashFirma: null,
      });
    } catch (error) {
      return {
        ok: false,
        status: 409,
        body: { codigo: "YA_FIRMADO", mensaje: "Este aprobador ya registró su decisión" },
      };
    }

    await solicitudesRepo.actualizarEstado({
      solicitudId,
      estadoEsperado: ESTADOS_SOLICITUD.PENDIENTE,
      nuevoEstado: ESTADOS_SOLICITUD.RECHAZADA,
    });

    return {
      ok: true,
      status: 200,
      body: { mensaje: "Solicitud rechazada", estado: ESTADOS_APROBADOR.RECHAZADO, solicitud_estado: ESTADOS_SOLICITUD.RECHAZADA },
    };
  }

  const aprobadorAnterior = aprobadores.find((a) => a.orden === orden - 1);
  const hashAnterior = aprobadorAnterior
    ? aprobadorAnterior.hash_firma
    : calcularHashGenesis(solicitud);

  const hashFirma = calcularHashFirma({
    solicitud,
    hashAnterior,
    nombre: aprobadorActual.nombre,
    timestamp: fechaFirma,
  });

  try {
    await aprobadoresRepo.actualizarEstadoFirma({
      solicitudId,
      orden,
      nuevoEstado: ESTADOS_APROBADOR.FIRMADO,
      fechaFirma,
      hashFirma,
    });
  } catch (error) {
    return {
      ok: false,
      status: 409,
      body: { codigo: "YA_FIRMADO", mensaje: "Este aprobador ya registró su decisión" },
    };
  }

  const aprobadoresActualizados = aprobadores.map((a) =>
    a.orden === orden ? { ...a, estado_firma: ESTADOS_APROBADOR.FIRMADO, fecha_firma: fechaFirma, hash_firma: hashFirma } : a
  );
  const nuevoEstadoSolicitud = calcularEstadoSolicitud(aprobadoresActualizados);

  if (nuevoEstadoSolicitud === ESTADOS_SOLICITUD.FIRMAS_COMPLETAS) {
    await solicitudesRepo.actualizarEstado({
      solicitudId,
      estadoEsperado: ESTADOS_SOLICITUD.PENDIENTE,
      nuevoEstado: ESTADOS_SOLICITUD.FIRMAS_COMPLETAS,
    });

    // Generar PDF, subir a S3, y solo si tiene éxito pasar a COMPLETADA.
    // Si algo falla aquí, la solicitud queda en FIRMAS_COMPLETAS (nunca
    // COMPLETADA sin pdf_key) y puede reintentarse más adelante.
    try {
      const bytesPdf = await generarPdfEvidencia({
        solicitud,
        aprobadores: aprobadoresActualizados,
      });
      const pdfKey = await pdfStorageRepo.subirPdf({ solicitudId, bytesPdf });

      await solicitudesRepo.actualizarEstadoConPdf({
        solicitudId,
        estadoEsperado: ESTADOS_SOLICITUD.FIRMAS_COMPLETAS,
        nuevoEstado: ESTADOS_SOLICITUD.COMPLETADA,
        pdfKey,
      });

      return {
        ok: true,
        status: 200,
        body: { mensaje: "Firma registrada. Solicitud completada, PDF generado.", estado: ESTADOS_APROBADOR.FIRMADO, solicitud_estado: ESTADOS_SOLICITUD.COMPLETADA },
      };
    } catch (error) {
      console.error("Error generando/subiendo PDF:", error);
      return {
        ok: true,
        status: 200,
        body: { mensaje: "Firma registrada. La generación del PDF está pendiente.", estado: ESTADOS_APROBADOR.FIRMADO, solicitud_estado: ESTADOS_SOLICITUD.FIRMAS_COMPLETAS },
      };
    }
  }

  return {
    ok: true,
    status: 200,
    body: { mensaje: "Firma registrada", estado: ESTADOS_APROBADOR.FIRMADO, solicitud_estado: nuevoEstadoSolicitud },
  };
}

module.exports = { firmarSolicitud };