/**
 * Reglas de negocio puras sobre la máquina de estados de Solicitud y
 * Aprobador. No conoce DynamoDB ni ningún detalle de AWS: solo recibe
 * datos ya cargados y devuelve decisiones.
 */

const ESTADOS_SOLICITUD = {
  PENDIENTE: "PENDIENTE",
  FIRMAS_COMPLETAS: "FIRMAS_COMPLETAS",
  COMPLETADA: "COMPLETADA",
  RECHAZADA: "RECHAZADA",
};

const ESTADOS_APROBADOR = {
  PENDIENTE: "PENDIENTE",
  FIRMADO: "FIRMADO",
  RECHAZADO: "RECHAZADO",
};

/**
 * Códigos de error de negocio, para que los casos de uso decidan el
 * status HTTP sin acoplar esta capa a Express/API Gateway.
 */
const ERRORES = {
  SOLICITUD_RECHAZADA: "SOLICITUD_RECHAZADA",
  SOLICITUD_TERMINAL: "SOLICITUD_TERMINAL",
  TURNO_INVALIDO: "TURNO_INVALIDO",
  YA_FIRMADO: "YA_FIRMADO",
};

/**
 * Valida si un aprobador con `orden = N` puede firmar o rechazar ahora
 * mismo, según las 3 condiciones definidas en la Fase 1.
 *
 * @param {Object} solicitud - la solicitud completa (con su `estado`)
 * @param {Array}  aprobadores - lista de aprobadores de esa solicitud,
 *                               ya ordenados por `orden` (1, 2, 3)
 * @param {number} orden - el orden del aprobador que intenta actuar
 * @returns {{ permitido: boolean, error?: string, mensaje?: string }}
 */
function validarTurno(solicitud, aprobadores, orden) {
  // 1. La solicitud debe seguir PENDIENTE (no terminal, no rechazada)
  if (solicitud.estado === ESTADOS_SOLICITUD.RECHAZADA) {
    return {
      permitido: false,
      error: ERRORES.SOLICITUD_RECHAZADA,
      mensaje: "Esta solicitud ya fue rechazada",
    };
  }

  if (solicitud.estado !== ESTADOS_SOLICITUD.PENDIENTE) {
    return {
      permitido: false,
      error: ERRORES.SOLICITUD_TERMINAL,
      mensaje: `La solicitud ya está en estado ${solicitud.estado}`,
    };
  }

  // 2. Todos los aprobadores con orden < N deben estar FIRMADO
  const previos = aprobadores.filter((a) => a.orden < orden);
  const previosIncompletos = previos.some(
    (a) => a.estado_firma !== ESTADOS_APROBADOR.FIRMADO
  );
  if (previosIncompletos) {
    return {
      permitido: false,
      error: ERRORES.TURNO_INVALIDO,
      mensaje: "Aún no es tu turno para firmar",
    };
  }

  // 3. El aprobador actual debe estar PENDIENTE (no puede actuar dos veces)
  const actual = aprobadores.find((a) => a.orden === orden);
  if (!actual || actual.estado_firma !== ESTADOS_APROBADOR.PENDIENTE) {
    return {
      permitido: false,
      error: ERRORES.YA_FIRMADO,
      mensaje: "Este aprobador ya registró su decisión",
    };
  }

  return { permitido: true };
}

/**
 * Dado el nuevo estado de un aprobador que acaba de actuar, determina
 * cuál debe ser el siguiente estado de la Solicitud.
 *
 * @param {Array} aprobadoresActualizados - los 3 aprobadores, con el que
 *                                          acaba de actuar ya reflejando
 *                                          su nuevo estado_firma
 * @returns {string} uno de ESTADOS_SOLICITUD
 */
function calcularEstadoSolicitud(aprobadoresActualizados) {
  const hayRechazo = aprobadoresActualizados.some(
    (a) => a.estado_firma === ESTADOS_APROBADOR.RECHAZADO
  );
  if (hayRechazo) {
    return ESTADOS_SOLICITUD.RECHAZADA;
  }

  const todosFirmados = aprobadoresActualizados.every(
    (a) => a.estado_firma === ESTADOS_APROBADOR.FIRMADO
  );
  if (todosFirmados) {
    return ESTADOS_SOLICITUD.FIRMAS_COMPLETAS;
  }

  return ESTADOS_SOLICITUD.PENDIENTE;
}

module.exports = {
  ESTADOS_SOLICITUD,
  ESTADOS_APROBADOR,
  ERRORES,
  validarTurno,
  calcularEstadoSolicitud,
};