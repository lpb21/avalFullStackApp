const { createHash } = require("crypto");

const HASH_GENESIS_SEED = "GENESIS";

/**
 * Serializa los datos de la solicitud de forma canónica (determinista):
 * mismo orden de campos siempre, sin importar cómo llegó el objeto
 * (por ejemplo, leído de DynamoDB, donde el orden de atributos no está
 * garantizado). Esto es lo que hace que la cadena sea re-verificable.
 */
function serializarSolicitudCanonico(solicitud) {
  const datosOrdenados = {
    solicitud_id: solicitud.solicitud_id,
    titulo: solicitud.titulo,
    descripcion: solicitud.descripcion,
    monto: solicitud.monto,
    solicitante_email: solicitud.solicitante_email,
    solicitante_nombre: solicitud.solicitante_nombre,
    fecha_creacion: solicitud.fecha_creacion,
  };
  return JSON.stringify(datosOrdenados);
}

function sha256(texto) {
  return createHash("sha256").update(texto).digest("hex");
}

/**
 * Calcula el bloque génesis: el hash inicial del que arranca la cadena,
 * antes de que exista ninguna firma. Sirve como hashAnterior para el
 * aprobador con orden = 1.
 */
function calcularHashGenesis(solicitud) {
  const datosCanonico = serializarSolicitudCanonico(solicitud);
  return sha256(datosCanonico + HASH_GENESIS_SEED);
}

/**
 * Calcula el hash de una firma, encadenado con el hash anterior.
 *
 * hash_firma_N = SHA256(datosSolicitud_canonico + hashAnterior + nombre_N + timestamp_N)
 *
 * @param {Object} solicitud - la solicitud (para la serialización canónica)
 * @param {string} hashAnterior - hash génesis (orden=1) o hash_firma previo
 * @param {string} nombre - nombre del aprobador que firma
 * @param {number} timestamp - fecha_firma (epoch)
 */
function calcularHashFirma({ solicitud, hashAnterior, nombre, timestamp }) {
  const datosCanonico = serializarSolicitudCanonico(solicitud);
  const contenido = `${datosCanonico}${hashAnterior}${nombre}${timestamp}`;
  return sha256(contenido);
}

/**
 * Verifica la integridad de la cadena completa de firmas de una solicitud.
 * Recalcula cada hash desde cero y lo compara con el almacenado. Si algo
 * fue alterado, algún hash posterior dejará de coincidir.
 *
 * @param {Object} solicitud
 * @param {Array} aprobadoresFirmados - los 3 aprobadores, ordenados por
 *                                      `orden`, todos con estado_firma
 *                                      FIRMADO (o al menos hasta donde
 *                                      se quiera verificar)
 * @returns {{ valido: boolean, ordenInvalido?: number }}
 */
function verificarCadena(solicitud, aprobadoresFirmados) {
  let hashAnterior = calcularHashGenesis(solicitud);

  for (const aprobador of aprobadoresFirmados) {
    const hashEsperado = calcularHashFirma({
      solicitud,
      hashAnterior,
      nombre: aprobador.nombre,
      timestamp: aprobador.fecha_firma,
    });

    if (hashEsperado !== aprobador.hash_firma) {
      return { valido: false, ordenInvalido: aprobador.orden };
    }

    hashAnterior = aprobador.hash_firma;
  }

  return { valido: true };
}

module.exports = {
  calcularHashGenesis,
  calcularHashFirma,
  verificarCadena,
  serializarSolicitudCanonico,
};