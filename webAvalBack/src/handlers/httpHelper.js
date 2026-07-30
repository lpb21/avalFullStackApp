const HEADERS_CORS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

/**
 * Construye una respuesta JSON estándar para API Gateway, con los
 * headers CORS ya incluidos.
 */
function respuestaJson(statusCode, body) {
  return {
    statusCode,
    headers: HEADERS_CORS,
    body: JSON.stringify(body),
  };
}

/**
 * Construye una respuesta de redirección (302) con el header Location,
 * usada por el endpoint de descarga de PDF.
 */
function respuestaRedirect(url) {
  return {
    statusCode: 302,
    headers: {
      Location: url,
      "Access-Control-Allow-Origin": "*",
    },
    body: "",
  };
}

module.exports = { HEADERS_CORS, respuestaJson, respuestaRedirect };