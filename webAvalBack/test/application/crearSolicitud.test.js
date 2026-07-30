jest.mock("../../src/infrastructure/repositories/transaccionesRepository");
jest.mock("../../src/infrastructure/repositories/mockMailsRepository");

const transaccionesRepo = require("../../src/infrastructure/repositories/transaccionesRepository");
const mockMailsRepo = require("../../src/infrastructure/repositories/mockMailsRepository");
const { crearSolicitud } = require("../../src/application/crearSolicitud");

function inputValido(overrides = {}) {
  return {
    titulo: "Compra de laptops",
    descripcion: "20 laptops para el equipo",
    monto: 15000000,
    solicitante_email: "juan.perez@empresa.com",
    solicitante_nombre: "Juan Pérez",
    aprobadores: [
      { nombre: "María Gómez", email: "maria.gomez@empresa.com", rol: "Jefe de Departamento" },
      { nombre: "Carlos Ruiz", email: "carlos.ruiz@empresa.com", rol: "Director Financiero" },
      { nombre: "Ana Torres", email: "ana.torres@empresa.com", rol: "Gerente General" },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("crearSolicitud - validación", () => {
  test("rechaza sin llamar a ningún repositorio si los datos son inválidos", async () => {
    const input = inputValido();
    delete input.titulo;

    const resultado = await crearSolicitud(input);

    expect(resultado.ok).toBe(false);
    expect(resultado.errores.length).toBeGreaterThan(0);
    expect(transaccionesRepo.crearSolicitudConAprobadores).not.toHaveBeenCalled();
  });
});

describe("crearSolicitud - creación exitosa", () => {
  test("genera solicitud_id y token únicos, y persiste vía transacción atómica", async () => {
    transaccionesRepo.crearSolicitudConAprobadores.mockResolvedValue();
    mockMailsRepo.guardarMockMail.mockResolvedValue({});

    const resultado = await crearSolicitud(inputValido(), { baseUrl: "https://api.test.com" });

    expect(resultado.ok).toBe(true);
    expect(resultado.solicitud.solicitud_id).toBeDefined();
    expect(resultado.solicitud.estado).toBe("PENDIENTE");

    const [solicitudArg, aprobadoresArg] =
      transaccionesRepo.crearSolicitudConAprobadores.mock.calls[0];

    expect(aprobadoresArg).toHaveLength(3);
    expect(aprobadoresArg[0].orden).toBe(1);
    expect(aprobadoresArg[1].orden).toBe(2);
    expect(aprobadoresArg[2].orden).toBe(3);

    // Cada aprobador debe tener su propio token único (no repetido)
    const tokens = aprobadoresArg.map((a) => a.token);
    expect(new Set(tokens).size).toBe(3);
  });

  test("envía un mock-mail a cada uno de los 3 aprobadores", async () => {
    transaccionesRepo.crearSolicitudConAprobadores.mockResolvedValue();
    mockMailsRepo.guardarMockMail.mockResolvedValue({});

    await crearSolicitud(inputValido(), { baseUrl: "https://api.test.com" });

    expect(mockMailsRepo.guardarMockMail).toHaveBeenCalledTimes(3);
    expect(mockMailsRepo.guardarMockMail).toHaveBeenCalledWith(
      expect.objectContaining({ para: "maria.gomez@empresa.com" })
    );
    expect(mockMailsRepo.guardarMockMail).toHaveBeenCalledWith(
      expect.objectContaining({ para: "carlos.ruiz@empresa.com" })
    );
    expect(mockMailsRepo.guardarMockMail).toHaveBeenCalledWith(
      expect.objectContaining({ para: "ana.torres@empresa.com" })
    );
  });

  test("el link de aprobación en cada correo usa el baseUrl recibido", async () => {
    transaccionesRepo.crearSolicitudConAprobadores.mockResolvedValue();
    mockMailsRepo.guardarMockMail.mockResolvedValue({});

    await crearSolicitud(inputValido(), { baseUrl: "https://mi-api-de-prueba.com" });

    const primeraLlamada = mockMailsRepo.guardarMockMail.mock.calls[0][0];
    expect(primeraLlamada.cuerpo).toContain("https://mi-api-de-prueba.com/api/v1/approve");
  });
});