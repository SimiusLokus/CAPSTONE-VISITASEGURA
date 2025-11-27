// backend/servicios/seguridad/cifrado_router.js

const express = require("express");
const CifradorAES = require("./cifrado");

const router = express.Router();
const cifrador = new CifradorAES();

/**
 * POST /api/cifrado/procesar-qr
 * Propósito: Cifrar los datos del QR escaneado para almacenamiento seguro
 * Body esperado: { datosQR: { run, num_doc, nombres, apellidos, ... } }
 */
router.post("/procesar-qr", (req, res) => {
  try {
    const { datosQR } = req.body;
    
    console.log("Solicitud de cifrado recibida");

    // Validación básica
    if (!datosQR) {
      console.warn("No se recibieron datos para cifrar");
      return res.status(400).json({ 
        ok: false,
        error: "Se requieren datos del QR escaneado en 'datosQR'" 
      });
    }

    // Validar campos mínimos necesarios
    const camposRequeridos = ['run', 'num_doc'];
    const camposFaltantes = camposRequeridos.filter(campo => !datosQR[campo]);
    
    if (camposFaltantes.length > 0) {
      console.warn(`Campos faltantes: ${camposFaltantes.join(', ')}`);
      return res.status(400).json({
        ok: false,
        error: `Datos de QR incompletos. Faltan: ${camposFaltantes.join(', ')}`
      });
    }

    // Log de datos recibidos (sin mostrar información sensible completa)
    console.log(`Cifrando datos - RUN: ${datosQR.run.substring(0, 4)}***, NumDoc: ${datosQR.num_doc.substring(0, 4)}***`);

    // Cifrar los datos para almacenamiento seguro
    const datosCifrados = cifrador.cifrarParaBD(datosQR);
    
    console.log("Datos cifrados exitosamente");
    console.log(`Tamaño cifrado: ${datosCifrados.length} caracteres`);

    // Responder con datos cifrados y confirmación
    res.json({
      ok: true,
      datosCifrados: datosCifrados,
      datosOriginales: datosQR, // Útil para debugging, remover en producción
      metadata: {
        timestamp: new Date().toISOString(),
        algoritmo: 'AES-256-GCM',
        tamanio: datosCifrados.length
      }
    });

  } catch (error) {
    console.error("Error en /api/cifrado/procesar-qr:", error);
    console.error("Stack trace:", error.stack);
    
    res.status(500).json({ 
      ok: false,
      error: "Error procesando cifrado: " + error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/cifrado/descifrar
 * Propósito: Descifrar datos previamente cifrados (para consultas)
 * Body esperado: { datosCifrados: "string_cifrado" }
 */
router.post("/descifrar", (req, res) => {
  try {
    const { datosCifrados } = req.body;

    if (!datosCifrados) {
      return res.status(400).json({
        ok: false,
        error: "Se requieren 'datosCifrados' para descifrar"
      });
    }

    console.log("Solicitud de descifrado recibida");

    // Descifrar datos
    const datosDescifrados = cifrador.descifrarDesdeBD(datosCifrados);
    
    console.log("Datos descifrados exitosamente");

    res.json({
      ok: true,
      datosDescifrados: datosDescifrados,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("Error descifrando:", error);
    res.status(500).json({
      ok: false,
      error: "Error descifrando datos: " + error.message
    });
  }
});

/**
 * GET /api/cifrado/status
 * Propósito: Verificar que el servicio de cifrado funciona correctamente
 */
router.get("/status", (req, res) => {
  try {
    // Test rápido de cifrado/descifrado
    const testData = { test: "cifrado_funcional", timestamp: Date.now() };
    const cifrado = cifrador.cifrarParaBD(testData);
    const descifrado = cifrador.descifrarDesdeBD(cifrado);
    
    const funcionaCorrectamente = descifrado.test === testData.test;

    res.json({
      servicio: "cifrado",
      estado: funcionaCorrectamente ? "activo" : "error",
      algoritmo: "AES-256-GCM",
      timestamp: new Date().toISOString(),
      test: funcionaCorrectamente ? "exitoso" : "fallido",
      detalles: {
        claveConfigurada: !!cifrador.key,
        longitudClave: cifrador.key ? cifrador.key.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({
      servicio: "cifrado",
      estado: "error",
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/cifrado/test
 * Propósito: Endpoint de prueba para verificar cifrado/descifrado
 */
router.post("/test", (req, res) => {
  try {
    const { datos } = req.body;

    if (!datos) {
      return res.status(400).json({ error: "Se requiere campo 'datos'" });
    }

    console.log("Iniciando test de cifrado...");

    // Cifrar
    const cifrado = cifrador.cifrarParaBD(datos);
    console.log(`Cifrado exitoso - ${cifrado.length} caracteres`);

    // Descifrar
    const descifrado = cifrador.descifrarDesdeBD(cifrado);
    console.log("Descifrado exitoso");

    // Comparar
    const esIgual = JSON.stringify(datos) === JSON.stringify(descifrado);

    res.json({
      ok: true,
      test: "cifrado-descifrado",
      resultado: esIgual ? "exitoso" : "fallido",
      datosOriginales: datos,
      datosCifrados: cifrado.substring(0, 100) + "...", // Solo primeros 100 chars
      datosDescifrados: descifrado,
      longitudCifrado: cifrado.length
    });

  } catch (error) {
    console.error("Error en test:", error);
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

module.exports = router;