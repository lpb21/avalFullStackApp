const solicitudesRepo = require("../infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../infrastructure/repositories/aprobadoresRepository");
const otpsRepo = require("../infrastructure/repositories/otpsRepository");
const mockMailsRepo = require("../infrastructure/repositories/mockMailsRepository");
const { validarTurno, ESTADOS_SOLICITUD, ERRORES } = require("../domain/maquinaEstados");
const { generarCodigoOtp, hashearCodigoOtp, decidirAccionOtp } = require("../domain/otp");

async function resolverAprobacion({ solicitudId, approverToken }) {
  const aprobador = await aprobadoresRepo.buscarAprobadorPorToken(approverToken);

  if (!aprobador || aprobador.solicitud_id !== solicitudId) {
    return {
      ok: false,
      status: 400,
      body: { codigo: "TOKEN_INVALIDO", mensaje: "Token inválido o no corresponde a la solicitud" },
    };
  }

  const solicitud = await solicitudesRepo.obtenerSolicitudPorId(solicitudId);
  if (!solicitud) {
    return {
      ok: false,
      status: 400,
      body: { codigo: "TOKEN_INVALIDO", mensaje: "Token inválido o expirado" },
    };
  }

  if (solicitud.estado === ESTADOS_SOLICITUD.RECHAZADA) {
    return {
      ok: false,
      status: 409,
      body: { codigo: ERRORES.SOLICITUD_RECHAZADA, mensaje: "Esta solicitud ya fue rechazada" },
    };
  }
  if (solicitud.estado !== ESTADOS_SOLICITUD.PENDIENTE) {
    return {
      ok: false,
      status: 409,
      body: { codigo: ERRORES.SOLICITUD_TERMINAL, mensaje: `La solicitud ya está en estado ${solicitud.estado}` },
    };
  }

  const aprobadores = await aprobadoresRepo.listarAprobadoresPorSolicitud(solicitudId);
  const validacion = validarTurno(solicitud, aprobadores, aprobador.orden);
  if (!validacion.permitido) {
    return {
      ok: false,
      status: 403,
      body: { codigo: validacion.error, mensaje: validacion.mensaje },
    };
  }

  const ahoraSegundos = Math.floor(Date.now() / 1000);
  const otpActual = await otpsRepo.obtenerOtp(solicitudId, aprobador.orden);
  const decision = decidirAccionOtp(otpActual, aprobador.num_otp_generados, ahoraSegundos);

  if (decision.accion === "BLOQUEADO") {
    return {
      ok: false,
      status: 429,
      body: { codigo: "LIMITE_GENERACIONES_SUPERADO", mensaje: "Se agotaron las generaciones de OTP para este aprobador" },
    };
  }

  if (decision.accion === "GENERAR") {
    await aprobadoresRepo.incrementarGeneracionesOtp({
      solicitudId,
      orden: aprobador.orden,
    });
    const codigo = generarCodigoOtp();
    await otpsRepo.crearOtp({
      solicitudId,
      orden: aprobador.orden,
      codigoHash: hashearCodigoOtp(codigo),
    });

    // Simulación de envío: se guarda como mock-mail (no se envía nada real),
    // consultable en GET /api/v1/mock-mail, igual que el correo inicial.
    await mockMailsRepo.guardarMockMail({
      para: aprobador.email,
      asunto: `Tu código de verificación: ${solicitud.titulo}`,
      cuerpo:
        `Hola ${aprobador.nombre},\n\n` +
        `Tu código de verificación (OTP) es: ${codigo}\n` +
        `Válido por 3 minutos.\n\n` +
        `Solicitud: "${solicitud.titulo}"`,
    });
  }

  return {
    ok: true,
    status: 200,
    body: {
      mensaje: "Usa el OTP enviado a tu correo",
      solicitud_id: solicitudId,
      orden: aprobador.orden,
      generaciones_restantes: decision.generacionesRestantes,
    },
  };
}

module.exports = { resolverAprobacion };