// pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";

// Detecta si estás en localhost o red local
const getApiUrl = () => {
  const host = window.location.hostname;

  // Modo desarrollo local
  if (host === "localhost" || host === "127.0.0.1") {
    return "https://localhost:3001";
  }

  // Modo producción en red local / dominio
  return `https://${host}:3001`;
};

const API_URL = getApiUrl();

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError("Usuario o contraseña incorrectos");
        return;
      }

      // Guardar sesión
      localStorage.setItem("usuario", JSON.stringify(data));

      // Redirigir según rol
      if (data.rol === "admin") navigate("/admin");
      else if (data.rol === "security") navigate("/scanner");
      else navigate("/supervisor");

    } catch (error) {
      console.error(error);
      setError("No se pudo conectar al servidor");
    }
  };

  return (
    <div style={{ width: "300px", margin: "80px auto", textAlign: "center" }}>
      <h2>Iniciar Sesión</h2>

      <form onSubmit={handleLogin}>
        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />

        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ width: "100%", padding: "8px", marginBottom: "10px" }}
        />

        <button
          type="submit"
          style={{
            width: "100%",
            padding: "10px",
            background: "#007bff",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          Entrar
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: "10px" }}>{error}</p>}
    </div>
  );
}

export default Login;
