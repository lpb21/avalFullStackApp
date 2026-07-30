const solicitudesRepo = require("../infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../infrastructure/repositories/aprobadoresRepository");
const sessionTokensRepo = require("../infrastructure/repositories/sessionTokensRepository");
const { validarTurno, calcularEstadoSolicitud, ESTADOS_SOLICITUD, ESTADOS_APROBADOR } = require("../domain/maquinaEstados");
const { calcularHashGenesis, calcularHashFirma } = require("../domain/hashChain");

/**
 * Caso de uso de POST /firmar: valida el firma_token de un solo uso,
 * valida turno, y registra APROBAR (con hash encadenado) o RECHAZAR.
 * Si con esta firma se completan las 3, pasa la solicitud a
 * FIRMAS_COMPLETAS (la generación del PDF y el paso a COMPLETADA se
 * agregan en el siguiente módulo, aún no construido).
 */
async function firmarSolicitud({ solicitudId, orden, firmaToken, accion }) {
  // 1. Validar el firma_token
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

  // 2. Validar turno (mismas reglas que /approve y /otp/verify)
  const validacion = validarTurno(solicitud, aprobadores, orden);
  if (!validacion.permitido) {
    const status = validacion.error === "YA_FIRMADO" ? 409 : 403;
    return { ok: false, status, body: { codigo: validacion.error, mensaje: validacion.mensaje } };
  }

  // 3. Consumir el firma_token (un solo uso, condicional)
  try {
    await sessionTokensRepo.marcarFirmaTokenComoUsado(firmaToken);
  } catch (error) {
    // ConditionalCheckFailedException: alguien más lo consumió en la
    // misma fracción de segundo (carrera). Se trata como token inválido.
    return {
      ok: false,
      status: 401,
      body: { codigo: "TOKEN_INVALIDO", mensaje: "El token de firma ya fue utilizado" },
    };
  }

  const aprobadorActual = aprobadores.find((a) => a.orden === orden);
  const fechaFirma = Date.now();

  // 4. RECHAZAR: corta aquí, la solicitud pasa a RECHAZADA
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

  // 5. APROBAR: calcular el hash encadenado
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

  // 6. Revisar si se completaron las 3 firmas
  const aprobadoresActualizados = aprobadores.map((a) =>
    a.orden === orden ? { ...a, estado_firma: ESTADOS_APROBADOR.FIRMADO } : a
  );
  const nuevoEstadoSolicitud = calcularEstadoSolicitud(aprobadoresActualizados);

  if (nuevoEstadoSolicitud === ESTADOS_SOLICITUD.FIRMAS_COMPLETAS) {
    await solicitudesRepo.actualizarEstado({
      solicitudId,
      estadoEsperado: ESTADOS_SOLICITUD.PENDIENTE,
      nuevoEstado: ESTADOS_SOLICITUD.FIRMAS_COMPLETAS,
    });
    // TODO: aquí se dispara la generación del PDF (siguiente módulo) y,
    // si tiene éxito, la transición final a COMPLETADA.
  }

  return {
    ok: true,
    status: 200,
    body: {
      mensaje: "Firma registrada",
      estado: ESTADOS_APROBADOR.FIRMADO,
      solicitud_estado: nuevoEstadoSolicitud,
    },
  };
}

module.exports = { firmarSolicitud };