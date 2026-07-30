import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import CrearSolicitud from "./pages/CrearSolicitud";

const AppRemoto = lazy(() => import("aprobador/App"));

function Layout({ children }) {
  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <nav style={{ padding: "1rem", borderBottom: "1px solid #ccc", display: "flex", gap: "1rem" }}>
        <Link to="/">Crear solicitud</Link>
        <Link to="/panel">Panel del solicitante</Link>
      </nav>
      <main>{children}</main>
    </div>
  );
}

function PruebaRemote() {
  return (
    <div style={{ padding: "2rem" }}>
      <h3>Prueba de componente remoto:</h3>
      <Suspense fallback={<p>Cargando remote...</p>}>
        <AppRemoto />
      </Suspense>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<CrearSolicitud />} />
          <Route path="/panel" element={<p style={{ padding: "2rem" }}>Panel del solicitante (próximamente)</p>} />
          <Route path="/prueba-remote" element={<PruebaRemote />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;