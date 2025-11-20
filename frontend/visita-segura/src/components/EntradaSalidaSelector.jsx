// EntradaSalidaSelector.jsx
import React from "react";

export default function EntradaSalidaSelector({ tipoEvento, setTipoEvento }) {
  return (
    <div>
      <button
        onClick={() => setTipoEvento("entrada")}
        style={{
          background: tipoEvento === "entrada" ? "green" : "gray",
          color: "white",
          marginRight: 10
        }}
      >
        Entrada
      </button>

      <button
        onClick={() => setTipoEvento("salida")}
        style={{
          background: tipoEvento === "salida" ? "blue" : "gray",
          color: "white"
        }}
      >
        Salida
      </button>
    </div>
  );
}
