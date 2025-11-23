import React, { useRef, useState, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import LogoutButton from "../components/LogoutButton";
import { Box, Button, Card, Typography, Paper, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import "../App.css";
import fondoImg from "../assets/fondo.jpg";

// ---------------------- SELECTOR ENTRADA / SALIDA ----------------------
function EntradaSalidaSelector({ accion, setAccion }) {
  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      {["entrada", "salida"].map((tipo) => (
        <Button
          key={tipo}
          variant="contained"
          onClick={() => setAccion(tipo)}
          sx={{
            textTransform: "none",
            fontWeight: 800,
            px: 2,
            py: 1,
            borderRadius: "8px",
            background:
              accion === tipo
                ? "linear-gradient(90deg, #00eaff, #00b7ff)"
                : "rgba(0,0,0,0.7)",
            border: "2px solid #00eaff",
            boxShadow:
              accion === tipo
                ? "0 0 12px #00eaff, 0 0 22px #00b7ff"
                : "0 0 8px rgba(0, 234, 255, 0.3)",
            color: accion === tipo ? "black" : "#00eaff",
            "&:hover": {
              transform: "scale(1.05)",
              boxShadow: "0 0 20px #00eaff",
            },
            transition: "0.2s",
          }}
        >
          {tipo.toUpperCase()}
        </Button>
      ))}
    </Box>
  );
}

// ---------------------- SELECTOR EVENTO ----------------------
function TipoEventoSelector({ tipoEvento, setTipoEvento, accion }) {
  if (accion === "salida") return null;

  return (
    <FormControl fullWidth sx={{ mb: 3 }}>
      <InputLabel sx={{ color: "#00eaff" }}>Tipo de evento</InputLabel>

      <Select
        value={tipoEvento}
        onChange={(e) => setTipoEvento(e.target.value)}
        sx={{
          color: "#00eaff",
          borderRadius: "10px",
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00eaff",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00b7ff",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#00eaff",
            boxShadow: "0 0 12px #00eaff",
          },
        }}
      >
        <MenuItem value="Visita">Visita</MenuItem>
        <MenuItem value="Graduacion">Graduación</MenuItem>
        <MenuItem value="Recorrido guiado">Recorrido guiado</MenuItem>
        <MenuItem value="Otro">Otro</MenuItem>
      </Select>
    </FormControl>
  );
}

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
  const videoRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [run, setRun] = useState("");
  const [serial, setSerial] = useState("");
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiUrl] = useState(API_BASE_URL);
  const [showToast, setShowToast] = useState(false);
  const [flip, setFlip] = useState(false);

  const [accion, setAccion] = useState("entrada");
  const [tipoEvento, setTipoEvento] = useState("Visita");
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
        video: { facingMode: "environment" },
      });

      if (videoRef.current) videoRef.current.srcObject = mediaStream;

      setStream(mediaStream);
      setScanning(true);
      setRun("");
      setSerial("");
      setError(false);
      setErrorMsg("");
    } catch (e) {
      alert("No se pudo acceder a la cámara.");
    }
  };

  // ---------------------- LOOP ESCANEO ----------------------
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

      if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

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

            fetch(`${apiUrl}/visitas`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
              .then((res) => res.json())
              .then(() => {
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
              })
              .catch(() => {
                setError(true);
                setErrorMsg("Error al registrar la visita.");
              });
          } catch (e) {
            setError(true);
            setErrorMsg("Código QR inválido.");
          }

          stopScan();
          return;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => rafId && cancelAnimationFrame(rafId);
  }, [scanning, apiUrl, tipoEvento, accion, stopScan]);

  // ---------------------- UI NEON ----------------------
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        p: 2,
        background: `radial-gradient(circle at 50% 50%, rgba(0,30,40,0.9), rgba(0,0,0,1)), url(${fondoImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: 600,
          borderRadius: 4,
          p: 0,
          overflow: "hidden",
          border: "2px solid #00eaff",
          background: "rgba(0,0,0,0.75)",
          boxShadow: "0 0 25px #00eaff, 0 0 40px #0088aa",
        }}
      >
        {/* BARRA SUPERIOR */}
        <Box
          sx={{
            p: 2,
            background: "rgba(0,0,0,0.9)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "2px solid #00eaff",
          }}
        >
          <EntradaSalidaSelector accion={accion} setAccion={setAccion} />
          <LogoutButton />
        </Box>

        {/* CUERPO */}
        <Box sx={{ p: 3 }}>
          <TipoEventoSelector
            tipoEvento={tipoEvento}
            setTipoEvento={setTipoEvento}
            accion={accion}
          />

          <Typography
            align="center"
            variant="h4"
            sx={{
              mb: 3,
              fontWeight: 900,
              color: "#00eaff",
              textShadow: "0 0 10px #00eaff",
            }}
          >
            VISITASEGURA
          </Typography>

          {/* CUADRO QR / VIDEO */}
          <Box
            sx={{
              width: "100%",
              maxWidth: 360,
              mx: "auto",
              overflow: "hidden",
              borderRadius: 3,
              border: "3px solid #00eaff",
              boxShadow: "0 0 20px #00eaff",
              transition: "0.3s",
            }}
          >
            {!flip ? (
              <img
                src="/qr-placeholder.png"
                alt="QR Placeholder"
                style={{ width: "100%", display: "block" }}
              />
            ) : (
              <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }} />
            )}
          </Box>

          {/* RESULTADOS */}
          {run && (
            <Paper
              sx={{
                mt: 3,
                p: 2,
                background: "rgba(0,50,70,0.4)",
                color: "#00eaff",
                border: "2px solid #00eaff",
              }}
            >
              <Typography>RUN: {run}</Typography>
              <Typography>Serial: {serial}</Typography>
              <Typography>Evento: {tipoEvento}</Typography>
            </Paper>
          )}

          {error && (
            <Paper
              sx={{
                mt: 3,
                p: 2,
                background: "rgba(60,0,0,0.5)",
                border: "2px solid red",
                color: "white",
              }}
            >
              ❌ {errorMsg}
            </Paper>
          )}
        </Box>

        {/* BARRA INFERIOR */}
        <Box
          sx={{
            p: 2,
            background: "rgba(0,0,0,0.9)",
            borderTop: "2px solid #00eaff",
            textAlign: "center",
          }}
        >
          {!scanning ? (
            <Button
              onClick={startScan}
              variant="contained"
              sx={{
                fontWeight: 900,
                fontSize: "1.1rem",
                px: 4,
                py: 1.5,
                borderRadius: "10px",
                background: "linear-gradient(90deg,#00eaff,#00b7ff)",
                color: "black",
                boxShadow: "0 0 18px #00eaff",
                "&:hover": {
                  transform: "scale(1.05)",
                  boxShadow: "0 0 28px #00eaff",
                },
              }}
            >
              ▶ Iniciar escaneo
            </Button>
          ) : (
            <Button
              onClick={stopScan}
              variant="contained"
              sx={{
                fontWeight: 900,
                fontSize: "1.1rem",
                px: 4,
                py: 1.5,
                borderRadius: "10px",
                background: "linear-gradient(90deg,#ff0040,#b3002d)",
                boxShadow: "0 0 18px red",
                "&:hover": {
                  transform: "scale(1.05)",
                  boxShadow: "0 0 28px red",
                },
              }}
            >
              ⏹ Detener escaneo
            </Button>
          )}
        </Box>
      </Card>

      {/* TOAST */}
      {showToast && (
        <Box
          sx={{
            position: "fixed",
            bottom: 20,
            right: 20,
            p: 2,
            borderRadius: "10px",
            background: "rgba(0,60,80,0.9)",
            color: "#00eaff",
            border: "2px solid #00eaff",
            boxShadow: "0 0 12px #00eaff",
          }}
        >
          Usuario registrado con éxito ✅
        </Box>
      )}
    </Box>
  );
}
