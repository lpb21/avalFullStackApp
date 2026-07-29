const { verificarOtp } = require("../application/verificarOtp");

const HEADERS_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

exports.verificar = async (event) => {
  try {
    const input = JSON.parse(event.body || "{}");
    const { solicitud_id, orden, approver_token, codigo } = input;

    if (!solicitud_id || orden === undefined || !approver_token || !codigo) {
      return {
        statusCode: 400,
        headers: HEADERS_CORS,
        body: JSON.stringify({
          codigo: "PARAMETROS_FALTANTES",
          mensaje: "Se requieren solicitud_id, orden, approver_token y codigo",
        }),
      };
    }

    const resultado = await verificarOtp({
      solicitudId: solicitud_id,
      orden,
      approverToken: approver_token,
      codigo,
    });

    return {
      statusCode: resultado.status,
      headers: HEADERS_CORS,
      body: JSON.stringify(resultado.body),
    };
  } catch (error) {
    console.error("Error en verificarOtp handler:", error);
    return {
      statusCode: 500,
      headers: HEADERS_CORS,
      body: JSON.stringify({ codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" }),
    };
  }
};