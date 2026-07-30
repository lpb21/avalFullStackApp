import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import DetalleSolicitud from "../DetalleSolicitud";
import api from "../../services/api";

jest.mock("../../services/api");

function renderConRuta(solicitudId = "sol-1") {
  return render(
    <MemoryRouter initialEntries={[`/solicitudes/${solicitudId}`]}>
      <Routes>
        <Route path="/solicitudes/:id" element={<DetalleSolicitud />} />
      </Routes>
    </MemoryRouter>
  );
}

const detalleBase = {
  solicitud: {
    solicitud_id: "sol-1",
    titulo: "Compra de laptops",
    descripcion: "20 laptops",
    monto: 15000000,
    solicitante_nombre: "Juan Pérez",
    solicitante_email: "juan@empresa.com",
    estado: "PENDIENTE",
  },
  aprobadores: [
    { orden: 1, nombre: "María", rol: "Jefe de Departamento", estado_firma: "PENDIENTE", fecha_firma: null },
    { orden: 2, nombre: "Carlos", rol: "Director Financiero", estado_firma: "PENDIENTE", fecha_firma: null },
    { orden: 3, nombre: "Ana", rol: "Gerente General", estado_firma: "PENDIENTE", fecha_firma: null },
  ],
};

describe("DetalleSolicitud", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("muestra 'Cargando...' mientras espera la respuesta", () => {
    api.get.mockReturnValue(new Promise(() => {})); // nunca resuelve
    renderConRuta();
    expect(screen.getByText(/Cargando/i)).toBeInTheDocument();
  });

  test("muestra el detalle de la solicitud y sus aprobadores", async () => {
    api.get.mockResolvedValue({ data: detalleBase });
    renderConRuta();

    expect(await screen.findByText("Compra de laptops")).toBeInTheDocument();
    expect(screen.getByText("María", { exact: false })).toBeInTheDocument();
    expect(screen.getAllByText("PENDIENTE").length).toBeGreaterThan(0);
  });

  test("NO muestra el botón de descarga si la solicitud no está COMPLETADA", async () => {
    api.get.mockResolvedValue({ data: detalleBase });
    renderConRuta();

    await screen.findByText("Compra de laptops");
    expect(screen.queryByText(/Descargar PDF/i)).not.toBeInTheDocument();
  });

  test("SÍ muestra el botón de descarga cuando la solicitud está COMPLETADA", async () => {
    const detalleCompletado = {
      ...detalleBase,
      solicitud: { ...detalleBase.solicitud, estado: "COMPLETADA" },
      aprobadores: detalleBase.aprobadores.map((a) => ({ ...a, estado_firma: "FIRMADO", fecha_firma: Date.now() })),
    };
    api.get.mockResolvedValue({ data: detalleCompletado });
    renderConRuta();

    expect(await screen.findByText(/Descargar PDF/i)).toBeInTheDocument();
  });

  test("muestra un mensaje de error si la API falla", async () => {
    api.get.mockRejectedValue(new Error("fail"));
    renderConRuta();

    expect(await screen.findByText(/No se pudo cargar/i)).toBeInTheDocument();
  });
});