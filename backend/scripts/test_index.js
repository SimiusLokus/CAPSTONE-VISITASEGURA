const { indexarRegistro } = require('../servicios/querys/index_qr_datos.js');

/**
 * Script de prueba para el flujo completo de escaneo QR
 * Simula el proceso: QR -> Indexación -> Registro en BD
 */

async function pruebaFlujoCompleto() {
    console.log("=== INICIANDO PRUEBA DE FLUJO QR ===");
    console.log("Proceso: QR -> Indexación -> Registro en BD");
    console.log("----------------------------------------");

    // Datos de prueba simulando QR escaneado
    const datosPrueba = [
        { run: "12345678-9", num_doc: "AB123456" },
        { run: "98765432-1", num_doc: "CD789012" },
        { run: "11222333-4", num_doc: "EF345678" }
    ];

    for (let i = 0; i < datosPrueba.length; i++) {
        const { run, num_doc } = datosPrueba[i];
        
        console.log(`\n--- PRUEBA ${i + 1} ---`);
        console.log(`Datos QR escaneados: RUN=${run}, NumDoc=${num_doc}`);

        try {
            // Paso 1: Indexar datos (servicio de indexación)
            console.log("Paso 1: Llamando a servicio de indexación...");
            const resultadoIndexacion = await indexarRegistro(run, num_doc);
            
            if (resultadoIndexacion.exito) {
                console.log("Indexación EXITOSA");
                console.log("Datos indexados obtenidos:");
                console.log("- Nombres: " + resultadoIndexacion.registroIndexado.nombres);
                console.log("- Apellidos: " + resultadoIndexacion.registroIndexado.apellidos);
                console.log("- Fecha Nac: " + resultadoIndexacion.registroIndexado.fecha_nac);
                console.log("- Sexo: " + resultadoIndexacion.registroIndexado.sexo);
                console.log("- ID Ficticio: " + resultadoIndexacion.registroIndexado.id_ficticio);

                // Paso 2: Simular inserción en BD (aquí iría el endpoint /visitas)
                console.log("Paso 2: Simulando inserción en base de datos...");
                console.log("INSERT INTO visitas (run, nombres, apellidos, fecha_nac, sexo, num_doc, tipo_evento, fecha, hora_entrada)");
                console.log("VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
                console.log("Parámetros: [");
                console.log("  '" + resultadoIndexacion.registroIndexado.run + "',");
                console.log("  '" + resultadoIndexacion.registroIndexado.nombres + "',");
                console.log("  '" + resultadoIndexacion.registroIndexado.apellidos + "',");
                console.log("  '" + resultadoIndexacion.registroIndexado.fecha_nac + "',");
                console.log("  '" + resultadoIndexacion.registroIndexado.sexo + "',");
                console.log("  '" + resultadoIndexacion.registroIndexado.num_doc + "',");
                console.log("  'Visita',");
                console.log("  '" + new Date().toISOString().split('T')[0] + "',");
                console.log("  '" + new Date().toTimeString().split(' ')[0] + "'");
                console.log("]");
                
                console.log("Resultado: Registro insertado exitosamente");
                
            } else if (resultadoIndexacion.duplicado) {
                console.log("Indexación FALLIDA: Registro duplicado");
                console.log("Motivo: " + resultadoIndexacion.mensaje);
            } else {
                console.log("Indexación FALLIDA");
                console.log("Motivo: " + resultadoIndexacion.mensaje);
            }

        } catch (error) {
            console.log("ERROR en el proceso:");
            console.log("Detalle: " + error.message);
        }
    }

    console.log("\n=== RESUMEN DE PRUEBAS ===");
    console.log("Proceso completado. Revisa los logs anteriores para detalles.");
    console.log("Flujo probado: QR -> Indexación -> Preparación para BD");
    console.log("=================================");
}

/**
 * Función para probar casos específicos
 */
async function pruebaCasosEspecificos() {
    console.log("\n=== PRUEBAS ESPECÍFICAS ===");
    
    // Caso 1: Datos válidos
    console.log("\nCaso 1: Datos válidos nuevos");
    await probarCaso("11111111-1", "TEST001");

    // Caso 2: Posible duplicado (ejecutar 2 veces)
    console.log("\nCaso 2: Verificación de duplicados");
    await probarCaso("22222222-2", "TEST002");

    // Caso 3: Sin datos ficticios disponibles
    console.log("\nCaso 3: Sin RUN");
    await probarCaso("", "TEST003");
}

async function probarCaso(run, num_doc) {
    console.log(`Probando: RUN=${run || 'VACIO'}, NumDoc=${num_doc}`);
    
    try {
        const resultado = await indexarRegistro(run, num_doc);
        
        if (resultado.exito) {
            console.log("Resultado: EXITO - Datos indexados");
        } else if (resultado.duplicado) {
            console.log("Resultado: DUPLICADO - Ya existe en visitas");
        } else {
            console.log("Resultado: FALLIDO - " + resultado.mensaje);
        }
    } catch (error) {
        console.log("Resultado: ERROR - " + error.message);
    }
}

// Ejecutar pruebas
if (require.main === module) {
    pruebaFlujoCompleto()
        .then(() => pruebaCasosEspecificos())
        .catch(error => {
            console.error("Error en pruebas:", error);
            process.exit(1);
        });
}

module.exports = {
    pruebaFlujoCompleto,
    pruebaCasosEspecificos
};