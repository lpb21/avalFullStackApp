const { resolverAprobacion } = require("../application/resolverAprobacion");
const { respuestaJson } = require("./httpHelper");

exports.resolver = async (event) => {
  try {
    const params = event.queryStringParameters || {};
    const solicitudId = params.solicitud_id;
    const approverToken = params.approver_token;

    if (!solicitudId || !approverToken) {
      return respuestaJson(400, {
        codigo: "PARAMETROS_FALTANTES",
        mensaje: "Se requieren solicitud_id y approver_token",
      });
    }

    const resultado = await resolverAprobacion({ solicitudId, approverToken });
    return respuestaJson(resultado.status, resultado.body);
  } catch (error) {
    console.error("Error en resolverAprobacion handler:", error);
    return respuestaJson(500, { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" });
  }
};