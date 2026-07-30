const { mockClient } = require("aws-sdk-client-mock");
require("aws-sdk-client-mock-jest");
const { PutCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const { docClient } = require("../../../src/infrastructure/dynamoClient");
const {
  crearAprobador,
  listarAprobadoresPorSolicitud,
  buscarAprobadorPorToken,
  actualizarEstadoFirma,
  incrementarGeneracionesOtp,
} = require("../../../src/infrastructure/repositories/aprobadoresRepository");

const ddbMock = mockClient(docClient);

beforeEach(() => {
  ddbMock.reset();
});

describe("crearAprobador", () => {
  test("envía un PutCommand con el aprobador completo", async () => {
    const aprobador = { solicitud_id: "abc-123", orden: 1, nombre: "María Gómez" };
    ddbMock.on(PutCommand).resolves({});

    const resultado = await crearAprobador(aprobador);

    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "Aprobadores",
      Item: aprobador,
    });
    expect(resultado).toEqual(aprobador);
  });
});

describe("listarAprobadoresPorSolicitud", () => {
  test("consulta por solicitud_id y devuelve los aprobadores", async () => {
    const aprobadores = [
      { solicitud_id: "abc-123", orden: 1, nombre: "María" },
      { solicitud_id: "abc-123", orden: 2, nombre: "Carlos" },
    ];
    ddbMock.on(QueryCommand).resolves({ Items: aprobadores });

    const resultado = await listarAprobadoresPorSolicitud("abc-123");

    expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "Aprobadores",
      KeyConditionExpression: "solicitud_id = :sid",
      ExpressionAttributeValues: { ":sid": "abc-123" },
    });
    expect(resultado).toEqual(aprobadores);
  });

  test("devuelve un array vacío si no hay aprobadores (Items ausente)", async () => {
    ddbMock.on(QueryCommand).resolves({});

    const resultado = await listarAprobadoresPorSolicitud("sin-aprobadores");

    expect(resultado).toEqual([]);
  });
});

describe("buscarAprobadorPorToken", () => {
  test("consulta el GSI de token usando el alias #tok (palabra reservada)", async () => {
    const aprobador = { solicitud_id: "abc-123", orden: 1, token: "uuid-token" };
    ddbMock.on(QueryCommand).resolves({ Items: [aprobador] });

    const resultado = await buscarAprobadorPorToken("uuid-token");

    expect(ddbMock).toHaveReceivedCommandWith(QueryCommand, {
      TableName: "Aprobadores",
      IndexName: "gsi_token",
      KeyConditionExpression: "#tok = :t",
      ExpressionAttributeNames: { "#tok": "token" },
      ExpressionAttributeValues: { ":t": "uuid-token" },
    });
    expect(resultado).toEqual(aprobador);
  });

  test("devuelve null si el token no corresponde a ningún aprobador", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });

    const resultado = await buscarAprobadorPorToken("token-inexistente");

    expect(resultado).toBeNull();
  });
});

describe("actualizarEstadoFirma", () => {
  test("envía un UpdateCommand condicionado a que el estado previo sea PENDIENTE", async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await actualizarEstadoFirma({
      solicitudId: "abc-123",
      orden: 1,
      nuevoEstado: "FIRMADO",
      fechaFirma: 1700000000000,
      hashFirma: "hash-simulado",
    });

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "Aprobadores",
      Key: { solicitud_id: "abc-123", orden: 1 },
      UpdateExpression:
        "SET estado_firma = :nuevoEstado, fecha_firma = :fechaFirma, hash_firma = :hashFirma",
      ConditionExpression: "estado_firma = :pendiente",
      ExpressionAttributeValues: {
        ":nuevoEstado": "FIRMADO",
        ":fechaFirma": 1700000000000,
        ":hashFirma": "hash-simulado",
        ":pendiente": "PENDIENTE",
      },
    });
  });

  test("propaga el error si la condición falla (ya estaba firmado)", async () => {
    ddbMock.on(UpdateCommand).rejects(new Error("ConditionalCheckFailedException"));

    await expect(
      actualizarEstadoFirma({
        solicitudId: "abc-123",
        orden: 1,
        nuevoEstado: "FIRMADO",
        fechaFirma: 1700000000000,
        hashFirma: "hash",
      })
    ).rejects.toThrow("ConditionalCheckFailedException");
  });
});

describe("incrementarGeneracionesOtp", () => {
  test("envía un UpdateCommand condicionado al límite de 3 generaciones", async () => {
    const aprobadorActualizado = { solicitud_id: "abc-123", orden: 1, num_otp_generados: 1 };
    ddbMock.on(UpdateCommand).resolves({ Attributes: aprobadorActualizado });

    const resultado = await incrementarGeneracionesOtp({ solicitudId: "abc-123", orden: 1 });

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "Aprobadores",
      Key: { solicitud_id: "abc-123", orden: 1 },
      UpdateExpression: "SET num_otp_generados = num_otp_generados + :uno",
      ConditionExpression: "num_otp_generados < :limite",
      ExpressionAttributeValues: { ":uno": 1, ":limite": 3 },
      ReturnValues: "ALL_NEW",
    });
    expect(resultado).toEqual(aprobadorActualizado);
  });

  test("propaga el error si ya se alcanzó el límite de generaciones", async () => {
    ddbMock.on(UpdateCommand).rejects(new Error("ConditionalCheckFailedException"));

    await expect(
      incrementarGeneracionesOtp({ solicitudId: "abc-123", orden: 1 })
    ).rejects.toThrow("ConditionalCheckFailedException");
  });
});