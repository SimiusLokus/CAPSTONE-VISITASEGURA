const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../../data/registros.db');

/**
 * Script para ELIMINAR registros duplicados manteniendo el último registro
 * Elimina duplicados basados en nombres + apellidos
 */
async function eliminarRegistrosDuplicados() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== ELIMINANDO REGISTROS DUPLICADOS ===");
    console.log("Criterio: nombres + apellidos (manteniendo el ultimo registro)");
    console.log("-------------------------------------------------------------");

    try {
        // 1. Estado inicial
        console.log("\n1. ANALIZANDO ESTADO INICIAL:");
        const totalInicial = await contarRegistros(db);
        const duplicadosInicial = await identificarDuplicados(db);
        
        console.log("Total registros inicial:", totalInicial);
        console.log("Combinaciones duplicadas encontradas:", duplicadosInicial.length);

        if (duplicadosInicial.length === 0) {
            console.log("No hay duplicados para eliminar");
            return;
        }

        // 2. Mostrar duplicados encontrados
        console.log("\n2. DUPLICADOS IDENTIFICADOS:");
        duplicadosInicial.forEach(dup => {
            console.log(`- ${dup.nombres} ${dup.apellidos}: ${dup.cantidad} registros`);
        });

        // 3. ELIMINAR duplicados
        console.log("\n3. ELIMINANDO DUPLICADOS...");
        const resultadoEliminacion = await eliminarDuplicados(db);
        
        console.log("Registros eliminados:", resultadoEliminacion.eliminados);
        console.log("Registros conservados:", resultadoEliminacion.conservados);

        // 4. Estado final
        console.log("\n4. ESTADO FINAL:");
        const totalFinal = await contarRegistros(db);
        const duplicadosFinal = await identificarDuplicados(db);
        
        console.log("Total registros final:", totalFinal);
        console.log("Registros eliminados total:", totalInicial - totalFinal);
        console.log("Combinaciones duplicadas restantes:", duplicadosFinal.length);

        // 5. Mostrar resumen de lo eliminado
        if (resultadoEliminacion.eliminados > 0) {
            console.log("\n5. RESUMEN DE ELIMINACION:");
            await mostrarResumenEliminacion(db, duplicadosInicial);
        }

    } catch (error) {
        console.log("Error general:", error.message);
    } finally {
        db.close();
        console.log("\nProceso completado");
    }
}

/**
 * Identifica combinaciones duplicadas de nombres + apellidos
 */
function identificarDuplicados(db) {
    return new Promise((resolve) => {
        db.all(
            `SELECT nombres, apellidos, COUNT(*) as cantidad
             FROM visitas
             WHERE nombres != 'no disponible'
             AND apellidos != 'no disponible'
             AND nombres IS NOT NULL
             AND apellidos IS NOT NULL
             GROUP BY nombres, apellidos
             HAVING COUNT(*) > 1
             ORDER BY cantidad DESC`,
            (err, rows) => {
                if (err) {
                    console.log("Error identificando duplicados:", err.message);
                    resolve([]);
                } else {
                    resolve(rows || []);
                }
            }
        );
    });
}

/**
 * Elimina registros duplicados manteniendo solo el último (mayor ID)
 */
function eliminarDuplicados(db) {
    return new Promise((resolve) => {
        // Primero: Crear tabla temporal con los IDs a conservar (último registro de cada duplicado)
        const queryConservar = `
            CREATE TEMPORARY TABLE ids_a_conservar AS
            SELECT MAX(id) as id
            FROM visitas
            WHERE nombres != 'no disponible'
            AND apellidos != 'no disponible'
            AND nombres IS NOT NULL
            AND apellidos IS NOT NULL
            GROUP BY nombres, apellidos
        `;

        db.run(queryConservar, function(err) {
            if (err) {
                console.log("Error creando tabla temporal:", err.message);
                resolve({ eliminados: 0, conservados: 0 });
                return;
            }

            // Contar cuántos se van a conservar
            db.get("SELECT COUNT(*) as conservados FROM ids_a_conservar", (err, countRow) => {
                if (err) {
                    resolve({ eliminados: 0, conservados: 0 });
                    return;
                }

                const conservados = countRow.conservados;

                // ELIMINAR registros que NO están en la tabla de conservados
                const queryEliminar = `
                    DELETE FROM visitas
                    WHERE nombres != 'no disponible'
                    AND apellidos != 'no disponible'
                    AND nombres IS NOT NULL
                    AND apellidos IS NOT NULL
                    AND id NOT IN (SELECT id FROM ids_a_conservar)
                    AND id IN (
                        SELECT v.id FROM visitas v
                        INNER JOIN (
                            SELECT nombres, apellidos, COUNT(*) as count
                            FROM visitas
                            WHERE nombres != 'no disponible'
                            AND apellidos != 'no disponible'
                            GROUP BY nombres, apellidos
                            HAVING COUNT(*) > 1
                        ) dup ON v.nombres = dup.nombres AND v.apellidos = dup.apellidos
                    )
                `;

                db.run(queryEliminar, function(deleteErr) {
                    if (deleteErr) {
                        console.log("Error eliminando duplicados:", deleteErr.message);
                        resolve({ eliminados: 0, conservados: conservados });
                    } else {
                        const eliminados = this.changes;
                        
                        // Eliminar tabla temporal
                        db.run("DROP TABLE IF EXISTS ids_a_conservar", (dropErr) => {
                            if (dropErr) {
                                console.log("Error eliminando tabla temporal:", dropErr.message);
                            }
                            resolve({ eliminados: eliminados, conservados: conservados });
                        });
                    }
                });
            });
        });
    });
}

