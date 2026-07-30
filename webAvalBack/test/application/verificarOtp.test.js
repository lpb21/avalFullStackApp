jest.mock("../../src/infrastructure/repositories/solicitudesRepository");
jest.mock("../../src/infrastructure/repositories/aprobadoresRepository");
jest.mock("../../src/infrastructure/repositories/otpsRepository");
jest.mock("../../src/infrastructure/repositories/sessionTokensRepository");

const solicitudesRepo = require("../../src/infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../../src/infrastructure/repositories/aprobadoresRepository");
const otpsRepo = require("../../src/infrastructure/repositories/otpsRepository");
const sessionTokensRepo = require("../../src/infrastructure/repositories/sessionTokensRepository");
const { verificarOtp } = require("../../src/application/verificarOtp");
const { hashearCodigoOtp } = require("../../src/domain/otp");

const AHORA_SEGUNDOS = Math.floor(Date.now() / 1000);

function aprobador(overrides = {}) {
  return {
    solicitud_id: "sol-1",
    orden: 1,
    token: "token-maria",
    nombre: "María",
    estado_firma: "PENDIENTE",
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

describe("verificarOtp - protección del approver_token (hallazgo de seguridad corregido)", () => {
  test("rechaza con 400 si el approver_token no corresponde a ningún aprobador, SIN comparar el código", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(null);

    const resultado = await verificarOtp({
      solicitudId: "sol-1",
      orden: 1,
      approverToken: "token-invalido",
      codigo: "000000",
    });

    expect(resultado.status).toBe(400);
    expect(resultado.body.codigo).toBe("TOKEN_INVALIDO");
    // El punto clave del hallazgo de seguridad: nunca debe llegar a tocar el OTP
    // si el approver_token no es válido primero.
    expect(otpsRepo.obtenerOtp).not.toHaveBeenCalled();
  });

  test("rechaza con 400 si el approver_token no coincide con el orden indicado", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador({ orden: 2 }));

    const resultado = await verificarOtp({
      solicitudId: "sol-1",
      orden: 1,
      approverToken: "token-maria",
      codigo: "000000",
    });

    expect(resultado.status).toBe(400);
    expect(otpsRepo.obtenerOtp).not.toHaveBeenCalled();
  });
});

describe("verificarOtp - validación de turno y estado", () => {
  test("rechaza con 409 si la solicitud ya está en estado terminal", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud({ estado: "COMPLETADA" }));

    const resultado = await verificarOtp({
      solicitudId: "sol-1",
      orden: 1,
      approverToken: "token-maria",
      codigo: "000000",
    });

    expect(resultado.status).toBe(409);
  });

  test("rechaza con 403 si no es el turno del aprobador", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador({ orden: 2 }));
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());

    const resultado = await verificarOtp({
      solicitudId: "sol-1",
      orden: 2,
      approverToken: "token-carlos",
      codigo: "000000",
    });

    expect(resultado.status).toBe(403);
  });
});

describe("verificarOtp - validación del código", () => {
  test("rechaza con 400 si no hay OTP vigente (expirado o inexistente)", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    otpsRepo.obtenerOtp.mockResolvedValue(null);

    const resultado = await verificarOtp({
      solicitudId: "sol-1",
      orden: 1,
      approverToken: "token-maria",
      codigo: "123456",
    });

    expect(resultado.status).toBe(400);
    expect(resultado.body.codigo).toBe("OTP_INVALIDO");
  });

  test("rechaza con 400 si el código no coincide, e incrementa intentos", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    otpsRepo.obtenerOtp.mockResolvedValue({
      expira_en: AHORA_SEGUNDOS + 100,
      intentos: 0,
      codigo_hash: hashearCodigoOtp("123456"),
    });
    otpsRepo.incrementarIntentos.mockResolvedValue({ intentos: 1 });

    const resultado = await verificarOtp({
      solicitudId: "sol-1",
      orden: 1,
      approverToken: "token-maria",
      codigo: "000000", // código incorrecto
    });

    expect(resultado.status).toBe(400);
    expect(otpsRepo.incrementarIntentos).toHaveBeenCalledWith("sol-1", 1);
  });

  test("responde 429 si el intento fallido agota el límite de 3", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    otpsRepo.obtenerOtp
      .mockResolvedValueOnce({
        expira_en: AHORA_SEGUNDOS + 100,
        intentos: 2,
        codigo_hash: hashearCodigoOtp("123456"),
      })
      .mockResolvedValueOnce({ expira_en: AHORA_SEGUNDOS + 100, intentos: 3 });
    otpsRepo.incrementarIntentos.mockResolvedValue({ intentos: 3 });

    const resultado = await verificarOtp({
      solicitudId: "sol-1",
      orden: 1,
      approverToken: "token-maria",
      codigo: "000000",
    });

    expect(resultado.status).toBe(429);
    expect(resultado.body.codigo).toBe("LIMITE_INTENTOS_SUPERADO");
  });

  test("si el código es correcto, elimina el OTP y emite un firma_token", async () => {
    aprobadoresRepo.buscarAprobadorPorToken.mockResolvedValue(aprobador());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitud());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    otpsRepo.obtenerOtp.mockResolvedValue({
      expira_en: AHORA_SEGUNDOS + 100,
      intentos: 0,
      codigo_hash: hashearCodigoOtp("123456"),
    });
    otpsRepo.eliminarOtp.mockResolvedValue();
    sessionTokensRepo.crearFirmaToken.mockResolvedValue({
      expira_en: AHORA_SEGUNDOS + 300,
    });

    const resultado = await verificarOtp({
      solicitudId: "sol-1",
      orden: 1,
      approverToken: "token-maria",
      codigo: "123456",
    });

    expect(resultado.status).toBe(200);
    expect(resultado.body.firma_token).toBeDefined();
    expect(otpsRepo.eliminarOtp).toHaveBeenCalledWith("sol-1", 1);
    expect(sessionTokensRepo.crearFirmaToken).toHaveBeenCalled();
  });
});