
const CAMPOS_REQUERIDOS_SOLICITUD = [
  "titulo",
  "descripcion",
  "monto",
  "solicitante_email",
  "solicitante_nombre",
  "aprobadores",
];

const CAMPOS_REQUERIDOS_APROBADOR = ["nombre", "email", "rol"];

/**
 * Valida los datos de entrada para crear una solicitud, según las reglas
 * del enunciado: campos requeridos, monto positivo, exactamente 3
 * aprobadores con roles distintos.
 *
 * @returns {{ valido: boolean, errores: string[] }}
 */
function validarDatosSolicitud(input) {
  const errores = [];

  for (const campo of CAMPOS_REQUERIDOS_SOLICITUD) {
    if (input[campo] === undefined || input[campo] === null || input[campo] === "") {
      errores.push(`El campo '${campo}' es requerido`);
    }
  }

  if (typeof input.monto === "number" && input.monto <= 0) {
    errores.push("El monto debe ser mayor a cero");
  }

  if (Array.isArray(input.aprobadores)) {
    if (input.aprobadores.length !== 3) {
      errores.push("Se requieren exactamente 3 aprobadores");
    }

    input.aprobadores.forEach((aprobador, i) => {
      for (const campo of CAMPOS_REQUERIDOS_APROBADOR) {
        if (!aprobador || !aprobador[campo]) {
          errores.push(`El aprobador #${i + 1} requiere el campo '${campo}'`);
        }
      }
    });

    const roles = input.aprobadores
      .filter((a) => a && a.rol)
      .map((a) => a.rol.trim().toLowerCase());
    const rolesUnicos = new Set(roles);
    if (roles.length === 3 && rolesUnicos.size !== 3) {
      errores.push("Los 3 aprobadores deben tener roles distintos");
    }
  }

  return { valido: errores.length === 0, errores };
}

module.exports = { validarDatosSolicitud };