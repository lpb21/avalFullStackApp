const { crearSolicitud } = require("../application/crearSolicitud");

const HEADERS_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

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
      return {
        statusCode: 400,
        headers: HEADERS_CORS,
        body: JSON.stringify({
          codigo: "VALIDACION_FALLIDA",
          mensaje: "Datos inválidos",
          errores: resultado.errores,
        }),
      };
    }

    return {
      statusCode: 201,
      headers: HEADERS_CORS,
      body: JSON.stringify({
        solicitud_id: resultado.solicitud.solicitud_id,
        estado: resultado.solicitud.estado,
        mensaje: "Solicitud creada. Se enviaron los links a los aprobadores.",
      }),
    };
  } catch (error) {
    console.error("Error en crearSolicitud handler:", error);
    return {
      statusCode: 500,
      headers: HEADERS_CORS,
      body: JSON.stringify({ codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" }),
    };
  }
};