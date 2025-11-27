const { indexarRegistro } = require('../servicios/querys/index_qr_datos.js');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Importar servicios de seguridad
const ServicioHash = require('../servicios/seguridad/hash');
const CifradorAES = require('../servicios/seguridad/cifrado');

const dbPath = path.join(__dirname, '../../data/registros.db');
const servicioHash = new ServicioHash();
const cifrador = new CifradorAES();

/**
 * Script MEJORADO con hash y cifrado
 */
async function insertarNuevosRegistrosUnicos() {
    const db = new sqlite3.Database(dbPath);
    
    console.log("=== INSERTANDO REGISTROS CON SEGURIDAD (HASH + CIFRADO) ===");
    console.log("Proceso: Generar datos -> Cifrar -> Hash seguridad -> Insertar");
    console.log("---------------------------------------------------------------");

    try {
        const ultimoId = await obtenerUltimoId(db);
        console.log("Ultimo ID en la base de datos:", ultimoId);

        const cantidadRegistros = 5; // Reducido para pruebas
        console.log("Cantidad de nuevos registros a insertar:", cantidadRegistros);

        let insercionesExitosas = 0;
        let insercionesFallidas = 0;
        let duplicadosEvitados = 0;

        const datosUsadosEnEstaEjecucion = new Set();

        for (let i = 1; i <= cantidadRegistros; i++) {
            console.log("\n--- Procesando registro", i, "de", cantidadRegistros, "---");

            const runUnico = generarRUNUnico(ultimoId + i);
            const numDocUnico = generarNumDocUnico(ultimoId + i);
            
            console.log("RUN unico generado:", runUnico);
            console.log("NumDoc unico generado:", numDocUnico);

            // 1. OBTENER DATOS ÚNICOS
            const resultadoIndexacion = await obtenerDatosUnicos(db, runUnico, numDocUnico, datosUsadosEnEstaEjecucion);
            
            if (resultadoIndexacion.exito) {
                const datosOriginales = resultadoIndexacion.registroIndexado;
                console.log("Datos originales obtenidos:", 
                    datosOriginales.nombres, 
                    datosOriginales.apellidos
                );

                // 2. CIFRAR DATOS SENSIBLES
                const datosCifrados = await cifrarDatosSensibles(datosOriginales);
                console.log("✓ Datos sensibles cifrados");

                // 3. PREPARAR SOLICITUD CON SEGURIDAD
                const solicitudSegura = await prepararSolicitudSegura({
                    run: runUnico,
                    num_doc: numDocUnico,
                    datosCifrados: datosCifrados,
                    // Incluir datos necesarios para el registro
                    nombres: datosOriginales.nombres,
                    apellidos: datosOriginales.apellidos,
                    fecha_nac: datosOriginales.fecha_nac,
                    sexo: datosOriginales.sexo,
                    tipo_evento: datosOriginales.tipo_evento || "Visita"
                });

                console.log("✓ Headers de seguridad generados");

                // 4. INSERTAR EN BASE DE DATOS
                const resultado = await insertarRegistroConSeguridad(db, datosOriginales, datosCifrados, solicitudSegura);
                
                if (resultado.exito) {
                    console.log(" Inserción segura exitosa - ID:", resultado.id);
                    insercionesExitosas++;
                    
                    // Registrar datos como usados
                    const claveDatos = `${datosOriginales.nombres}|${datosOriginales.apellidos}|${datosOriginales.fecha_nac}`;
                    datosUsadosEnEstaEjecucion.add(claveDatos);
                } else {
                    console.log(" Error en inserción:", resultado.error);
                    insercionesFallidas++;
                }

            } else if (resultadoIndexacion.duplicado) {
                console.log(" Duplicado evitado:", resultadoIndexacion.mensaje);
                duplicadosEvitados++;
                i--; // Reintentar
            } else {
                console.log(" Error en indexación:", resultadoIndexacion.mensaje);
                insercionesFallidas++;
            }

            // Prevenir loop infinito
            if (duplicadosEvitados > 10) {
                console.log(" Demasiados duplicados, deteniendo ejecución");
                break;
            }
        }

        console.log("\n=== RESUMEN FINAL CON SEGURIDAD ===");
        console.log(" Inserciones exitosas:", insercionesExitosas);
        console.log(" Inserciones fallidas:", insercionesFallidas);
        console.log(" Duplicados evitados:", duplicadosEvitados);
        console.log(" Total registros en BD:", await contarRegistros(db));

    } catch (error) {
        console.log(" Error general:", error.message);
    } finally {
        db.close();
        console.log(" Proceso de seguridad completado");
    }
}

