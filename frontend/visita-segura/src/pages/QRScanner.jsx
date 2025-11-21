// src/pages/QRScanner.jsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import jsQR from "jsqr";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import LogoutButton from "../components/LogoutButton";
import fondoImg from "../assets/fondo.jpg";

// ---------------------- BOTONES ENTRADA / SALIDA ----------------------
function EntradaSalidaSelector({ accion, setAccion }) {
  const baseStyle = {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "2px solid white",
    fontWeight: "bold",
    cursor: "pointer",
    backgroundColor: "black",
    color: "white",
    fontSize: "14px",
  };

  return (
    <div style={{ display: "flex", gap: "10px" }}>
      <button
        onClick={() => setAccion("entrada")}
        style={{
          ...baseStyle,
          backgroundColor: accion === "entrada" ? "#FFB61B" : "black",
          color: accion === "entrada" ? "black" : "white",
        }}
      >
        Entrada
      </button>

      <button
        onClick={() => setAccion("salida")}
        style={{
          ...baseStyle,
          backgroundColor: accion === "salida" ? "#FFB61B" : "black",
          color: accion === "salida" ? "black" : "white",
        }}
      >
        Salida
      </button>
    </div>
  );
}

function TipoEventoSelector({ tipoEvento, setTipoEvento, accion }) {
  if (accion === "salida") return null;

  return (
    <div className="mb-3 text-center">
      <label className="form-label fw-bold">Tipo de evento:</label>
      <select
        className="form-select w-auto mx-auto"
        value={tipoEvento}
        onChange={(e) => setTipoEvento(e.target.value)}
      >
        <option value="Visita">Visita</option>
        <option value="Graduacion">Graduación</option>
        <option value="Recorrido guiado">Recorrido guiado</option>
        <option value="Otro">Otro</option>
      </select>
    </div>
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

  // STOPSCAN
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
      console.error(e);
    }
  };

  // ESCANEO
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
                .then((res) => {
                  if (!res.ok) throw new Error(`HTTP ${res.status}`);
                  return res.json();
                })
                .then(() => {
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                })
                .catch((err) => {
                  setError(true);
                  setErrorMsg(err.message || "Error desconocido");
                });
            } catch (e) {
              setError(true);
              setErrorMsg(e.message || "Error al procesar QR");
            }

            stopScan();
            return;
          }
        }
      } catch (outer) {
        console.error("Error en tick:", outer);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [scanning, apiUrl, tipoEvento, accion, stopScan]);

  // ---------------------- RETORNO ----------------------
  return (
    <div
      className="container-fluid d-flex flex-column align-items-center justify-content-center min-vh-100 p-3"
      style={{
        position: "relative",
        backgroundImage: `url(${fondoImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >

      {/* CAPA NEGRA 50% */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0,0,0,0.5)",
          zIndex: 1,
        }}
      ></div>

      {/* CARD - encima del overlay */}
      <div
        className="card shadow-lg p-0 w-100"
        style={{
          maxWidth: "500px",
          overflow: "hidden",
          borderRadius: "12px",
          position: "relative",
          zIndex: 2,
        }}
      >
        {/* FRANJA SUPERIOR NEGRA */}
        <div
          className="w-100 d-flex justify-content-between align-items-center"
          style={{
            background: "black",
            padding: "14px 16px",
            margin: "0",
            width: "100%",
          }}
        >
          <EntradaSalidaSelector accion={accion} setAccion={setAccion} />
          <LogoutButton />
        </div>

        {/* CONTENIDO PRINCIPAL */}
        <div className="p-4">
          <TipoEventoSelector
            tipoEvento={tipoEvento}
            setTipoEvento={setTipoEvento}
            accion={accion}
          />

          <h1 className="text-center mb-4 fw-bold" style={{ color: "#000000" }}>
            VisitaSegura
          </h1>

          <div className="flip-container mx-auto mb-4" style={{ maxWidth: 350 }}>
            <div className={`flipper ${flip ? "flipped" : ""}`}>
              <div className="front">
                <img
                  src="/qr-placeholder.png"
                  alt="QR Placeholder"
                  className="w-100 rounded shadow-sm"
                />
              </div>
              <div className="back">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  className="w-100 rounded shadow-sm"
                ></video>
              </div>
            </div>
          </div>

          {run && serial && (
            <div className="mt-3 alert alert-success">
              <strong>RUN:</strong> {run} <br />
              <strong>Serial:</strong> {serial} <br />
              <strong>Tipo evento:</strong> {tipoEvento}
            </div>
          )}

          {error && (
            <div className="mt-3 alert alert-danger text-center">
              ❌ Error: {errorMsg}
            </div>
          )}
        </div>

        {/* FRANJA NEGRA INFERIOR */}
        <div
          style={{
            width: "100%",
            background: "black",
            padding: "14px 16px",
            boxSizing: "border-box",
          }}
        >
          <div className="d-flex justify-content-center" style={{ width: "100%" }}>
            {!scanning ? (
              <button
                onClick={startScan}
                style={{
                  padding: "10px 18px",
                  border: "2px solid white",
                  background: "#FFB61B",
                  color: "black",
                  fontSize: "18px",
                  fontWeight: "bold",
                  borderRadius: "6px",
                }}
              >
                ▶ Iniciar Escaneo
              </button>
            ) : (
              <button
                onClick={stopScan}
                style={{
                  padding: "10px 18px",
                  border: "2px solid white",
                  background: "red",
                  color: "#FFFFFF",
                  fontSize: "18px",
                  fontWeight: "bold",
                  borderRadius: "6px",
                }}
              >
                ⏹ Detener Escaneo
              </button>
            )}
          </div>
        </div>
      </div>

      {showToast && (
        <div
          className="toast show position-fixed bottom-0 end-0 m-3"
          role="alert"
          onClick={() => setShowToast(false)}
          style={{ minWidth: "200px", cursor: "pointer" }}
        >
          <div className="toast-header bg-success text-white">
            <strong className="me-auto">VisitaSegura</strong>
            <small>Ahora</small>
            <button
              type="button"
              className="btn-close btn-close-white ms-2 mb-1"
            ></button>
          </div>
          <div className="toast-body">Usuario registrado con éxito ✅</div>
        </div>
      )}
    </div>
  );
}
