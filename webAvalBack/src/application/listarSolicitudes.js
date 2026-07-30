const solicitudesRepo = require("../infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../infrastructure/repositories/aprobadoresRepository");

/**
 * Caso de uso de GET /solicitudes: lista solicitudes de un solicitante,
 * con un resumen del estado de sus aprobadores (pendientes/firmados/
 * rechazados) para el panel del solicitante.
 */
async function listarSolicitudes(solicitanteEmail) {
  const solicitudes = await solicitudesRepo.listarPorSolicitante(solicitanteEmail);

  const resumenes = await Promise.all(
    solicitudes.map(async (s) => {
      const aprobadores = await aprobadoresRepo.listarAprobadoresPorSolicitud(s.solicitud_id);
      return {
        solicitud_id: s.solicitud_id,
        titulo: s.titulo,
        monto: s.monto,
        estado: s.estado,
        fecha_creacion: s.fecha_creacion,
        aprobadores_count: {
          pendientes: aprobadores.filter((a) => a.estado_firma === "PENDIENTE").length,
          firmados: aprobadores.filter((a) => a.estado_firma === "FIRMADO").length,
          rechazados: aprobadores.filter((a) => a.estado_firma === "RECHAZADO").length,
        },
      };
    })
  );

  return { ok: true, status: 200, body: resumenes };
}

module.exports = { listarSolicitudes };