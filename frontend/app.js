import React, { useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import "bootstrap/dist/css/bootstrap.min.css";
import HashClient from "./utils/hash_cliente"; 

function App() {
  const videoRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [stream, setStream] = useState(null);
  const [run, setRun] = useState("");
  const [serial, setSerial] = useState("");
  
  // Instanciar cliente de seguridad
  const hashClient = new HashClient();

  // Función para indexar y registrar - AHORA CON SEGURIDAD
  const indexarYRegistrar = async (run, serial) => {
    try {
      // 1. Primero indexar con seguridad
      const resultadoIndexacion = await hashClient.enviarSolicitudSegura(
        '/api/indexacion/indexar',
        { run, num_doc: serial }
      );
      
      if (resultadoIndexacion.exito) {
        // 2. Luego registrar con los datos indexados
        await hashClient.enviarSolicitudSegura(
          '/visitas',
          resultadoIndexacion.registroIndexado
        );

        alert("Visita registrada: " + 
          resultadoIndexacion.registroIndexado.nombres + " " + 
          resultadoIndexacion.registroIndexado.apellidos);
          
      } else if (resultadoIndexacion.duplicado) {
        alert("Esta persona ya está registrada");
      } else {
        alert("No se pudo completar el registro: " + resultadoIndexacion.mensaje);
      }
    } catch (error) {
      console.error("Error en registro:", error);
      alert("Error de seguridad o conexión: " + error.message);
    }
  };

  // [El resto del código de scanning se mantiene igual...]
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

            // Llamar a la función de indexación y registro después de escanear
            indexarYRegistrar(runValue, serialValue);

          } catch (e) {
            alert("Error al procesar el QR");
          }

          stop();
          return;
        }
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }, [scanning, stream]);

  return (
    <div className="container text-center mt-5">
      <h1 className="mb-4">Lector QR Seguro</h1>
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
            Iniciar Escaneo Seguro
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