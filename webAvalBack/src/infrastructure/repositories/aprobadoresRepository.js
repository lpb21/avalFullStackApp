const {
  PutCommand,
  QueryCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../dynamoClient");

const TABLE_NAME = "Aprobadores";
const GSI_TOKEN = "gsi_token";

/**
 * Crea un aprobador para una solicitud (uno de los 3, con su orden 1-3).
 */
async function crearAprobador(aprobador) {
  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: aprobador,
    })
  );
  return aprobador;
}

/**
 * Lista los aprobadores de una solicitud, ya ordenados por `orden`
 * (Query por PK con SK ascendente es el orden natural de DynamoDB).
 */
async function listarAprobadoresPorSolicitud(solicitudId) {
  const resultado = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "solicitud_id = :sid",
      ExpressionAttributeValues: {
        ":sid": solicitudId,
      },
    })
  );
  return resultado.Items || [];
}

/**
 * Resuelve un aprobador por su token único (vía GSI), sin conocer de antemano
 * su solicitud_id ni su orden. Es lo que usa GET /api/v1/approve.
 */
async function buscarAprobadorPorToken(token) {
  const resultado = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      IndexName: GSI_TOKEN,
      KeyConditionExpression: "token = :t",
      ExpressionAttributeValues: {
        ":t": token,
      },
    })
  );
  return resultado.Items && resultado.Items[0] ? resultado.Items[0] : null;
}

/**
 * Marca un aprobador como FIRMADO o RECHAZADO, de forma condicional:
 * solo si estaba PENDIENTE (evita firmas duplicadas / condiciones de carrera).
 */
async function actualizarEstadoFirma({
  solicitudId,
  orden,
  nuevoEstado,
  fechaFirma,
  hashFirma,
}) {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { solicitud_id: solicitudId, orden },
      UpdateExpression:
        "SET estado_firma = :nuevoEstado, fecha_firma = :fechaFirma, hash_firma = :hashFirma",
      ConditionExpression: "estado_firma = :pendiente",
      ExpressionAttributeValues: {
        ":nuevoEstado": nuevoEstado,
        ":fechaFirma": fechaFirma,
        ":hashFirma": hashFirma || null,
        ":pendiente": "PENDIENTE",
      },
    })
  );
}

/**
 * Incrementa el contador de generaciones de OTP y reinicia el estado,
 * de forma condicional: solo si aún no se llegó al límite de 3.
 */
async function incrementarGeneracionesOtp({ solicitudId, orden }) {
  const resultado = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { solicitud_id: solicitudId, orden },
      UpdateExpression: "SET num_otp_generados = num_otp_generados + :uno",
      ConditionExpression: "num_otp_generados < :limite",
      ExpressionAttributeValues: {
        ":uno": 1,
        ":limite": 3,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  return resultado.Attributes;
}

module.exports = {
  crearAprobador,
  listarAprobadoresPorSolicitud,
  buscarAprobadorPorToken,
  actualizarEstadoFirma,
  incrementarGeneracionesOtp,
};