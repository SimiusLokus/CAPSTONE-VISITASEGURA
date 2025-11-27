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

// Función para verificar si una tabla existe
function verificarTablaExiste(nombreTabla) {
  return new Promise((resolve, reject) => {
    db.get(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
      [nombreTabla],
      function(err, row) {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      }
    );
  });
}

// Funciones para truncar tablas (eliminar todos los datos)
function truncarTablaDatosFicticios() {
  return new Promise(async (resolve, reject) => {
    try {
      // Verificar si la tabla existe antes de intentar truncar
      const tablaExiste = await verificarTablaExiste('datos_ficticios');
      
      if (!tablaExiste) {
        console.log("Tabla 'datos_ficticios' no existe, omitiendo truncado");
        resolve(0);
        return;
      }

      db.run("DELETE FROM datos_ficticios", function(err) {
        if (err) {
          if (err.code === 'SQLITE_ERROR' && err.message.includes('no such table')) {
            console.log("Tabla 'datos_ficticios' no existe, omitiendo truncado");
            resolve(0);
          } else {
            reject(err);
          }
        } else {
          console.log(`Tabla datos_ficticios truncada: ${this.changes} registros eliminados`);
          resolve(this.changes);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function truncarTablaVisitas() {
  return new Promise(async (resolve, reject) => {
    try {
      // Verificar si la tabla existe antes de intentar truncar
      const tablaExiste = await verificarTablaExiste('visitas');
      
      if (!tablaExiste) {
        console.log("Tabla 'visitas' no existe, omitiendo truncado");
        resolve(0);
        return;
      }

      db.run("DELETE FROM visitas", function(err) {
        if (err) {
          if (err.code === 'SQLITE_ERROR' && err.message.includes('no such table')) {
            console.log("Tabla 'visitas' no existe, omitiendo truncado");
            resolve(0);
          } else {
            reject(err);
          }
        } else {
          console.log(`Tabla visitas truncada: ${this.changes} registros eliminados`);
          resolve(this.changes);
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Funciones para dropear tablas (eliminar tabla completa)
function dropearTablaDatosFicticios() {
  return new Promise(async (resolve, reject) => {
    try {
      // Verificar si la tabla existe antes de intentar dropear
      const tablaExiste = await verificarTablaExiste('datos_ficticios');
      
      if (!tablaExiste) {
        console.log("Tabla 'datos_ficticios' no existe, omitiendo eliminación");
        resolve();
        return;
      }

      db.run("DROP TABLE IF EXISTS datos_ficticios", function(err) {
        if (err) {
          reject(err);
        } else {
          console.log("Tabla datos_ficticios eliminada exitosamente");
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function dropearTablaVisitas() {
  return new Promise(async (resolve, reject) => {
    try {
      // Verificar si la tabla existe antes de intentar dropear
      const tablaExiste = await verificarTablaExiste('visitas');
      
      if (!tablaExiste) {
        console.log("Tabla 'visitas' no existe, omitiendo eliminación");
        resolve();
        return;
      }

      db.run("DROP TABLE IF EXISTS visitas", function(err) {
        if (err) {
          reject(err);
        } else {
          console.log("Tabla visitas eliminada exitosamente");
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Función para listar todas las tablas en la base de datos
function listarTablasExistentes() {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
      function(err, rows) {
        if (err) {
          reject(err);
        } else {
          const tablas = rows.map(row => row.name);
          console.log("Tablas existentes en la base de datos:");
          if (tablas.length === 0) {
            console.log("No hay tablas definidas por el usuario");
          } else {
            tablas.forEach(tabla => console.log(`   - ${tabla}`));
          }
          resolve(tablas);
        }
      }
    );
  });
}

// Función principal que ejecuta las operaciones
async function main() {
  try {
    console.log("\n" + "=".repeat(50));
    console.log("INICIANDO OPERACIONES EN LA BASE DE DATOS");
    console.log("=".repeat(50));

    // Primero listar las tablas existentes
    await listarTablasExistentes();

    console.log("\n" + "=".repeat(30));
    console.log("TRUNCADO DE TABLAS");
    console.log("=".repeat(30));
    
    // Truncar las tablas (eliminar datos pero mantener estructura)
    const registrosFicticiosEliminados = await truncarTablaDatosFicticios();
    const registrosVisitasEliminados = await truncarTablaVisitas();
    
    console.log("Resumen truncado:");
    console.log(`  - Registros eliminados de datos_ficticios: ${registrosFicticiosEliminados}`);
    console.log(`  - Registros eliminados de visitas: ${registrosVisitasEliminados}`);

    console.log("\n" + "=".repeat(30));
    console.log("ELIMINACIÓN DE TABLAS");
    console.log("=".repeat(30));
    
    // Dropear las tablas (eliminar tablas completas)
    await dropearTablaDatosFicticios();
    await dropearTablaVisitas();

    // Listar tablas después de las operaciones
    console.log("Estado final de la base de datos:");
    await listarTablasExistentes();
    
    console.log("Operaciones completadas exitosamente");

  } catch (error) {
    console.error("   Error durante las operaciones:");
    console.error("   Mensaje:", error.message);
    console.error("   Código:", error.code);
    
    // Mostrar información adicional para debugging
    if (error.code === 'SQLITE_ERROR') {
      console.error("   Tipo: Error de SQLite");
    }
  } finally {
    // Cerrar la conexión a la base de datos
    db.close((err) => {
      if (err) {
        console.error("Error al cerrar la base de datos:", err.message);
        process.exit(1);
      } else {
        console.log("Conexión a la base de datos cerrada correctamente");
        process.exit(0);
      }
    });
  }
}

// Manejar cierre graceful del proceso
process.on('SIGINT', () => {
  console.log('Proceso interrumpido por el usuario');
  db.close((err) => {
    if (err) {
      console.error('Error al cerrar la base de datos:', err.message);
      process.exit(1);
    }
    console.log('Base de datos cerrada correctamente');
    process.exit(0);
  });
});

// Ejecutar el script
main();