import { useState } from "react";
import api from "../services/api";

const ROLES_DISPONIBLES = [
  "Jefe de Departamento",
  "Director Financiero",
  "Gerente General",
  "Contador",
  "Auditor",
];

function CrearSolicitud() {
  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    monto: "",
    solicitante_email: "",
    solicitante_nombre: "",
    aprobadores: [
      { nombre: "", email: "", rol: "" },
      { nombre: "", email: "", rol: "" },
      { nombre: "", email: "", rol: "" },
    ],
  });
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState(null);

  function actualizarCampo(campo, valor) {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  }

  function actualizarAprobador(indice, campo, valor) {
    setForm((prev) => {
      const aprobadores = [...prev.aprobadores];
      aprobadores[indice] = { ...aprobadores[indice], [campo]: valor };
      return { ...prev, aprobadores };
    });
  }

  function validarRolesDistintos() {
    const roles = form.aprobadores.map((a) => a.rol.trim().toLowerCase());
    return new Set(roles).size === 3 && roles.every((r) => r !== "");
  }

  async function manejarEnvio(e) {
    e.preventDefault();
    setError(null);
    setResultado(null);

    if (!validarRolesDistintos()) {
      setError("Los 3 aprobadores deben tener roles distintos y todos deben estar seleccionados.");
      return;
    }

    setEnviando(true);
    try {
      const respuesta = await api.post("/api/v1/solicitudes", {
        ...form,
        monto: Number(form.monto),
      });
      setResultado(respuesta.data);
      setForm({
        titulo: "",
        descripcion: "",
        monto: "",
        solicitante_email: "",
        solicitante_nombre: "",
        aprobadores: [
          { nombre: "", email: "", rol: "" },
          { nombre: "", email: "", rol: "" },
          { nombre: "", email: "", rol: "" },
        ],
      });
    } catch (err) {
      const mensaje = err.response?.data?.mensaje || "Error al crear la solicitud.";
      const detalles = err.response?.data?.errores?.join(" ") || "";
      setError(`${mensaje} ${detalles}`);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Crear solicitud de compra</h2>

      <form onSubmit={manejarEnvio}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="titulo">Título</label>
          <input
            id="titulo"
            type="text"
            value={form.titulo}
            onChange={(e) => actualizarCampo("titulo", e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="descripcion">Descripción</label>
          <textarea
            id="descripcion"
            value={form.descripcion}
            onChange={(e) => actualizarCampo("descripcion", e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="monto">Monto</label>
          <input
            id="monto"
            type="number"
            min="1"
            value={form.monto}
            onChange={(e) => actualizarCampo("monto", e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="solicitante_nombre">Tu nombre (solicitante)</label>
          <input
            id="solicitante_nombre"
            type="text"
            value={form.solicitante_nombre}
            onChange={(e) => actualizarCampo("solicitante_nombre", e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <div style={{ marginBottom: "1.5rem" }}>
          <label htmlFor="solicitante_email">Tu email (solicitante)</label>
          <input
            id="solicitante_email"
            type="email"
            value={form.solicitante_email}
            onChange={(e) => actualizarCampo("solicitante_email", e.target.value)}
            required
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>

        <h3>Aprobadores (3, con roles distintos)</h3>
        {form.aprobadores.map((aprobador, i) => (
          <div key={i} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "0.75rem" }}>
            <strong>Aprobador {i + 1} (orden {i + 1})</strong>
            <div style={{ marginTop: "0.5rem" }}>
              <input
                type="text"
                placeholder="Nombre"
                value={aprobador.nombre}
                onChange={(e) => actualizarAprobador(i, "nombre", e.target.value)}
                required
                style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
              />
              <input
                type="email"
                placeholder="Email"
                value={aprobador.email}
                onChange={(e) => actualizarAprobador(i, "email", e.target.value)}
                required
                style={{ width: "100%", padding: "0.5rem", marginBottom: "0.5rem" }}
              />
              <select
                value={aprobador.rol}
                onChange={(e) => actualizarAprobador(i, "rol", e.target.value)}
                required
                style={{ width: "100%", padding: "0.5rem" }}
              >
                <option value="">Selecciona un rol</option>
                {ROLES_DISPONIBLES.map((rol) => (
                  <option key={rol} value={rol}>
                    {rol}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}

        {error && (
          <p style={{ color: "#b00020", fontWeight: "bold" }}>{error}</p>
        )}

        {resultado && (
          <p style={{ color: "#0a7a2f", fontWeight: "bold" }}>
            Solicitud creada correctamente. ID: {resultado.solicitud_id} — Estado: {resultado.estado}
          </p>
        )}

        <button type="submit" disabled={enviando} style={{ padding: "0.75rem 1.5rem" }}>
          {enviando ? "Creando..." : "Crear solicitud"}
        </button>
      </form>
    </div>
  );
}

export default CrearSolicitud;