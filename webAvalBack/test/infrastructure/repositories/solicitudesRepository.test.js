const { mockClient } = require("aws-sdk-client-mock");
require("aws-sdk-client-mock-jest");
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
} = require("@aws-sdk/lib-dynamodb");

const { docClient } = require("../../../src/infrastructure/dynamoClient");
const {
  crearSolicitud,
  obtenerSolicitudPorId,
  actualizarEstado,
  actualizarEstadoConPdf,
} = require("../../../src/infrastructure/repositories/solicitudesRepository");

const ddbMock = mockClient(docClient);

beforeEach(() => {
  ddbMock.reset();
});

describe("crearSolicitud", () => {
  test("envía un PutCommand con la condición de no-existencia y los datos exactos", async () => {
    const solicitud = { solicitud_id: "abc-123", titulo: "Compra de prueba", estado: "PENDIENTE" };
    ddbMock.on(PutCommand).resolves({});

    const resultado = await crearSolicitud(solicitud);

    expect(ddbMock).toHaveReceivedCommandWith(PutCommand, {
      TableName: "Solicitudes",
      Item: solicitud,
      ConditionExpression: "attribute_not_exists(solicitud_id)",
    });
    expect(resultado).toEqual(solicitud);
  });
});

describe("obtenerSolicitudPorId", () => {
  test("devuelve el ítem cuando existe", async () => {
    const solicitudGuardada = { solicitud_id: "abc-123", titulo: "Compra de prueba" };
    ddbMock.on(GetCommand).resolves({ Item: solicitudGuardada });

    const resultado = await obtenerSolicitudPorId("abc-123");

    expect(ddbMock).toHaveReceivedCommandWith(GetCommand, {
      TableName: "Solicitudes",
      Key: { solicitud_id: "abc-123" },
    });
    expect(resultado).toEqual(solicitudGuardada);
  });

  test("devuelve null cuando no existe (DynamoDB responde sin Item)", async () => {
    ddbMock.on(GetCommand).resolves({});

    const resultado = await obtenerSolicitudPorId("no-existe");

    expect(resultado).toBeNull();
  });
});

describe("actualizarEstado", () => {
  test("envía un UpdateCommand con la condición del estado esperado", async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await actualizarEstado({
      solicitudId: "abc-123",
      estadoEsperado: "PENDIENTE",
      nuevoEstado: "RECHAZADA",
    });

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "Solicitudes",
      Key: { solicitud_id: "abc-123" },
      UpdateExpression: "SET estado = :nuevo",
      ConditionExpression: "estado = :esperado",
      ExpressionAttributeValues: {
        ":nuevo": "RECHAZADA",
        ":esperado": "PENDIENTE",
      },
    });
  });
});

describe("actualizarEstadoConPdf", () => {
  test("envía un UpdateCommand que actualiza estado y pdf_key a la vez", async () => {
    ddbMock.on(UpdateCommand).resolves({});

    await actualizarEstadoConPdf({
      solicitudId: "abc-123",
      estadoEsperado: "FIRMAS_COMPLETAS",
      nuevoEstado: "COMPLETADA",
      pdfKey: "evidencias/abc-123.pdf",
    });

    expect(ddbMock).toHaveReceivedCommandWith(UpdateCommand, {
      TableName: "Solicitudes",
      Key: { solicitud_id: "abc-123" },
      UpdateExpression: "SET estado = :nuevo, pdf_key = :pdfKey",
      ConditionExpression: "estado = :esperado",
      ExpressionAttributeValues: {
        ":nuevo": "COMPLETADA",
        ":esperado": "FIRMAS_COMPLETAS",
        ":pdfKey": "evidencias/abc-123.pdf",
      },
    });
  });
});