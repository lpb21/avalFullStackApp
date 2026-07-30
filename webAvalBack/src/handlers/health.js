const { respuestaJson } = require("./httpHelper");

exports.handler = async () => {
  return respuestaJson(200, {
    status: "ok",
    servicio: "webAvalBack",
    timestamp: new Date().toISOString(),
  });
};