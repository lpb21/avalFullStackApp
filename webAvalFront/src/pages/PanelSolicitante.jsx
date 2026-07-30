import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";

const ESTADO_COLOR = {
  PENDIENTE: "#b8860b",
  FIRMAS_COMPLETAS: "#1e6091",
  COMPLETADA: "#0a7a2f",
  RECHAZADA: "#b00020",
};

function PanelSolicitante() {
  const [email, setEmail] = useState("");
  const [emailBuscado, setEmailBuscado] = useState(null);
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!emailBuscado) return;

    setCargando(true);
    setError(null);

    api
      .get(`/api/v1/solicitudes?solicitante_email=${encodeURIComponent(emailBuscado)}`)
      .then((res) => setSolicitudes(res.data))
      .catch(() => setError("No se pudieron cargar las solicitudes."))
      .finally(() => setCargando(false));
  }, [emailBuscado]);

  function manejarBusqueda(e) {
    e.preventDefault();
    setEmailBuscado(email);
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Panel del solicitante</h2>

      <form onSubmit={manejarBusqueda} style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem" }}>
        <input
          type="email"
          placeholder="Tu email de solicitante"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ flex: 1, padding: "0.5rem" }}
        />
        <button type="submit">Ver mis solicitudes</button>
      </form>

      {cargando && <p>Cargando...</p>}
      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {emailBuscado && !cargando && solicitudes.length === 0 && !error && (
        <p>No se encontraron solicitudes para este email.</p>
      )}

      {solicitudes.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #ccc", textAlign: "left" }}>
              <th style={{ padding: "0.5rem" }}>Título</th>
              <th style={{ padding: "0.5rem" }}>Monto</th>
              <th style={{ padding: "0.5rem" }}>Estado</th>
              <th style={{ padding: "0.5rem" }}>Aprobadores</th>
              <th style={{ padding: "0.5rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.solicitud_id} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "0.5rem" }}>{s.titulo}</td>
                <td style={{ padding: "0.5rem" }}>${Number(s.monto).toLocaleString("es-CO")}</td>
                <td style={{ padding: "0.5rem" }}>
                  <span style={{ color: ESTADO_COLOR[s.estado] || "#000", fontWeight: "bold" }}>
                    {s.estado}
                  </span>
                </td>
                <td style={{ padding: "0.5rem" }}>
                  {s.aprobadores_count.firmados} firmados / {s.aprobadores_count.pendientes} pendientes
                  {s.aprobadores_count.rechazados > 0 && ` / ${s.aprobadores_count.rechazados} rechazados`}
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <Link to={`/solicitudes/${s.solicitud_id}`}>Ver detalle</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default PanelSolicitante;