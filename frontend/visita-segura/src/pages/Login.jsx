// pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Login.css";
import fondoImg from "../assets/fondo.jpg";

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
    <div className="login-container" style={{ backgroundImage: `url(${fondoImg})`}} >
      <div className="login-card">
        {/* Logo */}
        <div className="logo">
          <img 
            src="/logo_duoc2.png" 
            alt="Sitemarku Logo" 
            style={{ width: "325px", height: "74px" }} 
          />
        </div>
        {/* Title */}
        <h1 className="login-title">Iniciar Sesión</h1>

        <form onSubmit={handleLogin}>
          {/* Email/Username */}
          <div className="input-group">
            <label className="input-label">Usuario</label>
            <input
              type="text"
              className="input-field"
              placeholder=""
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div className="input-group">
            <label className="input-label">Contraseña</label>
            <input
              type="password"
              className="input-field"
              placeholder="••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>


          {/* Sign In Button */}
          <button type="submit" className="btn-signin">
            Ingresar
          </button>
        </form>

        {/* Error */}
        {error && <p className="error-message">{error}</p>}
      </div>
    </div>
  );
}

export default Login;