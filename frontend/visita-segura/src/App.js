import React, { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const videoRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [run, setRun] = useState("");
  const [serial, setSerial] = useState("");

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
    } catch (error) {
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

            // Enviar al backend HTTPS con campos "pepe"
            fetch("https://localhost:3001/visitas", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                run: qrRun,
                nombres: "pepe",
                apellidos: "pepe",
                fecha_nac: "pepe",
                sexo: "pepe",
                num_doc: qrSerial,
                tipo_evento: "pepe",
                fecha_hora: new Date().toISOString(),
              }),
            })
              .then((res) => res.json())
              .then((data) => console.log("Guardado en DB con ID:", data.id))
              .catch((err) => console.error("Error al guardar:", err));
          } catch (e) {
            alert("Error al procesar el QR");
          }

          stopScanEffect(); // Detenemos escaneo al detectar QR
          return;
        }
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [scanning, stream]);

  return (
    <div className="container text-center mt-5">
      <h1 className="mb-4">Lector QR</h1>

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
    </div>
  );
}

export default App;
