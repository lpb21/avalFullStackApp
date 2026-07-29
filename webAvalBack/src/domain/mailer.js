/**
 * Construye el contenido de la notificación de aprobación (simulada).
 * No envía nada: solo arma el objeto que luego el caso de uso persiste
 * vía mockMailsRepository.
 */
function construirCorreoAprobacion({ solicitud, aprobador, baseUrl }) {
  const link = `${baseUrl}/api/v1/approve?solicitud_id=${solicitud.solicitud_id}&approver_token=${aprobador.token}`;

  return {
    para: aprobador.email,
    asunto: `Aprobación requerida: ${solicitud.titulo}`,
    cuerpo:
      `Hola ${aprobador.nombre},\n\n` +
      `Se requiere tu aprobación (rol: ${aprobador.rol}) para la solicitud "${solicitud.titulo}".\n` +
      `Monto: ${solicitud.monto}\n\n` +
      `Ingresa al siguiente link para revisar y firmar:\n${link}\n\n` +
      `Este link es único y personal, no lo compartas.`,
  };
}

module.exports = { construirCorreoAprobacion };