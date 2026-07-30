jest.mock("../../src/infrastructure/repositories/solicitudesRepository");
jest.mock("../../src/infrastructure/repositories/aprobadoresRepository");
jest.mock("../../src/infrastructure/repositories/otpsRepository");
jest.mock("../../src/infrastructure/repositories/mockMailsRepository");

const solicitudesRepo = require("../../src/infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../../src/infrastructure/repositories/aprobadoresRepository");
const otpsRepo = require("../../src/infrastructure/repositories/otpsRepository");
const mockMailsRepo = require("../../src/infrastructure/repositories/mockMailsRepository");
const { resolverAprobacion } = require("../../src/application/resolverAprobacion");

const AHORA_SEGUNDOS = Math.floor(Date.now() / 1000);

function aprobador(overrides = {}) {
  return {
    solicitud_id: "sol-1",
    orden: 1,
    token: "token-maria",
    email: "maria@empresa.com",
    nombre: "María",
    estado_firma: "PENDIENTE",
    num_otp_generados: 0,
    ...overrides,
  };
}

function solicitud(overrides = {}) {
  return { solicitud_id: "sol-1", titulo: "Compra de prueba", estado: "PENDIENTE", ...overrides };
}

function aprobadoresBase(overrides = []) {
  const base = [
    aprobador({ orden: 1 }),
    { orden: 2, estado_firma: "PENDIENTE" },
    { orden: 3, estado_firma: "PENDIENTE" },
  ];
  overrides.forEach((o) => Object.assign(base.find((a) => a.orden === o.orden), o));
  return base;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("resolverAprobacion - validaciones básicas", () => {
  test("rechaza con 400 si el token no corresponde a ningún aprobador", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(null);

    const resultado = await resolverAprobacion({ solicitudId: "sol-1", approverToken: "x" });

    expect(resultado.status).toBe(400);
  });

  test("rechaza con 400 si el token no corresponde a esta solicitud", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(
      aprobador({ solicitud_id: "otra-solicitud" })
    );

    const resultado = await resolverAprobacion({ solicitudId: "sol-1", approverToken: "x" });

    expect(resultado.status).toBe(400);
  });

  test("rechaza con 409 si la solicitud ya está RECHAZADA", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud({ estado: "RECHAZADA" }));

    const resultado = await resolverAprobacion({ solicitudId: "sol-1", approverToken: "x" });

    expect(resultado.status).toBe(409);
    expect(resultado.body.codigo).toBe("SOLICITUD_RECHAZADA");
  });

  test("rechaza con 403 si aún no es el turno del aprobador", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador({ orden: 2 }));
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());

    const resultado = await resolverAprobacion({ solicitudId: "sol-1", approverToken: "x" });

    expect(resultado.status).toBe(403);
  });
});

describe("resolverAprobacion - decisión de OTP", () => {
  test("REUTILIZA el OTP si ya hay uno vigente (no consume generación)", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    otpsRepo.obtenerOtp.mockResolvedValue({ expira_en: AHORA_SEGUNDOS + 100, intentos: 0 });

    const resultado = await resolverAprobacion({ solicitudId: "sol-1", approverToken: "x" });

    expect(resultado.status).toBe(200);
    expect(otpsRepo.crearOtp).not.toHaveBeenCalled();
    expect(aprobadoresRepo.incrementarGeneracionesOtp).not.toHaveBeenCalled();
  });

  test("GENERA un OTP nuevo y lo guarda como mock-mail si no hay uno vigente", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    otpsRepo.obtenerOtp.mockResolvedValue(null);
    aprobadoresRepo.incrementarGeneracionesOtp.mockResolvedValue({ num_otp_generados: 1 });
    otpsRepo.crearOtp.mockResolvedValue({});
    mockMailsRepo.guardarMockMail.mockResolvedValue({});

    const resultado = await resolverAprobacion({ solicitudId: "sol-1", approverToken: "x" });

    expect(resultado.status).toBe(200);
    expect(otpsRepo.crearOtp).toHaveBeenCalled();
    expect(mockMailsRepo.guardarMockMail).toHaveBeenCalledWith(
      expect.objectContaining({ para: "maria@empresa.com" })
    );
  });

  test("responde 429 si ya se agotaron las 3 generaciones (deadlock resuelto)", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(
      aprobador({ num_otp_generados: 3 })
    );
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    // OTP existente pero con intentos agotados: no es "vigente" y no quedan generaciones
    otpsRepo.obtenerOtp.mockResolvedValue({ expira_en: AHORA_SEGUNDOS + 100, intentos: 3 });

    const resultado = await resolverAprobacion({ solicitudId: "sol-1", approverToken: "x" });

    expect(resultado.status).toBe(429);
    expect(otpsRepo.crearOtp).not.toHaveBeenCalled();
  });
});