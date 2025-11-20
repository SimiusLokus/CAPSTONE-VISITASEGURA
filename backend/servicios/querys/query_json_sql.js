const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Ruta CORREGIDA para el JSON
const datosFicticios = require(path.join(__dirname, "../JSON/datos_ficticios.json"));

const router = express.Router();

// Ruta ABSOLUTAMENTE CORRECTA para la base de datos
const dbPath = path.join(__dirname, "../../../data/registros.db");
console.log("Buscando base de datos en:", dbPath);

// Verificar si existe la base de datos
if (!fs.existsSync(dbPath)) {
    console.error("ERROR: No se encuentra la base de datos en:", dbPath);
    // Crear el directorio si no existe
    const dataDir = path.dirname(dbPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log("Directorio data creado:", dataDir);
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al conectar con la base de datos:", err.message);
        console.log("Ruta intentada:", dbPath);
    } else {
        console.log("Conectado a la base de datos exitosamente");
    }
});

// Función para sincronizar JSON con la tabla de datos ficticios
async function sincronizarDatosFicticios() {
  return new Promise((resolve, reject) => {
    // Crear tabla si no existe con los atributos requeridos
    db.run(`
      CREATE TABLE IF NOT EXISTS datos_ficticios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombres TEXT NOT NULL,
        apellidos TEXT NOT NULL,
        fecha_nac TEXT NOT NULL,
        sexo TEXT NOT NULL
      )
    `, function(err) {
      if (err) {
        reject(err);
        return;
      }

      // Preparar la consulta de insercion
      const stmt = db.prepare(`
        INSERT INTO datos_ficticios 
        (nombres, apellidos, fecha_nac, sexo) 
        VALUES (?, ?, ?, ?)
      `);

      // Insertar cada persona del JSON en la base de datos
      datosFicticios.forEach((persona) => {
        stmt.run([
          persona.nombres,
          persona.apellidos,
          persona.fecha_nac,
          persona.sexo
        ]);
      });

      // Finalizar la declaracion y manejar el resultado
      stmt.finalize((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

// Exportar solo la funcion de sincronizacion
module.exports = {
  sincronizarDatosFicticios
};