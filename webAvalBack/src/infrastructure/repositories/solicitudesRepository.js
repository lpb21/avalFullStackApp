const { PutCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../dynamoClient");

const TABLE_NAME = "Solicitudes";

/**
 * Crea una nueva solicitud en estado PENDIENTE.
 * Usa condición para evitar sobrescribir si el ID ya existiera (defensivo).
 */
async function crearSolicitud(solicitud) {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: solicitud,
      ConditionExpression: "attribute_not_exists(solicitud_id)",
    })
  );
  return solicitud;
}

/**
 * Obtiene una solicitud por su ID. Devuelve null si no existe.
 */
async function obtenerSolicitudPorId(solicitudId) {
  const resultado = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { solicitud_id: solicitudId },
    })
  );
  return resultado.Item || null;
}

module.exports = { crearSolicitud, obtenerSolicitudPorId };