// src/pages/QRScanner.js
import React, { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import "bootstrap/dist/css/bootstrap.min.css";
import "../App.css";
import LogoutButton from "../components/LogoutButton";

function EntradaSalidaSelector({ accion, setAccion }) {
  return (
    <div style={{
      position: "fixed",
      top: 12,
      left: 12,
      zIndex: 1200,
      display: "flex",
      gap: 8,
      alignItems: "center"
    }}>
      <button
        type="button"
        className={`btn btn-sm ${accion === "entrada" ? "btn-success" : "btn-outline-secondary"}`}
        onClick={() => setAccion("entrada")}
      >
        Entrada
      </button>

      <button
        type="button"
        className={`btn btn-sm ${accion === "salida" ? "btn-primary" : "btn-outline-secondary"}`}
        onClick={() => setAccion("salida")}
      >
        Salida
      </button>
    </div>
  );
}

function TipoEventoSelector({ tipoEvento, setTipoEvento, accion }) {
  if (accion === "salida") return null; // desaparece al seleccionar salida
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
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
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
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiUrl] = useState(API_BASE_URL);
  const [showToast, setShowToast] = useState(false);
  const [flip, setFlip] = useState(false);

  const [accion, setAccion] = useState("entrada"); // Entrada/Salida
  const [tipoEvento, setTipoEvento] = useState("Visita"); // Tipo de evento

  const [ticksSinQR, setTicksSinQR] = useState(0);

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
      setSuccess(false);
      setError(false);
      setErrorMsg("");
    } catch (e) {
      alert("No se pudo acceder a la cámara.");
      console.error(e);
    }
  };

  const stopScan = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    setScanning(false);
  };

  useEffect(() => {
    if (!scanning) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    let rafId = null;

    const tick = () => {
      if (!scanning) return;

      setTicksSinQR(prev => {
        const nuevo = prev + 1;
        if (nuevo > 120) {
          console.log("⛔ Detenido: No se encontró QR.");
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
                tipo_evento: tipoEvento, // ahora se guarda correctamente
                accion: accion // Entrada o Salida
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
                  setSuccess(true);
                  setError(false);
                  setShowToast(true);
                  setTimeout(() => setShowToast(false), 3000);
                })
                .catch((err) => {
                  console.error("POST /visitas error:", err);
                  setError(true);
                  setSuccess(false);
                  setErrorMsg(err.message || "Error desconocido");
                });
            } catch (e) {
              console.error("Error procesando QR:", e);
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
  }, [scanning, stream, apiUrl, tipoEvento, accion]);

  return (
    <div className="container-fluid d-flex flex-column align-items-center justify-content-center min-vh-100 bg-light p-3" style={{ position: "relative" }}>
      <EntradaSalidaSelector accion={accion} setAccion={setAccion} />
      <LogoutButton />
      <TipoEventoSelector tipoEvento={tipoEvento} setTipoEvento={setTipoEvento} accion={accion} />

      <div className="card shadow-lg p-4 w-100" style={{ maxWidth: "500px" }}>
        <h1 className="text-center mb-4 text-primary fw-bold">VisitaSegura</h1>

        <div className="text-center mb-3">
          <small className="text-muted">
            📡 API: {apiUrl} <br />
            🌐 Host: {window.location.hostname}
          </small>
        </div>

        <div className="flip-container mx-auto mb-4">
          <div className={`flipper ${flip ? "flipped" : ""}`}>
            <div className="front">
              <img src="/qr-placeholder.png" alt="QR Placeholder" className="w-100 rounded shadow-sm" />
            </div>
            <div className="back">
              <video ref={videoRef} autoPlay playsInline className="w-100 rounded shadow-sm"></video>
            </div>
          </div>
        </div>

        <div className="d-grid gap-2">
          {!scanning ? (
            <button className="btn btn-primary btn-lg" onClick={startScan}>▶ Iniciar Escaneo</button>
          ) : (
            <button className="btn btn-danger btn-lg" onClick={stopScan}>⏹ Detener Escaneo</button>
          )}
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

      {showToast && (
        <div className="toast show position-fixed bottom-0 end-0 m-3" role="alert" onClick={() => setShowToast(false)} style={{ minWidth: "200px", cursor: "pointer" }}>
          <div className="toast-header bg-success text-white">
            <strong className="me-auto">VisitaSegura</strong>
            <small>Ahora</small>
            <button type="button" className="btn-close btn-close-white ms-2 mb-1" onClick={() => setShowToast(false)}></button>
          </div>
          <div className="toast-body">Usuario ingresado con éxito ✅</div>
        </div>
      )}
    </div>
  );
}
