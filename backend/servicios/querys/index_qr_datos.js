// backend/servicios/querys/index_qr_datos.js

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const router = express.Router();
const dbPath = path.join(__dirname, "../../../data/registros.db");
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Error conectando a BD en index_qr_datos:", err.message);
  } else {
    console.log("Conexión exitosa a BD para indexación");
  }
});

/**
 * Función para indexar registro QR con datos ficticios
 * @param {string} run - RUN capturado del QR
 * @param {string} num_doc - Número de documento del QR
 * @returns {Promise<Object>} Resultado de la indexación
 */
async function indexarRegistro(run, num_doc) {
  return new Promise((resolve, reject) => {
    
    console.log(`Iniciando indexación para RUN: ${run}, NumDoc: ${num_doc}`);
    
    // 1. Buscar un dato ficticio disponible (sin usar)
    // Ordenamos aleatoriamente para variar los datos asignados
    db.get(
      `SELECT df.id, df.nombres, df.apellidos, df.fecha_nac, df.sexo 
       FROM datos_ficticios df
       WHERE df.id NOT IN (
         SELECT DISTINCT id
         FROM visitas 
         WHERE id IS NOT NULL
       )
       ORDER BY RANDOM() 
       LIMIT 1`,
      [],
      (err, datoFicticio) => {
        if (err) {
          console.error("Error consultando datos ficticios:", err);
          reject(err);
          return;
        }

        // Si no hay datos ficticios disponibles, intentar reutilizar uno
        if (!datoFicticio) {
          console.warn("No hay datos ficticios sin usar, reutilizando...");
          
          db.get(
            `SELECT df.id, df.nombres, df.apellidos, df.fecha_nac, df.sexo 
             FROM datos_ficticios df
             ORDER BY RANDOM() 
             LIMIT 1`,
            [],
            (err2, datoReutilizado) => {
              if (err2 || !datoReutilizado) {
                console.error("No hay datos ficticios disponibles");
                resolve({
                  exito: false,
                  mensaje: "No hay datos ficticios disponibles en el sistema"
                });
                return;
              }

              console.log(`Dato ficticio reutilizado - ID: ${datoReutilizado.id}`);
              
              resolve({
                exito: true,
                registroIndexado: {
                  run: run,
                  num_doc: num_doc,
                  nombres: datoReutilizado.nombres,
                  apellidos: datoReutilizado.apellidos,
                  fecha_nac: datoReutilizado.fecha_nac,
                  sexo: datoReutilizado.sexo,
                  tipo_evento: "Visita",
                  fecha_hora: new Date().toISOString(),
                  id: datoReutilizado.id
                }
              });
            }
          );
          return;
        }

        console.log(`Dato ficticio asignado - ID: ${datoFicticio.id}, Nombres: ${datoFicticio.nombres}`);

        // 2. Retornar el registro indexado completo
        resolve({
          exito: true,
          registroIndexado: {
            run: run,
            num_doc: num_doc,
            nombres: datoFicticio.nombres,
            apellidos: datoFicticio.apellidos,
            fecha_nac: datoFicticio.fecha_nac,
            sexo: datoFicticio.sexo,
            tipo_evento: "Visita",
            fecha_hora: new Date().toISOString(),
            id: datoFicticio.id
          }
        });
      }
    );
  });
}

/**
 * POST /api/indexar
 * Endpoint para indexar datos QR con datos ficticios
 */
router.post("/indexar", async (req, res) => {
  try {
    const { run, num_doc } = req.body;

    // Validación de datos
    if (!run || !num_doc) {
      console.warn("Solicitud sin RUN o NumDoc");
      return res.status(400).json({ 
        exito: false,
        error: "Se requiere 'run' y 'num_doc' en el body" 
      });
    }

    console.log(`Solicitud de indexación recibida - RUN: ${run}`);

    // Ejecutar indexación
    const resultado = await indexarRegistro(run, num_doc);
    
    if (!resultado.exito) {
      console.warn(`Indexación fallida: ${resultado.mensaje}`);
      return res.status(400).json(resultado);
    }

    console.log(`Indexación exitosa para RUN: ${run}`);
    res.json(resultado);

  } catch (error) {
    console.error("Error en endpoint /api/indexar:", error);
    res.status(500).json({ 
      exito: false,
      error: "Error interno del servidor: " + error.message 
    });
  }
});

/**
 * GET /api/indexar/stats
 * Endpoint para ver estadísticas de datos ficticios disponibles
 */
router.get("/stats", (req, res) => {
  db.all(
    `SELECT 
      COUNT(*) as total,
      (SELECT COUNT(DISTINCT id) FROM visitas WHERE id IS NOT NULL) as usados,
      COUNT(*) - (SELECT COUNT(DISTINCT id) FROM visitas WHERE id IS NOT NULL) as disponibles
     FROM datos_ficticios`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows[0]);
    }
  );
});

module.exports = {
  indexarRegistro,
  router
};