const { PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../dynamoClient");

const TABLE_NAME = "Solicitudes";

// ... (crearSolicitud y obtenerSolicitudPorId quedan igual) ...

/**
 * Cambia el estado de la solicitud, de forma condicional: solo si el
 * estado actual coincide con el esperado (evita transiciones inválidas
 * por condiciones de carrera, ej. dos firmas casi simultáneas).
 */
async function actualizarEstado({ solicitudId, estadoEsperado, nuevoEstado }) {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { solicitud_id: solicitudId },
      UpdateExpression: "SET estado = :nuevo",
      ConditionExpression: "estado = :esperado",
      ExpressionAttributeValues: {
        ":nuevo": nuevoEstado,
        ":esperado": estadoEsperado,
      },
    })
  );
}

module.exports = { crearSolicitud, obtenerSolicitudPorId, actualizarEstado };