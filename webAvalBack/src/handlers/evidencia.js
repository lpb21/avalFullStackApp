const { obtenerEvidenciaPdf } = require("../application/obtenerEvidenciaPdf");
const { respuestaJson, respuestaRedirect } = require("./httpHelper");

exports.descargar = async (event) => {
  try {
    const solicitudId = event.pathParameters && event.pathParameters.solicitud_id;
    const resultado = await obtenerEvidenciaPdf(solicitudId);

    if (!resultado.ok) {
      return respuestaJson(resultado.status, resultado.body);
    }

    return respuestaRedirect(resultado.url);
  } catch (error) {
    console.error("Error en obtenerEvidenciaPdf handler:", error);
    return respuestaJson(500, { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" });
  }
};