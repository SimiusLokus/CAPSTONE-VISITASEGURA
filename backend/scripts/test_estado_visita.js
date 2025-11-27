const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/registros.db');
const db = new sqlite3.Database(dbPath);

console.log("=== ESTADO ACTUAL - ENTRADAS/SALIDAS ===");

// Mostrar registros con salida pendiente
db.all(
    `SELECT id, run, nombres, apellidos, fecha, hora_entrada, hora_salida 
     FROM visitas 
     WHERE hora_entrada IS NOT NULL 
     ORDER BY id DESC 
     LIMIT 10`,
    (err, rows) => {
        if (err) {
            console.log("Error:", err.message);
        } else {
            console.log("\nÚLTIMOS 10 REGISTROS:");
            rows.forEach(row => {
                const estado = row.hora_salida ? `SALIDA: ${row.hora_salida}` : 'PENDIENTE';
                console.log(`ID: ${row.id} | RUN: ${row.run} | ${row.fecha} ${row.hora_entrada} | ${estado}`);
            });
            
            // Contar pendientes
            db.get(
                "SELECT COUNT(*) as pendientes FROM visitas WHERE hora_salida IS NULL AND hora_entrada IS NOT NULL",
                (err, countRow) => {
                    console.log(`TOTAL SALIDAS PENDIENTES: ${countRow.pendientes}`);
                    db.close();
                }
            );
        }
    }
);