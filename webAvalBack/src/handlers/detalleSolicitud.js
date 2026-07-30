const { obtenerDetalleSolicitud } = require("../application/obtenerDetalleSolicitud");

const HEADERS_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

exports.obtener = async (event) => {
  try {
    const solicitudId = event.pathParameters && event.pathParameters.solicitud_id;
    const resultado = await obtenerDetalleSolicitud(solicitudId);

    return {
      statusCode: resultado.status,
      headers: HEADERS_CORS,
      body: JSON.stringify(resultado.body),
    };
  } catch (error) {
    console.error("Error en obtenerDetalleSolicitud handler:", error);
    return {
      statusCode: 500,
      headers: HEADERS_CORS,
      body: JSON.stringify({ codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" }),
    };
  }
};