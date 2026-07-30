const { PutCommand, GetCommand, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../dynamoClient");

const TABLE_NAME = "Solicitudes";
const GSI_SOLICITANTE_EMAIL = "gsi_solicitante_email";

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

async function actualizarEstadoConPdf({ solicitudId, estadoEsperado, nuevoEstado, pdfKey }) {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { solicitud_id: solicitudId },
      UpdateExpression: "SET estado = :nuevo, pdf_key = :pdfKey",
      ConditionExpression: "estado = :esperado",
      ExpressionAttributeValues: {
        ":nuevo": nuevoEstado,
        ":esperado": estadoEsperado,
        ":pdfKey": pdfKey,
      },
    })
  );
}


/**
 * Lista las solicitudes de un solicitante, vía el GSI de su email
 * (evita un Scan completo de la tabla).
 */
async function listarPorSolicitante(solicitanteEmail) {
  const resultado = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI_SOLICITANTE_EMAIL,
      KeyConditionExpression: "solicitante_email = :email",
      ExpressionAttributeValues: {
        ":email": solicitanteEmail,
      },
    })
  );
  return resultado.Items || [];
}

module.exports = { 
    crearSolicitud, 
    obtenerSolicitudPorId, 
    actualizarEstado, 
    actualizarEstadoConPdf,
    listarPorSolicitante };