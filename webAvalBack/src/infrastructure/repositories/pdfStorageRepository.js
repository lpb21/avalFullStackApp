const { PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { S3Client } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3Client = new S3Client({});
const BUCKET_NAME = process.env.BUCKET_EVIDENCIAS;
const URL_EXPIRACION_SEGUNDOS = 300; // 5 minutos

/**
 * Sube el PDF de evidencia a S3. La key sigue el patrón
 * evidencias/{solicitud_id}.pdf para que sea predecible y única.
 */
async function subirPdf({ solicitudId, bytesPdf }) {
  const key = `evidencias/${solicitudId}.pdf`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: bytesPdf,
      ContentType: "application/pdf",
    })
  );

  return key;
}

/**
 * Genera una URL prefirmada temporal para descargar el PDF, sin exponer
 * el bucket públicamente (coherente con la decisión de seguridad de la
 * Fase 1: el bucket está privado, el acceso es solo por URL firmada).
 */
async function generarUrlDescarga(key) {
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  const url = await getSignedUrl(s3Client, command, {
    expiresIn: URL_EXPIRACION_SEGUNDOS,
  });

  return url;
}

module.exports = { subirPdf, generarUrlDescarga };