const express = require("express");
const CifradorAES = require("./cifrado");

const router = express.Router();
const cifrador = new CifradorAES();

/**
 * POST /api/cifrado/procesar-qr
 * Propósito: Cifrar los datos del QR escaneado para almacenamiento seguro
 */
router.post("/procesar-qr", (req, res) => {
  try {
    const { datosQR } = req.body;
    
    console.log("Procesando QR para cifrado - RUN:", datosQR?.run);

    if (!datosQR) {
      return res.status(400).json({ 
        ok: false,
        error: "Se requieren datos del QR escaneado" 
      });
    }

    // Validar datos mínimos
    if (!datosQR.run || !datosQR.num_doc) {
      return res.status(400).json({
        ok: false,
        error: "Datos de QR incompletos - se requiere run y num_doc"
      });
    }

    // Cifrar los datos para almacenamiento seguro
    const datosCifrados = cifrador.cifrarParaBD(datosQR);
    
    console.log("QR cifrado exitosamente para RUN:", datosQR.run);

    res.json({
      ok: true,
      datosCifrados: datosCifrados,
      datosOriginales: datosQR,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error en /api/cifrado/procesar-qr:", error);
    res.status(500).json({ 
      ok: false,
      error: "Error procesando QR: " + error.message 
    });
  }
});

/**
 * GET /api/cifrado/status
 * Propósito: Verificar que el servicio de cifrado funciona
 */
router.get("/status", (req, res) => {
  res.json({
    servicio: "cifrado",
    estado: "activo",
    algoritmo: "AES-256-GCM",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;