// security_test.js
const https = require('https');
const crypto = require('crypto');

class SecurityTester {
    constructor() {
        this.baseURL = 'https://localhost:3001';
        this.agent = new https.Agent({ 
            rejectUnauthorized: false // Permitir self-signed certificates
        });
        this.testResults = [];
    }

    logTest(name, result, details = '') {
        const status = result ? 'PASS' : 'FAIL';
        const color = result ? '\x1b[32m' : '\x1b[31m';
        console.log(`${color}[${status}]\x1b[0m ${name}`);
        if (details) {
            console.log(`   Details: ${details}`);
        }
        this.testResults.push({ name, result, details });
    }

    async makeRequest(endpoint, options = {}) {
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
                    try {
                        const jsonData = data ? JSON.parse(data) : {};
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: jsonData
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: data
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (options.body) {
                req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
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

        return {
            'x-hash-seguridad': hash,
            'x-timestamp': timestamp.toString(),
            'x-nonce': nonce
        };
    }

    // ===== PRUEBAS DE SERVICIOS NORMALES =====

    async testServicioInfo() {
        try {
            const response = await this.makeRequest('/info');
            const success = response.statusCode === 200 && response.data.message;
            this.logTest('Servicio Info', success, 
                success ? `IP: ${response.data.ip}` : `Status: ${response.statusCode}`);
            return success;
        } catch (error) {
            this.logTest('Servicio Info', false, error.message);
            return false;
        }
    }

    async testServicioCifradoStatus() {
        try {
            const response = await this.makeRequest('/api/cifrado/status');
            const success = response.statusCode === 200 && response.data.estado === 'activo';
            this.logTest('Servicio Cifrado Status', success, 
                success ? response.data.estado : `Status: ${response.statusCode}`);
            return success;
        } catch (error) {
            this.logTest('Servicio Cifrado Status', false, error.message);
            return false;
        }
    }

    async testLoginValido() {
        try {
            const response = await this.makeRequest('/login', {
                method: 'POST',
                body: {
                    username: 'admin',
                    password: 'admin123'
                }
            });
            const success = response.statusCode === 200 && response.data.ok === true;
            this.logTest('Login Válido', success, 
                success ? `Usuario: ${response.data.username}` : `Response: ${JSON.stringify(response.data)}`);
            return success;
        } catch (error) {
            this.logTest('Login Válido', false, error.message);
            return false;
        }
    }

    async testProcesarQRValido() {
        try {
            const datosQR = {
                run: '12345678-9',
                num_doc: 'DOC123456',
                tipo_evento: 'Visita',
                timestamp: Date.now()
            };

            const response = await this.makeRequest('/api/cifrado/procesar-qr', {
                method: 'POST',
                body: { datosQR }
            });

            const success = response.statusCode === 200 && 
                           response.data.ok && 
                           response.data.datosCifrados;
            
            this.logTest('Procesar QR Válido', success, 
                success ? 'QR cifrado exitosamente' : `Error: ${response.data.error}`);
            
            if (success) {
                this.lastCifradoData = response.data;
            }
            return success;
        } catch (error) {
            this.logTest('Procesar QR Válido', false, error.message);
            return false;
        }
    }

    async testRegistroVisitaConCifrado() {
        if (!this.lastCifradoData) {
            this.logTest('Registro Visita con Cifrado', false, 'No hay datos cifrados previos');
            return false;
        }

        try {
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');
            
            const body = {
                datosCifrados: this.lastCifradoData.datosCifrados,
                accion: 'entrada',
                tipo_evento: 'Visita'
            };

            const securityHeaders = this.generateSecurityHeaders(timestamp, nonce, body);

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: securityHeaders
            });

            const success = response.statusCode === 200 && response.data.ok;
            this.logTest('Registro Visita con Cifrado', success, 
                success ? `ID: ${response.data.id}` : `Error: ${response.data.error}`);
            return success;
        } catch (error) {
            this.logTest('Registro Visita con Cifrado', false, error.message);
            return false;
        }
    }

    // ===== PRUEBAS DE ATAQUES Y VULNERABILIDADES =====

