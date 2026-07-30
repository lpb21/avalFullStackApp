const { obtenerEvidenciaPdf } = require("../application/obtenerEvidenciaPdf");

const HEADERS_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

exports.descargar = async (event) => {
  try {
    const solicitudId = event.pathParameters && event.pathParameters.solicitud_id;

    const resultado = await obtenerEvidenciaPdf(solicitudId);

    if (!resultado.ok) {
      return {
        statusCode: resultado.status,
        headers: HEADERS_CORS,
        body: JSON.stringify(resultado.body),
      };
    }

    return {
      statusCode: 302,
      headers: {
        Location: resultado.url,
        "Access-Control-Allow-Origin": "*",
      },
      body: "",
    };
  } catch (error) {
    console.error("Error en obtenerEvidenciaPdf handler:", error);
    return {
      statusCode: 500,
      headers: HEADERS_CORS,
      body: JSON.stringify({ codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" }),
    };
  }
};