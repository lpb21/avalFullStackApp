jest.mock("../../src/infrastructure/repositories/solicitudesRepository");
jest.mock("../../src/infrastructure/repositories/aprobadoresRepository");
jest.mock("../../src/infrastructure/repositories/sessionTokensRepository");
jest.mock("../../src/infrastructure/pdfGenerator");
jest.mock("../../src/infrastructure/repositories/pdfStorageRepository");

const solicitudesRepo = require("../../src/infrastructure/repositories/solicitudesRepository");
const aprobadoresRepo = require("../../src/infrastructure/repositories/aprobadoresRepository");
const sessionTokensRepo = require("../../src/infrastructure/repositories/sessionTokensRepository");
const { generarPdfEvidencia } = require("../../src/infrastructure/pdfGenerator");
const pdfStorageRepo = require("../../src/infrastructure/repositories/pdfStorageRepository");
const { firmarSolicitud } = require("../../src/application/firmarSolicitud");

const AHORA_SEGUNDOS = Math.floor(Date.now() / 1000);

function tokenValido(overrides = {}) {
  return {
    firma_token: "firma-token-1",
    solicitud_id: "sol-1",
    orden: 1,
    usado: false,
    expira_en: AHORA_SEGUNDOS + 100,
    ...overrides,
  };
}

function solicitudPendiente(overrides = {}) {
  return {
    solicitud_id: "sol-1",
    titulo: "Compra de prueba",
    estado: "PENDIENTE",
    ...overrides,
  };
}

function aprobadoresBase(overrides = []) {
  const base = [
    { orden: 1, nombre: "María", estado_firma: "PENDIENTE", hash_firma: null },
    { orden: 2, nombre: "Carlos", estado_firma: "PENDIENTE", hash_firma: null },
    { orden: 3, nombre: "Ana", estado_firma: "PENDIENTE", hash_firma: null },
  ];
  overrides.forEach((o) => Object.assign(base.find((a) => a.orden === o.orden), o));
  return base;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("firmarSolicitud - validaciones de token", () => {
  test("rechaza con 401 si el firma_token no existe", async () => {
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(null);

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 1,
      firmaToken: "no-existe",
      accion: "APROBAR",
    });

    expect(resultado.status).toBe(401);
    expect(resultado.body.codigo).toBe("TOKEN_INVALIDO");
  });

  test("rechaza con 401 si el token ya fue usado", async () => {
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(tokenValido({ usado: true }));

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 1,
      firmaToken: "firma-token-1",
      accion: "APROBAR",
    });

    expect(resultado.status).toBe(401);
  });

  test("rechaza con 401 si el token expiró", async () => {
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(
      tokenValido({ expira_en: AHORA_SEGUNDOS - 10 })
    );

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 1,
      firmaToken: "firma-token-1",
      accion: "APROBAR",
    });

    expect(resultado.status).toBe(401);
  });

  test("rechaza con 401 si el token no corresponde a esta solicitud/orden", async () => {
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(tokenValido({ orden: 2 }));

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 1,
      firmaToken: "firma-token-1",
      accion: "APROBAR",
    });

    expect(resultado.status).toBe(401);
  });
});

describe("firmarSolicitud - RECHAZAR", () => {
  test("rechaza la solicitud completa cuando la acción es RECHAZAR", async () => {
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(tokenValido());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitudPendiente());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    sessionTokensRepo.marcarFirmaTokenComoUsado.mockResolvedValue();
    aprobadoresRepo.actualizarEstadoFirma.mockResolvedValue();
    solicitudesRepo.actualizarEstado.mockResolvedValue();

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 1,
      firmaToken: "firma-token-1",
      accion: "RECHAZAR",
    });

    expect(resultado.status).toBe(200);
    expect(resultado.body.solicitud_estado).toBe("RECHAZADA");
    expect(aprobadoresRepo.actualizarEstadoFirma).toHaveBeenCalledWith(
      expect.objectContaining({ nuevoEstado: "RECHAZADO", hashFirma: null })
    );
    expect(solicitudesRepo.actualizarEstado).toHaveBeenCalledWith(
      expect.objectContaining({ nuevoEstado: "RECHAZADA" })
    );
  });
});

