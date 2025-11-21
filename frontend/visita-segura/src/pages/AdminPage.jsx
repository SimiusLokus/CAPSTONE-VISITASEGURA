import { useEffect, useState } from "react";
import LogoutButton from "../components/LogoutButton";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

function AdminPage() {
  const [visitas, setVisitas] = useState([]);
  const [filtroFecha, setFiltroFecha] = useState(""); // YYYY-MM-DD
  const [totalUsuarios, setTotalUsuarios] = useState(0);
  const [personasDentro, setPersonasDentro] = useState(0);

  // Cargar registros desde backend
  const fetchVisitas = async (fecha) => {
    try {
      const url = fecha 
        ? `https://localhost:3001/visitas?fecha=${fecha}` 
        : "https://localhost:3001/visitas";
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Error en la respuesta del servidor");
      
      const data = await response.json();
      const visitasMostradas = data.data || [];
      setVisitas(visitasMostradas);

      // Contadores
      setTotalUsuarios(visitasMostradas.length);
      setPersonasDentro(visitasMostradas.filter(v => !v.hora_salida).length);

    } catch (error) {
      console.error("Error al cargar visitas:", error);
    }
  };

  useEffect(() => {
    fetchVisitas(filtroFecha);
  }, [filtroFecha]);

  // Exportar Excel
  const exportarExcel = () => {
    if (visitas.length === 0) return;

    const dataExport = visitas.map((v, idx) => ({
      "#": idx + 1,
      RUN: v.run,
      Nombres: v.nombres,
      Apellidos: v.apellidos,
      "Tipo Evento": v.tipo_evento,
      Fecha: v.fecha,
      "Hora Entrada": v.hora_entrada,
      "Hora Salida": v.hora_salida || "-",
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Visitas");

    const fechaStr = filtroFecha || new Date().toISOString().split("T")[0];
    const fileName = `reporte-${fechaStr}.xlsx`;

    const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([wbout], { type: "application/octet-stream" });
    saveAs(blob, fileName);
  };

  return (
    <div style={{ padding: "20px" }}>
      <h1>Hola Administrador</h1>
      <p>Bienvenido al panel administrativo.</p>

      <div style={{ marginBottom: "15px" }}>
        <label>
          Filtrar por fecha:{" "}
          <input
            type="date"
            value={filtroFecha}
            onChange={(e) => setFiltroFecha(e.target.value)}
            style={{ padding: "5px", fontSize: "16px" }}
          />
        </label>
        <button 
          onClick={exportarExcel} 
          style={{ marginLeft: "10px", padding: "8px 12px", fontSize: "16px" }}
        >
          Exportar
        </button>
      </div>

      <div style={{ marginBottom: "15px", fontSize: "16px" }}>
        <span>Total Usuarios: {totalUsuarios}</span>{" "}
        <span style={{ marginLeft: "20px" }}>Personas dentro: {personasDentro}</span>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          textAlign: "left",
        }}
      >
        <thead>
          <tr style={{ backgroundColor: "#1976d2", color: "white" }}>
            <th style={{ padding: "8px" }}>#</th>
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
          {visitas.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: "center", padding: "10px" }}>
                No hay registros
              </td>
            </tr>
          ) : (
            visitas.map((v, idx) => (
              <tr
                key={v.id}
                style={{
                  backgroundColor: idx % 2 === 0 ? "#f1f1f1" : "#ffffff",
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
