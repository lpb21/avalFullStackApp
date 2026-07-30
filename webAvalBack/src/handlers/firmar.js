const { firmarSolicitud } = require("../application/firmarSolicitud");

const HEADERS_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function obtenerFirmaToken(event) {
  const headers = event.headers || {};
  return headers["X-Firma-Token"] || headers["x-firma-token"] || null;
}

exports.firmar = async (event) => {
  try {
    const params = event.pathParameters || {};
    const solicitudId = params.solicitud_id;
    const orden = Number(params.orden);
    const firmaToken = obtenerFirmaToken(event);

    if (!firmaToken) {
      return {
        statusCode: 401,
        headers: HEADERS_CORS,
        body: JSON.stringify({
          codigo: "TOKEN_INVALIDO",
          mensaje: "Falta el token de firma (header X-Firma-Token)",
        }),
      };
    }

    const input = JSON.parse(event.body || "{}");
    const accion = input.accion;

    if (accion !== "APROBAR" && accion !== "RECHAZAR") {
      return {
        statusCode: 400,
        headers: HEADERS_CORS,
        body: JSON.stringify({
          codigo: "ACCION_INVALIDA",
          mensaje: "El campo 'accion' debe ser APROBAR o RECHAZAR",
        }),
      };
    }

    const resultado = await firmarSolicitud({ solicitudId, orden, firmaToken, accion });

    return {
      statusCode: resultado.status,
      headers: HEADERS_CORS,
      body: JSON.stringify(resultado.body),
    };
  } catch (error) {
    console.error("Error en firmarSolicitud handler:", error);
    return {
      statusCode: 500,
      headers: HEADERS_CORS,
      body: JSON.stringify({ codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" }),
    };
  }
};