describe("firmarSolicitud - APROBAR (hash chain)", () => {
  test("el aprobador de orden 1 usa el hash génesis (no hay anterior)", async () => {
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(tokenValido());
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitudPendiente());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());
    sessionTokensRepo.marcarFirmaTokenComoUsado.mockResolvedValue();
    aprobadoresRepo.actualizarEstadoFirma.mockResolvedValue();

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 1,
      firmaToken: "firma-token-1",
      accion: "APROBAR",
    });

    expect(resultado.status).toBe(200);
    expect(resultado.body.solicitud_estado).toBe("PENDIENTE"); // faltan 2 y 3
    const llamada = aprobadoresRepo.actualizarEstadoFirma.mock.calls[0][0];
    expect(llamada.hashFirma).toMatch(/^[a-f0-9]{64}$/);
  });

  test("el aprobador de orden 2 encadena con el hash_firma del aprobador 1", async () => {
    const hashDeMaria = "a".repeat(64);
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(
      tokenValido({ firma_token: "firma-token-2", orden: 2 })
    );
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitudPendiente());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(
      aprobadoresBase([{ orden: 1, estado_firma: "FIRMADO", hash_firma: hashDeMaria }])
    );
    sessionTokensRepo.marcarFirmaTokenComoUsado.mockResolvedValue();
    aprobadoresRepo.actualizarEstadoFirma.mockResolvedValue();

    await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 2,
      firmaToken: "firma-token-2",
      accion: "APROBAR",
    });

    const llamada = aprobadoresRepo.actualizarEstadoFirma.mock.calls[0][0];
    // El hash de orden 2 debe ser distinto al de orden 1 (no reutiliza el génesis)
    expect(llamada.hashFirma).not.toBe(hashDeMaria);
    expect(llamada.hashFirma).toMatch(/^[a-f0-9]{64}$/);
  });

  test("bloquea con 403/409 si el turno no es válido", async () => {
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(
      tokenValido({ firma_token: "firma-token-2", orden: 2 })
    );
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitudPendiente());
    // orden 1 sigue PENDIENTE: orden 2 no puede firmar todavía
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(aprobadoresBase());

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 2,
      firmaToken: "firma-token-2",
      accion: "APROBAR",
    });

    expect(resultado.status).toBe(403);
    expect(aprobadoresRepo.actualizarEstadoFirma).not.toHaveBeenCalled();
  });

  test("al completar la 3ra firma, genera el PDF y pasa a COMPLETADA", async () => {
    const hashCarlos = "b".repeat(64);
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(
      tokenValido({ firma_token: "firma-token-3", orden: 3 })
    );
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitudPendiente());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(
      aprobadoresBase([
        { orden: 1, estado_firma: "FIRMADO", hash_firma: "a".repeat(64) },
        { orden: 2, estado_firma: "FIRMADO", hash_firma: hashCarlos },
      ])
    );
    sessionTokensRepo.marcarFirmaTokenComoUsado.mockResolvedValue();
    aprobadoresRepo.actualizarEstadoFirma.mockResolvedValue();
    solicitudesRepo.actualizarEstado.mockResolvedValue();
    generarPdfEvidencia.mockResolvedValue(Buffer.from("pdf-simulado"));
    pdfStorageRepo.subirPdf.mockResolvedValue("evidencias/sol-1.pdf");
    solicitudesRepo.actualizarEstadoConPdf.mockResolvedValue();

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 3,
      firmaToken: "firma-token-3",
      accion: "APROBAR",
    });

    expect(resultado.status).toBe(200);
    expect(resultado.body.solicitud_estado).toBe("COMPLETADA");
    expect(generarPdfEvidencia).toHaveBeenCalled();
    expect(pdfStorageRepo.subirPdf).toHaveBeenCalled();
    expect(solicitudesRepo.actualizarEstadoConPdf).toHaveBeenCalledWith(
      expect.objectContaining({ nuevoEstado: "COMPLETADA", pdfKey: "evidencias/sol-1.pdf" })
    );
  });

  test("si falla la generación del PDF, queda en FIRMAS_COMPLETAS (no COMPLETADA sin pdf_key)", async () => {
    sessionTokensRepo.obtenerFirmaToken.mockResolvedValue(
      tokenValido({ firma_token: "firma-token-3", orden: 3 })
    );
    solicitudesRepo.obtenerSolicitudPorId.mockResolvedValue(solicitudPendiente());
    aprobadoresRepo.listarAprobadoresPorSolicitud.mockResolvedValue(
      aprobadoresBase([
        { orden: 1, estado_firma: "FIRMADO", hash_firma: "a".repeat(64) },
        { orden: 2, estado_firma: "FIRMADO", hash_firma: "b".repeat(64) },
      ])
    );
    sessionTokensRepo.marcarFirmaTokenComoUsado.mockResolvedValue();
    aprobadoresRepo.actualizarEstadoFirma.mockResolvedValue();
    solicitudesRepo.actualizarEstado.mockResolvedValue();
    generarPdfEvidencia.mockRejectedValue(new Error("Fallo simulado de generación de PDF"));

    const resultado = await firmarSolicitud({
      solicitudId: "sol-1",
      orden: 3,
      firmaToken: "firma-token-3",
      accion: "APROBAR",
    });

    expect(resultado.status).toBe(200); // la firma sí se registró
    expect(resultado.body.solicitud_estado).toBe("FIRMAS_COMPLETAS"); // pero no llegó a COMPLETADA
    expect(solicitudesRepo.actualizarEstadoConPdf).not.toHaveBeenCalled();
  });
});