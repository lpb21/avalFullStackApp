const { createHash, randomInt } = require("crypto");

const LONGITUD_OTP = 6;
const LIMITE_INTENTOS = 3;
const LIMITE_GENERACIONES = 3;

/**
 * Genera un código OTP numérico de 6 dígitos, con ceros a la izquierda
 * si hace falta (ej: "004821").
 */
function generarCodigoOtp() {
  const numero = randomInt(0, 10 ** LONGITUD_OTP);
  return String(numero).padStart(LONGITUD_OTP, "0");
}

/**
 * Hashea un código OTP con SHA256. Nunca se guarda ni se compara el
 * código en texto plano.
 */
function hashearCodigoOtp(codigo) {
  return createHash("sha256").update(codigo).digest("hex");
}

/**
 * Compara un código recibido contra su hash almacenado.
 */
function codigoCoincide(codigo, codigoHash) {
  return hashearCodigoOtp(codigo) === codigoHash;
}

/**
 * Determina si un OTP existente sigue siendo VIGENTE (reutilizable):
 * no ha expirado Y no ha agotado sus intentos. El TTL de DynamoDB es
 * solo limpieza; esta es la validación real, en código.
 *
 * @param {Object|null} otp - el ítem OTP tal como lo devuelve el repositorio
 * @param {number} ahoraEpochSegundos
 */
function esOtpVigente(otp, ahoraEpochSegundos) {
  if (!otp) return false;
  const noExpirado = otp.expira_en > ahoraEpochSegundos;
  const conIntentosDisponibles = otp.intentos < LIMITE_INTENTOS;
  return noExpirado && conIntentosDisponibles;
}

/**
 * Decide qué hacer al llegar una petición de GET /api/v1/approve, dado
 * el estado actual del OTP (si existe) y las generaciones ya usadas
 * por el aprobador. Resuelve el orden de precedencia que evita el
 * deadlock entre "reutilizar OTP vigente" y "3 intentos agotados":
 *
 *   1. ¿OTP vigente (no expirado Y con intentos<3)? -> REUTILIZAR
 *   2. Si no -> ¿quedan generaciones (<3)?
 *        Sí -> GENERAR nuevo (resetea intentos)
 *        No -> BLOQUEADO (429, límite de generaciones)
 *
 * @param {Object|null} otpActual
 * @param {number} numOtpGenerados - contador actual del aprobador
 * @param {number} ahoraEpochSegundos
 * @returns {{ accion: "REUTILIZAR" | "GENERAR" | "BLOQUEADO", generacionesRestantes?: number }}
 */
function decidirAccionOtp(otpActual, numOtpGenerados, ahoraEpochSegundos) {
  if (esOtpVigente(otpActual, ahoraEpochSegundos)) {
    return {
      accion: "REUTILIZAR",
      generacionesRestantes: LIMITE_GENERACIONES - numOtpGenerados,
    };
  }

  if (numOtpGenerados < LIMITE_GENERACIONES) {
    return {
      accion: "GENERAR",
      generacionesRestantes: LIMITE_GENERACIONES - (numOtpGenerados + 1),
    };
  }

  return { accion: "BLOQUEADO" };
}

module.exports = {
  LONGITUD_OTP,
  LIMITE_INTENTOS,
  LIMITE_GENERACIONES,
  generarCodigoOtp,
  hashearCodigoOtp,
  codigoCoincide,
  esOtpVigente,
  decidirAccionOtp,
};