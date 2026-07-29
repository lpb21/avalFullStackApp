/**
 * Health check: confirma que la Lambda + API Gateway responden.
 * No toca base de datos ni lógica de negocio; solo valida el ciclo de despliegue.
 */
exports.handler = async () => {
  return {
    statusCode: 200,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      status: "ok",
      servicio: "webAvalBack",
      timestamp: new Date().toISOString(),
    }),
  };
};