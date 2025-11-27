const { indexarRegistro } = require('../servicios/querys/index_qr_datos.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/registros.db');

/**
 * Script que usa el servicio de indexación
 */
async function pruebaEntradaSalidaConIndexacion() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== PRUEBA ENTRADA/SALIDA CON INDEXACIÓN ===");
    console.log("Proceso: QR -> Indexación -> Entrada -> Salida");
    console.log("--------------------------------------------");

    try {
        // 1. Estado inicial
        console.log("\n1. ESTADO INICIAL:");
        const pendientesInicial = await obtenerRegistrosPendientes(db);
        console.log("Registros pendientes:", pendientesInicial.length);

        // 2. PROBAR ENTRADA CON INDEXACIÓN (como el frontend real)
        console.log("\n2. ENTRADA CON INDEXACIÓN:");
        const runPrueba = "19721459-7";
        const numDocPrueba = "530276170";
        
        console.log(`Datos: RUN=${runPrueba}, NumDoc=${numDocPrueba}`);
        
        // ⚡️ ESTO SÍ USA EL SERVICIO DE INDEXACIÓN ⚡️
        const resultadoIndexacion = await indexarRegistro(runPrueba, numDocPrueba);
        
        if (resultadoIndexacion.exito) {
            console.log("INDEXACIÓN EXITOSA");
            console.log("Datos obtenidos:", resultadoIndexacion.registroIndexado.nombres, resultadoIndexacion.registroIndexado.apellidos);
            
            // Insertar con los datos indexados (como hace el frontend real)
            const entradaId = await insertarConDatosIndexados(db, resultadoIndexacion.registroIndexado);
            if (entradaId) {
                console.log("ENTRADA REGISTRADA - ID:", entradaId);
                
                // 3. Verificar que NO puede entrar again
                console.log("3. VERIFICANDO BLOQUEO DE SEGUNDA ENTRADA:");
                const puedeSegundaEntrada = await verificarPuedeEntrar(db, runPrueba);
                if (!puedeSegundaEntrada) {
                    console.log("BLOQUEO FUNCIONA - No permite segunda entrada");
                }
                
                // 4. Probar salida
                console.log("4. PROCESANDO SALIDA:");
                const salidaExitosa = await simularSalida(db, runPrueba);
                if (salidaExitosa) {
                    console.log("SALIDA REGISTRADA");
                    
                    // 5. Verificar que AHORA SÍ puede entrar again
                    console.log("5. VERIFICANDO LIBERACIÓN:");
                    const puedeEntrarNuevamente = await verificarPuedeEntrar(db, runPrueba);
                    if (puedeEntrarNuevamente) {
                        console.log("SISTEMA LIBERADO - Ahora puede entrar nuevamente");
                    }
                }
            }
        } else if (resultadoIndexacion.duplicado) {
            console.log("INDEXACIÓN FALLIDA - Duplicado:", resultadoIndexacion.mensaje);
        } else {
            console.log("INDEXACIÓN FALLIDA:", resultadoIndexacion.mensaje);
        }

        // 6. Estado final
        console.log("6. ESTADO FINAL:");
        const pendientesFinal = await obtenerRegistrosPendientes(db);
        console.log("Registros pendientes:", pendientesFinal.length);

    } catch (error) {
        console.log("ERROR:", error.message);
    } finally {
        db.close();
        console.log("=================================");
        console.log("Prueba completada");
    }
}

/**
 * Inserta usando los datos del servicio de indexación (como el frontend real)
 */
function insertarConDatosIndexados(db, registroIndexado) {
    return new Promise((resolve) => {
        const ahora = new Date();
        const fecha = ahora.toISOString().split('T')[0];
        const hora_entrada = ahora.toTimeString().split(' ')[0];
        
        db.run(
            `INSERT INTO visitas 
             (run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha, hora_entrada, hora_salida) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`,
            [
                registroIndexado.run,
                registroIndexado.nombres,      // ← DATOS DEL JSON
                registroIndexado.apellidos,    // ← DATOS DEL JSON  
                registroIndexado.fecha_nac,    // ← DATOS DEL JSON
                registroIndexado.sexo,         // ← DATOS DEL JSON
                registroIndexado.num_doc,
                registroIndexado.tipo_evento || "Visita",
                fecha,
                hora_entrada
            ],
            function(err) {
                if (err) {
                    console.log("Error insertando:", err.message);
                    resolve(null);
                } else {
                    resolve(this.lastID);
                }
            }
        );
    });
}

// Las otras funciones se mantienen igual que en el script anterior...
function verificarPuedeEntrar(db, run) {
    return new Promise((resolve) => {
        db.get(
            `SELECT * FROM visitas 
             WHERE run = ? 
             AND hora_entrada IS NOT NULL 
             AND (hora_salida IS NULL OR hora_salida = '') 
             ORDER BY id DESC LIMIT 1`,
            [run],
            (err, row) => {
                resolve(err ? true : !row);
            }
        );
    });
}

function simularSalida(db, run) {
    return new Promise((resolve) => {
        db.get(
            `SELECT * FROM visitas 
             WHERE run = ? 
             AND hora_entrada IS NOT NULL 
             AND (hora_salida IS NULL OR hora_salida = '') 
             ORDER BY id DESC LIMIT 1`,
            [run],
            (err, row) => {
                if (err || !row) {
                    resolve(false);
                    return;
                }
                
                const hora_salida = new Date().toTimeString().split(' ')[0];
                db.run(
                    `UPDATE visitas SET hora_salida = ? WHERE id = ?`,
                    [hora_salida, row.id],
                    function(updateErr) {
                        resolve(!updateErr);
                    }
                );
            }
        );
    });
}

function obtenerRegistrosPendientes(db) {
    return new Promise((resolve) => {
        db.all(
            `SELECT id, run, nombres, apellidos 
             FROM visitas 
             WHERE hora_entrada IS NOT NULL 
             AND (hora_salida IS NULL OR hora_salida = '') 
             ORDER BY id`,
            (err, rows) => {
                resolve(err ? [] : rows);
            }
        );
    });
}

// Ejecutar
pruebaEntradaSalidaConIndexacion();