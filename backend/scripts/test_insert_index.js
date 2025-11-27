const { indexarRegistro } = require('../servicios/querys/index_qr_datos.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Configuración de la base de datos
const dbPath = path.join(__dirname, '../../data/registros.db');

/**
 * Script que REALMENTE inserta datos en la base de datos - VERSIÓN CORREGIDA
 */
async function pruebaInsercionReal() {
    // Crear nueva conexión para esta ejecución
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== PRUEBA DE INSERCIÓN REAL EN BD ===");
    console.log("Proceso: QR -> Indexación -> Inserción REAL en BD");
    console.log("-----------------------------------------------");

    // Datos de prueba
    const datosPrueba = [
        { run: "12345678-9", num_doc: "AB123456" },
        { run: "98765432-1", num_doc: "CD789012" },
        { run: "11222333-4", num_doc: "EF345678" }
    ];

    let insercionesExitosas = 0;
    let insercionesFallidas = 0;

    for (let i = 0; i < datosPrueba.length; i++) {
        const { run, num_doc } = datosPrueba[i];
        
        console.log(`\n--- PRUEBA ${i + 1} ---`);
        console.log(`Datos QR: RUN=${run}, NumDoc=${num_doc}`);

        try {
            // Paso 1: Indexar datos
            console.log("Paso 1: Indexando datos...");
            const resultadoIndexacion = await indexarRegistro(run, num_doc);
            
            if (resultadoIndexacion.exito) {
                console.log("Indexación EXITOSA");
                
                // Paso 2: INSERTAR REALMENTE en la BD
                console.log("Paso 2: Insertando en base de datos...");
                
                const registro = resultadoIndexacion.registroIndexado;
                const ahora = new Date();
                const fecha = ahora.toISOString().split('T')[0];
                const hora_entrada = ahora.toTimeString().split(' ')[0];
                
                const query = `
                    INSERT INTO visitas 
                    (run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha, hora_entrada, hora_salida) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
                `;
                
                const resultado = await insertarEnBD(db, query, [
                    registro.run,
                    registro.nombres,
                    registro.apellidos,
                    registro.fecha_nac,
                    registro.sexo,
                    registro.num_doc,
                    registro.tipo_evento || "Visita",
                    fecha,
                    hora_entrada
                ]);
                
                if (resultado.exito) {
                    console.log("INSERCIÓN EXITOSA - ID: " + resultado.id);
                    insercionesExitosas++;
                    
                    // Verificar que realmente se insertó
                    await verificarInsercion(db, resultado.id);
                } else {
                    console.log("INSERCIÓN FALLIDA: " + resultado.error);
                    insercionesFallidas++;
                }
                
            } else if (resultadoIndexacion.duplicado) {
                console.log("Indexación FALLIDA: Registro duplicado");
                insercionesFallidas++;
            } else {
                console.log("Indexación FALLIDA: " + resultadoIndexacion.mensaje);
                insercionesFallidas++;
            }

        } catch (error) {
            console.log("ERROR en el proceso: " + error.message);
            insercionesFallidas++;
        }
    }

    // Mostrar resumen final
    console.log("\n=== RESUMEN FINAL ===");
    console.log("Inserciones exitosas: " + insercionesExitosas);
    console.log("Inserciones fallidas: " + insercionesFallidas);
    console.log("Total de registros en BD: " + await contarRegistros(db));
    
    // Mostrar últimos registros ANTES de cerrar la BD
    await mostrarUltimosRegistros(db);
    
    console.log("=================================");
    
    // Cerrar conexión a la BD solo al final
    db.close((err) => {
        if (err) {
            console.log("Error cerrando BD: " + err.message);
        } else {
            console.log("Conexión a BD cerrada correctamente");
        }
    });
}

/**
 * Función para insertar realmente en la BD
 */
function insertarEnBD(db, query, parametros) {
    return new Promise((resolve, reject) => {
        db.run(query, parametros, function(err) {
            if (err) {
                resolve({ exito: false, error: err.message });
            } else {
                resolve({ exito: true, id: this.lastID });
            }
        });
    });
}

/**
 * Verificar que el registro se insertó correctamente
 */
function verificarInsercion(db, id) {
    return new Promise((resolve, reject) => {
        db.get("SELECT * FROM visitas WHERE id = ?", [id], (err, row) => {
            if (err) {
                console.log("  Error verificando inserción: " + err.message);
                resolve(false);
            } else if (row) {
                console.log("  Verificación EXITOSA - Registro encontrado en BD");
                console.log("  Detalles: " + row.nombres + " " + row.apellidos);
                resolve(true);
            } else {
                console.log("  Verificación FALLIDA - Registro NO encontrado");
                resolve(false);
            }
        });
    });
}

/**
 * Contar total de registros en la tabla visitas
 */
function contarRegistros(db) {
    return new Promise((resolve, reject) => {
        db.get("SELECT COUNT(*) as total FROM visitas", (err, row) => {
            if (err) {
                console.log("Error contando registros: " + err.message);
                resolve(0);
            } else {
                resolve(row.total);
            }
        });
    });
}

/**
 * Mostrar los últimos 5 registros insertados
 */
function mostrarUltimosRegistros(db) {
    return new Promise((resolve, reject) => {
        console.log("\n=== ÚLTIMOS 5 REGISTROS EN BD ===");
        db.all("SELECT id, run, nombres, apellidos, fecha, hora_entrada FROM visitas ORDER BY id DESC LIMIT 5", (err, rows) => {
            if (err) {
                console.log("Error obteniendo registros: " + err.message);
            } else if (rows && rows.length > 0) {
                rows.forEach(row => {
                    console.log(`ID: ${row.id} | RUN: ${row.run} | Nombre: ${row.nombres} ${row.apellidos} | Fecha: ${row.fecha} ${row.hora_entrada}`);
                });
            } else {
                console.log("No hay registros en la base de datos");
            }
            resolve();
        });
    });
}

// Ejecutar prueba completa
async function ejecutarPruebaCompleta() {
    try {
        await pruebaInsercionReal();
    } catch (error) {
        console.error("Error en prueba completa:", error);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    ejecutarPruebaCompleta();
}

module.exports = {
    pruebaInsercionReal
};