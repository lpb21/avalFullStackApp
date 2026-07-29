
const { randomUUID } = require("crypto");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../dynamoClient");

const TABLE_NAME = "MockMails";

/**
 * Guarda un correo simulado (no se envía nada real, solo se persiste
 * para que /api/v1/mock-mail pueda listarlo).
 */
async function guardarMockMail({ para, asunto, cuerpo }) {
  const mail = {
    mail_id: randomUUID(),
    para,
    asunto,
    cuerpo,
    timestamp: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: mail,
    })
  );

  return mail;
}

/**
 * Lista todos los correos simulados. Usa Scan porque es una bitácora
 * general de bajo volumen (no un patrón de acceso frecuente ni a
 * escala) — un Scan aquí es aceptable; se documenta como tal.
 */
async function listarMockMails() {
  const resultado = await docClient.send(
    new ScanCommand({
      TableName: TABLE_NAME,
    })
  );
  return resultado.Items || [];
}

module.exports = { guardarMockMail, listarMockMails };