const { validarDatosSolicitud } = require("../../src/domain/validacionSolicitud");

function solicitudValida() {
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
  };
}

describe("validarDatosSolicitud", () => {
  test("una solicitud completa y correcta es válida", () => {
    const resultado = validarDatosSolicitud(solicitudValida());
    expect(resultado.valido).toBe(true);
    expect(resultado.errores).toHaveLength(0);
  });

  test("rechaza si falta el título", () => {
    const input = solicitudValida();
    delete input.titulo;
    const resultado = validarDatosSolicitud(input);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => e.includes("titulo"))).toBe(true);
  });

  test("rechaza si el monto es cero o negativo", () => {
    const input = { ...solicitudValida(), monto: 0 };
    const resultado = validarDatosSolicitud(input);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => e.includes("monto"))).toBe(true);
  });

  test("rechaza si hay menos de 3 aprobadores", () => {
    const input = solicitudValida();
    input.aprobadores = input.aprobadores.slice(0, 2);
    const resultado = validarDatosSolicitud(input);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => e.includes("3 aprobadores"))).toBe(true);
  });

  test("rechaza si hay más de 3 aprobadores", () => {
    const input = solicitudValida();
    input.aprobadores.push({ nombre: "Extra", email: "extra@empresa.com", rol: "Otro Rol" });
    const resultado = validarDatosSolicitud(input);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => e.includes("3 aprobadores"))).toBe(true);
  });

  test("rechaza si falta el email de un aprobador", () => {
    const input = solicitudValida();
    delete input.aprobadores[1].email;
    const resultado = validarDatosSolicitud(input);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => e.includes("email"))).toBe(true);
  });

  test("rechaza si dos aprobadores tienen el mismo rol", () => {
    const input = solicitudValida();
    input.aprobadores[1].rol = input.aprobadores[0].rol;
    const resultado = validarDatosSolicitud(input);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => e.includes("roles distintos"))).toBe(true);
  });

  test("detecta roles duplicados aunque tengan distinta capitalización o espacios extra", () => {
    const input = solicitudValida();
    input.aprobadores[0].rol = "Jefe de Departamento";
    input.aprobadores[1].rol = "  JEFE DE DEPARTAMENTO  ";
    const resultado = validarDatosSolicitud(input);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.some((e) => e.includes("roles distintos"))).toBe(true);
  });

  test("acumula múltiples errores a la vez, no se detiene en el primero", () => {
    const input = solicitudValida();
    delete input.titulo;
    input.monto = -100;
    const resultado = validarDatosSolicitud(input);
    expect(resultado.valido).toBe(false);
    expect(resultado.errores.length).toBeGreaterThanOrEqual(2);
  });
});