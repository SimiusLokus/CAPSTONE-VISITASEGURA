const { indexarRegistro } = require('../servicios/querys/index_qr_datos.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/registros.db');

/**
 * Script para ACTUALIZAR registros existentes con datos del JSON
 * Valida que no se repitan nombres con diferentes RUN/NumDoc
 */
async function actualizarRegistrosConDatosJSON() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== ACTUALIZANDO REGISTROS CON DATOS JSON ===");
    console.log("Proceso: Buscar registros 'no disponible' -> Indexar -> Actualizar");
    console.log("---------------------------------------------------------------");

    try {
        // 1. Buscar registros con datos "no disponible"
        const registrosSinDatos = await obtenerRegistrosSinDatos(db);
        console.log("Registros encontrados sin datos completos:", registrosSinDatos.length);

        if (registrosSinDatos.length === 0) {
            console.log("No hay registros para actualizar");
            return;
        }

        let actualizacionesExitosas = 0;
        let actualizacionesFallidas = 0;
        let duplicadosEvitados = 0;

        // 2. Procesar cada registro
        for (const registro of registrosSinDatos) {
            console.log("\n--- Procesando ID:", registro.id, "---");
            console.log("RUN:", registro.run, "| NumDoc:", registro.num_doc);
            console.log("Datos actuales:", registro.nombres, registro.apellidos);

            // Verificar si YA tiene datos reales (por si acaso)
            if (registro.nombres !== "no disponible" && registro.nombres !== "" && registro.nombres !== null) {
                console.log("Ya tiene datos reales, saltando...");
                continue;
            }

            // Usar el servicio de indexación para obtener datos del JSON
            const resultadoIndexacion = await indexarRegistro(registro.run, registro.num_doc);
            
            if (resultadoIndexacion.exito) {
                console.log("Datos obtenidos del JSON:", 
                    resultadoIndexacion.registroIndexado.nombres, 
                    resultadoIndexacion.registroIndexado.apellidos
                );

                // Verificar que no exista duplicación de nombres con diferente RUN
                const esDuplicado = await verificarDuplicacionNombres(
                    db, 
                    resultadoIndexacion.registroIndexado.nombres,
                    resultadoIndexacion.registroIndexado.apellidos,
                    registro.run  // Excluir el registro actual
                );

                if (esDuplicado) {
                    console.log("Duplicado evitado: Mismos nombres con RUN diferente");
                    duplicadosEvitados++;
                    continue;
                }

                // Actualizar el registro existente
                const resultado = await actualizarRegistro(db, registro.id, resultadoIndexacion.registroIndexado);
                
                if (resultado.exito) {
                    console.log("Actualizacion exitosa");
                    actualizacionesExitosas++;
                } else {
                    console.log("Error en actualizacion:", resultado.error);
                    actualizacionesFallidas++;
                }

            } else if (resultadoIndexacion.duplicado) {
                console.log("Duplicado en indexacion:", resultadoIndexacion.mensaje);
                duplicadosEvitados++;
            } else {
                console.log("Error en indexacion:", resultadoIndexacion.mensaje);
                actualizacionesFallidas++;
            }
        }

        // 3. Resumen final
        console.log("\n=== RESUMEN FINAL ===");
        console.log("Actualizaciones exitosas:", actualizacionesExitosas);
        console.log("Actualizaciones fallidas:", actualizacionesFallidas);
        console.log("Duplicados evitados:", duplicadosEvitados);
        console.log("Registros sin datos restantes:", (await obtenerRegistrosSinDatos(db)).length);

    } catch (error) {
        console.log("Error general:", error.message);
    } finally {
        db.close();
        console.log("Proceso completado");
    }
}

/**
 * Obtiene registros que tienen datos "no disponible"
 */
