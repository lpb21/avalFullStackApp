const {
  LIMITE_INTENTOS,
  LIMITE_GENERACIONES,
  generarCodigoOtp,
  hashearCodigoOtp,
  codigoCoincide,
  esOtpVigente,
  decidirAccionOtp,
} = require("../../src/domain/otp");

describe("generarCodigoOtp", () => {
  test("genera un código de 6 dígitos numéricos", () => {
    const codigo = generarCodigoOtp();
    expect(codigo).toMatch(/^\d{6}$/);
  });

  test("rellena con ceros a la izquierda cuando el número es pequeño", () => {
    // No podemos forzar el valor exacto de randomInt, pero sí verificar
    // que el formato siempre tiene 6 caracteres sin importar el valor.
    for (let i = 0; i < 50; i++) {
      expect(generarCodigoOtp()).toHaveLength(6);
    }
  });
});

describe("hashearCodigoOtp / codigoCoincide", () => {
  test("el mismo código siempre produce el mismo hash", () => {
    expect(hashearCodigoOtp("123456")).toBe(hashearCodigoOtp("123456"));
  });

  test("códigos distintos producen hashes distintos", () => {
    expect(hashearCodigoOtp("123456")).not.toBe(hashearCodigoOtp("654321"));
  });

  test("codigoCoincide confirma un código correcto contra su hash", () => {
    const hash = hashearCodigoOtp("123456");
    expect(codigoCoincide("123456", hash)).toBe(true);
  });

  test("codigoCoincide rechaza un código incorrecto", () => {
    const hash = hashearCodigoOtp("123456");
    expect(codigoCoincide("000000", hash)).toBe(false);
  });
});

describe("esOtpVigente", () => {
  const ahora = 1700000000;

  test("no es vigente si el OTP no existe", () => {
    expect(esOtpVigente(null, ahora)).toBe(false);
  });

  test("es vigente si no ha expirado y tiene intentos disponibles", () => {
    const otp = { expira_en: ahora + 100, intentos: 0 };
    expect(esOtpVigente(otp, ahora)).toBe(true);
  });

  test("no es vigente si ya expiró, aunque tenga intentos disponibles", () => {
    const otp = { expira_en: ahora - 1, intentos: 0 };
    expect(esOtpVigente(otp, ahora)).toBe(false);
  });

  test("no es vigente si agotó los intentos, aunque no haya expirado (resuelve el deadlock)", () => {
    const otp = { expira_en: ahora + 100, intentos: LIMITE_INTENTOS };
    expect(esOtpVigente(otp, ahora)).toBe(false);
  });
});

describe("decidirAccionOtp", () => {
  const ahora = 1700000000;

  test("REUTILIZAR si hay un OTP vigente", () => {
    const otpVigente = { expira_en: ahora + 100, intentos: 0 };
    const resultado = decidirAccionOtp(otpVigente, 1, ahora);
    expect(resultado.accion).toBe("REUTILIZAR");
    expect(resultado.generacionesRestantes).toBe(LIMITE_GENERACIONES - 1);
  });

  test("GENERAR si no hay OTP y quedan generaciones disponibles", () => {
    const resultado = decidirAccionOtp(null, 0, ahora);
    expect(resultado.accion).toBe("GENERAR");
  });

  test("GENERAR si el OTP expiró y quedan generaciones (no lo reutiliza)", () => {
    const otpExpirado = { expira_en: ahora - 1, intentos: 0 };
    const resultado = decidirAccionOtp(otpExpirado, 1, ahora);
    expect(resultado.accion).toBe("GENERAR");
  });

  test("GENERAR si el OTP agotó intentos pero quedan generaciones (resuelve el deadlock, no bloquea)", () => {
    const otpSinIntentos = { expira_en: ahora + 100, intentos: LIMITE_INTENTOS };
    const resultado = decidirAccionOtp(otpSinIntentos, 1, ahora);
    expect(resultado.accion).toBe("GENERAR");
  });

  test("BLOQUEADO si no hay OTP vigente y ya se agotaron las 3 generaciones", () => {
    const resultado = decidirAccionOtp(null, LIMITE_GENERACIONES, ahora);
    expect(resultado.accion).toBe("BLOQUEADO");
  });

  test("BLOQUEADO incluso si el OTP actual tiene intentos agotados y no quedan generaciones (caso límite del deadlock)", () => {
    const otpSinIntentos = { expira_en: ahora + 100, intentos: LIMITE_INTENTOS };
    const resultado = decidirAccionOtp(otpSinIntentos, LIMITE_GENERACIONES, ahora);
    expect(resultado.accion).toBe("BLOQUEADO");
  });
});