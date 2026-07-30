const {
  calcularHashGenesis,
  calcularHashFirma,
  verificarCadena,
  serializarSolicitudCanonico,
} = require("../../src/domain/hashChain");

const solicitudBase = {
  solicitud_id: "abc-123",
  titulo: "Compra de prueba",
  descripcion: "Descripción de prueba",
  monto: 1000000,
  solicitante_email: "test@empresa.com",
  solicitante_nombre: "Juan Pérez",
  fecha_creacion: 1700000000000,
};

describe("serializarSolicitudCanonico", () => {
  test("produce el mismo string sin importar el orden de las propiedades del objeto de entrada", () => {
    const solicitudOrdenAlterado = {
      fecha_creacion: solicitudBase.fecha_creacion,
      monto: solicitudBase.monto,
      solicitud_id: solicitudBase.solicitud_id,
      titulo: solicitudBase.titulo,
      solicitante_nombre: solicitudBase.solicitante_nombre,
      descripcion: solicitudBase.descripcion,
      solicitante_email: solicitudBase.solicitante_email,
    };

    expect(serializarSolicitudCanonico(solicitudBase)).toBe(
      serializarSolicitudCanonico(solicitudOrdenAlterado)
    );
  });

  test("produce un string distinto si cambia cualquier dato", () => {
    const solicitudModificada = { ...solicitudBase, monto: 2000000 };
    expect(serializarSolicitudCanonico(solicitudBase)).not.toBe(
      serializarSolicitudCanonico(solicitudModificada)
    );
  });
});

describe("calcularHashGenesis", () => {
  test("es determinista: la misma solicitud siempre da el mismo hash génesis", () => {
    const hash1 = calcularHashGenesis(solicitudBase);
    const hash2 = calcularHashGenesis(solicitudBase);
    expect(hash1).toBe(hash2);
  });

  test("tiene el formato de un SHA256 (64 caracteres hexadecimales)", () => {
    const hash = calcularHashGenesis(solicitudBase);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("calcularHashFirma", () => {
  test("el hash de orden 1 depende del hash génesis, no de datos arbitrarios", () => {
    const hashGenesis = calcularHashGenesis(solicitudBase);
    const hashFirma1 = calcularHashFirma({
      solicitud: solicitudBase,
      hashAnterior: hashGenesis,
      nombre: "María Gómez",
      timestamp: 1700000100000,
    });
    expect(hashFirma1).toMatch(/^[a-f0-9]{64}$/);
    expect(hashFirma1).not.toBe(hashGenesis);
  });

  test("dos firmas con distinto nombre producen hashes distintos", () => {
    const hashGenesis = calcularHashGenesis(solicitudBase);
    const paramsComunes = {
      solicitud: solicitudBase,
      hashAnterior: hashGenesis,
      timestamp: 1700000100000,
    };
    const hashMaria = calcularHashFirma({ ...paramsComunes, nombre: "María Gómez" });
    const hashCarlos = calcularHashFirma({ ...paramsComunes, nombre: "Carlos Ruiz" });
    expect(hashMaria).not.toBe(hashCarlos);
  });

  test("el mismo aprobador con distinto hashAnterior produce hashes distintos (efecto cadena)", () => {
    const hashGenesis = calcularHashGenesis(solicitudBase);
    const otroHashAnterior = "0".repeat(64);

    const conGenesis = calcularHashFirma({
      solicitud: solicitudBase,
      hashAnterior: hashGenesis,
      nombre: "María Gómez",
      timestamp: 1700000100000,
    });
    const conOtroAnterior = calcularHashFirma({
      solicitud: solicitudBase,
      hashAnterior: otroHashAnterior,
      nombre: "María Gómez",
      timestamp: 1700000100000,
    });

    expect(conGenesis).not.toBe(conOtroAnterior);
  });
});

describe("verificarCadena", () => {
  function construirCadenaValida() {
    const hashGenesis = calcularHashGenesis(solicitudBase);

    const hash1 = calcularHashFirma({
      solicitud: solicitudBase,
      hashAnterior: hashGenesis,
      nombre: "María Gómez",
      timestamp: 1700000100000,
    });
    const hash2 = calcularHashFirma({
      solicitud: solicitudBase,
      hashAnterior: hash1,
      nombre: "Carlos Ruiz",
      timestamp: 1700000200000,
    });
    const hash3 = calcularHashFirma({
      solicitud: solicitudBase,
      hashAnterior: hash2,
      nombre: "Ana Torres",
      timestamp: 1700000300000,
    });

    return [
      { orden: 1, nombre: "María Gómez", fecha_firma: 1700000100000, hash_firma: hash1 },
      { orden: 2, nombre: "Carlos Ruiz", fecha_firma: 1700000200000, hash_firma: hash2 },
      { orden: 3, nombre: "Ana Torres", fecha_firma: 1700000300000, hash_firma: hash3 },
    ];
  }

  test("una cadena válida de 3 firmas se verifica correctamente", () => {
    const aprobadores = construirCadenaValida();
    const resultado = verificarCadena(solicitudBase, aprobadores);
    expect(resultado.valido).toBe(true);
  });

  test("detecta manipulación si se altera el hash de una firma intermedia", () => {
    const aprobadores = construirCadenaValida();
    aprobadores[1].hash_firma = "0".repeat(64); // se corrompe el hash de Carlos (orden 2)

    const resultado = verificarCadena(solicitudBase, aprobadores);
    expect(resultado.valido).toBe(false);
    expect(resultado.ordenInvalido).toBe(2);
  });

  test("detecta manipulación si se altera el nombre de un aprobador ya firmado", () => {
    const aprobadores = construirCadenaValida();
    aprobadores[0].nombre = "Nombre Falsificado"; // el hash no coincidirá con este nombre

    const resultado = verificarCadena(solicitudBase, aprobadores);
    expect(resultado.valido).toBe(false);
    expect(resultado.ordenInvalido).toBe(1);
  });
});