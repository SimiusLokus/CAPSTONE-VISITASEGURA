import React from "react";

export default function TipoEventoSelector({ tipoEvento, setTipoEvento }) {
  const opciones = ["Visita", "Graduación", "Recorrido guiado", "Otro"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label htmlFor="tipo-evento" style={{ fontWeight: "bold" }}>
        Tipo de evento:
      </label>
      <select
        id="tipo-evento"
        value={tipoEvento}
        onChange={(e) => setTipoEvento(e.target.value)}
        className="form-select"
      >
        {opciones.map((opcion) => (
          <option key={opcion} value={opcion}>
            {opcion}
          </option>
        ))}
      </select>
    </div>
  );
}