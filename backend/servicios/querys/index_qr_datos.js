const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const router = express.Router();
const dbPath = path.join(__dirname, "../../../data/registros.db");
const db = new sqlite3.Database(dbPath);

// Funcion para indexar datos QR con datos ficticios
async function indexarRegistro(run, num_doc) {
  return new Promise((resolve, reject) => {
    
    // 1. Verificar si ya existe este RUN/NumDoc en visitas
    db.get(
      `SELECT COUNT(*) as count FROM visitas WHERE run = ? AND num_doc = ?`,
      [run, num_doc],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        // Si ya existe, rechazar la indexacion
        if (row.count > 0) {
          resolve({
            exito: false,
            duplicado: true,
            mensaje: "RUN y Numero de Documento ya existen en visitas"
          });
          return;
        }

        // 2. Buscar datos ficticios que NO esten indexados con este RUN
        db.get(
          `SELECT df.id, df.nombres, df.apellidos, df.fecha_nac, df.sexo 
           FROM datos_ficticios df
           WHERE NOT EXISTS (
             SELECT 1 FROM visitas v 
             WHERE v.nombres = df.nombres 
             AND v.apellidos = df.apellidos 
             AND v.run = ?
           )
           ORDER BY RANDOM() 
           LIMIT 1`,
          [run],
          (err, datoFicticio) => {
            if (err) {
              reject(err);
              return;
            }

            if (!datoFicticio) {
              resolve({
                exito: false,
                mensaje: "No hay datos ficticios disponibles para indexar"
              });
              return;
            }

            // 3. Retornar la combinacion para ser insertada
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
                id_ficticio: datoFicticio.id
              }
            });
          }
        );
      }
    );
  });
}

// Endpoint para indexacion
router.post("/indexar", async (req, res) => {
  try {
    const { run, num_doc } = req.body;

    if (!run || !num_doc) {
      return res.status(400).json({ 
        error: "Se requiere run y num_doc" 
      });
    }

    const resultado = await indexarRegistro(run, num_doc);
    res.json(resultado);

  } catch (error) {
    console.error("Error en servicio de indexacion:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
});

module.exports = {
  indexarRegistro,
  router
};