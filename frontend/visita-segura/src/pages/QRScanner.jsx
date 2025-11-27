// src/pages/QRScanner.jsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import {
  Box,
  Paper,
  Button,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Snackbar,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Stack,
  Fade,
  Grow,
  Container,
  useTheme,
  alpha,
} from "@mui/material";
import {
  QrCodeScanner,
  CheckCircle,
  Error as ErrorIcon,
  Login,
  Logout as LogoutIcon,
  CameraAlt,
  Stop,
} from "@mui/icons-material";
import LogoutButton from "../components/LogoutButton";
import fondoImg from "../assets/fondo.jpg";

const getApiUrl = () => {
  if (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  ) {
    return "https://localhost:3001";
  }
  return `https://${window.location.hostname}:3001`;
};

const API_BASE_URL = getApiUrl();

export default function QRScanner() {
  const theme = useTheme();
  const videoRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [run, setRun] = useState("");
  const [serial, setSerial] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showToast, setShowToast] = useState(false);

  const [accion, setAccion] = useState("entrada");
  const [tipoEvento, setTipoEvento] = useState("Visita");

  const [flip, setFlip] = useState(false);
  const [ticksSinQR, setTicksSinQR] = useState(0);

  const stopScan = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setScanning(false);
    setFlip(false);
  }, [stream]);

  const startScan = async () => {
    setFlip(true);
    setTicksSinQR(0);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          zoom: 2
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        const videoTrack = mediaStream.getVideoTracks()[0];
        const capabilities = videoTrack.getCapabilities();
        
        if (capabilities.zoom) {
          await videoTrack.applyConstraints({
            advanced: [{ zoom: 2 }]
          });
        }
      }
      
      setStream(mediaStream);
      setScanning(true);
      setRun("");
      setSerial("");
      setErrorMsg("");
    } catch (e) {
      setErrorMsg("No se pudo acceder a la cámara.");
    }
  };

  useEffect(() => {
    if (!scanning) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    let rafId = null;

    const tick = () => {
      if (!scanning) return;

      setTicksSinQR((prev) => {
        const nuevo = prev + 1;
        if (nuevo > 300) {
          stopScan();
          return 0;
        }
        return nuevo;
      });

      try {
        if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;

          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const code = jsQR(
            imageData.data,
            imageData.width,
            imageData.height
          );

          if (code) {
            setTicksSinQR(0);
            try {
              const url = new URL(code.data);
              const params = new URLSearchParams(url.search);

              const qrRun = params.get("RUN") || "";
              const qrSerial = params.get("serial") || "";

              setRun(qrRun);
              setSerial(qrSerial);

              const payload = {
                run: qrRun,
                nombres: "no disponible",
                apellidos: "no disponible",
                fecha_nac: "no disponible",
                sexo: "no disponible",
                num_doc: qrSerial,
                tipo_evento: tipoEvento,
                accion: accion,
              };
              fetch(`${API_BASE_URL}/visitas`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              })
                .then(async (res) => {
                  if (!res.ok) {
                    // intentamos leer el mensaje de error que venga del backend
                    let data = {};
                    try { data = await res.json(); } catch {}
                    
                    // Si el backend indica que el usuario ya existe
                    if (data.error) throw new Error(data.error);
                    
                    // Si es conflicto 409
                    if (res.status === 409) {
                      if (accion === "entrada") throw new Error("Usuario ya ingresado");
                      if (accion === "salida") throw new Error("El usuario ya ha salido");
                    }
                    
                    throw new Error(`HTTP ${res.status}`);
                  }
                  return res.json();
                })
                .then(() => {
                  setShowToast(true);
                })
                .catch((err) => {
                  setErrorMsg(err.message || "Error desconocido");
                });
            } catch (e) {
              setErrorMsg(e.message || "Error al procesar QR");
            }

            stopScan();
            return;
          }
        }
      } catch {}

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [scanning, tipoEvento, accion, stopScan]);

  return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          position: "relative",
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

      <Container maxWidth="sm" sx={{ position: "relative", zIndex: 10, py: 4 }}>
        <Fade in timeout={800}>
          <Paper
            elevation={24}
            sx={{
              borderRadius: 4,
              overflow: "hidden",
              background: alpha(theme.palette.background.paper, 0.95),
              backdropFilter: "blur(20px)",
              border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
            }}
          >
            {/* Header con gradiente */}
          <Box
            sx={{
              background: `linear-gradient(
                135deg, 
                ${alpha("#000", 0.9)} 0%, 
                ${alpha("#000", 0.6)} 100%
              )`,
              p: 3,
              position: "relative",
              overflow: "hidden",

              "&::before": {
                content: '""',
                position: "absolute",
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: alpha("#fff", 0.05), // ⭐ suave para no opacar el negro
              },
            }}
          >

              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ position: "relative", zIndex: 1 }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flex: 1 }}>
                  <QrCodeScanner sx={{ fontSize: 40, color: "white", flexShrink: 0 }} />

                  <Typography
                    variant="h4"
                    sx={{
                      color: "white",
                      fontWeight: 800,
                      letterSpacing: "-0.5px",

                      // ✔ hace que se adapte
                      flexGrow: 1,
                      flexShrink: 1,
                      minWidth: 0, // Necesario para que text-overflow funcione

                      // ✔ controla el ajuste del texto
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",

                      // ✔ tamaño responsivo
                      fontSize: {
                        xs: "1.4rem",
                        sm: "1.8rem",
                        md: "2rem",
                      },
                    }}
                  >
                    VisitaSegura
                  </Typography>
                </Stack>

                <LogoutButton />
              </Stack>
            </Box>

            {/* Contenido principal */}
            <Box sx={{ p: 3 }}>
              {/* Toggle Entrada/Salida */}
              <Box sx={{ mb: 3 }}>
                <ToggleButtonGroup
                  value={accion}
                  exclusive
                  onChange={(e, v) => v && setAccion(v)}
                  fullWidth
                  sx={{
                    "& .MuiToggleButton-root": {
                      py: 1.5,
                      fontWeight: 600,
                      textTransform: "none",
                      fontSize: "1rem",
                      border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                      "&.Mui-selected": {
                        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                        color: "white",
                        "&:hover": {
                          background: `linear-gradient(135deg, ${theme.palette.primary.dark} 0%, ${theme.palette.primary.main} 100%)`,
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="entrada">
                    <Login sx={{ mr: 1 }} /> Entrada
                  </ToggleButton>
                  <ToggleButton value="salida">
                    <LogoutIcon sx={{ mr: 1 }} /> Salida
                  </ToggleButton>
                </ToggleButtonGroup>
              </Box>

              {/* Tipo de evento */}
              {accion === "entrada" && (
                <Grow in timeout={500}>
                  <FormControl fullWidth sx={{ mb: 3 }}>
                    <InputLabel
                      sx={{
                        fontWeight: 600,
                        "&.Mui-focused": { fontWeight: 700 },
                      }}
                    >
                      Tipo de evento
                    </InputLabel>
                    <Select
                      value={tipoEvento}
                      label="Tipo de evento"
                      onChange={(e) => setTipoEvento(e.target.value)}
                      sx={{
                        borderRadius: 2,
                        "& .MuiOutlinedInput-notchedOutline": {
                          borderWidth: 2,
                        },
                      }}
                    >
                      <MenuItem value="Visita">🏛️ Visita</MenuItem>
                      <MenuItem value="Graduacion">🎓 Graduación</MenuItem>
                      <MenuItem value="Recorrido guiado">🚶 Recorrido guiado</MenuItem>
                      <MenuItem value="Otro">📋 Otro</MenuItem>
                    </Select>
                  </FormControl>
                </Grow>
              )}

              {/* Video/QR Scanner */}
              <Paper
                elevation={8}
                sx={{
                  position: "relative",
                  width: "100%",
                  height: 280, // ⬅️ ANTES: 320 (más compacto)
                  mb: 3,
                  borderRadius: 3,
                  overflow: "hidden",
                  border: scanning
                    ? `3px solid ${theme.palette.primary.main}`
                    : `3px solid ${alpha(theme.palette.divider, 0.2)}`,
                  transition: "all 0.3s ease",
                  boxShadow: scanning
                    ? `0 0 30px ${alpha(theme.palette.primary.main, 0.4)}`
                    : "none",
                }}
              >
                {flip ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                      }}
                    />

                    <Box
                      sx={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        alignItems: "center",
                        background: alpha("#000", 0.2),
                      }}
                    >
                      <Box
                        sx={{
                          width: 200,     // ⬅️ ANTES: 250
                          height: 200,    // ⬅️ ANTES: 250
                          border: `4px solid ${theme.palette.primary.main}`,
                          borderRadius: 3,
                          position: "relative",
                          boxShadow: `0 0 0 2000px ${alpha("#000", 0.5)}`,
                          "&::before, &::after": {
                            content: '""',
                            position: "absolute",
                            width: 25,   // ⬅️ Antes: 30 (ligeramente más pequeño)
                            height: 25,
                            borderColor: theme.palette.primary.main,
                            borderStyle: "solid",
                          },
                          "&::before": {
                            top: -4,
                            left: -4,
                            borderWidth: "4px 0 0 4px",
                            borderTopLeftRadius: 10,
                          },
                          "&::after": {
                            bottom: -4,
                            right: -4,
                            borderWidth: "0 4px 4px 0",
                            borderBottomRightRadius: 10,
                          },
                        }}
                      />
                      <Chip
                        label="Escaneando..."
                        color="primary"
                        sx={{
                          mt: 3,
                          fontWeight: 700,
                          fontSize: "0.90rem", // opcional: un pelito más pequeño
                          px: 2,
                        }}
                      />
                    </Box>
                  </>
                ) : (
                  <Box
                    sx={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      background: `linear-gradient(135deg, ${alpha(
                        theme.palette.primary.main,
                        0.05
                      )} 0%, ${alpha(theme.palette.secondary.main, 0.05)} 100%)`,
                    }}
                  >
                    <QrCodeScanner
                      sx={{ fontSize: 80, color: alpha("#000", 0.2), mb: 2 }} // ⬅️ ANTES: 100
                    />
                  </Box>
                )}
              </Paper>


              {/* Botón de acción */}
              {!scanning ? (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={startScan}
                  startIcon={<CameraAlt />}
                  sx={{
                    py: 1.8,
                    borderRadius: 2.5,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    textTransform: "none",
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    boxShadow: `0 8px 20px ${alpha(theme.palette.primary.main, 0.4)}`,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: `0 12px 28px ${alpha(theme.palette.primary.main, 0.5)}`,
                    },
                  }}
                >
                  Iniciar Escaneo
                </Button>
              ) : (
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  color="error"
                  onClick={stopScan}
                  startIcon={<Stop />}
                  sx={{
                    py: 1.8,
                    borderRadius: 2.5,
                    fontSize: "1.1rem",
                    fontWeight: 700,
                    textTransform: "none",
                    boxShadow: `0 8px 20px ${alpha(theme.palette.error.main, 0.4)}`,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: `0 12px 28px ${alpha(theme.palette.error.main, 0.5)}`,
                    },
                  }}
                >
                  Detener Escaneo
                </Button>
              )}
            </Box>
          </Paper>
        </Fade>
      </Container>

      {/* Modal de éxito centrado */}
      <Snackbar
        open={showToast}
        autoHideDuration={3000}
        onClose={() => setShowToast(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{
          top: "50% !important",
          transform: "translateY(-50%)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "white",
            borderRadius: 4,
            p: 4,
            boxShadow: `0 20px 60px ${alpha(theme.palette.success.main, 0.4)}`,
            minWidth: 280,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.palette.success.light} 0%, ${theme.palette.success.main} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 2,
              animation: "scaleIn 0.5s ease-out",
              "@keyframes scaleIn": {
                "0%": { transform: "scale(0)", opacity: 0 },
                "50%": { transform: "scale(1.1)" },
                "100%": { transform: "scale(1)", opacity: 1 },
              },
            }}
          >
            <CheckCircle sx={{ fontSize: 50, color: "white" }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: theme.palette.success.main,
              textAlign: "center",
            }}
          >
            ¡Registro Exitoso!
          </Typography>
        </Box>
      </Snackbar>

      {/* Modal de error centrado */}
      <Snackbar
        open={!!errorMsg}
        autoHideDuration={3000}
        onClose={() => setErrorMsg("")}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
        sx={{
          top: "50% !important",
          transform: "translateY(-50%)",
        }}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "white",
            borderRadius: 4,
            p: 4,
            boxShadow: `0 20px 60px ${alpha(theme.palette.error.main, 0.4)}`,
            minWidth: 280,
          }}
        >
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `linear-gradient(135deg, ${theme.palette.error.light} 0%, ${theme.palette.error.main} 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              mb: 2,
              animation: "scaleIn 0.5s ease-out",
              "@keyframes scaleIn": {
                "0%": { transform: "scale(0)", opacity: 0 },
                "50%": { transform: "scale(1.1)" },
                "100%": { transform: "scale(1)", opacity: 1 },
              },
            }}
          >
            <ErrorIcon sx={{ fontSize: 50, color: "white" }} />
          </Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: theme.palette.error.main,
              textAlign: "center",
            }}
          >
            {errorMsg}
          </Typography>
        </Box>
      </Snackbar>
    </Box>
  );
}
