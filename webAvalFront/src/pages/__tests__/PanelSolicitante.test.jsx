import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PanelSolicitante from "../PanelSolicitante";
import api from "../../services/api";

jest.mock("../../services/api");

function renderConRouter() {
  return render(
    <MemoryRouter>
      <PanelSolicitante />
    </MemoryRouter>
  );
}

describe("PanelSolicitante", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("no llama a la API hasta que se busca un email", () => {
    renderConRouter();
    expect(api.get).not.toHaveBeenCalled();
  });

  test("busca y muestra las solicitudes del email ingresado", async () => {
    api.get.mockResolvedValue({
      data: [
        {
          solicitud_id: "sol-1",
          titulo: "Compra de laptops",
          monto: 15000000,
          estado: "PENDIENTE",
          aprobadores_count: { pendientes: 3, firmados: 0, rechazados: 0 },
        },
      ],
    });

    renderConRouter();

    fireEvent.change(screen.getByPlaceholderText(/Tu email de solicitante/i), {
      target: { value: "juan@empresa.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ver mis solicitudes/i }));

    expect(await screen.findByText("Compra de laptops")).toBeInTheDocument();
    expect(screen.getByText("PENDIENTE")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith(
      expect.stringContaining("solicitante_email=juan%40empresa.com")
    );
  });

  test("muestra mensaje cuando no hay solicitudes para el email", async () => {
    api.get.mockResolvedValue({ data: [] });

    renderConRouter();

    fireEvent.change(screen.getByPlaceholderText(/Tu email de solicitante/i), {
      target: { value: "nadie@empresa.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ver mis solicitudes/i }));

    expect(await screen.findByText(/No se encontraron solicitudes/i)).toBeInTheDocument();
  });

  test("muestra un error si la API falla", async () => {
    api.get.mockRejectedValue(new Error("Network error"));

    renderConRouter();

    fireEvent.change(screen.getByPlaceholderText(/Tu email de solicitante/i), {
      target: { value: "juan@empresa.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Ver mis solicitudes/i }));

    expect(await screen.findByText(/No se pudieron cargar/i)).toBeInTheDocument();
  });
});