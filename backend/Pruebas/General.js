// test_final_corregido.js
const https = require('https');
const crypto = require('crypto');

class TestCorregido {
    constructor() {
        this.baseURL = 'https://localhost:3001';
        this.agent = new https.Agent({ rejectUnauthorized: false });
        this.claveSecreta = "clave-secreta-visitasegura-2025";
    }

    async testCorregido() {
        console.log('=== PRUEBA CON ORDEN CORREGIDO ===\n');
        
        const timestamp = Date.now();
        const nonce = crypto.randomBytes(16).toString('hex');
        const body = {
            datosCifrados: 'test_cifrado_data_123',
            accion: 'entrada',
            tipo_evento: 'Visita'
        };

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
            .createHmac('sha256', this.claveSecreta)
            .update(stringPayload)
            .digest('hex');

        console.log('📦 Payload completo:', stringPayload);
        console.log('🔐 Hash:', hash);

        const headers = {
            'x-hash-seguridad': hash,
            'x-timestamp': timestamp.toString(),
            'x-nonce': nonce
        };

        console.log('\n🚀 Enviando request CON body...');
        const response = await this.makeRequest('/visitas', {
            method: 'POST',
            body: body, // ✅ ESTE body debe llegar al middleware
            headers: headers
        });

        console.log('\n📊 RESULTADO:');
        console.log('Status:', response.statusCode);
        
        if (response.statusCode === 200) {
            console.log('🎉 ✅ ✅ ✅ ÉXITO TOTAL');
            console.log('El middleware ahora recibe el body correctamente');
            console.log('Data:', response.data);
        } else {
            console.log('❌ FALLO:', response.data);
            console.log('\n🔴 VERIFICA EN LOS LOGS DEL SERVIDOR:');
            console.log(' - Debe aparecer: [SECURITY DEBUG] Body disponible: [\"datosCifrados\",\"accion\",\"tipo_evento\"]');
            console.log(' - Si no aparece, el orden del middleware sigue incorrecto');
        }
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

// Ejecutar prueba corregida
if (require.main === module) {
    const test = new TestCorregido();
    test.testCorregido().catch(console.error);
}