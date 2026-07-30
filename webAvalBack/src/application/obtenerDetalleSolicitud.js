const solicitudesRepo = require("../infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../infrastructure/repositories/aprobadoresRepository");

/**
 * Caso de uso de GET /solicitudes/{id}: trae la solicitud y sus
 * aprobadores (ya ordenados por `orden`, gracias al Query por SK).
 */
async function obtenerDetalleSolicitud(solicitudId) {
  const solicitud = await solicitudesRepo.obtenerSolicitudPorId(solicitudId);

  if (!solicitud) {
    return {
      ok: false,
      status: 404,
      body: { codigo: "SOLICITUD_NO_ENCONTRADA", mensaje: "Solicitud no encontrada" },
    };
  }

  const aprobadores = await aprobadoresRepo.listarAprobadoresPorSolicitud(solicitudId);

  return {
    ok: true,
    status: 200,
    body: { solicitud, aprobadores },
  };
}

module.exports = { obtenerDetalleSolicitud };