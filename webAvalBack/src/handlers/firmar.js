const { firmarSolicitud } = require("../application/firmarSolicitud");
const { respuestaJson } = require("./httpHelper");

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
      return respuestaJson(401, {
        codigo: "TOKEN_INVALIDO",
        mensaje: "Falta el token de firma (header X-Firma-Token)",
      });
    }

    const input = JSON.parse(event.body || "{}");
    const accion = input.accion;

    if (accion !== "APROBAR" && accion !== "RECHAZAR") {
      return respuestaJson(400, {
        codigo: "ACCION_INVALIDA",
        mensaje: "El campo 'accion' debe ser APROBAR o RECHAZAR",
      });
    }

    const resultado = await firmarSolicitud({ solicitudId, orden, firmaToken, accion });
    return respuestaJson(resultado.status, resultado.body);
  } catch (error) {
    console.error("Error en firmarSolicitud handler:", error);
    return respuestaJson(500, { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" });
  }
};