const { verificarOtp } = require("../application/verificarOtp");
const { respuestaJson } = require("./httpHelper");

exports.verificar = async (event) => {
  try {
    const input = JSON.parse(event.body || "{}");
    const { solicitud_id, orden, approver_token, codigo } = input;

    if (!solicitud_id || orden === undefined || !approver_token || !codigo) {
      return respuestaJson(400, {
        codigo: "PARAMETROS_FALTANTES",
        mensaje: "Se requieren solicitud_id, orden, approver_token y codigo",
      });
    }

    const resultado = await verificarOtp({
      solicitudId: solicitud_id,
      orden,
      approverToken: approver_token,
      codigo,
    });

    return respuestaJson(resultado.status, resultado.body);
  } catch (error) {
    console.error("Error en verificarOtp handler:", error);
    return respuestaJson(500, { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" });
  }
};