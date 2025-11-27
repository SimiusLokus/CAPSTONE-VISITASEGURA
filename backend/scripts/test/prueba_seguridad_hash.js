// test_seguridad_hash.js
const path = require('path');
const fs = require('fs');

// Encontrar el directorio raíz del backend
function encontrarBackendRoot() {
    let currentDir = __dirname;
    
    while (currentDir !== path.parse(currentDir).root) {
        const serviciosDir = path.join(currentDir, 'servicios');
        const seguridadDir = path.join(serviciosDir, 'seguridad');
        const hashFile = path.join(seguridadDir, 'hash.js');
        
        if (fs.existsSync(hashFile)) {
            return currentDir;
        }
        
        currentDir = path.dirname(currentDir);
    }
    
    throw new Error("No se pudo encontrar el directorio raiz del backend");
}

try {
    const backendRoot = encontrarBackendRoot();
    console.log("Directorio raiz del backend:", backendRoot);

    const ServicioHash = require(path.join(backendRoot, 'servicios/seguridad/hash'));
    const servicioHash = new ServicioHash();

    console.log("=== PRUEBAS DE SEGURIDAD DEL HASH ===");

    // Test 1: Datos legítimos
    console.log("1. SOLICITUD LEGITIMA:");
    const datosLegitimos = {
        datosQR: { run: "12345678-9", num_doc: "ABC123", timestamp: Date.now() }
    };
    const hashLegitimo = servicioHash.generarHashFrontend(datosLegitimos);
    const validacionLegitima = servicioHash.validarHashFrontend(
        { ...datosLegitimos, timestamp: hashLegitimo.timestamp, nonce: hashLegitimo.nonce },
        hashLegitimo.hash
    );
    console.log("   Resultado:", validacionLegitima.valido ? "APROBADO" : "RECHAZADO");

    // Test 2: Datos manipulados
    console.log("2. SOLICITUD CON DATOS MANIPULADOS:");
    const datosManipulados = {
        datosQR: { run: "99999999-9", num_doc: "HACKED123", timestamp: Date.now() },
        timestamp: hashLegitimo.timestamp,
        nonce: hashLegitimo.nonce
    };
    const validacionManipulada = servicioHash.validarHashFrontend(datosManipulados, hashLegitimo.hash);
    console.log("   Resultado:", validacionManipulada.valido ? "APROBADO" : "RECHAZADO");
    console.log("   Mensaje:", validacionManipulada.error);

    // Test 3: Hash incorrecto
    console.log("3. SOLICITUD CON HASH INCORRECTO:");
    const validacionHashMalo = servicioHash.validarHashFrontend(
        { ...datosLegitimos, timestamp: hashLegitimo.timestamp, nonce: hashLegitimo.nonce },
        "hash_falso_que_no_corresponde_a_los_datos"
    );
    console.log("   Resultado:", validacionHashMalo.valido ? "APROBADO" : "RECHAZADO");
    console.log("   Mensaje:", validacionHashMalo.error);

    // Test 4: Solicitud expirada
    console.log("4. SOLICITUD EXPIRADA:");
    const datosExpirados = {
        datosQR: { run: "12345678-9", num_doc: "ABC123", timestamp: Date.now() - 60000 },
        timestamp: Date.now() - 60000,
        nonce: hashLegitimo.nonce
    };
    const hashExpirado = servicioHash.generarHashFrontend(datosExpirados);
    const validacionExpirada = servicioHash.validarHashFrontend(datosExpirados, hashExpirado.hash);
    console.log("   Resultado:", validacionExpirada.valido ? "APROBADO" : "RECHAZADO");
    console.log("   Mensaje:", validacionExpirada.error);

    // Test 5: Nonce repetido (ataque replay)
    console.log("5. ATAQUE REPLAY (NONCE REPETIDO):");
    const mismosDatos = {
        ...datosLegitimos,
        timestamp: hashLegitimo.timestamp,
        nonce: hashLegitimo.nonce
    };
    const validacionReplay = servicioHash.validarHashFrontend(mismosDatos, hashLegitimo.hash);
    console.log("   Resultado:", validacionReplay.valido ? "APROBADO" : "RECHAZADO");

} catch (error) {
    console.error("ERROR:", error.message);
    console.log("Directorio actual:", __dirname);
}