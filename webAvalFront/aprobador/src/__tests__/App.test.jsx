import { render, screen, fireEvent } from "@testing-library/react";
import App from "../App";
import api from "../services/api";

jest.mock("../services/api");

function configurarUrl(solicitudId, approverToken) {
  const url = new URL(window.location.href);
  url.search = `?solicitud_id=${solicitudId}&approver_token=${approverToken}`;
  window.history.pushState({}, "", url);
}

describe("App (remote aprobador)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("muestra error si faltan parámetros en la URL", async () => {
    configurarUrl("", "");
    render(<App />);
    expect(await screen.findByText(/Este link no es válido/i)).toBeInTheDocument();
    expect(api.get).not.toHaveBeenCalled();
  });

  test("resuelve el token y muestra la pantalla de OTP", async () => {
    configurarUrl("sol-1", "token-123");
    api.get.mockResolvedValue({ data: { orden: 1, generaciones_restantes: 2 } });

    render(<App />);

    expect(await screen.findByText("Verificación de identidad")).toBeInTheDocument();
    expect(screen.getByText(/Envíos de código restantes: 2/i)).toBeInTheDocument();
  });

  test("muestra error si el token es inválido", async () => {
    configurarUrl("sol-1", "token-malo");
    api.get.mockRejectedValue({
      response: { data: { mensaje: "Token inválido o expirado" } },
    });

    render(<App />);

    expect(await screen.findByText("Token inválido o expirado")).toBeInTheDocument();
  });

  test("verifica el OTP y avanza a la pantalla de detalle", async () => {
    configurarUrl("sol-1", "token-123");
    api.get.mockResolvedValue({ data: { orden: 1, generaciones_restantes: 2 } });
    api.post.mockResolvedValue({
      data: {
        firma_token: "firma-abc",
        detalle: {
          solicitud: { titulo: "Compra de laptops", descripcion: "desc", monto: 1000000, solicitante_nombre: "Juan" },
          aprobadores: [
            { orden: 1, nombre: "María", rol: "Jefe de Departamento", estado_firma: "PENDIENTE" },
            { orden: 2, nombre: "Carlos", rol: "Director Financiero", estado_firma: "PENDIENTE" },
            { orden: 3, nombre: "Ana", rol: "Gerente General", estado_firma: "PENDIENTE" },
          ],
        },
      },
    });

    render(<App />);

    await screen.findByText("Verificación de identidad");
    fireEvent.change(screen.getByPlaceholderText(/Código de 6 dígitos/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verificar código/i }));

    expect(await screen.findByText("Compra de laptops")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aprobar/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Rechazar/i })).toBeInTheDocument();
  });

  test("firma la solicitud y muestra el resultado final", async () => {
    configurarUrl("sol-1", "token-123");
    api.get.mockResolvedValue({ data: { orden: 1, generaciones_restantes: 2 } });
    api.post
      .mockResolvedValueOnce({
        data: {
          firma_token: "firma-abc",
          detalle: {
            solicitud: { titulo: "Compra de laptops", descripcion: "desc", monto: 1000000, solicitante_nombre: "Juan" },
            aprobadores: [{ orden: 1, nombre: "María", rol: "Jefe", estado_firma: "PENDIENTE" }],
          },
        },
      })
      .mockResolvedValueOnce({
        data: { mensaje: "Firma registrada", estado: "FIRMADO", solicitud_estado: "PENDIENTE" },
      });

    render(<App />);

    await screen.findByText("Verificación de identidad");
    fireEvent.change(screen.getByPlaceholderText(/Código de 6 dígitos/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Verificar código/i }));

    await screen.findByText("Compra de laptops");
    fireEvent.click(screen.getByRole("button", { name: /^Aprobar$/i }));

    expect(await screen.findByText("¡Listo!")).toBeInTheDocument();
    expect(screen.getByText("Firma registrada")).toBeInTheDocument();
    expect(api.post).toHaveBeenLastCalledWith(
      expect.stringContaining("/aprobadores/1/firmar"),
      { accion: "APROBAR" },
      expect.objectContaining({ headers: { "X-Firma-Token": "firma-abc" } })
    );
  });
});