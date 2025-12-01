// insert_data_with_encryption.js
const https = require('https');
const crypto = require('crypto');

class DataInserter {
    constructor() {
        this.baseURL = 'https://localhost:3001';
        this.agent = new https.Agent({ 
            rejectUnauthorized: false // Para certificados self-signed
        });
        this.sessionToken = null;
        this.insertedRecords = [];
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

    async login() {
        console.log('Iniciando sesión...');
        
        try {
            const response = await this.makeRequest('/login', {
                method: 'POST',
                body: {
                    username: 'admin',
                    password: 'admin123'
                }
            });

            if (response.statusCode === 200 && response.data.ok) {
                console.log('Login exitoso como:', response.data.username);
                return true;
            } else {
                console.log('Error en login:', response.data.error);
                return false;
            }
        } catch (error) {
            console.log('rror de conexión en login:', error.message);
            return false;
        }
    }

    async procesarQRParaCifrado(datosQR) {
        console.log('Enviando datos para cifrado...');
        
        try {
            const response = await this.makeRequest('/api/cifrado/procesar-qr', {
                method: 'POST',
                body: { datosQR }
            });

            if (response.statusCode === 200 && response.data.ok) {
                console.log('Datos cifrados correctamente');
                return response.data;
            } else {
                console.log('Error en cifrado:', response.data.error);
                return null;
            }
        } catch (error) {
            console.log('Error de conexión en cifrado:', error.message);
            return null;
        }
    }

    async registrarVisitaConCifrado(datosCifrados, accion = 'entrada', tipoEvento = 'Visita') {
        console.log('Registrando visita con datos cifrados...');
        
        try {
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');
            
            const body = {
                datosCifrados: datosCifrados,
                accion: accion,
                tipo_evento: tipoEvento
            };

            const securityHeaders = this.generateSecurityHeaders(timestamp, nonce, body);

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: securityHeaders
            });

            if (response.statusCode === 200 && response.data.ok) {
                console.log('Visita registrada exitosamente - ID:', response.data.id);
                return response.data;
            } else {
                console.log('Error registrando visita:', response.data.error);
                return null;
            }
        } catch (error) {
            console.log('Error de conexión:', error.message);
            return null;
        }
    }

    async registrarSalida(run) {
        console.log('Registrando salida para RUN:', run);
        
        try {
            const timestamp = Date.now();
            const nonce = crypto.randomBytes(16).toString('hex');
            
            const body = {
                accion: 'salida',
                run: run
            };

            const securityHeaders = this.generateSecurityHeaders(timestamp, nonce, body);

            const response = await this.makeRequest('/visitas', {
                method: 'POST',
                body: body,
                headers: securityHeaders
            });

            if (response.statusCode === 200 && response.data.ok) {
                console.log('Salida registrada exitosamente');
                return response.data;
            } else {
                console.log('Error registrando salida:', response.data.error);
                return null;
            }
        } catch (error) {
            console.log('Error de conexión:', error.message);
            return null;
        }
    }

    async verificarRegistroEnBD() {
        console.log('Verificando registros en base de datos...');
        
        try {
            const response = await this.makeRequest('/visitas');
            
            if (response.statusCode === 200 && response.data.ok) {
                const registros = response.data.data || [];
                console.log(`Total de registros en BD: ${registros.length}`);
                
                // Mostrar los últimos 3 registros
                const ultimosRegistros = registros.slice(0, 3);
                ultimosRegistros.forEach(reg => {
                    console.log(`   - ID: ${reg.id}, RUN: ${reg.run}, Entrada: ${reg.hora_entrada}, Cifrado: ${reg.datos_cifrados ? 'Sí' : 'No'}`);
                });
                
                return registros;
            } else {
                console.log('Error obteniendo registros');
                return [];
            }
        } catch (error) {
            console.log('Error verificando registros:', error.message);
            return [];
        }
    }

    // Datos de prueba realistas
    generarDatosPrueba(index) {
        const nombres = ['JUAN', 'MARIA', 'PEDRO', 'ANA', 'CARLOS', 'LAURA', 'DIEGO', 'SOFIA'];
        const apellidos = ['GONZALEZ', 'RODRIGUEZ', 'PEREZ', 'LOPEZ', 'MARTINEZ', 'GARCIA', 'FERNANDEZ', 'SILVA'];
        const sexos = ['M', 'F'];
        
        const nombre = nombres[Math.floor(Math.random() * nombres.length)];
        const apellido = apellidos[Math.floor(Math.random() * apellidos.length)];
        const sexo = sexos[Math.floor(Math.random() * sexos.length)];
        
        // Generar RUN chileno válido
        const numRun = Math.floor(1000000 + Math.random() * 20000000);
        const dv = this.calcularDigitoVerificador(numRun);
        const run = `${numRun}-${dv}`;
        
        // Generar fecha de nacimiento aleatoria (18-70 años)
        const añoNac = 1950 + Math.floor(Math.random() * 50);
        const mesNac = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
        const diaNac = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
        const fechaNac = `${diaNac}/${mesNac}/${añoNac}`;
        
        // Generar número de documento único
        const numDoc = `DOC${String(100000 + index).padStart(6, '0')}`;
        
        return {
            run: run,
            nombres: nombre,
            apellidos: apellido,
            fecha_nac: fechaNac,
            sexo: sexo,
            num_doc: numDoc,
            tipo_evento: 'Visita',
            timestamp: Date.now()
        };
    }

    calcularDigitoVerificador(run) {
        let suma = 0;
        let multiplicador = 2;
        const runStr = run.toString();
        
        for (let i = runStr.length - 1; i >= 0; i--) {
            suma += parseInt(runStr[i]) * multiplicador;
            multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
        }
        
        const resto = suma % 11;
        const dv = 11 - resto;
        
        if (dv === 11) return '0';
        if (dv === 10) return 'K';
        return dv.toString();
    }

    async insertarDatosConCifrado(cantidad = 5) {
        console.log('INICIANDO INSERCIÓN DE DATOS CON CIFRADO');
        console.log('============================================\n');
        
        // 1. Login (aunque no es estrictamente necesario para estos endpoints)
        await this.login();
        
        // 2. Insertar datos de prueba
        for (let i = 0; i < cantidad; i++) {
            console.log(`\n--- Registro ${i + 1}/${cantidad} ---`);
            
            // Generar datos de prueba
            const datosQR = this.generarDatosPrueba(i);
            console.log('Datos generados:', {
                run: datosQR.run,
                nombres: datosQR.nombres,
                apellidos: datosQR.apellidos,
                num_doc: datosQR.num_doc
            });
            
            // 3. Procesar QR para cifrado
            const resultadoCifrado = await this.procesarQRParaCifrado(datosQR);
            if (!resultadoCifrado) {
                console.log('Saltando registro debido a error en cifrado');
                continue;
            }
            
            // 4. Registrar visita con datos cifrados
            const registro = await this.registrarVisitaConCifrado(
                resultadoCifrado.datosCifrados,
                'entrada',
                datosQR.tipo_evento
            );
            
            if (registro) {
                this.insertedRecords.push({
                    id: registro.id,
                    run: datosQR.run,
                    datosOriginales: datosQR,
                    datosCifrados: resultadoCifrado.datosCifrados
                });
            }
            
            // Pequeña pausa entre registros
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // 5. Simular algunas salidas
        console.log('\n--- Registrando algunas salidas ---');
        for (let i = 0; i < Math.min(2, this.insertedRecords.length); i++) {
            const record = this.insertedRecords[i];
            await this.registrarSalida(record.run);
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        // 6. Verificar registros en BD
        await this.verificarRegistroEnBD();
        
        return this.insertedRecords;
    }

    generarReporte() {
        console.log('\nREPORTE FINAL');
        console.log('================');
        console.log(`Total de registros insertados: ${this.insertedRecords.length}`);
        
        if (this.insertedRecords.length > 0) {
            console.log('\nRegistros insertados:');
            this.insertedRecords.forEach((record, index) => {
                console.log(`${index + 1}. ID: ${record.id}, RUN: ${record.run}`);
                console.log(`   Datos originales: ${JSON.stringify(record.datosOriginales)}`);
                console.log(`   Datos cifrados: ${record.datosCifrados.substring(0, 50)}...`);
            });
        }
    }
}

// Función principal
async function main() {
    const inserter = new DataInserter();
    
    try {
        // Insertar 3 registros por defecto, o el número especificado
        const cantidad = process.argv[2] ? parseInt(process.argv[2]) : 3;
        await inserter.insertarDatosConCifrado(cantidad);
        inserter.generarReporte();
    } catch (error) {
        console.error('Error en la ejecución:', error);
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main().catch(console.error);
}

module.exports = DataInserter;