const { listarMockMails } = require("../application/listarMockMails");
const { respuestaJson } = require("./httpHelper");

exports.listar = async () => {
  try {
    const resultado = await listarMockMails();
    return respuestaJson(200, resultado.mails);
  } catch (error) {
    console.error("Error en listarMockMails handler:", error);
    return respuestaJson(500, { codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" });
  }
};