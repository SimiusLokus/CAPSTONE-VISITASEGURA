import { useEffect, useState } from "react";
import LogoutButton from "../components/LogoutButton";

function AdminPage() {
  const [visitas, setVisitas] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState(""); // YYYY-MM-DD
  const [personasDentro, setPersonasDentro] = useState(0);
  const [mostrarSoloDentro, setMostrarSoloDentro] = useState(false);

  // Cargar registros desde backend
  const fetchVisitas = async () => {
    try {
      let url = "https://localhost:3001/visitas";
      if (filtroFecha) url += `?fecha=${filtroFecha}`;

      const response = await fetch(url);
      if (!response.ok) throw new Error("Error en la respuesta del servidor");

      const data = await response.json();
      if (data.ok) {
        setVisitas(data.data);

        // Calcular personas dentro
        const dentro = data.data.filter((v) => !v.hora_salida || v.hora_salida === "").length;
        setPersonasDentro(dentro);
      } else {
        console.error("Error al cargar visitas:", data.error);
      }
    } catch (error) {
      console.error("Error al cargar visitas:", error);
    }
  };

  useEffect(() => {
    fetchVisitas();
  }, [filtroFecha]);

  // Filtrado de tabla según botón "Mostrar solo dentro"
  const visitasMostradas = mostrarSoloDentro
    ? visitas.filter((v) => !v.hora_salida || v.hora_salida === "")
    : visitas;

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1 style={{ color: "#1976d2" }}>Panel Administrativo</h1>
      <p>Bienvenido al panel administrativo.</p>

      <div style={{ marginBottom: "15px", display: "flex", gap: "20px", alignItems: "center" }}>
        <label>
          Filtrar por fecha:{" "}
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            style={{ padding: "5px 10px", fontSize: "16px" }}
          />
        </label>

        <div>
          <strong>Total registros: </strong> {visitas.length}
        </div>

        <div>
          <strong>Personas dentro: </strong> {personasDentro}
        </div>

        <button
          onClick={() => setMostrarSoloDentro(!mostrarSoloDentro)}
          style={{
            padding: "6px 12px",
            backgroundColor: mostrarSoloDentro ? "#d32f2f" : "#1976d2",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          {mostrarSoloDentro ? "Mostrar todos" : "Mostrar solo dentro"}
        </button>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
          boxShadow: "0 0 5px rgba(0,0,0,0.2)",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#1976d2", color: "white" }}>
            <th style={{ padding: "10px" }}>#</th>
            <th>RUN</th>
            <th>Nombres</th>
            <th>Apellidos</th>
            <th>Tipo Evento</th>
            <th>Fecha</th>
            <th>Hora Entrada</th>
            <th>Hora Salida</th>
          </tr>
        </thead>
        <tbody>
          {visitasMostradas.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center", padding: "15px" }}>
                No hay registros
              </td>
            </tr>
          ) : (
            visitasMostradas.map((v, idx) => (
              <tr
                key={v.id}
                style={{
                  backgroundColor: idx % 2 === 0 ? "#f9f9f9" : "#ffffff",
                }}
              >
                <td style={{ padding: "8px" }}>{idx + 1}</td>
                <td>{v.run}</td>
                <td>{v.nombres}</td>
                <td>{v.apellidos}</td>
                <td>{v.tipo_evento}</td>
                <td>{v.fecha}</td>
                <td>{v.hora_entrada}</td>
                <td>{v.hora_salida || "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <div style={{ marginTop: "20px" }}>
        <LogoutButton />
      </div>
    </div>
  );
}

export default AdminPage;
