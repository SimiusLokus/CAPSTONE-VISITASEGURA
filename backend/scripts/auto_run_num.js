const { indexarRegistro } = require('../servicios/querys/index_qr_datos.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/registros.db');

/**
 * Script que GENERA RUN y NumDoc únicos para poder indexar datos del JSON
 */
async function actualizarRegistrosConDatosUnicos() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== ACTUALIZANDO REGISTROS CON DATOS UNICOS ===");
    console.log("Proceso: Generar RUN/NumDoc unicos -> Indexar -> Actualizar");
    console.log("----------------------------------------------------------");

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

        // 2. Procesar cada registro con datos únicos
        for (let i = 0; i < registrosSinDatos.length; i++) {
            const registro = registrosSinDatos[i];
            
            console.log("\n--- Procesando ID:", registro.id, "---");
            console.log("Datos actuales:", registro.nombres, registro.apellidos);

            // Generar RUN y NumDoc únicos
            const runUnico = generarRUNUnico(i);
            const numDocUnico = generarNumDocUnico(i);
            
            console.log("RUN unico generado:", runUnico);
            console.log("NumDoc unico generado:", numDocUnico);

            // Usar el servicio de indexación con datos únicos
            const resultadoIndexacion = await indexarRegistro(runUnico, numDocUnico);
            
            if (resultadoIndexacion.exito) {
                console.log("Datos obtenidos del JSON:", 
                    resultadoIndexacion.registroIndexado.nombres, 
                    resultadoIndexacion.registroIndexado.apellidos
                );

                // Actualizar el registro existente con los nuevos datos
                const resultado = await actualizarRegistroCompleto(
                    db, 
                    registro.id, 
                    resultadoIndexacion.registroIndexado,
                    runUnico,
                    numDocUnico
                );
                
                if (resultado.exito) {
                    console.log("Actualizacion exitosa");
                    actualizacionesExitosas++;
                } else {
                    console.log("Error en actualizacion:", resultado.error);
                    actualizacionesFallidas++;
                }

            } else if (resultadoIndexacion.duplicado) {
                console.log("Error inesperado - Duplicado con datos unicos:", resultadoIndexacion.mensaje);
                actualizacionesFallidas++;
            } else {
                console.log("Error en indexacion:", resultadoIndexacion.mensaje);
                actualizacionesFallidas++;
            }
        }

        // 3. Resumen final
        console.log("\n=== RESUMEN FINAL ===");
        console.log("Actualizaciones exitosas:", actualizacionesExitosas);
        console.log("Actualizaciones fallidas:", actualizacionesFallidas);
        console.log("Registros sin datos restantes:", (await obtenerRegistrosSinDatos(db)).length);

    } catch (error) {
        console.log("Error general:", error.message);
    } finally {
        db.close();
        console.log("Proceso completado");
    }
}

/**
 * Genera un RUN único basado en el índice
 */
function generarRUNUnico(indice) {
    const baseNumber = 10000000 + indice;
    const digitoVerificador = (indice % 9) + 1;
    return `${baseNumber}-${digitoVerificador}`;
}

/**
 * Genera un NumDoc único basado en el índice
 */
function generarNumDocUnico(indice) {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letra1 = letras[Math.floor(indice / 26) % letras.length];
    const letra2 = letras[indice % letras.length];
    const numeros = String(100000 + indice).padStart(6, '0');
    return `${letra1}${letra2}${numeros}`;
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
 * Actualiza un registro existente con datos del JSON y nuevos RUN/NumDoc
 */
function actualizarRegistroCompleto(db, idRegistro, datosJSON, nuevoRUN, nuevoNumDoc) {
    return new Promise((resolve) => {
        db.run(
            `UPDATE visitas 
             SET run = ?, num_doc = ?, nombres = ?, apellidos = ?, fecha_nac = ?, sexo = ?, tipo_evento = ?
             WHERE id = ?`,
            [
                nuevoRUN,
                nuevoNumDoc,
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
 * Script alternativo: Actualizar SOLO los campos de nombre sin cambiar RUN/NumDoc
 * (Para cuando quieres mantener los RUN originales)
 */
async function actualizarSoloNombresConDatosJSON() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== ACTUALIZANDO SOLO NOMBRES CON DATOS JSON ===");
    console.log("Proceso: Usar datos JSON para nombres manteniendo RUN original");
    console.log("-------------------------------------------------------------");

    try {
        const registrosSinDatos = await obtenerRegistrosSinDatos(db);
        console.log("Registros encontrados sin datos completos:", registrosSinDatos.length);

        if (registrosSinDatos.length === 0) {
            console.log("No hay registros para actualizar");
            return;
        }

        let actualizacionesExitosas = 0;
        let actualizacionesFallidas = 0;

        // Para este enfoque, necesitamos datos del JSON directamente
        const datosFicticios = require('../servicios/JSON/datos_ficticios.json');
        
        for (let i = 0; i < registrosSinDatos.length; i++) {
            const registro = registrosSinDatos[i];
            const datoFicticio = datosFicticios[i % datosFicticios.length];
            
            console.log("\n--- Procesando ID:", registro.id, "---");
            console.log("RUN original:", registro.run);
            console.log("Dato ficticio asignado:", datoFicticio.nombres, datoFicticio.apellidos);

            // Actualizar solo los campos de nombre
            const resultado = await actualizarSoloNombres(
                db, 
                registro.id, 
                datoFicticio
            );
            
            if (resultado.exito) {
                console.log("Actualizacion exitosa");
                actualizacionesExitosas++;
            } else {
                console.log("Error en actualizacion:", resultado.error);
                actualizacionesFallidas++;
            }
        }

        console.log("\n=== RESUMEN FINAL ===");
        console.log("Actualizaciones exitosas:", actualizacionesExitosas);
        console.log("Actualizaciones fallidas:", actualizacionesFallidas);

    } catch (error) {
        console.log("Error general:", error.message);
    } finally {
        db.close();
        console.log("Proceso completado");
    }
}

function actualizarSoloNombres(db, idRegistro, datoFicticio) {
    return new Promise((resolve) => {
        db.run(
            `UPDATE visitas 
             SET nombres = ?, apellidos = ?, fecha_nac = ?, sexo = ?
             WHERE id = ?`,
            [
                datoFicticio.nombres,
                datoFicticio.apellidos, 
                datoFicticio.fecha_nac,
                datoFicticio.sexo,
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

// Ejecutar según opción
async function main() {
    const opcion = process.argv[2];
    
    if (opcion === '--solo-nombres') {
        await actualizarSoloNombresConDatosJSON();
    } else {
        await actualizarRegistrosConDatosUnicos();
    }
}

main();