const { listarMockMails } = require("../application/listarMockMails");

const HEADERS_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

exports.listar = async () => {
  try {
    const resultado = await listarMockMails();
    return {
      statusCode: 200,
      headers: HEADERS_CORS,
      body: JSON.stringify(resultado.mails),
    };
  } catch (error) {
    console.error("Error en listarMockMails handler:", error);
    return {
      statusCode: 500,
      headers: HEADERS_CORS,
      body: JSON.stringify({ codigo: "ERROR_INTERNO", mensaje: "Error interno del servidor" }),
    };
  }
};