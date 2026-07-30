import { Suspense, lazy } from "react";

const AppRemoto = lazy(() => import("aprobador/App"));

function App() {
  return (
    <div style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>AVAL — Flujo de Aprobaciones</h1>
      <p>Host funcionando correctamente.</p>
      <hr />
      <h3>Cargando componente remoto:</h3>
      <Suspense fallback={<p>Cargando remote...</p>}>
        <AppRemoto />
      </Suspense>
    </div>
  );
}

export default App;