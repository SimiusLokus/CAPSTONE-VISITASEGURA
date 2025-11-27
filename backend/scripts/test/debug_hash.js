// debug_hash_fixed.js
const path = require('path');
const fs = require('fs');

// Método robusto para encontrar el directorio raíz
function encontrarBackendRoot() {
    let currentDir = __dirname;
    
    // Buscar hacia arriba hasta encontrar la carpeta backend
    while (currentDir !== path.parse(currentDir).root) {
        const serviciosDir = path.join(currentDir, 'servicios');
        const seguridadDir = path.join(serviciosDir, 'seguridad');
        const hashFile = path.join(seguridadDir, 'hash.js');
        
        if (fs.existsSync(hashFile)) {
            console.log("✓ Encontrado hash.js en:", hashFile);
            return currentDir;
        }
        
        // Verificar si estamos en la carpeta backend
        const packagePath = path.join(currentDir, 'package.json');
        if (fs.existsSync(packagePath)) {
            console.log("✓ Encontrado package.json en:", currentDir);
            // Verificar si tiene la estructura de servicios
            if (fs.existsSync(serviciosDir)) {
                return currentDir;
            }
        }
        
        currentDir = path.dirname(currentDir);
    }
    
    throw new Error("No se pudo encontrar el directorio raíz del backend");
}

try {
    const backendRoot = encontrarBackendRoot();
    console.log("Directorio raíz del backend:", backendRoot);

    // Cargar módulos con rutas absolutas
    const ServicioHash = require(path.join(backendRoot, 'servicios/seguridad/hash'));
    const servicioHash = new ServicioHash();

    console.log("=== DEBUG HASH FRONTEND-BACKEND ===");

    // Simular EXACTAMENTE lo que enviaría el frontend
    const datosFrontend = {
        datosQR: {
            run: "12345678-9",
            num_doc: "ABC123",
            timestamp: 1234567890
        }
    };

    console.log("1. DATOS ORIGINALES:");
    console.log(JSON.stringify(datosFrontend, null, 2));

    // Paso 1: Frontend (simulado) prepara solicitud
    const hashData = servicioHash.generarHashFrontend(datosFrontend);
    console.log("\n2. HASH GENERADO:");
    console.log("Timestamp:", hashData.timestamp);
    console.log("Nonce:", hashData.nonce);
    console.log("Hash:", hashData.hash);
    console.log("Payload usado:", JSON.stringify(hashData.payload, null, 2));

    // Paso 2: Backend recibe y valida (simulando headers)
    console.log("\n3. VALIDACION EN BACKEND:");
    const datosRecibidos = {
        ...datosFrontend,
        timestamp: hashData.timestamp,
        nonce: hashData.nonce
    };

    console.log("Datos recibidos:", JSON.stringify(datosRecibidos, null, 2));

    const validacion = servicioHash.validarHashFrontend(datosRecibidos, hashData.hash);
    console.log("Resultado validacion:", validacion.valido);
    console.log("Error:", validacion.error);

    if (validacion.payload) {
        console.log("Payload validado:", JSON.stringify(validacion.payload, null, 2));
    }

    // Paso 3: Comparar los payloads
    console.log("\n4. COMPARACION DE PAYLOADS:");
    const sonIguales = JSON.stringify(hashData.payload) === JSON.stringify(validacion.payload);
    console.log("¿Son iguales?", sonIguales);
    
    if (!sonIguales && validacion.payload) {
        console.log("Payload generacion:", JSON.stringify(hashData.payload));
        console.log("Payload validacion:", JSON.stringify(validacion.payload));

        console.log("\n5. ANALISIS DE DIFERENCIAS:");
        const payload1 = hashData.payload;
        const payload2 = validacion.payload;
        
        for (let key in payload1) {
            if (JSON.stringify(payload1[key]) !== JSON.stringify(payload2[key])) {
                console.log(`Diferencia en ${key}:`);
                console.log(`  Generado: ${JSON.stringify(payload1[key])} (tipo: ${typeof payload1[key]})`);
                console.log(`  Validado: ${JSON.stringify(payload2[key])} (tipo: ${typeof payload2[key]})`);
            }
        }
    }

} catch (error) {
    console.error("❌ ERROR:", error.message);
    console.log("Directorio actual:", __dirname);
    console.log("Buscando estructura...");
    
    // Intentar listar directorio actual
    try {
        const files = fs.readdirSync(__dirname);
        console.log("Archivos en directorio actual:", files);
    } catch (e) {
        console.log("No se pudo leer directorio actual");
    }
    
    // Intentar listar directorio padre
    try {
        const parentDir = path.dirname(__dirname);
        const parentFiles = fs.readdirSync(parentDir);
        console.log("Archivos en directorio padre:", parentFiles);
    } catch (e) {
        console.log("No se pudo leer directorio padre");
    }
}