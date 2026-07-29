const { randomUUID } = require("crypto");
const solicitudesRepo = require("../infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../infrastructure/repositories/aprobadoresRepository");
const otpsRepo = require("../infrastructure/repositories/otpsRepository");
const sessionTokensRepo = require("../infrastructure/repositories/sessionTokensRepository");
const { validarTurno, ESTADOS_SOLICITUD, ERRORES } = require("../domain/maquinaEstados");
const { codigoCoincide, esOtpVigente } = require("../domain/otp");

/**
 * Caso de uso de POST /api/v1/otp/verify: valida el approver_token contra
 * el GSI ANTES de comparar el OTP (protege el factor débil), valida
 * turno/estado, compara el código, y si todo es correcto emite un
 * firma_token de un solo uso.
 */
async function verificarOtp({ solicitudId, orden, approverToken, codigo }) {
  const aprobador = await aprobadoresRepo.buscarAprobadorPorToken(approverToken);

  if (!aprobador || aprobador.solicitud_id !== solicitudId || aprobador.orden !== orden) {
    return {
      ok: false,
      status: 400,
      body: { codigo: "TOKEN_INVALIDO", mensaje: "Token inválido o no corresponde a la solicitud/orden" },
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
  const validacion = validarTurno(solicitud, aprobadores, orden);
  if (!validacion.permitido) {
    return {
      ok: false,
      status: 403,
      body: { codigo: validacion.error, mensaje: validacion.mensaje },
    };
  }

  const ahoraSegundos = Math.floor(Date.now() / 1000);
  const otp = await otpsRepo.obtenerOtp(solicitudId, orden);

  if (!esOtpVigente(otp, ahoraSegundos)) {
    return {
      ok: false,
      status: 400,
      body: { codigo: "OTP_INVALIDO", mensaje: "OTP inválido o expirado" },
    };
  }

  if (!codigoCoincide(codigo, otp.codigo_hash)) {
    try {
      await otpsRepo.incrementarIntentos(solicitudId, orden);
    } catch (error) {
      // ConditionalCheckFailedException: ya estaba en 3 intentos justo
      // cuando llegó esta petición (carrera); se trata igual como límite superado.
    }

    const otpActualizado = await otpsRepo.obtenerOtp(solicitudId, orden);
    if (otpActualizado && otpActualizado.intentos >= 3) {
      return {
        ok: false,
        status: 429,
        body: { codigo: "LIMITE_INTENTOS_SUPERADO", mensaje: "Máximo de intentos de OTP superado" },
      };
    }

    return {
      ok: false,
      status: 400,
      body: { codigo: "OTP_INVALIDO", mensaje: "Código incorrecto" },
    };
  }

  // OTP correcto: se elimina (un solo uso) y se emite el firma_token
  await otpsRepo.eliminarOtp(solicitudId, orden);

  const firmaToken = randomUUID();
  const tokenCreado = await sessionTokensRepo.crearFirmaToken({
    firmaToken,
    solicitudId,
    orden,
  });

  return {
    ok: true,
    status: 200,
    body: {
      firma_token: firmaToken,
      expira_firma_token: tokenCreado.expira_en,
      detalle: {
        solicitud,
        aprobadores,
      },
    },
  };
}

module.exports = { verificarOtp };