import React, { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import "bootstrap/dist/css/bootstrap.min.css";

// Configuración dinámica de API
const getApiUrl = () => {
  // Si estás en desarrollo local
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'https://localhost:3001';
  }
  
  // Si accedes desde la red (móvil), usa la misma IP del frontend
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

  // Test de conectividad al cargar
  useEffect(() => {
    const testConnection = async () => {
      try {
        console.log(`🔍 Probando conexión a: ${API_BASE_URL}`);
        const response = await fetch(`${API_BASE_URL}/info`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`✅ Conexión exitosa:`, data);
          setApiUrl(API_BASE_URL);
        }
      } catch (err) {
        console.error(`❌ Error de conexión:`, err);
      }
    };

    testConnection();
  }, []);

  const startScan = async () => {
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
    } catch (err) {
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

    const stopScanEffect = () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      setScanning(false);
    };

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

            console.log("RUN:", qrRun);
            console.log("Serial:", qrSerial);
            console.log("📡 Enviando a:", `${apiUrl}/visitas`);

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
                if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
                return res.json();
              })
              .then((data) => {
                console.log("✅ Guardado en DB con ID:", data.id);
                setSuccess(true);
                setError(false);
                setErrorMsg("");
              })
              .catch((err) => {
                console.error("❌ Error al guardar:", err);
                setError(true);
                setSuccess(false);
                setErrorMsg(err.message || "Error desconocido");
              });
          } catch (e) {
            console.error("Error al procesar el QR:", e);
            setError(true);
            setErrorMsg(e.message || "Error al procesar QR");
          }

          stopScanEffect();
          return;
        }
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [scanning, stream, apiUrl]);

  return (
    <div className="container text-center mt-5">
      <h1 className="mb-4">Lector QR</h1>
      
      {/* Info de conexión */}
      <div className="mb-3">
        <small className="text-muted">
          📡 API: {apiUrl} | 🌐 Accediendo desde: {window.location.hostname}
        </small>
      </div>

      <div className="border rounded p-2 d-inline-block">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-100"
          style={{ maxWidth: "300px", aspectRatio: "1/1", objectFit: "cover" }}
        ></video>
      </div>

      <div className="mt-3">
        {!scanning ? (
          <button className="btn btn-primary" onClick={startScan}>
            Iniciar Escaneo
          </button>
        ) : (
          <button className="btn btn-danger" onClick={stopScan}>
            Detener Escaneo
          </button>
        )}
      </div>

      {run && serial && (
        <div className="mt-3 alert alert-success">
          <div><strong>RUN:</strong> {run}</div>
          <div><strong>Serial:</strong> {serial}</div>
        </div>
      )}

      {success && (
        <div className="mt-3 alert alert-info">
          Usuario registrado ✅
        </div>
      )}

      {error && (
        <div className="mt-3 alert alert-danger">
          Error al guardar el usuario ❌ <br />
          {errorMsg}
        </div>
      )}
    </div>
  );
}

export default App;