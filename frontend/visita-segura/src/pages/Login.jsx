import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Fade,
  CircularProgress
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Person,
  Lock,
  Login as LoginIcon
} from "@mui/icons-material";
import fondoImg from "../assets/fondo.jpg";

const getApiUrl = () => {
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return "https://localhost:3001";
  return `https://${host}:3001`;
};

const API_URL = getApiUrl();

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const userRef = useRef(null);
  const passRef = useRef(null);

  // 🔥 Bloquea submit por teclado
  const handleLogin = (e) => {
    e.preventDefault();
  };

  const doLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!data.ok) {
        setError("Usuario o contraseña incorrectos");
        setLoading(false);
        return;
      }

      localStorage.setItem("usuario", JSON.stringify(data));

      if (data.rol === "admin") navigate("/admin");
      else if (data.rol === "security") navigate("/scanner");
      else navigate("/supervisor");

    } catch (error) {
      console.error(error);
      setError("No se pudo conectar al servidor");
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Lógica ENTER dinámica
  const handleEnter = (e, field) => {
    if (e.key !== "Enter") return;
    e.preventDefault();

    if (field === "user") {
      // Enter en usuario
      if (password === "") {
        passRef.current.focus();
      } else {
        doLogin();
      }
    }

    if (field === "pass") {
      // Enter en contraseña
      if (username === "") {
        userRef.current.focus();
      } else {
        doLogin();
      }
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 2,

        background: `radial-gradient(
          circle at 50% 35%,
          rgba(255,255,255,0.20) 0%,
          rgba(0,0,0,0.65) 45%,
          rgba(0,0,0,0.9) 90%
        ),
        url(${fondoImg})`,

        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}
    >
      <Container maxWidth="sm">
        <Fade in timeout={800}>
          <Paper
            elevation={24}
            sx={{
              padding: { xs: 3, sm: 5 },
              borderRadius: 4,
              background: "rgba(20, 20, 25, 0.72)",
              backdropFilter: "blur(25px)",
              boxShadow: "0 8px 40px rgba(0, 0, 0, 0.6)",
              border: "1px solid rgba(255, 255, 255, 0.1)",

              animation: error ? "shake 0.3s ease" : "none",
              "@keyframes shake": {
                "0%": { transform: "translateX(0px)" },
                "25%": { transform: "translateX(-4px)" },
                "50%": { transform: "translateX(4px)" },
                "75%": { transform: "translateX(-4px)" },
                "100%": { transform: "translateX(0px)" },
              },
            }}
          >
            <Box sx={{ display: "flex", justifyContent: "center", mb: 3 }}>
              <img
                src="/logo_duoc2.png"
                alt="Logo"
                style={{ width: "260px", height: "auto" }}
              />
            </Box>

            <Typography
              variant="h4"
              align="center"
              sx={{
                mb: 1,
                fontWeight: 700,
                background: "linear-gradient(45deg, #42a5f5, #90caf9)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Iniciar Sesión
            </Typography>

            <Typography
              variant="body2"
              align="center"
              color="gray"
              sx={{ mb: 4 }}
            >
              Ingresa tus credenciales para continuar
            </Typography>

            <Box component="form" onSubmit={handleLogin} noValidate>

              {/* Usuario */}
              <TextField
                inputRef={userRef}
                fullWidth
                label="Usuario"
                variant="outlined"
                margin="normal"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
                onKeyDown={(e) => handleEnter(e, "user")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person sx={{ color: "#90caf9" }} />
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 2,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.05)",
                    color: "white",
                    transition: "0.3s",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },

                    "&:hover": {
                      boxShadow: "0 0 12px rgba(144,202,249,0.3)",
                      borderColor: "#90caf9",
                    },
                    "&.Mui-focused": {
                      boxShadow: "0 0 18px rgba(144,202,249,0.45)",
                    },
                  },
                  "& label": { color: "rgba(255,255,255,0.7)" },
                }}
              />

              {/* Contraseña */}
              <TextField
                inputRef={passRef}
                fullWidth
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                variant="outlined"
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                onKeyDown={(e) => handleEnter(e, "pass")}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock sx={{ color: "#90caf9" }} />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword(!showPassword)}
                        edge="end"
                        sx={{ color: "white" }}
                      >
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  mb: 3,
                  "& .MuiOutlinedInput-root": {
                    borderRadius: 2,
                    background: "rgba(255,255,255,0.05)",
                    color: "white",
                    transition: "0.3s",
                    "& fieldset": { borderColor: "rgba(255,255,255,0.2)" },
                    "&:hover": {
                      boxShadow: "0 0 12px rgba(144,202,249,0.3)",
                    },
                    "&.Mui-focused": {
                      boxShadow: "0 0 18px rgba(144,202,249,0.45)",
                    },
                  },
                  "& label": { color: "rgba(255,255,255,0.7)" },
                }}
              />

              {error && (
                <Fade in>
                  <Alert
                    severity="error"
                    sx={{ mb: 2, borderRadius: 2 }}
                    onClose={() => setError("")}
                  >
                    {error}
                  </Alert>
                </Fade>
              )}

              <Button
                fullWidth
                variant="contained"
                disabled={loading}
                onClick={doLogin}
                startIcon={
                  loading ? <CircularProgress size={20} color="inherit" /> : <LoginIcon />
                }
                sx={{
                  mt: 2,
                  py: 1.4,
                  borderRadius: 2,
                  fontWeight: 700,
                  textTransform: "none",
                  fontSize: "1rem",
                  background: "linear-gradient(45deg, #42a5f5 20%, #1e88e5 90%)",
                  boxShadow: "0 4px 25px rgba(66,165,245,0.4)",
                  transition: "0.3s",

                  "&:hover": {
                    background: "linear-gradient(45deg, #64b5f6 20%, #2196f3 90%)",
                    boxShadow: "0 6px 30px rgba(66,165,245,0.55)",
                    transform: "translateY(-2px)",
                  },
                }}
              >
                {loading ? "Ingresando..." : "Ingresar"}
              </Button>
            </Box>
          </Paper>
        </Fade>
      </Container>
    </Box>
  );
}

export default Login;
