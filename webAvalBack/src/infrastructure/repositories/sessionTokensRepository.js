const { PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../dynamoClient");

const TABLE_NAME = "SessionTokens";
const DURACION_FIRMA_TOKEN_SEGUNDOS = 300; // 5 minutos

/**
 * Crea un token de firma de un solo uso, emitido tras validar el OTP.
 */
async function crearFirmaToken({ firmaToken, solicitudId, orden }) {
  const expiraEn = Math.floor(Date.now() / 1000) + DURACION_FIRMA_TOKEN_SEGUNDOS;

  const item = {
    firma_token: firmaToken,
    solicitud_id: solicitudId,
    orden,
    usado: false,
    expira_en: expiraEn,
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: item,
    })
  );

  return item;
}

/**
 * Obtiene un token de firma por su valor. Devuelve null si no existe.
 * NO valida expiración ni uso aquí: eso es responsabilidad del caso de uso.
 */
async function obtenerFirmaToken(firmaToken) {
  const resultado = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { firma_token: firmaToken },
    })
  );
  return resultado.Item || null;
}

/**
 * Marca un token como usado, de forma condicional: solo si aún no se
 * había consumido (garantiza el "un solo uso" incluso ante peticiones
 * simultáneas con el mismo token).
 */
async function marcarFirmaTokenComoUsado(firmaToken) {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { firma_token: firmaToken },
      UpdateExpression: "SET usado = :true",
      ConditionExpression: "usado = :false",
      ExpressionAttributeValues: {
        ":true": true,
        ":false": false,
      },
    })
  );
}

module.exports = {
  crearFirmaToken,
  obtenerFirmaToken,
  marcarFirmaTokenComoUsado,
  DURACION_FIRMA_TOKEN_SEGUNDOS,
};