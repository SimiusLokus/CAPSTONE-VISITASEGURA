// test_hash_current.js
const https = require('https');
const crypto = require('crypto');

class CurrentHashTest {
    constructor() {
        this.baseURL = 'https://localhost:3001';
        this.agent = new https.Agent({ rejectUnauthorized: false });
    }

    generateHash(timestamp, nonce, body) {
        const payload = {
            accion: body.accion,
            datosCifrados: body.datosCifrados,
            tipo_evento: body.tipo_evento,
            timestamp: timestamp,
            nonce: nonce,
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

        console.log('PAYLOAD:', stringPayload);
        console.log('HASH:   ', hash);
        
        return { hash, payload: stringPayload };
    }

    async testCurrentTimestamp() {
        console.log('=== PRUEBA CON TIMESTAMP ACTUAL ===\n');
        
        // Usar timestamp ACTUAL
        const timestamp = Date.now();
        const nonce = crypto.randomBytes(16).toString('hex');
        const body = {
            datosCifrados: 'test_cifrado_data_123',
            accion: 'entrada',
            tipo_evento: 'Visita'
        };

        console.log('TIMESTAMP ACTUAL:', timestamp);
        console.log('Nonce:', nonce);
        console.log('Body:', body);

        const { hash, payload } = this.generateHash(timestamp, nonce, body);

        const headers = {
            'x-hash-seguridad': hash,
            'x-timestamp': timestamp.toString(),
            'x-nonce': nonce
        };

        console.log('\nENVIANDO REQUEST...');
        const response = await this.makeRequest('/visitas', {
            method: 'POST',
            body: body,
            headers: headers
        });

        console.log('\nRESULTADO:');
        console.log('Status:', response.statusCode);
        
        if (response.statusCode === 401) {
            console.log('❌ FALLO:', response.data.detalle || response.data.error);
            
            if (response.data.detalle?.includes('Hash inválido')) {
                console.log('🔴 PROBLEMA: Hash NO coincide - clave secreta diferente');
            } else if (response.data.detalle?.includes('Solicitud expirada')) {
                console.log('🔴 PROBLEMA: Timestamp configurado incorrectamente');
            }
        } else if (response.statusCode === 200) {
            console.log('✅ ÉXITO - El hash COINCIDE y la seguridad funciona');
            console.log('Data:', response.data);
        }

        return response.statusCode === 200;
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
                            data: data ? JSON.parse(data) : {}
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            data: data
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

// Ejecutar prueba con timestamp actual
if (require.main === module) {
    const test = new CurrentHashTest();
    test.testCurrentTimestamp().catch(console.error);
}