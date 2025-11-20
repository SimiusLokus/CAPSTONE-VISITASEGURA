const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

// Ruta robusta que busca desde la raíz del proyecto
const projectRoot = path.join(__dirname, "../../..");
const dbPath = path.join(projectRoot, "data/registros.db");

console.log("Buscando base de datos en:", dbPath);

// Verificar si existe
if (!fs.existsSync(dbPath)) {
    console.error("ERROR: No se encuentra la base de datos en:", dbPath);
    process.exit(1);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error al conectar con la base de datos:", err.message);
        process.exit(1);
    }
    console.log("Conectado a la base de datos exitosamente");
});

// Funcion para truncar la tabla datos_ficticios (eliminar todos los datos)
function truncarTablaDatosFicticios() {
  return new Promise((resolve, reject) => {
    db.run("DELETE FROM datos_ficticios", function(err) {
      if (err) {
        reject(err);
      } else {
        console.log(`Tabla truncada: ${this.changes} registros eliminados`);
        resolve(this.changes);
      }
    });
  });
}

// Funcion para dropear la tabla datos_ficticios (eliminar tabla completa)
function dropearTablaDatosFicticios() {
  return new Promise((resolve, reject) => {
    db.run("DROP TABLE IF EXISTS datos_ficticios", function(err) {
      if (err) {
        reject(err);
      } else {
        console.log("Tabla datos_ficticios eliminada exitosamente");
        resolve();
      }
    });
  });
}

// Funcion principal que ejecuta las operaciones
async function main() {
  try {
    // Truncar la tabla (eliminar datos pero mantener estructura)
    const registrosEliminados = await truncarTablaDatosFicticios();
    console.log(`Registros eliminados: ${registrosEliminados}`);

    // Dropear la tabla (eliminar tabla completa)
    await dropearTablaDatosFicticios();
    console.log("Operaciones completadas exitosamente");

  } catch (error) {
    console.error("Error durante las operaciones:", error);
  } finally {
    // Cerrar la conexion a la base de datos
    db.close();
  }
}

// Ejecutar el script
main();