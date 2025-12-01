// security_diagnostic.js
const https = require('https');
const crypto = require('crypto');

class SecurityDiagnostic {
    constructor() {
        this.baseURL = 'https://localhost:3001';
        this.agent = new https.Agent({ 
            rejectUnauthorized: false
        });
        this.testResults = [];
        this.debugLogs = [];
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
        console.log(`\x1b[36m[DEBUG ${category}]\x1b[0m ${message}`);
        if (data) {
            console.log(`   Data:`, JSON.stringify(data, null, 2).substring(0, 200) + '...');
        }
    }

    logTest(name, result, details = '', responseData = null) {
        const status = result ? 'PASS' : 'FAIL';
        const color = result ? '\x1b[32m' : '\x1b[31m';
        console.log(`\n${color}[${status}]\x1b[0m ${name}`);
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
        
        // Ordenar y stringify igual que el servidor
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

    // ===== DIAGNÓSTICO DETALLADO DE VULNERABILIDADES =====

    async diagnoseHashModification() {
        this.logDebug('DIAGNOSTIC', '=== INICIANDO DIAGNÓSTICO: Hash Modificado ===');
        
        try {
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');
            const body = {
                datosCifrados: 'datos_falsos_cifrados',
                accion: 'entrada'
            };

            const validHeaders = this.generateSecurityHeaders(timestamp, nonce, body);
            
            // Modificar el hash
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
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Aceptó hash modificado',
                response.data
            );

            // Análisis adicional
            if (!success) {
                this.logDebug('VULNERABILITY_ANALYSIS', 'ANÁLISIS DE VULNERABILIDAD HASH', {
                    problema: 'El servidor aceptó un hash modificado',
                    impacto: 'Ataque MITM puede modificar datos',
                    recomendacion: 'Verificar middleware de seguridad en endpoints POST'
                });
            }

            return success;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnóstico Hash Modificado', error.message);
            this.logTest('Ataque - Hash Modificado', false, error.message);
            return false;
        }
    }

