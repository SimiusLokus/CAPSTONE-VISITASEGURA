import React, { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import "bootstrap/dist/css/bootstrap.min.css";
import "./App.css"; // estilos personalizados

const getApiUrl = () => {
  if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
    return "https://localhost:3001";
  }
  return `https://${window.location.hostname}:3001`;
};

const API_BASE_URL = getApiUrl();

function App() {
  const videoRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [run, setRun] = useState("");
  const [serial, setSerial] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [apiUrl, setApiUrl] = useState(API_BASE_URL);
  const [showToast, setShowToast] = useState(false);
  const [flip, setFlip] = useState(false); // controla flip QR

  useEffect(() => {
    const testConnection = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/info`);
        if (response.ok) {
          setApiUrl(API_BASE_URL);
        }
      } catch (err) {
        console.error("❌ Error de conexión:", err);
      }
    };
    testConnection();
  }, []);

  const startScan = async () => {
    setFlip(true); // animación flip
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      videoRef.current.srcObject = mediaStream;
      setStream(mediaStream);
      setScanning(true);
      setRun("");
      setSerial("");
      setSuccess(false);
      setError(false);
      setErrorMsg("");
    } catch {
      alert("No se pudo acceder a la cámara.");
    }
  };

  const stopScan = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScanning(false);
  };

  useEffect(() => {
    if (!scanning) return;

    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const tick = () => {
      if (!scanning) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          try {
            const url = new URL(code.data);
            const params = new URLSearchParams(url.search);

            const qrRun = params.get("RUN") || "";
            const qrSerial = params.get("serial") || "";

            setRun(qrRun);
            setSerial(qrSerial);

            fetch(`${apiUrl}/visitas`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                run: qrRun,
                nombres: "no disponible",
                apellidos: "no disponible",
                fecha_nac: "no disponible",
                sexo: "no disponible",
                num_doc: qrSerial,
                tipo_evento: "no disponible",
                fecha_hora: new Date().toISOString(),
              }),
            })
              .then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.json();
              })
              .then(() => {
                setSuccess(true);
                setError(false);
                setErrorMsg("");

                // Mostrar toast
                setShowToast(true);
                setTimeout(() => setShowToast(false), 3000);
              })
              .catch((err) => {
                setError(true);
                setSuccess(false);
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
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [scanning, stream, apiUrl]);

  return (
    <div className="container-fluid d-flex flex-column align-items-center justify-content-center min-vh-100 bg-light p-3">
      <div className="card shadow-lg p-4 w-100" style={{ maxWidth: "500px" }}>
        <h1 className="text-center mb-4 text-primary fw-bold">VisitaSegura</h1>

        <div className="text-center mb-3">
          <small className="text-muted">
            📡 API: {apiUrl} <br />
            🌐 Host: {window.location.hostname}
          </small>
        </div>

        {/* Flip QR / Video */}
        <div className="flip-container mx-auto mb-4">
          <div className={`flipper ${flip ? "flipped" : ""}`}>
            {/* Cara frontal: QR genérico */}
            <div className="front">
              <img
                src="/qr-placeholder.png"
                alt="QR Placeholder"
                className="w-100 rounded shadow-sm"
              />
            </div>

            {/* Cara trasera: Video */}
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

        <div className="d-grid gap-2">
          {!scanning ? (
            <button className="btn btn-primary btn-lg" onClick={startScan}>
              ▶ Iniciar Escaneo
            </button>
          ) : (
            <button className="btn btn-danger btn-lg" onClick={stopScan}>
              ⏹ Detener Escaneo
            </button>
          )}
        </div>

        {run && serial && (
          <div className="mt-3 alert alert-success">
            <div><strong>RUN:</strong> {run}</div>
            <div><strong>Serial:</strong> {serial}</div>
          </div>
        )}

        {error && (
          <div className="mt-3 alert alert-danger text-center">
            ❌ Error: {errorMsg}
          </div>
        )}
      </div>

      {/* TOAST FLOTANTE */}
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
              aria-label="Close"
              onClick={() => setShowToast(false)}
            ></button>
          </div>
          <div className="toast-body">
            Usuario ingresado con éxito ✅
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
