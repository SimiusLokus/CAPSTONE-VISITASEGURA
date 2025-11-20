import { useEffect, useState } from "react";
import LogoutButton from "../components/LogoutButton";

function AdminPage() {
  const [registros, setRegistros] = useState([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch("https://localhost:3001/visitas", {
          method: "GET",
        });

        const data = await response.json();
        if (data.ok) {
          setRegistros(data.data);
        }
      } catch (error) {
        console.error("Error cargando registros:", error);
      }
    }

    fetchData();
  }, []);

  return (
    <div style={{ padding: "25px", fontFamily: "Arial" }}>
      <h1 style={{ marginBottom: "10px" }}>Panel Administrador</h1>
      <p style={{ marginTop: "0", marginBottom: "20px" }}>
        Registros de entradas y salidas.
      </p>

      <LogoutButton />

      {/* TABLA */}
      <div
        style={{
          marginTop: "25px",
          overflowX: "auto",
          borderRadius: "10px",
          border: "1px solid #ccc",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            backgroundColor: "#fff",
          }}
        >
          <thead style={{ backgroundColor: "#1976d2", color: "white" }}>
            <tr>
              <th style={cellHead}>#</th>
              <th style={cellHead}>RUN</th>
              <th style={cellHead}>Nombre</th>
              <th style={cellHead}>Apellido</th>
              <th style={cellHead}>Tipo evento</th>
              <th style={cellHead}>Hora entrada</th>
              <th style={cellHead}>Hora salida</th>
            </tr>
          </thead>

          <tbody>
            {registros.length === 0 ? (
              <tr>
                <td colSpan="7" style={emptyRow}>
                  No hay registros todavía.
                </td>
              </tr>
            ) : (
              registros.map((r, index) => (
                <tr key={r.id} style={index % 2 ? rowEven : rowOdd}>
                  <td style={cell}>{index + 1}</td>
                  <td style={cell}>{r.run}</td>
                  <td style={cell}>{r.nombres}</td>
                  <td style={cell}>{r.apellidos}</td>
                  <td style={cell}>{r.tipo_evento || "—"}</td>
                  <td style={cell}>
                    {r.hora_entrada
                      ? new Date(r.hora_entrada).toLocaleString()
                      : "—"}
                  </td>
                  <td style={cell}>
                    {r.hora_salida
                      ? new Date(r.hora_salida).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ------- ESTILOS -------
const cellHead = {
  padding: "12px",
  textAlign: "left",
  fontWeight: "bold",
};

const cell = {
  padding: "10px",
  borderBottom: "1px solid #ddd",
};

const rowEven = { backgroundColor: "#f7f7f7" };
const rowOdd = { backgroundColor: "#ffffff" };

const emptyRow = {
  padding: "20px",
  textAlign: "center",
  color: "#666",
};

export default AdminPage;