/**
 * Muestra resumen de lo que se eliminó
 */
async function mostrarResumenEliminacion(db, duplicadosInicial) {
    console.log("\nDETALLE DE ELIMINACION:");
    
    for (const dup of duplicadosInicial) {
        const registrosFinal = await contarRegistrosPorNombre(db, dup.nombres, dup.apellidos);
        console.log(`- ${dup.nombres} ${dup.apellidos}: ${dup.cantidad} -> ${registrosFinal} registros`);
    }
}

/**
 * Cuenta registros por combinación nombre+apellido
 */
function contarRegistrosPorNombre(db, nombres, apellidos) {
    return new Promise((resolve) => {
        db.get(
            `SELECT COUNT(*) as count 
             FROM visitas 
             WHERE nombres = ? AND apellidos = ?`,
            [nombres, apellidos],
            (err, row) => {
                resolve(err ? 0 : row.count);
            }
        );
    });
}

/**
 * Cuenta el total de registros
 */
function contarRegistros(db) {
    return new Promise((resolve) => {
        db.get("SELECT COUNT(*) as total FROM visitas", (err, row) => {
            resolve(err ? 0 : row.total);
        });
    });
}

/**
 * Script ALTERNATIVO: Eliminación más conservadora (con backup)
 */
async function eliminarDuplicadosConBackup() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== ELIMINANDO DUPLICADOS CON BACKUP ===");
    console.log("Creando backup antes de eliminar...");
    console.log("----------------------------------------");

    try {
        // 1. Crear tabla de backup
        console.log("\n1. CREANDO BACKUP...");
        await crearBackup(db);
        
        // 2. Estado inicial
        const totalInicial = await contarRegistros(db);
        const duplicadosInicial = await identificarDuplicados(db);
        
        console.log("Total registros inicial:", totalInicial);
        console.log("Duplicados encontrados:", duplicadosInicial.length);

        if (duplicadosInicial.length === 0) {
            console.log("No hay duplicados para eliminar");
            return;
        }

        // 3. Eliminar duplicados
        console.log("\n2. ELIMINANDO DUPLICADOS...");
        const resultado = await eliminarDuplicados(db);
        
        console.log("Registros eliminados:", resultado.eliminados);
        console.log("Registros conservados:", resultado.conservados);

        // 4. Estado final
        const totalFinal = await contarRegistros(db);
        console.log("\n3. ESTADO FINAL:");
        console.log("Total registros final:", totalFinal);
        console.log("Reduccion total:", totalInicial - totalFinal);

        // 5. Información de backup
        console.log("\n4. INFORMACION DE BACKUP:");
        console.log("Backup creado en: tabla 'visitas_backup'");
        console.log("Para restaurar: INSERT INTO visitas SELECT * FROM visitas_backup");
        console.log("Para limpiar backup: DROP TABLE visitas_backup");

    } catch (error) {
        console.log("Error:", error.message);
    } finally {
        db.close();
        console.log("\nProceso completado con backup");
    }
}

/**
 * Crea una tabla de backup
 */
function crearBackup(db) {
    return new Promise((resolve, reject) => {
        // Eliminar backup anterior si existe
        db.run("DROP TABLE IF EXISTS visitas_backup", (dropErr) => {
            if (dropErr) {
                console.log("Error eliminando backup anterior:", dropErr.message);
            }
            
            // Crear nuevo backup
            db.run(
                `CREATE TABLE visitas_backup AS 
                 SELECT * FROM visitas`,
                (createErr) => {
                    if (createErr) {
                        reject(createErr);
                    } else {
                        console.log("Backup creado exitosamente");
                        resolve();
                    }
                }
            );
        });
    });
}

/**
 * Muestra los últimos registros para verificar
 */
async function mostrarUltimosRegistros() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("\n=== ULTIMOS 10 REGISTROS ===");
    
    const registros = await new Promise((resolve) => {
        db.all(
            `SELECT id, run, nombres, apellidos, fecha, hora_entrada 
             FROM visitas 
             ORDER BY id DESC 
             LIMIT 10`,
            (err, rows) => {
                resolve(err ? [] : rows);
            }
        );
    });
    
    registros.forEach(reg => {
        console.log(`ID: ${reg.id} | RUN: ${reg.run} | Nombre: ${reg.nombres} ${reg.apellidos}`);
    });
    
    db.close();
}

// Ejecutar según opción
async function main() {
    const opcion = process.argv[2];
    
    if (opcion === '--backup') {
        await eliminarDuplicadosConBackup();
    } else if (opcion === '--mostrar') {
        await mostrarUltimosRegistros();
    } else {
        await eliminarRegistrosDuplicados();
        await mostrarUltimosRegistros();
    }
}

main();