/**
 * Cifra los datos sensibles usando AES
 */
async function cifrarDatosSensibles(datos) {
    try {
        const datosParaCifrar = {
            run: datos.run,
            num_doc: datos.num_doc,
            nombres: datos.nombres,
            apellidos: datos.apellidos,
            fecha_nac: datos.fecha_nac,
            timestamp: Date.now()
        };

        return cifrador.cifrarParaBD(datosParaCifrar);
    } catch (error) {
        console.log("Error cifrando datos:", error.message);
        return null;
    }
}

/**
 * Prepara solicitud con headers de seguridad
 */
async function prepararSolicitudSegura(datos) {
    try {
        // Generar hash de seguridad
        const hashData = servicioHash.generarHashFrontend(datos);
        
        return {
            headers: {
                'x-hash-seguridad': hashData.hash,
                'x-timestamp': hashData.timestamp.toString(),
                'x-nonce': hashData.nonce
            },
            datos: datos,
            payloadValidado: hashData.payload
        };
    } catch (error) {
        console.log("Error preparando seguridad:", error.message);
        throw error;
    }
}

/**
 * Inserta registro con validación de seguridad
 */
async function insertarRegistroConSeguridad(db, datosOriginales, datosCifrados, solicitudSegura) {
    return new Promise((resolve) => {
        const ahora = new Date();
        const fecha = ahora.toISOString().split('T')[0];
        const hora_entrada = ahora.toTimeString().split(' ')[0];
        
        // Validar hash de seguridad (simulando lo que hace el middleware)
        const validacion = servicioHash.validarHashFrontend(
            solicitudSegura.datos, 
            solicitudSegura.headers['x-hash-seguridad']
        );

        if (!validacion.valido) {
            console.log(" Validación de seguridad fallida:", validacion.error);
            resolve({ exito: false, error: validacion.error });
            return;
        }

        console.log("✓ Validación de seguridad exitosa");

        // Insertar en BD con datos cifrados
        db.run(
            `INSERT INTO visitas (run, num_doc, nombres, apellidos, fecha_nac, sexo, tipo_evento, fecha, hora_entrada, datos_cifrados) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                datosOriginales.run, 
                datosOriginales.num_doc, 
                datosOriginales.nombres, 
                datosOriginales.apellidos, 
                datosOriginales.fecha_nac, 
                datosOriginales.sexo, 
                datosOriginales.tipo_evento || "Visita", 
                fecha, 
                hora_entrada,
                datosCifrados  // ← Datos cifrados almacenados
            ],
            function(err) {
                if (err) {
                    console.log(" Error en BD:", err.message);
                    resolve({ exito: false, error: err.message });
                } else {
                    console.log(" Registro insertado con ID:", this.lastID);
                    
                    // Verificar que se puede descifrar
                    try {
                        const datosDescifrados = cifrador.descifrarDesdeBD(datosCifrados);
                        console.log(" Datos descifrados correctamente:", datosDescifrados.run);
                    } catch (descifradoError) {
                        console.log(" Advertencia: Error al verificar descifrado:", descifradoError.message);
                    }
                    
                    resolve({ exito: true, id: this.lastID });
                }
            }
        );
    });
}

/**
 * Función para verificar cifrado/descifrado
 */
async function verificarCifrado() {
    console.log("\n=== VERIFICANDO CIFRADO ===");
    
    const testData = {
        run: "12345678-9",
        num_doc: "AB123456",
        nombres: "Juan",
        apellidos: "Pérez",
        timestamp: Date.now()
    };

    try {
        console.log("Datos originales:", testData);
        
        // Cifrar
        const cifrado = cifrador.cifrarParaBD(testData);
        console.log(" Datos cifrados:", cifrado.substring(0, 50) + "...");
        
        // Descifrar
        const descifrado = cifrador.descifrarDesdeBD(cifrado);
        console.log(" Datos descifrados:", descifrado);
        
        console.log(" Cifrado/descifrado funcionando correctamente");
        return true;
    } catch (error) {
        console.log(" Error en cifrado/descifrado:", error.message);
        return false;
    }
}

// Las funciones auxiliares existentes se mantienen igual...
async function obtenerDatosUnicos(db, run, numDoc, datosUsadosEnEjecucion) {
    let intentos = 0;
    const maxIntentos = 5;
    
    while (intentos < maxIntentos) {
        const resultadoIndexacion = await indexarRegistro(run, numDoc);
        
        if (resultadoIndexacion.exito) {
            const datos = resultadoIndexacion.registroIndexado;
            const claveDatos = `${datos.nombres}|${datos.apellidos}|${datos.fecha_nac}`;
            
            const existenEnBD = await verificarDatosExistenEnBD(db, datos.nombres, datos.apellidos, datos.fecha_nac);
            const usadosEnEjecucion = datosUsadosEnEjecucion.has(claveDatos);
            
            if (!existenEnBD && !usadosEnEjecucion) {
                return resultadoIndexacion;
            } else {
                console.log("  Datos duplicados:", datos.nombres, datos.apellidos);
                run = generarRUNUnico(Date.now() + intentos);
                numDoc = generarNumDocUnico(Date.now() + intentos + 1000);
            }
        } else if (resultadoIndexacion.duplicado) {
            run = generarRUNUnico(Date.now() + intentos);
            numDoc = generarNumDocUnico(Date.now() + intentos + 1000);
        } else {
            return resultadoIndexacion;
        }
        
        intentos++;
    }
    
    return { 
        exito: false, 
        mensaje: "No se pudieron obtener datos únicos después de " + maxIntentos + " intentos" 
    };
}

function verificarDatosExistenEnBD(db, nombres, apellidos, fecha_nac) {
    return new Promise((resolve) => {
        db.get(
            `SELECT COUNT(*) as count 
             FROM visitas 
             WHERE nombres = ? AND apellidos = ? AND fecha_nac = ? 
             AND nombres != 'no disponible' AND apellidos != 'no disponible'`,
            [nombres, apellidos, fecha_nac],
            (err, row) => {
                resolve(err ? false : row.count > 0);
            }
        );
    });
}

function generarRUNUnico(numeroBase) {
    const baseNumber = 30000000 + numeroBase;
    const digitoVerificador = (numeroBase % 9) + 1;
    return `${baseNumber}-${digitoVerificador}`;
}

function generarNumDocUnico(numeroBase) {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const letra1 = letras[Math.floor(numeroBase / 26) % letras.length];
    const letra2 = letras[numeroBase % letras.length];
    const numeros = String(700000 + numeroBase).padStart(6, '0');
    return `${letra1}${letra2}${numeros}`;
}

function obtenerUltimoId(db) {
    return new Promise((resolve) => {
        db.get("SELECT MAX(id) as maxId FROM visitas", (err, row) => {
            resolve(err || !row || !row.maxId ? 0 : row.maxId);
        });
    });
}

function contarRegistros(db) {
    return new Promise((resolve) => {
        db.get("SELECT COUNT(*) as total FROM visitas", (err, row) => {
            resolve(err ? 0 : row.total);
        });
    });
}

// Ejecutar
async function main() {
    const opcion = process.argv[2];
    
    if (opcion === '--verificar-cifrado') {
        await verificarCifrado();
    } else if (opcion === '--controlado') {
        console.log("Opción controlada no disponible con seguridad aún");
    } else {
        console.log(" INICIANDO INSERCIÓN CON SEGURIDAD HASH + CIFRADO");
        await insertarNuevosRegistrosUnicos();
    }
}

main();