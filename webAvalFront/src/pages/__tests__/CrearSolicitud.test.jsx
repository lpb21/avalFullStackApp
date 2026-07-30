import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CrearSolicitud from "../CrearSolicitud";
import api from "../../services/api";

jest.mock("../../services/api");

function llenarFormularioValido() {
  fireEvent.change(screen.getByLabelText(/Título/i), { target: { value: "Compra de prueba" } });
  fireEvent.change(screen.getByLabelText(/Descripción/i), { target: { value: "Descripción de prueba" } });
  fireEvent.change(screen.getByLabelText(/Monto/i), { target: { value: "1000000" } });
  fireEvent.change(screen.getByLabelText(/Tu nombre/i), { target: { value: "Juan Pérez" } });
  fireEvent.change(screen.getByLabelText(/Tu email/i), { target: { value: "juan@empresa.com" } });

  const nombres = screen.getAllByPlaceholderText("Nombre");
  const emails = screen.getAllByPlaceholderText("Email");
  const selects = screen.getAllByRole("combobox");

  const datos = [
    { nombre: "María Gómez", email: "maria@empresa.com", rol: "Jefe de Departamento" },
    { nombre: "Carlos Ruiz", email: "carlos@empresa.com", rol: "Director Financiero" },
    { nombre: "Ana Torres", email: "ana@empresa.com", rol: "Gerente General" },
  ];

  datos.forEach((d, i) => {
    fireEvent.change(nombres[i], { target: { value: d.nombre } });
    fireEvent.change(emails[i], { target: { value: d.email } });
    fireEvent.change(selects[i], { target: { value: d.rol } });
  });
}

describe("CrearSolicitud", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("renderiza el formulario con sus campos principales", () => {
    render(<CrearSolicitud />);
    expect(screen.getByText("Crear solicitud de compra")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Crear solicitud/i })).toBeInTheDocument();
  });

  test("muestra error si los 3 aprobadores no tienen roles distintos", async () => {
    render(<CrearSolicitud />);
    llenarFormularioValido();

    // Forzamos un rol duplicado después de llenar el formulario válido
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "Jefe de Departamento" } });

    fireEvent.click(screen.getByRole("button", { name: /Crear solicitud/i }));

    expect(
      await screen.findByText(/deben tener roles distintos/i)
    ).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  test("envía la solicitud y muestra el mensaje de éxito", async () => {
    api.post.mockResolvedValue({
      data: { solicitud_id: "abc-123", estado: "PENDIENTE" },
    });

    render(<CrearSolicitud />);
    llenarFormularioValido();

    fireEvent.click(screen.getByRole("button", { name: /Crear solicitud/i }));

    expect(await screen.findByText(/Solicitud creada correctamente/i)).toBeInTheDocument();
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith(
      "/api/v1/solicitudes",
      expect.objectContaining({ titulo: "Compra de prueba", monto: 1000000 })
    );
  });

  test("muestra el mensaje de error del backend si la creación falla", async () => {
    api.post.mockRejectedValue({
      response: { data: { mensaje: "Datos inválidos", errores: ["El campo 'titulo' es requerido"] } },
    });

    render(<CrearSolicitud />);
    llenarFormularioValido();

    fireEvent.click(screen.getByRole("button", { name: /Crear solicitud/i }));

    expect(await screen.findByText(/Datos inválidos/i)).toBeInTheDocument();
  });
});