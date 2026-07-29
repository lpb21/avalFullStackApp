const {
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
} = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../dynamoClient");

const TABLE_NAME = "OTPs";
const DURACION_OTP_SEGUNDOS = 180; // 3 minutos

/**
 * Crea (o sobrescribe) el OTP de un aprobador. Se usa tanto en la primera
 * generación como en una regeneración (el Put reemplaza el ítem completo,
 * reiniciando intentos a 0).
 */
async function crearOtp({ solicitudId, orden, codigoHash }) {
  const expiraEn = Math.floor(Date.now() / 1000) + DURACION_OTP_SEGUNDOS;

  const otp = {
    solicitud_id: solicitudId,
    orden,
    codigo_hash: codigoHash,
    expira_en: expiraEn,
    intentos: 0,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: otp,
    })
  );

  return otp;
}

/**
 * Obtiene el OTP vigente de un aprobador, si existe. Devuelve null si no
 * hay ítem. NO valida expiración aquí: eso es responsabilidad del caso de
 * uso, que compara expira_en contra el tiempo actual (el TTL de DynamoDB
 * es solo limpieza, no la fuente de verdad).
 */
async function obtenerOtp(solicitudId, orden) {
  const resultado = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { solicitud_id: solicitudId, orden },
    })
  );
  return resultado.Item || null;
}

/**
 * Incrementa el contador de intentos fallidos, de forma condicional:
 * solo si aún no se llegó al límite de 3 (evita condiciones de carrera
 * en validaciones simultáneas del mismo OTP).
 */
async function incrementarIntentos(solicitudId, orden) {
  const resultado = await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { solicitud_id: solicitudId, orden },
      UpdateExpression: "SET intentos = intentos + :uno",
      ConditionExpression: "intentos < :limite",
      ExpressionAttributeValues: {
        ":uno": 1,
        ":limite": 3,
      },
      ReturnValues: "ALL_NEW",
    })
  );
  return resultado.Attributes;
}

/**
 * Elimina el OTP tras un uso exitoso (validado correctamente), para que
 * no quede reutilizable aunque aún no haya expirado.
 */
async function eliminarOtp(solicitudId, orden) {
  await docClient.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { solicitud_id: solicitudId, orden },
    })
  );
}

module.exports = {
  crearOtp,
  obtenerOtp,
  incrementarIntentos,
  eliminarOtp,
  DURACION_OTP_SEGUNDOS,
};