    async diagnoseTimestampExpired() {
        this.logDebug('DIAGNOSTIC', '=== INICIANDO DIAGNÓSTICO: Timestamp Expirado ===');
        
        try {
            const timestamp = Date.now() - 60000; // 1 minuto en el pasado
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
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Aceptó request expirado',
                response.data
            );

            if (!success) {
                this.logDebug('VULNERABILITY_ANALYSIS', 'ANÁLISIS DE VULNERABILIDAD TIMESTAMP', {
                    problema: 'El servidor aceptó request con timestamp expirado',
                    impacto: 'Ataques replay posibles',
                    recomendacion: 'Implementar validación de timestamp en middleware'
                });
            }

            return success;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnóstico Timestamp Expirado', error.message);
            this.logTest('Ataque - Timestamp Expirado', false, error.message);
            return false;
        }
    }

    async diagnoseReplayAttack() {
        this.logDebug('DIAGNOSTIC', '=== INICIANDO DIAGNÓSTICO: Replay Attack ===');
        
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

            // Primer request (debería funcionar)
            const firstResponse = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            this.logDebug('REPLAY_FIRST', 'Primera respuesta', {
                statusCode: firstResponse.statusCode,
                success: firstResponse.statusCode === 200
            });

            // Pequeña pausa
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Segundo request con mismo nonce (debería fallar)
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
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Aceptó nonce reutilizado',
                {
                    firstRequest: firstResponse.data,
                    secondRequest: secondResponse.data
                }
            );

            if (!success) {
                this.logDebug('VULNERABILITY_ANALYSIS', 'ANÁLISIS DE VULNERABILIDAD REPLAY', {
                    problema: 'El servidor aceptó nonce reutilizado',
                    impacto: 'Ataques replay pueden duplicar transacciones',
                    recomendacion: 'Implementar registro de nonces usados con expiración'
                });
            }

            return success;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnóstico Replay Attack', error.message);
            this.logTest('Ataque - Replay Nonce', false, error.message);
            return false;
        }
    }

    async diagnoseMissingSecurityHeaders() {
        this.logDebug('DIAGNOSTIC', '=== INICIANDO DIAGNÓSTICO: Headers de Seguridad Faltantes ===');
        
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
                // Sin headers de seguridad
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
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Aceptó request sin seguridad',
                response.data
            );

            if (!success) {
                this.logDebug('VULNERABILITY_ANALYSIS', 'ANÁLISIS DE VULNERABILIDAD HEADERS', {
                    problema: 'El servidor aceptó request sin headers de seguridad',
                    impacto: 'Cualquier cliente puede hacer requests sin autenticación',
                    recomendacion: 'Middleware debe requerir headers para todos los endpoints POST/PUT/DELETE'
                });
            }

            return success;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnóstico Missing Headers', error.message);
            this.logTest('Ataque - Sin Headers Seguridad', false, error.message);
            return false;
        }
    }

    async diagnoseMiddlewareConfiguration() {
        this.logDebug('DIAGNOSTIC', '=== DIAGNÓSTICO: Configuración del Middleware ===');
        
        try {
            // Probar diferentes endpoints para ver cuáles están protegidos
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
                'Configuración Middleware', 
                correctConfig, 
                correctConfig ? 'Configuración correcta' : 'Configuración incorrecta de middleware',
                results
            );

            if (!correctConfig) {
                this.logDebug('CONFIG_ANALYSIS', 'ANÁLISIS DE CONFIGURACIÓN MIDDLEWARE', {
                    problema: 'Configuración inconsistente de protección',
                    endpointsProblema: results.filter(r => !r.correct).map(r => r.endpoint),
                    recomendacion: 'Revisar aplicación del middleware en app.js'
                });
            }

            return correctConfig;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnóstico Middleware', error.message);
            this.logTest('Configuración Middleware', false, error.message);
            return false;
        }
    }

    async diagnoseServerResponsePatterns() {
        this.logDebug('DIAGNOSTIC', '=== DIAGNÓSTICO: Patrones de Respuesta del Servidor ===');
        
        try {
            // Probar diferentes tipos de requests malformados
            const testCases = [
                { 
                    name: 'Request vacío', 
                    body: {}, 
                    headers: {} 
                },
                { 
                    name: 'Solo timestamp', 
                    body: {}, 
                    headers: { 'x-timestamp': Date.now().toString() } 
                },
                { 
                    name: 'Timestamp y nonce sin hash', 
                    body: {}, 
                    headers: { 
                        'x-timestamp': Date.now().toString(), 
                        'x-nonce': 'test-nonce' 
                    } 
                },
                { 
                    name: 'Hash inválido formato', 
                    body: {}, 
                    headers: { 
                        'x-timestamp': Date.now().toString(), 
                        'x-nonce': 'test-nonce',
                        'x-hash-seguridad': 'not-a-valid-hex-hash'
                    } 
                }
            ];

            const patterns = [];

            for (const testCase of testCases) {
                this.logDebug('PATTERN_TEST', `Probando patrón: ${testCase.name}`, {
                    headers: Object.keys(testCase.headers)
                });

                const response = await this.makeRequest('/visitas', {
                    method: 'POST',
                    body: testCase.body,
                    headers: testCase.headers
                });

                patterns.push({
                    testCase: testCase.name,
                    statusCode: response.statusCode,
                    hasError: response.data && response.data.error,
                    errorType: response.data ? response.data.error : 'none'
                });

                this.logDebug('PATTERN_RESULT', `Resultado para ${testCase.name}`, {
                    statusCode: response.statusCode,
                    error: response.data ? response.data.error : 'none'
                });
            }

            this.logTest(
                'Análisis Patrones Respuesta', 
                true, 
                'Completado - ver detalles en logs',
                patterns
            );

            // Análisis de patrones
            const always401 = patterns.every(p => p.statusCode === 401);
            const mixedResponses = patterns.some(p => p.statusCode !== 401 && p.statusCode !== 200);

            this.logDebug('PATTERN_ANALYSIS', 'ANÁLISIS DE PATRONES DE RESPUESTA', {
                siempre401: always401,
                respuestasMixtas: mixedResponses,
                patrones: patterns,
                conclusion: always401 ? 'Comportamiento consistente' : 'Comportamiento inconsistente - posible bypass'
            });

            return !mixedResponses;

        } catch (error) {
            this.logDebug('ERROR', 'Fallo en diagnóstico Patrones', error.message);
            this.logTest('Análisis Patrones Respuesta', false, error.message);
            return false;
        }
    }

    async runCompleteDiagnosis() {
        console.log('\x1b[36m INICIANDO DIAGNÓSTICO COMPLETO DE SEGURIDAD\x1b[0m');
        console.log('Servidor:', this.baseURL);
        console.log('Hora:', new Date().toISOString());
        console.log('=' .repeat(80) + '\n');

        // Diagnósticos individuales
        await this.diagnoseMiddlewareConfiguration();
        await this.diagnoseHashModification();
        await this.diagnoseTimestampExpired();
        await this.diagnoseReplayAttack();
        await this.diagnoseMissingSecurityHeaders();
        await this.diagnoseServerResponsePatterns();

        this.generateDetailedReport();
    }

    generateDetailedReport() {
        console.log('\n' + '='.repeat(80));
        console.log('\x1b[36m REPORTE DE DIAGNÓSTICO DETALLADO\x1b[0m');
        console.log('='.repeat(80));

        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.result).length;
        const failedTests = totalTests - passedTests;

        console.log(`\n ESTADÍSTICAS:`);
        console.log(`   Total pruebas: ${totalTests}`);
        console.log(`   \x1b[32mExitosas: ${passedTests}\x1b[0m`);
        console.log(`   \x1b[31mFallidas: ${failedTests}\x1b[0m`);

        if (failedTests > 0) {
            console.log(`\n VULNERABILIDADES CRÍTICAS IDENTIFICADAS:`);
            this.testResults
                .filter(test => !test.result)
                .forEach(test => {
                    console.log(`\n ${test.name}`);
                    console.log(`      Problema: ${test.details}`);
                    if (test.response) {
                        console.log(`      Respuesta del servidor: ${JSON.stringify(test.response)}`);
                    }
                });
        }

        console.log(`\n LOGS DE DIAGNÓSTICO (${this.debugLogs.length} entradas):`);
        this.debugLogs
            .filter(log => log.category.includes('VULNERABILITY') || log.category.includes('ANALYSIS'))
            .forEach(log => {
                console.log(`\n    ${log.category}: ${log.message}`);
                if (log.data) {
                    console.log(`      ${JSON.stringify(log.data, null, 2).split('\n').join('\n      ')}`);
                }
            });

        console.log(`\n RECOMENDACIONES INMEDIATAS:`);
        
        const failedTestNames = this.testResults.filter(t => !t.result).map(t => t.name);
        
        if (failedTestNames.includes('Ataque - Hash Modificado')) {
            console.log(`   • \x1b[31mURGENTE: El middleware no valida correctamente los hashes\x1b[0m`);
            console.log(`     Verificar la función validarHashFrontend en servicios/seguridad/hash.js`);
        }
        
        if (failedTestNames.includes('Ataque - Timestamp Expirado')) {
            console.log(`   • \x1b[31mURGENTE: No se validan timestamps expirados\x1b[0m`);
            console.log(`     Implementar validación de timestamp en el middleware`);
        }
        
        if (failedTestNames.includes('Ataque - Sin Headers Seguridad')) {
            console.log(`   • \x1b[31mURGENTE: Endpoints aceptan requests sin headers de seguridad\x1b[0m`);
            console.log(`     Revisar aplicación del middleware en app.js`);
        }

        console.log(`\n PRÓXIMOS PASOS:`);
        console.log(`   1. Revisar los logs de diagnóstico arriba`);
        console.log(`   2. Corregir el middleware de seguridad`);
        console.log(`   3. Verificar que todos los endpoints POST requieran headers`);
        console.log(`   4. Implementar registro de nonces usados`);
        console.log(`   5. Ejecutar este diagnóstico nuevamente`);

        console.log('\n' + '='.repeat(80));
    }
}

// Ejecutar diagnóstico
if (require.main === module) {
    const diagnostic = new SecurityDiagnostic();
    
    diagnostic.runCompleteDiagnosis().catch(error => {
        console.error(' Error ejecutando diagnóstico:', error);
    });
}

module.exports = SecurityDiagnostic;