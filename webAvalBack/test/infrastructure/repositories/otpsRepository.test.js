const { mockClient } = require("aws-sdk-client-mock");
require("aws-sdk-client-mock-jest");
const { PutCommand, GetCommand, UpdateCommand, DeleteCommand } = require("@aws-sdk/lib-dynamodb");

const { docClient } = require("../../../src/infrastructure/dynamoClient");
const {
  crearOtp,
  obtenerOtp,
  incrementarIntentos,
  eliminarOtp,
  DURACION_OTP_SEGUNDOS,
} = require("../../../src/infrastructure/repositories/otpsRepository");

const ddbMock = mockClient(docClient);

beforeEach(() => {
  ddbMock.reset();
});

describe("crearOtp", () => {
  test("calcula expira_en en SEGUNDOS (epoch), no en milisegundos", async () => {
    const ahoraMs = 1700000000000;
    jest.spyOn(Date, "now").mockReturnValue(ahoraMs);
    ddbMock.on(PutCommand).resolves({});

    const resultado = await crearOtp({
      solicitudId: "abc-123",
      orden: 1,
      codigoHash: "hash-simulado",
    });

    const esperadoSegundos = Math.floor(ahoraMs / 1000) + DURACION_OTP_SEGUNDOS;
    expect(resultado.expira_en).toBe(esperadoSegundos);
    // Verifica que NO se guardó en milisegundos (el bug que ya corregimos una vez)
    expect(resultado.expira_en).toBeLessThan(ahoraMs);

    Date.now.mockRestore();
  });

  test("siempre arranca con intentos en 0 (así regenerar resetea el contador)", async () => {
    ddbMock.on(PutCommand).resolves({});

    const resultado = await crearOtp({ solicitudId: "abc-123", orden: 1, codigoHash: "hash" });

    expect(resultado.intentos).toBe(0);
    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "OTPs",
      Item: expect.objectContaining({ intentos: 0 }),
    });
  });
});

describe("obtenerOtp", () => {
  test("devuelve el ítem sin validar expiración (responsabilidad del caso de uso)", async () => {
    const otpExpirado = { solicitud_id: "abc-123", orden: 1, expira_en: 1, intentos: 0 };
    ddbMock.on(GetCommand).resolves({ Item: otpExpirado });

    const resultado = await obtenerOtp("abc-123", 1);

    expect(resultado).toEqual(otpExpirado);
  });

  test("devuelve null si no hay OTP", async () => {
    ddbMock.on(GetCommand).resolves({});

    const resultado = await obtenerOtp("abc-123", 1);

    expect(resultado).toBeNull();
  });
});

describe("incrementarIntentos", () => {
  test("envía un UpdateCommand condicionado al límite de 3 intentos", async () => {
    ddbMock.on(UpdateCommand).resolves({ Attributes: { intentos: 1 } });

    const resultado = await incrementarIntentos("abc-123", 1);

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "OTPs",
      Key: { solicitud_id: "abc-123", orden: 1 },
      UpdateExpression: "SET intentos = intentos + :uno",
      ConditionExpression: "intentos < :limite",
      ExpressionAttributeValues: { ":uno": 1, ":limite": 3 },
      ReturnValues: "ALL_NEW",
    });
    expect(resultado).toEqual({ intentos: 1 });
  });

  test("propaga el error si ya se alcanzó el límite de intentos", async () => {
    ddbMock.on(UpdateCommand).rejects(new Error("ConditionalCheckFailedException"));

    await expect(incrementarIntentos("abc-123", 1)).rejects.toThrow(
      "ConditionalCheckFailedException"
    );
  });
});

describe("eliminarOtp", () => {
  test("envía un DeleteCommand con la clave correcta", async () => {
    ddbMock.on(DeleteCommand).resolves({});

    await eliminarOtp("abc-123", 1);

    expect(ddbMock).toHaveReceivedCommandWith(DeleteCommand, {
      TableName: "OTPs",
      Key: { solicitud_id: "abc-123", orden: 1 },
    });
  });
});