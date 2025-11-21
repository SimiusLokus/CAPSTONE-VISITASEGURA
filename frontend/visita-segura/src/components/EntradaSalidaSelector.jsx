// ---------------------- BOTONES ENTRADA / SALIDA ----------------------
function EntradaSalidaSelector({ accion, setAccion }) {
  const baseStyle = {
    padding: "10px 16px",
    border: "2px solid white",
    borderRadius: "8px",
    fontWeight: "bold",
    cursor: "pointer",
    width: "120px",
    textAlign: "center",
  };

  return (
    <div style={{ display: "flex", gap: "10px" }}>
      {/* ENTRADA */}
      <button
        onClick={() => setAccion("entrada")}
        style={{
          ...baseStyle,
          background: accion === "entrada" ? "#FFB61B" : "black",
          color: accion === "entrada" ? "black" : "white",
        }}
      >
        Entrada
      </button>

      {/* SALIDA */}
      <button
        onClick={() => setAccion("salida")}
        style={{
          ...baseStyle,
          background: accion === "salida" ? "#FFB61B" : "black",
          color: accion === "salida" ? "black" : "white",
        }}
      >
        Salida
      </button>
    </div>
  );
}
