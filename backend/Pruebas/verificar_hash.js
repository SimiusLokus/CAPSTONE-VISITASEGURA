// debug_hash_mismatch.js
const https = require('https');
const crypto = require('crypto');

class HashDebugger {
    constructor() {
        this.baseURL = 'https://localhost:3001';
        this.agent = new https.Agent({ rejectUnauthorized: false });
    }

    // Función IDÉNTICA a la que usa el frontend
    generateSecurityHeaders(timestamp, nonce, body = {}) {
        const payload = {
            ...body,
            timestamp,
            nonce,
            origen: 'frontend'
        };
        
        // Ordenar exactamente igual que el backend
        const ordenado = {};
        Object.keys(payload).sort().forEach(key => {
            ordenado[key] = payload[key];
        });
        const stringPayload = JSON.stringify(ordenado);
        
        const hash = crypto
            .createHmac('sha256', 'clave-secreta-visitasegura-2025')
            .update(stringPayload)
            .digest('hex');

        console.log('HASH DEBUG - FRONTEND:');
        console.log('Payload:', stringPayload);
        console.log('Hash generado:', hash);
        console.log('Timestamp:', timestamp);
        console.log('Nonce:', nonce);
        console.log('Body keys:', Object.keys(body));

        return {
            'x-hash-seguridad': hash,
            'x-timestamp': timestamp.toString(),
            'x-nonce': nonce
        };
    }

    async testHashMismatch() {
        console.log('=== DIAGNOSTICO DE HASH MISMATCH ===\n');
        
        const timestamp = Date.now();
        const nonce = crypto.randomBytes(16).toString('hex');
        const body = {
            datosCifrados: 'test_cifrado_data_123',
            accion: 'entrada',
            tipo_evento: 'Visita'
        };

        console.log('1. DATOS ORIGINALES:');
        console.log('Body:', JSON.stringify(body, null, 2));
        console.log('Timestamp:', timestamp);
        console.log('Nonce:', nonce);

        const headers = this.generateSecurityHeaders(timestamp, nonce, body);

        console.log('\n2. ENVIANDO REQUEST...');
        const response = await this.makeRequest('/visitas', {
            method: 'POST',
            body: body,
            headers: headers
        });

        console.log('\n3. RESPUESTA DEL SERVIDOR:');
        console.log('Status:', response.statusCode);
        
        if (response.statusCode === 401) {
            console.log('ERROR: Validacion de seguridad fallo');
            console.log('Detalle:', response.data.detalle || response.data.error);
        } else if (response.statusCode === 200) {
            console.log('EXITO: Request aceptado');
            console.log('Data:', response.data);
        } else {
            console.log('Respuesta inesperada:', response.data);
        }

        return response.statusCode === 200;
    }

    async testWithRealCifrado() {
        console.log('\n=== PRUEBA CON CIFRADO REAL ===\n');
        
        // Paso 1: Obtener datos cifrados reales
        const datosQR = {
            run: '12345678-9',
            num_doc: 'DOC123456',
            tipo_evento: 'Visita',
            timestamp: Date.now()
        };

        console.log('1. OBTENIENDO DATOS CIFRADOS...');
        const cifradoResponse = await this.makeRequest('/api/cifrado/procesar-qr', {
            method: 'POST',
            body: { datosQR }
        });

        if (!cifradoResponse.data.ok) {
            console.log('Error en cifrado:', cifradoResponse.data.error);
            return false;
        }

        console.log('Datos cifrados obtenidos');
        const datosCifrados = cifradoResponse.data.datosCifrados;

        // Paso 2: Registrar con los datos cifrados
        const timestamp = Date.now();
        const nonce = crypto.randomBytes(16).toString('hex');
        const body = {
            datosCifrados: datosCifrados,
            accion: 'entrada',
            tipo_evento: 'Visita'
        };

        console.log('\n2. PREPARANDO REQUEST CON CIFRADO:');
        console.log('Datos cifrados (primeros 100 chars):', datosCifrados.substring(0, 100) + '...');

        const headers = this.generateSecurityHeaders(timestamp, nonce, body);

        console.log('\n3. ENVIANDO REQUEST CON CIFRADO...');
        const visitaResponse = await this.makeRequest('/visitas', {
            method: 'POST',
            body: body,
            headers: headers
        });

        console.log('\n4. RESPUESTA:');
        console.log('Status:', visitaResponse.statusCode);
        
        if (visitaResponse.statusCode === 401) {
            console.log('ERROR: Validacion de seguridad fallo con datos cifrados');
            console.log('Detalle:', visitaResponse.data.detalle || visitaResponse.data.error);
        } else if (visitaResponse.statusCode === 200) {
            console.log('EXITO: Registro con cifrado funciono');
            console.log('Data:', visitaResponse.data);
        }

        return visitaResponse.statusCode === 200;
    }

    async analyzeServerLogs() {
        console.log('\n=== ANALISIS DE LOGS DEL SERVIDOR ===\n');
        
        console.log('Revisa los logs del servidor para ver:');
        console.log('1. [SECURITY DEBUG] Datos recibidos para validacion');
        console.log('2. [SECURITY DEBUG] Payload COMPLETO para hash'); 
        console.log('3. [SECURITY DEBUG] Hash comparacion');
        console.log('4. [SECURITY ERROR] Hash no coincide');
        
        console.log('\nPOSIBLES CAUSAS:');
        console.log('• Diferente orden de propiedades en JSON');
        console.log('• Timestamps diferentes (ms vs segundos)');
        console.log('• Clave secreta diferente');
        console.log('• Codificacion diferente (UTF-8 vs otros)');
    }

    makeRequest(endpoint, options = {}) {
        return new Promise((resolve, reject) => {
            const url = new URL(endpoint, this.baseURL);
            
            const reqOptions = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'GET',
                agent: this.agent,
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            };

            const req = https.request(reqOptions, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    try {
                        resolve({
                            statusCode: res.statusCode,
                            data: data ? JSON.parse(data) : {},
                            rawData: data
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            data: data,
                            rawData: data
                        });
                    }
                });
            });

            req.on('error', reject);

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }
}

// Script para verificar la clave secreta
class SecretKeyChecker {
    checkSecretKey() {
        console.log('\n=== VERIFICACION DE CLAVE SECRETA ===\n');
        
        const clave = 'clave-secreta-visitasegura-2025';
        const testData = 'test_data';
        
        const hash1 = crypto
            .createHmac('sha256', clave)
            .update(testData)
            .digest('hex');
            
        console.log('Clave usada:', clave);
        console.log('Test data:', testData);
        console.log('Hash result:', hash1);
        console.log('Hash length:', hash1.length);
        
        console.log('\nSi este hash no coincide con el del servidor, la clave secreta es diferente');
    }
}

// Ejecutar diagnostico
if (require.main === module) {
    const hashDebugger = new HashDebugger();
    const keyChecker = new SecretKeyChecker();
    
    console.log('DIAGNOSTICO COMPLETO DE HASH MISMATCH\n');
    
    hashDebugger.testHashMismatch()
        .then(success => {
            if (!success) {
                return hashDebugger.testWithRealCifrado();
            }
            return success;
        })
        .then(success => {
            if (!success) {
                keyChecker.checkSecretKey();
                hashDebugger.analyzeServerLogs();
            }
            console.log(success ? 
                '\nPROBLEMA RESUELTO - Hash funciona correctamente' : 
                '\nPROBLEMA PERSISTE - Revisa los logs arriba');
        })
        .catch(console.error);
}