const {
  ESTADOS_SOLICITUD,
  ESTADOS_APROBADOR,
  ERRORES,
  validarTurno,
  calcularEstadoSolicitud,
} = require("../../src/domain/maquinaEstados");

describe("validarTurno", () => {
  const solicitudPendiente = { estado: ESTADOS_SOLICITUD.PENDIENTE };

  const aprobadores = [
    { orden: 1, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
    { orden: 2, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
    { orden: 3, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
  ];

  test("permite firmar al aprobador de orden 1 cuando nadie ha firmado", () => {
    const resultado = validarTurno(solicitudPendiente, aprobadores, 1);
    expect(resultado.permitido).toBe(true);
  });

  test("bloquea al aprobador de orden 2 si el de orden 1 no ha firmado", () => {
    const resultado = validarTurno(solicitudPendiente, aprobadores, 2);
    expect(resultado.permitido).toBe(false);
    expect(resultado.error).toBe(ERRORES.TURNO_INVALIDO);
  });

  test("bloquea al aprobador de orden 3 si solo ha firmado el de orden 1", () => {
    const aprobadoresParciales = [
      { orden: 1, estado_firma: ESTADOS_APROBADOR.FIRMADO },
      { orden: 2, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
      { orden: 3, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
    ];
    const resultado = validarTurno(solicitudPendiente, aprobadoresParciales, 3);
    expect(resultado.permitido).toBe(false);
    expect(resultado.error).toBe(ERRORES.TURNO_INVALIDO);
  });

  test("permite firmar al aprobador de orden 2 cuando el de orden 1 ya firmó", () => {
    const aprobadoresParciales = [
      { orden: 1, estado_firma: ESTADOS_APROBADOR.FIRMADO },
      { orden: 2, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
      { orden: 3, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
    ];
    const resultado = validarTurno(solicitudPendiente, aprobadoresParciales, 2);
    expect(resultado.permitido).toBe(true);
  });

  test("bloquea si el aprobador ya firmó antes (no puede actuar dos veces)", () => {
    const aprobadoresConFirma = [
      { orden: 1, estado_firma: ESTADOS_APROBADOR.FIRMADO },
      { orden: 2, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
      { orden: 3, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
    ];
    const resultado = validarTurno(solicitudPendiente, aprobadoresConFirma, 1);
    expect(resultado.permitido).toBe(false);
    expect(resultado.error).toBe(ERRORES.YA_FIRMADO);
  });

  test("bloquea cualquier firma si la solicitud ya fue rechazada", () => {
    const solicitudRechazada = { estado: ESTADOS_SOLICITUD.RECHAZADA };
    const resultado = validarTurno(solicitudRechazada, aprobadores, 1);
    expect(resultado.permitido).toBe(false);
    expect(resultado.error).toBe(ERRORES.SOLICITUD_RECHAZADA);
  });

  test("bloquea cualquier firma si la solicitud ya está COMPLETADA", () => {
    const solicitudCompletada = { estado: ESTADOS_SOLICITUD.COMPLETADA };
    const resultado = validarTurno(solicitudCompletada, aprobadores, 1);
    expect(resultado.permitido).toBe(false);
    expect(resultado.error).toBe(ERRORES.SOLICITUD_TERMINAL);
  });
});

describe("calcularEstadoSolicitud", () => {
  test("devuelve PENDIENTE si ningún aprobador ha decidido aún", () => {
    const aprobadores = [
      { orden: 1, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
      { orden: 2, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
      { orden: 3, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
    ];
    expect(calcularEstadoSolicitud(aprobadores)).toBe(ESTADOS_SOLICITUD.PENDIENTE);
  });

  test("devuelve PENDIENTE si solo algunos han firmado", () => {
    const aprobadores = [
      { orden: 1, estado_firma: ESTADOS_APROBADOR.FIRMADO },
      { orden: 2, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
      { orden: 3, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
    ];
    expect(calcularEstadoSolicitud(aprobadores)).toBe(ESTADOS_SOLICITUD.PENDIENTE);
  });

  test("devuelve FIRMAS_COMPLETAS cuando los 3 han firmado (nunca COMPLETADA directo)", () => {
    const aprobadores = [
      { orden: 1, estado_firma: ESTADOS_APROBADOR.FIRMADO },
      { orden: 2, estado_firma: ESTADOS_APROBADOR.FIRMADO },
      { orden: 3, estado_firma: ESTADOS_APROBADOR.FIRMADO },
    ];
    expect(calcularEstadoSolicitud(aprobadores)).toBe(ESTADOS_SOLICITUD.FIRMAS_COMPLETAS);
  });

  test("devuelve RECHAZADA si cualquiera rechazó, incluso si otros ya firmaron", () => {
    const aprobadores = [
      { orden: 1, estado_firma: ESTADOS_APROBADOR.FIRMADO },
      { orden: 2, estado_firma: ESTADOS_APROBADOR.RECHAZADO },
      { orden: 3, estado_firma: ESTADOS_APROBADOR.PENDIENTE },
    ];
    expect(calcularEstadoSolicitud(aprobadores)).toBe(ESTADOS_SOLICITUD.RECHAZADA);
  });
});