const { mockClient } = require("aws-sdk-client-mock");
require("aws-sdk-client-mock-jest");
const { PutCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const { docClient } = require("../../../src/infrastructure/dynamoClient");
const {
  crearFirmaToken,
  obtenerFirmaToken,
  marcarFirmaTokenComoUsado,
  DURACION_FIRMA_TOKEN_SEGUNDOS,
} = require("../../../src/infrastructure/repositories/sessionTokensRepository");

const ddbMock = mockClient(docClient);

beforeEach(() => {
  ddbMock.reset();
});

describe("crearFirmaToken", () => {
  test("crea el token con usado=false y expira_en en SEGUNDOS", async () => {
    const ahoraMs = 1700000000000;
    jest.spyOn(Date, "now").mockReturnValue(ahoraMs);
    ddbMock.on(PutCommand).resolves({});

    const resultado = await crearFirmaToken({
      firmaToken: "token-uuid",
      solicitudId: "abc-123",
      orden: 1,
    });

    const esperadoSegundos = Math.floor(ahoraMs / 1000) + DURACION_FIRMA_TOKEN_SEGUNDOS;
    expect(resultado.expira_en).toBe(esperadoSegundos);
    expect(resultado.usado).toBe(false);
    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "SessionTokens",
      Item: expect.objectContaining({ firma_token: "token-uuid", usado: false }),
    });

    Date.now.mockRestore();
  });
});

describe("obtenerFirmaToken", () => {
  test("devuelve el token cuando existe", async () => {
    const token = { firma_token: "token-uuid", solicitud_id: "abc-123", orden: 1, usado: false };
    ddbMock.on(GetCommand).resolves({ Item: token });

    const resultado = await obtenerFirmaToken("token-uuid");

    expect(ddbMock).toHaveReceivedCommandWith(GetCommand, {
      TableName: "SessionTokens",
      Key: { firma_token: "token-uuid" },
    });
    expect(resultado).toEqual(token);
  });

  test("devuelve null si el token no existe", async () => {
    ddbMock.on(GetCommand).resolves({});

    const resultado = await obtenerFirmaToken("no-existe");

    expect(resultado).toBeNull();
  });
});

describe("marcarFirmaTokenComoUsado", () => {
  test("envía un UpdateCommand condicionado a usado=false (garantiza un solo uso)", async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await marcarFirmaTokenComoUsado("token-uuid");

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "SessionTokens",
      Key: { firma_token: "token-uuid" },
      UpdateExpression: "SET usado = :true",
      ConditionExpression: "usado = :false",
      ExpressionAttributeValues: { ":true": true, ":false": false },
    });
  });

  test("propaga el error si el token ya fue usado (protege contra doble consumo)", async () => {
    ddbMock.on(UpdateCommand).rejects(new Error("ConditionalCheckFailedException"));

    await expect(marcarFirmaTokenComoUsado("token-ya-usado")).rejects.toThrow(
      "ConditionalCheckFailedException"
    );
  });
});