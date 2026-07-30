const { crearSolicitud } = require("../application/crearSolicitud");
const { listarSolicitudes } = require("../application/listarSolicitudes");
const { respuestaJson } = require("./httpHelper");

function obtenerBaseUrl(event) {
  const host = event.headers && (event.headers.Host || event.headers.host);
  const stage = event.requestContext && event.requestContext.stage;
  if (host && stage) {
    return `https://${host}/${stage}`;
  }
  return "http://localhost:3000";
}

exports.crear = async (event) => {
  try {
    const input = JSON.parse(event.body || "{}");
    const baseUrl = obtenerBaseUrl(event);
    const resultado = await crearSolicitud(input, { baseUrl });

    if (!resultado.ok) {
      return respuestaJson(400, {
        codigo: "VALIDACION_FALLIDA",
        mensaje: "Datos inválidos",
        errores: resultado.errores,
      });
    }

    return respuestaJson(201, {
      solicitud_id: resultado.solicitud.solicitud_id,
      estado: resultado.solicitud.estado,
      mensaje: "Solicitud creada. Se enviaron los links a los aprobadores.",
    });
  } catch (error) {
    console.error("Error en crearSolicitud handler:", error);
    return respuestaJson(500, { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" });
  }
};

exports.listar = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const solicitanteEmail = params.solicitante_email;

    if (!solicitanteEmail) {
      return respuestaJson(400, {
        codigo: "PARAMETROS_FALTANTES",
        mensaje: "Se requiere el parámetro solicitante_email",
      });
    }

    const resultado = await listarSolicitudes(solicitanteEmail);
    return respuestaJson(resultado.status, resultado.body);
  } catch (error) {
    console.error("Error en listarSolicitudes handler:", error);
    return respuestaJson(500, { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" });
  }
};