    async testAtaqueHashModificado() {
        try {
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');
            const body = {
                datosCifrados: 'datos_falsos_cifrados',
                accion: 'entrada'
            };

            const headers = this.generateSecurityHeaders(timestamp, nonce, body);
            headers['x-hash-seguridad'] = 'hash_modificado_incorrecto';

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            const success = response.statusCode === 401;
            this.logTest('Ataque - Hash Modificado', success, 
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Aceptó hash modificado');
            return success;
        } catch (error) {
            this.logTest('Ataque - Hash Modificado', false, error.message);
            return false;
        }
    }

    async testAtaqueTimestampExpirado() {
        try {
            const timestamp = Date.now() - 60000; // 1 minuto en el pasado
            const nonce = crypto.randomBytes(16).toString('hex');
            const body = { accion: 'entrada' };

            const headers = this.generateSecurityHeaders(timestamp, nonce, body);

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            const success = response.statusCode === 401;
            this.logTest('Ataque - Timestamp Expirado', success, 
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Aceptó request expirado');
            return success;
        } catch (error) {
            this.logTest('Ataque - Timestamp Expirado', false, error.message);
            return false;
        }
    }

    async testAtaqueReplayNonce() {
        try {
            const timestamp = Date.now();
            const nonce = 'nonce_reutilizado_malicioso';
            const body = { accion: 'entrada' };

            const headers = this.generateSecurityHeaders(timestamp, nonce, body);

            // Primer request (debería funcionar)
            await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            // Segundo request con mismo nonce (debería fallar)
            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            const success = response.statusCode === 401;
            this.logTest('Ataque - Replay Nonce', success, 
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Aceptó nonce reutilizado');
            return success;
        } catch (error) {
            this.logTest('Ataque - Replay Nonce', false, error.message);
            return false;
        }
    }

    async testAtaqueSQLInjection() {
        try {
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');
            
            const body = {
                run: "12345678-9' OR '1'='1",
                nombres: "Test'; DROP TABLE visitas;--",
                accion: 'entrada'
            };

            const headers = this.generateSecurityHeaders(timestamp, nonce, body);

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            // Verificar que no hubo error de BD y que se manejó correctamente
            const success = response.statusCode !== 500 && 
                          !response.data.error?.includes('SQL') &&
                          !response.data.error?.includes('database');
            
            this.logTest('Ataque - SQL Injection', success, 
                success ? 'Protegido contra SQLi' : 'POSIBLE VULNERABILIDAD SQLi');
            return success;
        } catch (error) {
            this.logTest('Ataque - SQL Injection', false, error.message);
            return false;
        }
    }

    async testAtaqueCORS() {
        try {
            const response = await this.makeRequest('/info', {
                headers: {
                    'Origin': 'https://malicious-site.com'
                }
            });

            const corsHeader = response.headers['access-control-allow-origin'];
            const success = !corsHeader || corsHeader !== 'https://malicious-site.com';
            
            this.logTest('Ataque - CORS Malicioso', success, 
                success ? 'CORS configurado correctamente' : 'VULNERABLE: CORS permite dominios maliciosos');
            return success;
        } catch (error) {
            this.logTest('Ataque - CORS Malicioso', false, error.message);
            return false;
        }
    }

    async testAtaqueQRManipulado() {
        try {
            const datosQRMalicioso = {
                run: '99999999-9',
                num_doc: 'MALICIOUS_DOC',
                tipo_evento: 'Visita',
                timestamp: Date.now(),
                // Intentar inyectar datos adicionales
                __proto__: { admin: true },
                constructor: { prototype: { isAdmin: true } }
            };

            const response = await this.makeRequest('/api/cifrado/procesar-qr', {
                method: 'POST',
                body: { datosQR: datosQRMalicioso }
            });

            const success = response.statusCode === 200 || 
                          (response.statusCode === 400 && response.data.error);
            
            this.logTest('Ataque - QR Manipulado', success, 
                success ? 'Manejado correctamente' : 'Comportamiento inesperado');
            return success;
        } catch (error) {
            this.logTest('Ataque - QR Manipulado', false, error.message);
            return false;
        }
    }

    async testAtaqueDatosCifradosManipulados() {
        try {
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');
            
            const body = {
                datosCifrados: 'datos_cifrados_manipulados_maliciosamente',
                accion: 'entrada',
                tipo_evento: 'Visita'
            };

            const headers = this.generateSecurityHeaders(timestamp, nonce, body);

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: headers
            });

            // Debería fallar silenciosamente o dar error controlado
            const success = response.statusCode !== 500;
            
            this.logTest('Ataque - Datos Cifrados Manipulados', success, 
                success ? 'Manejado sin crash' : 'CRITICAL: Server crash con datos maliciosos');
            return success;
        } catch (error) {
            this.logTest('Ataque - Datos Cifrados Manipulados', false, error.message);
            return false;
        }
    }

    async testSinHeadersSeguridad() {
        try {
            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: { accion: 'entrada', run: '12345678-9' }
                // Sin headers de seguridad
            });

            const success = response.statusCode === 401;
            this.logTest('Ataque - Sin Headers Seguridad', success, 
                success ? 'Bloqueado correctamente' : 'VULNERABLE: Aceptó request sin seguridad');
            return success;
        } catch (error) {
            this.logTest('Ataque - Sin Headers Seguridad', false, error.message);
            return false;
        }
    }

    async testFlujoCompletoAtaque() {
        console.log('\n\x1b[36m=== INICIANDO FLUJO COMPLETO DE ATAQUE ===\x1b[0m');
        
        // 1. Obtener información del servidor
        await this.testServicioInfo();
        
        // 2. Probar servicios sin autenticación
        await this.testServicioCifradoStatus();
        
        // 3. Ataques de seguridad
        await this.testAtaqueHashModificado();
        await this.testAtaqueTimestampExpirado();
        await this.testAtaqueReplayNonce();
        await this.testAtaqueSQLInjection();
        await this.testAtaqueCORS();
        await this.testAtaqueQRManipulado();
        await this.testAtaqueDatosCifradosManipulados();
        await this.testSinHeadersSeguridad();
        
        // 4. Flujos válidos (deberían funcionar)
        await this.testLoginValido();
        await this.testProcesarQRValido();
        await this.testRegistroVisitaConCifrado();
    }

    generateReport() {
        console.log('\n\x1b[36m=== REPORTE DE SEGURIDAD ===\x1b[0m');
        
        const totalTests = this.testResults.length;
        const passedTests = this.testResults.filter(test => test.result).length;
        const failedTests = totalTests - passedTests;
        
        console.log(`Total pruebas: ${totalTests}`);
        console.log(`\x1b[32mExitosas: ${passedTests}\x1b[0m`);
        console.log(`\x1b[31mFallidas: ${failedTests}\x1b[0m`);
        
        if (failedTests > 0) {
            console.log('\n\x1b[33mPruebas fallidas:\x1b[0m');
            this.testResults
                .filter(test => !test.result)
                .forEach(test => {
                    console.log(` • ${test.name}: ${test.details}`);
                });
        }
        
        // Recomendaciones
        console.log('\n\x1b[36m=== RECOMENDACIONES ===\x1b[0m');
        if (failedTests === 0) {
            console.log('✓ Sistema seguro contra los ataques probados');
        } else {
            console.log('✗ Revisar las vulnerabilidades identificadas');
        }
        
        console.log('✓ Considerar agregar rate limiting');
        console.log('✓ Monitorear logs de seguridad');
        console.log('✓ Actualizar dependencias regularmente');
    }

    async runAllTests() {
        console.log('\x1b[36m=== INICIANDO PRUEBAS DE SEGURIDAD ===\x1b[0m');
        console.log('Servidor objetivo:', this.baseURL);
        console.log('Hora de inicio:', new Date().toISOString());
        console.log('');
        
        await this.testFlujoCompletoAtaque();
        this.generateReport();
    }
}

// Ejecutar pruebas si se llama directamente
if (require.main === module) {
    const tester = new SecurityTester();
    
    // Manejar cierre graceful
    process.on('SIGINT', () => {
        console.log('\n\nPruebas interrumpidas por el usuario');
        tester.generateReport();
        process.exit(1);
    });
    
    tester.runAllTests().catch(console.error);
}

module.exports = SecurityTester;