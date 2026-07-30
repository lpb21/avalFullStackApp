import { render, screen } from "@testing-library/react";
import App from "../App";

jest.mock("aprobador/App", () => () => <div>Componente remoto simulado</div>, { virtual: true });

describe("App (host)", () => {
  test("renderiza la vista de Crear Solicitud en la ruta raíz", () => {
    render(<App />);
    expect(screen.getByText("Crear solicitud de compra")).toBeInTheDocument();
  });

  test("muestra los links de navegación", () => {
    render(<App />);
    expect(screen.getByRole("link", { name: /Crear solicitud/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Panel del solicitante/i })).toBeInTheDocument();
  });
});