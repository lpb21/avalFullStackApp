const { TransactWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../dynamoClient");

const TABLA_SOLICITUDES = "Solicitudes";
const TABLA_APROBADORES = "Aprobadores";

/**
 * Crea la solicitud y sus 3 aprobadores de forma ATÓMICA: o se crean
 * los 4 ítems, o no se crea ninguno. Evita el estado parcial que
 * ocurriría con escrituras secuenciales si una falla a mitad de camino.
 */
async function crearSolicitudConAprobadores(solicitud, aprobadores) {
  const items = [
    {
      Put: {
        TableName: TABLA_SOLICITUDES,
        Item: solicitud,
        ConditionExpression: "attribute_not_exists(solicitud_id)",
      },
    },
    ...aprobadores.map((aprobador) => ({
      Put: {
        TableName: TABLA_APROBADORES,
        Item: aprobador,
      },
    })),
  ];

  await docClient.send(new TransactWriteCommand({ TransactItems: items }));
}

module.exports = { crearSolicitudConAprobadores };