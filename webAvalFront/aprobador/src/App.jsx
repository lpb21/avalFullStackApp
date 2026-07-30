import { useState, useEffect } from "react";
import api from "./services/api";

function leerParametrosUrl() {
  const params = new URLSearchParams(window.location.search);
  return {
    solicitudId: params.get("solicitud_id"),
    approverToken: params.get("approver_token"),
  };
}

const ESTADO_COLOR = {
  PENDIENTE: "#b8860b",
  FIRMAS_COMPLETAS: "#1e6091",
  COMPLETADA: "#0a7a2f",
  RECHAZADA: "#b00020",
};

function App() {
  const [solicitudId] = useState(() => leerParametrosUrl().solicitudId);
  const [approverToken] = useState(() => leerParametrosUrl().approverToken);

  const [paso, setPaso] = useState("cargando"); // cargando | otp | detalle | resultado | error
  const [mensajeError, setMensajeError] = useState(null);
  const [orden, setOrden] = useState(null);
  const [generacionesRestantes, setGeneracionesRestantes] = useState(null);

  const [codigo, setCodigo] = useState("");
  const [verificando, setVerificando] = useState(false);

  const [firmaToken, setFirmaToken] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [enviandoAccion, setEnviandoAccion] = useState(false);
  const [resultadoFinal, setResultadoFinal] = useState(null);

  useEffect(() => {
    if (!solicitudId || !approverToken) {
      setMensajeError("Este link no es válido. Falta información en la URL.");
      setPaso("error");
      return;
    }

    api
      .get(`/api/v1/approve?solicitud_id=${solicitudId}&approver_token=${approverToken}`)
      .then((res) => {
        setOrden(res.data.orden);
        setGeneracionesRestantes(res.data.generaciones_restantes);
        setPaso("otp");
      })
      .catch((err) => {
        const mensaje = err.response?.data?.mensaje || "No se pudo procesar tu link de aprobación.";
        setMensajeError(mensaje);
        setPaso("error");
      });
  }, [solicitudId, approverToken]);

  async function manejarVerificarOtp(e) {
    e.preventDefault();
    setVerificando(true);
    setMensajeError(null);

    try {
      const respuesta = await api.post("/api/v1/otp/verify", {
        solicitud_id: solicitudId,
        orden,
        approver_token: approverToken,
        codigo,
      });
      setFirmaToken(respuesta.data.firma_token);
      setDetalle(respuesta.data.detalle);
      setPaso("detalle");
    } catch (err) {
      const mensaje = err.response?.data?.mensaje || "Código incorrecto.";
      setMensajeError(mensaje);
    } finally {
      setVerificando(false);
    }
  }

  async function manejarAccion(accion) {
    setEnviandoAccion(true);
    setMensajeError(null);

    try {
      const respuesta = await api.post(
        `/api/v1/solicitudes/${solicitudId}/aprobadores/${orden}/firmar`,
        { accion },
        { headers: { "X-Firma-Token": firmaToken } }
      );
      setResultadoFinal(respuesta.data);
      setPaso("resultado");
    } catch (err) {
      const mensaje = err.response?.data?.mensaje || "No se pudo registrar tu decisión.";
      setMensajeError(mensaje);
    } finally {
      setEnviandoAccion(false);
    }
  }

  if (paso === "cargando") {
    return <p style={{ padding: "2rem", fontFamily: "sans-serif" }}>Verificando tu link...</p>;
  }

  if (paso === "error") {
    return (
      <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>No se pudo continuar</h2>
        <p style={{ color: "#b00020" }}>{mensajeError}</p>
      </div>
    );
  }

  if (paso === "otp") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>Verificación de identidad</h2>
        <p>Te enviamos un código de verificación a tu correo. Ingrésalo para continuar.</p>

        <form onSubmit={manejarVerificarOtp}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="Código de 6 dígitos"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            required
            style={{ width: "100%", padding: "0.75rem", fontSize: "1.2rem", textAlign: "center", letterSpacing: "0.3rem" }}
          />

          {mensajeError && <p style={{ color: "#b00020" }}>{mensajeError}</p>}

          {generacionesRestantes !== null && (
            <p style={{ fontSize: "0.85rem", color: "#555" }}>
              Envíos de código restantes: {generacionesRestantes}
            </p>
          )}

          <button type="submit" disabled={verificando} style={{ width: "100%", padding: "0.75rem", marginTop: "0.5rem" }}>
            {verificando ? "Verificando..." : "Verificar código"}
          </button>
        </form>
      </div>
    );
  }

  if (paso === "detalle") {
    const { solicitud, aprobadores } = detalle;
    const aprobadoresOrdenados = [...aprobadores].sort((a, b) => a.orden - b.orden);

    return (
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif" }}>
        <h2>{solicitud.titulo}</h2>
        <p>{solicitud.descripcion}</p>
        <p><strong>Monto:</strong> ${Number(solicitud.monto).toLocaleString("es-CO")}</p>
        <p><strong>Solicitante:</strong> {solicitud.solicitante_nombre}</p>

        <h3>Estado de los aprobadores</h3>
        {aprobadoresOrdenados.map((a) => (
          <div key={a.orden} style={{ padding: "0.5rem 0", borderBottom: "1px solid #eee" }}>
            {a.orden}. {a.nombre} ({a.rol}) —{" "}
            <span style={{ color: ESTADO_COLOR[a.estado_firma] || "#000", fontWeight: "bold" }}>
              {a.estado_firma}
            </span>
          </div>
        ))}

        {mensajeError && <p style={{ color: "#b00020", marginTop: "1rem" }}>{mensajeError}</p>}

        <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
          <button
            onClick={() => manejarAccion("APROBAR")}
            disabled={enviandoAccion}
            style={{ flex: 1, padding: "0.75rem", backgroundColor: "#0a7a2f", color: "#fff", border: "none", borderRadius: "4px" }}
          >
            {enviandoAccion ? "Enviando..." : "Aprobar"}
          </button>
          <button
            onClick={() => manejarAccion("RECHAZAR")}
            disabled={enviandoAccion}
            style={{ flex: 1, padding: "0.75rem", backgroundColor: "#b00020", color: "#fff", border: "none", borderRadius: "4px" }}
          >
            {enviandoAccion ? "Enviando..." : "Rechazar"}
          </button>
        </div>
      </div>
    );
  }

  if (paso === "resultado") {
    return (
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "2rem", fontFamily: "sans-serif", textAlign: "center" }}>
        <h2>¡Listo!</h2>
        <p>{resultadoFinal.mensaje}</p>
        <p>
          Estado de la solicitud:{" "}
          <span style={{ color: ESTADO_COLOR[resultadoFinal.solicitud_estado] || "#000", fontWeight: "bold" }}>
            {resultadoFinal.solicitud_estado}
          </span>
        </p>
      </div>
    );
  }

  return null;
}

export default App;