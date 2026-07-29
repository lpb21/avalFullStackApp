const { resolverAprobacion } = require("../application/resolverAprobacion");

const HEADERS_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

exports.resolver = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const solicitudId = params.solicitud_id;
    const approverToken = params.approver_token;

    if (!solicitudId || !approverToken) {
      return {
        statusCode: 400,
        headers: HEADERS_CORS,
        body: JSON.stringify({
          codigo: "PARAMETROS_FALTANTES",
          mensaje: "Se requieren solicitud_id y approver_token",
        }),
      };
    }

    const resultado = await resolverAprobacion({ solicitudId, approverToken });

    return {
      statusCode: resultado.status,
      headers: HEADERS_CORS,
      body: JSON.stringify(resultado.body),
    };
  } catch (error) {
    console.error("Error en resolverAprobacion handler:", error);
    return {
      statusCode: 500,
      headers: HEADERS_CORS,
      body: JSON.stringify({ codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" }),
    };
  }
};