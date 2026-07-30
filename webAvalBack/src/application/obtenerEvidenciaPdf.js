const solicitudesRepo = require("../infrastructure/repositories/solicitudesRepository");
const pdfStorageRepo = require("../infrastructure/repositories/pdfStorageRepository");
const { ESTADOS_SOLICITUD } = require("../domain/maquinaEstados");

/**
 * Caso de uso de GET /evidencia.pdf: si la solicitud está COMPLETADA y
 * tiene pdf_key, genera una URL prefirmada temporal de S3 para descargar.
 */
async function obtenerEvidenciaPdf(solicitudId) {
  const solicitud = await solicitudesRepo.obtenerSolicitudPorId(solicitudId);

  if (!solicitud) {
    return {
      ok: false,
      status: 404,
      body: { codigo: "SOLICITUD_NO_ENCONTRADA", mensaje: "Solicitud no encontrada" },
    };
  }

  if (solicitud.estado !== ESTADOS_SOLICITUD.COMPLETADA || !solicitud.pdf_key) {
    return {
      ok: false,
      status: 409,
      body: { codigo: "PDF_NO_DISPONIBLE", mensaje: "Solicitud no completada aún" },
    };
  }

  const url = await pdfStorageRepo.generarUrlDescarga(solicitud.pdf_key);

  return { ok: true, status: 302, url };
}

module.exports = { obtenerEvidenciaPdf };