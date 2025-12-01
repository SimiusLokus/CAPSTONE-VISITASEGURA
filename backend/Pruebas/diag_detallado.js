// security_diagnostic_advanced.js
const https = require('https');
const crypto = require('crypto');
const path = require('path');

class SecurityDiagnosticAdvanced {
    constructor() {
        this.baseURL = 'https://localhost:3001';
        this.agent = new https.Agent({ 
            rejectUnauthorized: false
        });
        this.testResults = [];
        this.debugLogs = [];
        this.vulnerabilityLocations = [];
    }

    logDebug(category, message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            category,
            message,
            data
        };
        this.debugLogs.push(logEntry);
        console.log(`[DEBUG ${category}] ${message}`);
        if (data) {
            console.log(`   Data:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
        }
    }

    logVulnerabilityLocation(testName, problem, location, impact, recommendation) {
        const vulnerability = {
            testName,
            problem,
            location,
            impact,
            recommendation,
            timestamp: new Date().toISOString()
        };
        this.vulnerabilityLocations.push(vulnerability);
        
        console.log(`[VULNERABILITY LOCATION] ${testName}`);
        console.log(`   Problem: ${problem}`);
        console.log(`   Location: ${location}`);
        console.log(`   Impact: ${impact}`);
        console.log(`   Recommendation: ${recommendation}`);
    }

    logTest(name, result, details = '', responseData = null) {
        const status = result ? 'PASS' : 'FAIL';
        const color = result ? 'GREEN' : 'RED';
        console.log(`[${status}] ${name}`);
        console.log(`   Details: ${details}`);
        
        if (responseData && !result) {
            console.log(`   Response:`, JSON.stringify(responseData, null, 2));
        }

        this.testResults.push({ 
            name, 
            result, 
            details,
            response: responseData
        });
    }

    async makeRequest(endpoint, options = {}) {
        const requestId = Math.random().toString(36).substring(7);
        
        this.logDebug('REQUEST', `Iniciando request ${requestId} to ${endpoint}`, {
            method: options.method || 'GET',
            headers: options.headers ? Object.keys(options.headers) : [],
            body: options.body ? 'PRESENT' : 'EMPTY'
        });

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
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    this.logDebug('RESPONSE', `Request ${requestId} completed`, {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        dataLength: data.length
                    });

                    try {
                        const jsonData = data ? JSON.parse(data) : {};
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: jsonData,
                            rawData: data
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: data,
                            rawData: data
                        });
                    }
                });
            });

            req.on('error', (error) => {
                this.logDebug('ERROR', `Request ${requestId} failed`, error.message);
                reject(error);
            });

            if (options.body) {
                const bodyStr = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
                req.write(bodyStr);
                this.logDebug('REQUEST_BODY', `Body for ${requestId}`, {
                    length: bodyStr.length,
                    preview: bodyStr.substring(0, 100) + '...'
                });
            }

            req.end();
        });
    }

    generateSecurityHeaders(timestamp, nonce, body = {}) {
        const payload = {
            ...body,
            timestamp,
            nonce,
            origen: 'frontend'
        };
        
        const ordenado = {};
        Object.keys(payload).sort().forEach(key => {
            ordenado[key] = payload[key];
        });
        const stringPayload = JSON.stringify(ordenado);
        
        const hash = crypto
            .createHmac('sha256', 'clave-secreta-visitasegura-2025')
            .update(stringPayload)
            .digest('hex');

        this.logDebug('HASH_GENERATION', 'Headers de seguridad generados', {
            timestamp,
            nonce,
            payloadKeys: Object.keys(ordenado),
            hashPreview: hash.substring(0, 20) + '...',
            stringPayload
        });

        return {
            'x-hash-seguridad': hash,
            'x-timestamp': timestamp.toString(),
            'x-nonce': nonce
        };
    }

    async diagnoseMiddlewareConfiguration() {
        this.logDebug('DIAGNOSTIC', 'INICIANDO DIAGNOSTICO: Configuracion del Middleware');
        
        try {
            const endpointsToTest = [
                { path: '/visitas', method: 'POST', shouldBeProtected: true },
                { path: '/visitas', method: 'GET', shouldBeProtected: false },
                { path: '/info', method: 'GET', shouldBeProtected: false },
                { path: '/login', method: 'POST', shouldBeProtected: false }
            ];

            const results = [];

            for (const endpoint of endpointsToTest) {
                this.logDebug('MIDDLEWARE_TEST', `Probando endpoint: ${endpoint.method} ${endpoint.path}`, {
                    shouldBeProtected: endpoint.shouldBeProtected
                });

                const body = endpoint.method === 'POST' ? { test: 'data' } : undefined;
                
                const response = await this.makeRequest(endpoint.path, {
                    method: endpoint.method,
                    body: body
                });

                const isProtected = response.statusCode === 401;
                const expected = endpoint.shouldBeProtected ? 401 : 'not 401';
                
                results.push({
                    endpoint: `${endpoint.method} ${endpoint.path}`,
                    shouldBeProtected: endpoint.shouldBeProtected,
                    statusCode: response.statusCode,
                    isProtected: isProtected,
                    correct: endpoint.shouldBeProtected === isProtected
                });

                this.logDebug('MIDDLEWARE_RESULT', `Resultado para ${endpoint.method} ${endpoint.path}`, {
                    statusCode: response.statusCode,
                    isProtected,
                    shouldBeProtected: endpoint.shouldBeProtected,
                    correct: endpoint.shouldBeProtected === isProtected
                });
            }

            const correctConfig = results.every(r => r.correct);
            
            this.logTest(
                'Configuracion Middleware', 
                correctConfig, 
                correctConfig ? 'Configuracion correcta' : 'Configuracion incorrecta de middleware',
                results
            );

            if (!correctConfig) {
                this.logVulnerabilityLocation(
                    'Configuracion Middleware',
                    'El endpoint POST /visitas no esta protegido por el middleware de seguridad',
                    'Archivo: app.js o server.js - Middleware de seguridad no se aplica correctamente a POST /visitas',
                    'Cualquier cliente puede hacer requests sin autenticacion',
                    'Revisar la aplicacion del middleware en app.js. Asegurar que servicioHash.middlewareProteccion() se aplique a POST /visitas'
                );
            }

            return correctConfig;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnostico Middleware', error.message);
            this.logTest('Configuracion Middleware', false, error.message);
            return false;
        }
    }

    async diagnoseHashModification() {
        this.logDebug('DIAGNOSTIC', 'INICIANDO DIAGNOSTICO: Hash Modificado');
        
        try {
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');
            const body = {
                datosCifrados: 'datos_falsos_cifrados',
                accion: 'entrada'
            };

            const validHeaders = this.generateSecurityHeaders(timestamp, nonce, body);
            
            const maliciousHeaders = {
                ...validHeaders,
                'x-hash-seguridad': 'hash_modificado_incorrecto_que_deberia_fallar'
            };

            this.logDebug('HASH_ATTACK', 'Enviando request con hash modificado', {
                originalHash: validHeaders['x-hash-seguridad'],
                maliciousHash: maliciousHeaders['x-hash-seguridad']
            });

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: maliciousHeaders
            });

            const success = response.statusCode === 401;
            
            this.logDebug('HASH_RESULT', 'Resultado del ataque de hash', {
                statusCode: response.statusCode,
                expected: 401,
                success: success,
                response: response.data
            });

            this.logTest(
                'Ataque - Hash Modificado', 
                success, 
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Acepto hash modificado',
                response.data
            );

            if (!success) {
                this.logVulnerabilityLocation(
                    'Ataque - Hash Modificado',
                    'El servidor acepto un hash modificado sin validacion',
                    'Archivo: servicios/seguridad/hash.js - Funcion: validarHashFrontend() no se esta ejecutando o no valida correctamente',
                    'Ataque MITM puede modificar datos en transito',
                    'Verificar que el middleware de seguridad se aplique en app.js y que validarHashFrontend() compare correctamente los hashes'
                );
            }

            return success;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnostico Hash Modificado', error.message);
            this.logTest('Ataque - Hash Modificado', false, error.message);
            return false;
        }
    }

    async diagnoseTimestampExpired() {
        this.logDebug('DIAGNOSTIC', 'INICIANDO DIAGNOSTICO: Timestamp Expirado');
        
        try {
            const timestamp = Date.now() - 60000;
            const nonce = crypto.randomBytes(16).toString('hex');
            const body = { accion: 'entrada' };

            const headers = this.generateSecurityHeaders(timestamp, nonce, body);

            this.logDebug('TIMESTAMP_ATTACK', 'Enviando request con timestamp expirado', {
                timestamp,
                currentTime: Date.now(),
                difference: Date.now() - timestamp
            });

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            const success = response.statusCode === 401;

            this.logDebug('TIMESTAMP_RESULT', 'Resultado del ataque de timestamp', {
                statusCode: response.statusCode,
                expected: 401,
                success: success,
                response: response.data
            });

            this.logTest(
                'Ataque - Timestamp Expirado', 
                success, 
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Acepto request expirado',
                response.data
            );

            if (!success) {
                this.logVulnerabilityLocation(
                    'Ataque - Timestamp Expirado',
                    'El servidor acepto request con timestamp expirado',
                    'Archivo: servicios/seguridad/hash.js - Funcion: validarHashFrontend() - No valida la expiracion del timestamp',
                    'Ataques replay posibles con requests antiguos',
                    'En validarHashFrontend(), agregar validacion: if (Date.now() - timestamp > this.tiempoExpiracion) return false'
                );
            }

            return success;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnostico Timestamp Expirado', error.message);
            this.logTest('Ataque - Timestamp Expirado', false, error.message);
            return false;
        }
    }

    async diagnoseReplayAttack() {
        this.logDebug('DIAGNOSTIC', 'INICIANDO DIAGNOSTICO: Replay Attack');
        
        try {
            const timestamp = Date.now();
            const nonce = 'nonce_reutilizado_malicioso_' + Date.now();
            const body = { accion: 'entrada', run: 'test-replay-' + Date.now() };

            const headers = this.generateSecurityHeaders(timestamp, nonce, body);

            this.logDebug('REPLAY_ATTACK', 'Enviando primer request con nonce', {
                nonce,
                timestamp,
                body
            });

            const firstResponse = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            this.logDebug('REPLAY_FIRST', 'Primera respuesta', {
                statusCode: firstResponse.statusCode,
                success: firstResponse.statusCode === 200
            });

            await new Promise(resolve => setTimeout(resolve, 1000));

            this.logDebug('REPLAY_ATTACK', 'Enviando segundo request con MISMO nonce', {
                nonce,
                timestamp: Date.now()
            });

            const secondResponse = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            const success = secondResponse.statusCode === 401;

            this.logDebug('REPLAY_RESULT', 'Resultado del ataque replay', {
                firstRequest: firstResponse.statusCode,
                secondRequest: secondResponse.statusCode,
                expectedSecond: 401,
                success: success,
                secondResponse: secondResponse.data
            });

            this.logTest(
                'Ataque - Replay Nonce', 
                success, 
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Acepto nonce reutilizado',
                {
                    firstRequest: firstResponse.data,
                    secondRequest: secondResponse.data
                }
            );

            if (!success) {
                this.logVulnerabilityLocation(
                    'Ataque - Replay Nonce',
                    'El servidor acepto nonce reutilizado',
                    'Archivo: servicios/seguridad/hash.js - Clase: ServicioHash - No hay registro de nonces usados o no se verifica',
                    'Ataques replay pueden duplicar transacciones',
                    'En ServicioHash, implementar Map para nonces usados y verificar en validarHashFrontend(): if (this.noncesUsados.has(nonce)) return false'
                );
            }

            return success;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnostico Replay Attack', error.message);
            this.logTest('Ataque - Replay Nonce', false, error.message);
            return false;
        }
    }

    async diagnoseMissingSecurityHeaders() {
        this.logDebug('DIAGNOSTIC', 'INICIANDO DIAGNOSTICO: Headers de Seguridad Faltantes');
        
        try {
            const body = { 
                accion: 'entrada', 
                run: 'test-no-headers-' + Date.now() 
            };

            this.logDebug('HEADERS_ATTACK', 'Enviando request SIN headers de seguridad', {
                body,
                headers: 'NINGUNO'
            });

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body
            });

            const success = response.statusCode === 401;

            this.logDebug('HEADERS_RESULT', 'Resultado del ataque sin headers', {
                statusCode: response.statusCode,
                expected: 401,
                success: success,
                response: response.data
            });

            this.logTest(
                'Ataque - Sin Headers Seguridad', 
                success, 
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Acepto request sin seguridad',
                response.data
            );

            if (!success) {
                this.logVulnerabilityLocation(
                    'Ataque - Sin Headers Seguridad',
                    'El servidor acepto request sin headers de seguridad',
                    'Archivo: app.js - Middleware de seguridad no intercepta requests sin headers o no se aplica a POST /visitas',
                    'Cualquier cliente puede hacer requests sin autenticacion, bypass completo de seguridad',
                    'En app.js, asegurar que el middleware verifique headers para TODOS los endpoints POST: if (!hashHeader || !timestampHeader || !nonceHeader) return res.status(401)'
                );
            }

            return success;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnostico Missing Headers', error.message);
            this.logTest('Ataque - Sin Headers Seguridad', false, error.message);
            return false;
        }
    }

    async diagnoseSecurityHeadersImplementation() {
        this.logDebug('DIAGNOSTIC', 'INICIANDO DIAGNOSTICO: Implementacion de Headers de Seguridad');
        
        try {
            const testCases = [
                { 
                    name: 'Request sin headers de seguridad', 
                    body: { accion: 'entrada', run: 'test-' + Date.now() }, 
                    headers: {},
                    expectedStatus: 401
                },
                { 
                    name: 'Solo header timestamp', 
                    body: { accion: 'entrada', run: 'test-' + Date.now() }, 
                    headers: { 'x-timestamp': Date.now().toString() },
                    expectedStatus: 401
                },
                { 
                    name: 'Solo header nonce', 
                    body: { accion: 'entrada', run: 'test-' + Date.now() }, 
                    headers: { 'x-nonce': 'test-nonce' },
                    expectedStatus: 401
                },
                { 
                    name: 'Timestamp y nonce sin hash', 
                    body: { accion: 'entrada', run: 'test-' + Date.now() }, 
                    headers: { 
                        'x-timestamp': Date.now().toString(), 
                        'x-nonce': 'test-nonce' 
                    },
                    expectedStatus: 401
                }
            ];

            const results = [];

            for (const testCase of testCases) {
                this.logDebug('HEADERS_IMPLEMENTATION_TEST', `Probando: ${testCase.name}`, {
                    headers: Object.keys(testCase.headers)
                });

                const response = await this.makeRequest('/visitas', {
                    method: 'POST',
                    body: testCase.body,
                    headers: testCase.headers
                });

                const passed = response.statusCode === testCase.expectedStatus;
                
                results.push({
                    testCase: testCase.name,
                    statusCode: response.statusCode,
                    expected: testCase.expectedStatus,
                    passed: passed,
                    headersUsed: Object.keys(testCase.headers)
                });

                this.logDebug('HEADERS_IMPLEMENTATION_RESULT', `Resultado para ${testCase.name}`, {
                    statusCode: response.statusCode,
                    expected: testCase.expectedStatus,
                    passed: passed
                });
            }

            const allPassed = results.every(r => r.passed);
            
            this.logTest(
                'Implementacion Headers Seguridad', 
                allPassed, 
                allPassed ? 'Todos los casos manejados correctamente' : 'Algunos casos no estan protegidos',
                results
            );

            if (!allPassed) {
                const failedCases = results.filter(r => !r.passed);
                failedCases.forEach(failed => {
                    this.logVulnerabilityLocation(
                        'Implementacion Headers Seguridad',
                        `Caso '${failed.testCase}' no esta protegido: Status ${failed.statusCode} instead of ${failed.expectedStatus}`,
                        `Archivo: app.js - Middleware de seguridad no valida correctamente la presencia de todos los headers requeridos`,
                        'Bypass de seguridad parcial o completo dependiendo de los headers faltantes',
                        'En el middleware, verificar que los tres headers esten presentes: x-hash-seguridad, x-timestamp, x-nonce. Si falta alguno, retornar 401 inmediatamente'
                    );
                });
            }

            return allPassed;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnostico Headers Implementation', error.message);
            this.logTest('Implementacion Headers Seguridad', false, error.message);
            return false;
        }
    }

    generateDetailedVulnerabilityReport() {
        console.log('\n' + '='.repeat(100));
        console.log('REPORTE DETALLADO DE VULNERABILIDADES - UBICACIONES EXACTAS');
        console.log('='.repeat(100));

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.result).length;
        const failedTests = totalTests - passedTests;

        console.log(`\nESTADISTICAS:`);
        console.log(`   Total pruebas: ${totalTests}`);
        console.log(`   Exitosas: ${passedTests}`);
        console.log(`   Fallidas: ${failedTests}`);

        if (this.vulnerabilityLocations.length > 0) {
            console.log(`\nVULNERABILIDADES CRITICAS IDENTIFICADAS:`);
            console.log(`(Ordenadas por criticidad)`);
            
            this.vulnerabilityLocations.forEach((vuln, index) => {
                console.log(`\n${index + 1}. ${vuln.testName.toUpperCase()}`);
                console.log(`   PROBLEMA: ${vuln.problem}`);
                console.log(`   UBICACION: ${vuln.location}`);
                console.log(`   IMPACTO: ${vuln.impact}`);
                console.log(`   SOLUCION: ${vuln.recommendation}`);
            });
        }

        console.log(`\nRESUMEN EJECUTIVO:`);
        console.log(`Archivos criticos que necesitan atencion inmediata:`);
        
        const criticalFiles = {};
        this.vulnerabilityLocations.forEach(vuln => {
            const match = vuln.location.match(/Archivo: ([\w\/.-]+)/);
            if (match) {
                const file = match[1];
                criticalFiles[file] = (criticalFiles[file] || 0) + 1;
            }
        });

        Object.entries(criticalFiles)
            .sort((a, b) => b[1] - a[1])
            .forEach(([file, count]) => {
                console.log(`   - ${file}: ${count} vulnerabilidades`);
            });

        console.log(`\nPRIORIDAD DE REPARACION:`);
        console.log(`1. app.js - Middleware de seguridad (URGENTE)`);
        console.log(`2. servicios/seguridad/hash.js - Validacion de seguridad (URGENTE)`);
        console.log(`3. servicios/seguridad/hash.js - Registro de nonces (ALTA)`);

        console.log(`\nPASOS DE REPARACION INMEDIATOS:`);
        console.log(`1. En app.js, verificar que el middleware se aplique a TODOS los endpoints POST`);
        console.log(`2. En servicios/seguridad/hash.js, implementar validacion de timestamp expirado`);
        console.log(`3. En servicios/seguridad/hash.js, implementar registro de nonces usados`);
        console.log(`4. En el middleware, verificar que los tres headers de seguridad esten presentes`);
        console.log(`5. Ejecutar este diagnostico nuevamente para verificar las correcciones`);

        console.log('\n' + '='.repeat(100));
    }

    async runCompleteDiagnosis() {
        console.log('INICIANDO DIAGNOSTICO COMPLETO DE SEGURIDAD');
        console.log('Servidor:', this.baseURL);
        console.log('Hora:', new Date().toISOString());
        console.log('='.repeat(80));

        await this.diagnoseMiddlewareConfiguration();
        await this.diagnoseHashModification();
        await this.diagnoseTimestampExpired();
        await this.diagnoseReplayAttack();
        await this.diagnoseMissingSecurityHeaders();
        await this.diagnoseSecurityHeadersImplementation();

        this.generateDetailedVulnerabilityReport();
    }
}

// Ejecutar diagnostico
if (require.main === module) {
    const diagnostic = new SecurityDiagnosticAdvanced();
    
    diagnostic.runCompleteDiagnosis().catch(error => {
        console.error('ERROR ejecutando diagnostico:', error);
    });
}

module.exports = SecurityDiagnosticAdvanced;