import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../services/api";

const ESTADO_COLOR = {
  PENDIENTE: "#b8860b",
  FIRMADO: "#0a7a2f",
  RECHAZADO: "#b00020",
};

const ESTADO_SOLICITUD_COLOR = {
  PENDIENTE: "#b8860b",
  FIRMAS_COMPLETAS: "#1e6091",
  COMPLETADA: "#0a7a2f",
  RECHAZADA: "#b00020",
};

function DetalleSolicitud() {
  const { id } = useParams();
  const [detalle, setDetalle] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setCargando(true);
    api
      .get(`/api/v1/solicitudes/${id}`)
      .then((res) => setDetalle(res.data))
      .catch(() => setError("No se pudo cargar el detalle de la solicitud."))
      .finally(() => setCargando(false));
  }, [id]);

  if (cargando) return <p style={{ padding: "2rem" }}>Cargando...</p>;
  if (error) return <p style={{ padding: "2rem", color: "#b00020" }}>{error}</p>;
  if (!detalle) return null;

  const { solicitud, aprobadores } = detalle;
  const aprobadoresOrdenados = [...aprobadores].sort((a, b) => a.orden - b.orden);

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>{solicitud.titulo}</h2>
      <p>{solicitud.descripcion}</p>
      <p><strong>Monto:</strong> ${Number(solicitud.monto).toLocaleString("es-CO")}</p>
      <p><strong>Solicitante:</strong> {solicitud.solicitante_nombre} ({solicitud.solicitante_email})</p>
      <p>
        <strong>Estado:</strong>{" "}
        <span style={{ color: ESTADO_SOLICITUD_COLOR[solicitud.estado] || "#000", fontWeight: "bold" }}>
          {solicitud.estado}
        </span>
      </p>

      <h3>Aprobadores</h3>
      {aprobadoresOrdenados.map((a) => (
        <div key={a.orden} style={{ border: "1px solid #ccc", padding: "1rem", marginBottom: "0.75rem" }}>
          <strong>{a.orden}. {a.nombre}</strong> — {a.rol}
          <p style={{ margin: "0.5rem 0 0" }}>
            Estado:{" "}
            <span style={{ color: ESTADO_COLOR[a.estado_firma] || "#000", fontWeight: "bold" }}>
              {a.estado_firma}
            </span>
          </p>
          {a.fecha_firma && (
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.9rem", color: "#555" }}>
              Fecha: {new Date(a.fecha_firma).toLocaleString("es-CO")}
            </p>
          )}
        </div>
      ))}

      {solicitud.estado === "COMPLETADA" && (
        <a
          href={`${api.defaults.baseURL}/api/v1/solicitudes/${solicitud.solicitud_id}/evidencia.pdf`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            marginTop: "1rem",
            padding: "0.75rem 1.5rem",
            backgroundColor: "#0a7a2f",
            color: "#fff",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          Descargar PDF de evidencia
        </a>
      )}
    </div>
  );
}

export default DetalleSolicitud;