function obtenerRegistrosSinDatos(db) {
    return new Promise((resolve) => {
        db.all(
            `SELECT id, run, num_doc, nombres, apellidos, fecha_nac, sexo 
             FROM visitas 
             WHERE nombres = 'no disponible' 
             OR apellidos = 'no disponible' 
             OR nombres IS NULL 
             OR apellidos IS NULL 
             OR nombres = '' 
             OR apellidos = ''
             ORDER BY id`,
            (err, rows) => {
                if (err) {
                    console.log("Error obteniendo registros:", err.message);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            }
        );
    });
}

/**
 * Verifica si ya existe la misma combinación de nombres/apellidos con RUN diferente
 */
function verificarDuplicacionNombres(db, nombres, apellidos, runExcluir) {
    return new Promise((resolve) => {
        db.get(
            `SELECT COUNT(*) as count 
             FROM visitas 
             WHERE nombres = ? 
             AND apellidos = ? 
             AND run != ? 
             AND nombres != 'no disponible' 
             AND apellidos != 'no disponible'`,
            [nombres, apellidos, runExcluir],
            (err, row) => {
                if (err) {
                    console.log("Error verificando duplicacion:", err.message);
                    resolve(false);
                } else {
                    resolve(row.count > 0);
                }
            }
        );
    });
}

/**
 * Actualiza un registro existente con datos del JSON
 */
function actualizarRegistro(db, idRegistro, datosJSON) {
    return new Promise((resolve) => {
        db.run(
            `UPDATE visitas 
             SET nombres = ?, apellidos = ?, fecha_nac = ?, sexo = ?, tipo_evento = ?
             WHERE id = ?`,
            [
                datosJSON.nombres,
                datosJSON.apellidos, 
                datosJSON.fecha_nac,
                datosJSON.sexo,
                datosJSON.tipo_evento || "Visita",
                idRegistro
            ],
            function(err) {
                if (err) {
                    resolve({ exito: false, error: err.message });
                } else {
                    if (this.changes > 0) {
                        resolve({ exito: true });
                    } else {
                        resolve({ exito: false, error: "No se actualizo ningun registro" });
                    }
                }
            }
        );
    });
}

/**
 * Muestra el estado antes/después de los registros actualizados
 */
async function mostrarEstadoRegistros() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("\n=== ESTADO ACTUAL DE REGISTROS ===");
    
    // Registros con datos reales
    const conDatosReales = await new Promise((resolve) => {
        db.all(
            `SELECT COUNT(*) as count 
             FROM visitas 
             WHERE nombres != 'no disponible' 
             AND nombres IS NOT NULL 
             AND nombres != ''`,
            (err, row) => {
                resolve(err ? 0 : row[0].count);
            }
        );
    });
    
    // Registros sin datos
    const sinDatosReales = await new Promise((resolve) => {
        db.all(
            `SELECT COUNT(*) as count 
             FROM visitas 
             WHERE nombres = 'no disponible' 
             OR nombres IS NULL 
             OR nombres = ''`,
            (err, row) => {
                resolve(err ? 0 : row[0].count);
            }
        );
    });
    
    console.log("Registros con datos reales:", conDatosReales);
    console.log("Registros sin datos reales:", sinDatosReales);
    console.log("Total registros:", conDatosReales + sinDatosReales);
    
    // Mostrar algunos ejemplos
    console.log("\nEjemplos de registros actuales:");
    const ejemplos = await new Promise((resolve) => {
        db.all(
            `SELECT id, run, nombres, apellidos 
             FROM visitas 
             ORDER BY id DESC 
             LIMIT 5`,
            (err, rows) => {
                resolve(err ? [] : rows);
            }
        );
    });
    
    ejemplos.forEach(reg => {
        console.log(`ID: ${reg.id} | RUN: ${reg.run} | Nombre: ${reg.nombres} ${reg.apellidos}`);
    });
    
    db.close();
}

// Ejecutar
async function main() {
    const opcion = process.argv[2];
    
    if (opcion === '--estado') {
        await mostrarEstadoRegistros();
    } else {
        console.log("Estado inicial:");
        await mostrarEstadoRegistros();
        console.log("\n" + "=".repeat(50));
        await actualizarRegistrosConDatosJSON();
        console.log("\n" + "=".repeat(50));
        console.log("Estado final:");
        await mostrarEstadoRegistros();
    }
}

main();