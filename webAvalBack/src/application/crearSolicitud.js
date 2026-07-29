const { randomUUID } = require("crypto");
const transaccionesRepo = require("../infrastructure/repositories/transaccionesRepository");
const { validarDatosSolicitud } = require("../domain/validacionSolicitud");
const { ESTADOS_SOLICITUD, ESTADOS_APROBADOR } = require("../domain/maquinaEstados");

async function crearSolicitud(input) {
  const { valido, errores } = validarDatosSolicitud(input);
  if (!valido) {
    return { ok: false, errores };
  }

  const solicitudId = randomUUID();
  const fechaCreacion = Date.now();

  const solicitud = {
    solicitud_id: solicitudId,
    titulo: input.titulo,
    descripcion: input.descripcion,
    monto: input.monto,
    solicitante_email: input.solicitante_email,
    solicitante_nombre: input.solicitante_nombre,
    estado: ESTADOS_SOLICITUD.PENDIENTE,
    fecha_creacion: fechaCreacion,
    pdf_key: null,
  };

  const aprobadores = input.aprobadores.map((a, i) => ({
    solicitud_id: solicitudId,
    orden: i + 1,
    approver_id: randomUUID(),
    nombre: a.nombre,
    email: a.email,
    rol: a.rol,
    token: randomUUID(),
    estado_firma: ESTADOS_APROBADOR.PENDIENTE,
    fecha_firma: null,
    hash_firma: null,
    num_otp_generados: 0,
  }));

  await transaccionesRepo.crearSolicitudConAprobadores(solicitud, aprobadores);

  return {
    ok: true,
    solicitud: { ...solicitud, aprobadores },
  };
}

module.exports = { crearSolicitud };