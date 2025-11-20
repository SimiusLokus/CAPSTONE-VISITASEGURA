import React, { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import "bootstrap/dist/css/bootstrap.min.css";

function App() {
  const videoRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [run, setRun] = useState("");
  const [serial, setSerial] = useState("");

  // Funcion para indexar y registrar
  const indexarYRegistrar = async (run, serial) => {
    try {
      // 1. Primero indexar
      const responseIndexacion = await fetch('https://localhost:3001/api/indexacion/indexar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run: run,
          num_doc: serial
        })
      });

      const resultadoIndexacion = await responseIndexacion.json();
      
      if (resultadoIndexacion.exito) {
        // 2. Luego registrar con los datos indexados
        const responseVisita = await fetch('https://localhost:3001/visitas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(resultadoIndexacion.registroIndexado)
        });

        if (responseVisita.ok) {
          alert("Visita registrada: " + resultadoIndexacion.registroIndexado.nombres + " " + resultadoIndexacion.registroIndexado.apellidos);
        }
      } else if (resultadoIndexacion.duplicado) {
        alert("Esta persona ya esta registrada");
      } else {
        alert("No se pudo completar el registro");
      }
    } catch (error) {
      alert("Error al procesar el registro");
    }
  };

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
      alert("No se pudo acceder a la camara.");
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

    const stop = () => {
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
            const runValue = params.get("RUN") || "";
            const serialValue = params.get("serial") || "";
            setRun(runValue);
            setSerial(serialValue);
            console.log("RUN:", runValue);
            console.log("Serial:", serialValue);

            // Llamar a la funcion de indexacion y registro despues de escanear
            indexarYRegistrar(runValue, serialValue);

          } catch (e) {
            alert("Error al procesar el QR");
          }

          stop(); // Detenemos escaneo
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