const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/registros.db');

/**
 * Script que usa EXACTAMENTE la misma lógica que server.js
 * - Misma consulta SQL
 * - Misma validación de negocio
 * - Mismo flujo de entrada/salida
 */
async function procesarSalidasPendientes() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== PROCESANDO SALIDAS PENDIENTES  ===");
    console.log("Usando EXACTAMENTE la misma validación que el endpoint /visitas");
    console.log("--------------------------------------------------------------");

    try {
        // 1. Obtener todos los RUNs únicos con salidas pendientes
        const runsPendientes = await obtenerRUNsConSalidasPendientes(db);
        console.log(`RUNs con salidas pendientes encontrados: ${runsPendientes.length}`);

        if (runsPendientes.length === 0) {
            console.log("No hay salidas pendientes por procesar");
            return;
        }

        let salidasProcesadas = 0;
        let sinEntradaPendiente = 0;

        // 2. Para cada RUN, usar la MISMA lógica que server.js
        for (const run of runsPendientes) {
            console.log(`--- Procesando RUN: ${run} ---`);
            
            // ESTA ES LA MISMA LÓGICA QUE TU SERVER.JS
            const entradaPendiente = await buscarEntradaPendiente(db, run);
            
            if (entradaPendiente) {
                console.log(`   Entrada pendiente encontrada - ID: ${entradaPendiente.id}`);
                console.log(`   Fecha: ${entradaPendiente.fecha} ${entradaPendiente.hora_entrada}`);
                console.log(`   Nombre: ${entradaPendiente.nombres} ${entradaPendiente.apellidos}`);

                // Registrar salida (MISMA lógica que server.js)
                const resultado = await registrarSalida(db, entradaPendiente.id);
                
                if (resultado.exito) {
                    console.log(`SALIDA REGISTRADA - Hora: ${resultado.hora_salida}`);
                    salidasProcesadas++;
                } else {
                    console.log(`Error registrando salida: ${resultado.error}`);
                }
            } else {
                console.log(`    No se encontró entrada pendiente para RUN: ${run}`);
                console.log(`   (Posiblemente ya fue procesada por otro medio)`);
                sinEntradaPendiente++;
            }
        }

        // 3. Resumen final
        console.log("=== RESUMEN FINAL ===");
        console.log(`Salidas procesadas exitosamente: ${salidasProcesadas}`);
        console.log(`RUNs sin entrada pendiente: ${sinEntradaPendiente}`);
        console.log(`Total RUNs pendientes restantes: ${(await obtenerRUNsConSalidasPendientes(db)).length}`);

    } catch (error) {
        console.log("ERROR GENERAL:", error.message);
    } finally {
        db.close();
        console.log("Proceso completado");
    }
}

/**
 * Obtiene RUNs únicos que tienen salidas pendientes
 * (Misma lógica que server.js para buscar por RUN)
 */
function obtenerRUNsConSalidasPendientes(db) {
    return new Promise((resolve) => {
        db.all(
            `SELECT DISTINCT run 
             FROM visitas 
             WHERE hora_entrada IS NOT NULL 
             AND (hora_salida IS NULL OR hora_salida = '') 
             ORDER BY run`,
            (err, rows) => {
                if (err) {
                    console.log("Error obteniendo RUNs pendientes:", err.message);
                    resolve([]);
                } else {
                    const runs = rows.map(row => row.run).filter(run => run); // Filtrar null/undefined
                    resolve(runs);
                }
            }
        );
    });
}

/**
 * BUSCA ENTRADA PENDIENTE - MISMO  que server.js
 */
function buscarEntradaPendiente(db, run) {
    return new Promise((resolve) => {
        //  ESTA ES LA CONSULTA DEL SERVER.JS
        db.get(
            `SELECT * FROM visitas 
             WHERE run = ? 
             AND hora_entrada IS NOT NULL 
             AND (hora_salida IS NULL OR hora_salida = '') 
             ORDER BY id DESC LIMIT 1`,
            [run],
            (err, row) => {
                if (err) {
                    console.log(`Error buscando entrada pendiente para ${run}:`, err.message);
                    resolve(null);
                } else {
                    resolve(row || null);
                }
            }
        );
    });
}

/**
 * Registra salida - MISMO que server.js
 */
function registrarSalida(db, idRegistro) {
    return new Promise((resolve) => {
        const hora_salida = new Date().toTimeString().split(' ')[0];
        
        // UPDATE similar al de server.js
        db.run(
            `UPDATE visitas SET hora_salida = ? WHERE id = ?`,
            [hora_salida, idRegistro],
            function(err) {
                if (err) {
                    resolve({ exito: false, error: err.message });
                } else {
                    if (this.changes > 0) {
                        resolve({ exito: true, hora_salida: hora_salida });
                    } else {
                        resolve({ exito: false, error: "No se actualizó ningún registro" });
                    }
                }
            }
        );
    });
}

/**
 * TEST: Simular el comportamiento del frontend
 */
async function simularFlujoCompletoFrontend() {
    const db = new sqlite3.Database(dbPath);
    
    console.log(" === SIMULANDO COMPORTAMIENTO FRONTEND ===");
    
    const runTest = "19721459-7";
    
    console.log(`Simulando frontend para RUN: ${runTest}`);
    
    // 1. Verificar si puede entrar (misma lógica que frontend)
    const puedeEntrar = await verificarPuedeEntrar(db, runTest);
    console.log(`¿Puede entrar? ${puedeEntrar ? 'SÍ' : 'NO'}`);
    
    if (puedeEntrar) {
        console.log("Frontend: Mostrar botón 'Registrar Entrada'");
        // Aquí simularíamos la entrada...
    } else {
        console.log("Frontend: Mostrar botón 'Registrar Salida'");
        // Aquí simularíamos la salida...
    }
    
    db.close();
}

function verificarPuedeEntrar(db, run) {
    return new Promise((resolve) => {
        // MISMA lógica que server.js para verificar entrada
        db.get(
            `SELECT * FROM visitas 
             WHERE run = ? 
             AND hora_entrada IS NOT NULL 
             AND (hora_salida IS NULL OR hora_salida = '') 
             ORDER BY id DESC LIMIT 1`,
            [run],
            (err, row) => {
                resolve(err ? true : !row); // Si no encuentra entrada pendiente, SÍ puede entrar
            }
        );
    });
}

// Ejecutar
async function main() {
    const opcion = process.argv[2];
    
    if (opcion === '--test-frontend') {
        await simularFlujoCompletoFrontend();
    } else {
        await procesarSalidasPendientes();
    }
}

main();