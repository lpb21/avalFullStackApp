const { obtenerDetalleSolicitud } = require("../application/obtenerDetalleSolicitud");
const { respuestaJson } = require("./httpHelper");

exports.obtener = async (event) => {
  try {
    const solicitudId = event.pathParameters && event.pathParameters.solicitud_id;
    const resultado = await obtenerDetalleSolicitud(solicitudId);
    return respuestaJson(resultado.status, resultado.body);
  } catch (error) {
    console.error("Error en obtenerDetalleSolicitud handler:", error);
    return respuestaJson(500, { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" });
  }
};