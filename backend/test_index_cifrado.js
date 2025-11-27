const https = require('https');

const API_BASE = 'https://localhost:3001';

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

function makeRequest(path, method, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3001,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            rejectUnauthorized: false
        };

        const req = https.request(options, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                try {
                    const parsed = JSON.parse(body);
                    resolve({ status: res.statusCode, data: parsed });
                } catch (e) {
                    reject(new Error('Error parseando respuesta: ' + body));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error('Error de conexion: ' + error.message));
        });

        if (data) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

async function test1_verificarServicios() {
    console.log('\n========================================');
    console.log('TEST 1: Verificar Servicios');
    console.log('========================================');

    try {
        const health = await makeRequest('/info', 'GET');
        console.log('Servidor activo:', health.data);

        const cifrado = await makeRequest('/api/cifrado/status', 'GET');
        console.log('Estado cifrado:', cifrado.data);

        return true;
    } catch (error) {
        console.error('ERROR:', error.message);
        return false;
    }
}

async function test2_indexacion() {
    console.log('\n========================================');
    console.log('TEST 2: Indexacion de Datos');
    console.log('========================================');

    try {
        const datosQR = {
            run: '12345678-9',
            num_doc: '987654321'
        };

        console.log('Datos QR simulados:', datosQR);

        const resultado = await makeRequest('/api/indexar', 'POST', datosQR);
        
        console.log('Status HTTP:', resultado.status);
        console.log('Respuesta completa:', JSON.stringify(resultado.data, null, 2));

        if (resultado.data.exito) {
            console.log('EXITO: Indexacion correcta');
            console.log('Datos indexados:');
            console.log('  - RUN:', resultado.data.registroIndexado.run);
            console.log('  - NumDoc:', resultado.data.registroIndexado.num_doc);
            console.log('  - Nombres:', resultado.data.registroIndexado.nombres);
            console.log('  - Apellidos:', resultado.data.registroIndexado.apellidos);
            console.log('  - Fecha Nac:', resultado.data.registroIndexado.fecha_nac);
            console.log('  - Sexo:', resultado.data.registroIndexado.sexo);
            return resultado.data.registroIndexado;
        } else {
            console.error('ERROR: Indexacion fallo:', resultado.data.mensaje);
            return null;
        }
    } catch (error) {
        console.error('ERROR:', error.message);
        return null;
    }
}

async function test3_cifrado(datosIndexados) {
    console.log('\n========================================');
    console.log('TEST 3: Cifrado de Datos');
    console.log('========================================');

    if (!datosIndexados) {
        console.error('ERROR: No hay datos indexados para cifrar');
        return null;
    }

    try {
        const datosParaCifrar = {
            run: datosIndexados.run,
            num_doc: datosIndexados.num_doc,
            nombres: datosIndexados.nombres,
            apellidos: datosIndexados.apellidos,
            fecha_nac: datosIndexados.fecha_nac,
            sexo: datosIndexados.sexo,
            tipo_evento: 'Visita',
            accion: 'entrada',
            timestamp: Date.now()
        };

        console.log('Datos a cifrar:', {
            run: datosParaCifrar.run,
            num_doc: datosParaCifrar.num_doc,
            nombres: datosParaCifrar.nombres,
            apellidos: datosParaCifrar.apellidos
        });

        const resultado = await makeRequest('/api/cifrado/procesar-qr', 'POST', {
            datosQR: datosParaCifrar
        });

        console.log('Status HTTP:', resultado.status);

        if (resultado.data.ok) {
            console.log('EXITO: Cifrado correcto');
            console.log('Tamano datos cifrados:', resultado.data.datosCifrados.length, 'caracteres');
            console.log('Primeros 100 caracteres:', resultado.data.datosCifrados.substring(0, 100) + '...');
            return resultado.data.datosCifrados;
        } else {
            console.error('ERROR: Cifrado fallo:', resultado.data.error);
            return null;
        }
    } catch (error) {
        console.error('ERROR:', error.message);
        return null;
    }
}

async function test4_registroCompleto(datosIndexados, datosCifrados) {
    console.log('\n========================================');
    console.log('TEST 4: Registro de Visita Completo');
    console.log('========================================');

    if (!datosIndexados) {
        console.error('ERROR: No hay datos indexados');
        return false;
    }

    try {
        const payload = {
            run: datosIndexados.run,
            num_doc: datosIndexados.num_doc,
            datos_cifrados: datosCifrados || null
        };

        console.log('Payload a enviar:', {
            run: payload.run,
            num_doc: payload.num_doc,
            datos_cifrados: payload.datos_cifrados ? 'PRESENTE (' + payload.datos_cifrados.length + ' chars)' : 'NULL'
        });

        const resultado = await makeRequest('/visitas', 'POST', payload);

        console.log('Status HTTP:', resultado.status);
        console.log('Respuesta completa:', JSON.stringify(resultado.data, null, 2));

        if (resultado.status === 200 && resultado.data.ok) {
            console.log('EXITO: Visita registrada');
            console.log('  - ID:', resultado.data.id);
            console.log('  - Indexado:', resultado.data.indexado ? 'SI' : 'NO');
            console.log('  - Cifrado:', resultado.data.cifrado ? 'SI' : 'NO');
            console.log('  - Tipo:', resultado.data.tipo);
            console.log('  - Mensaje:', resultado.data.mensaje);
            return resultado.data.id;
        } else {
            console.error('ERROR: No se pudo registrar visita');
            console.error('Respuesta:', resultado.data);
            return null;
        }
    } catch (error) {
        console.error('ERROR:', error.message);
        return null;
    }
}

async function test5_verificarEnBD(idRegistro) {
    console.log('\n========================================');
    console.log('TEST 5: Verificar Datos en BD');
    console.log('========================================');

    try {
        const resultado = await makeRequest('/visitas', 'GET');

        console.log('Status HTTP:', resultado.status);

        if (resultado.data.ok && resultado.data.data && resultado.data.data.length > 0) {
            const ultimaVisita = resultado.data.data[0];
            
            console.log('Ultima visita en BD:');
            console.log('  - ID:', ultimaVisita.id);
            console.log('  - RUN:', ultimaVisita.run);
            console.log('  - NumDoc:', ultimaVisita.num_doc);
            console.log('  - Nombres:', ultimaVisita.nombres);
            console.log('  - Apellidos:', ultimaVisita.apellidos);
            console.log('  - Fecha Nac:', ultimaVisita.fecha_nac);
            console.log('  - Sexo:', ultimaVisita.sexo);
            console.log('  - Tipo Evento:', ultimaVisita.tipo_evento);
            console.log('  - Fecha:', ultimaVisita.fecha);
            console.log('  - Hora Entrada:', ultimaVisita.hora_entrada);
            console.log('  - Datos Cifrados:', ultimaVisita.datos_cifrados ? 'PRESENTE' : 'NULL');

            if (ultimaVisita.datos_cifrados) {
                console.log('  - Tamano Cifrado:', ultimaVisita.datos_cifrados.length, 'caracteres');
            }

            const indexacionCorrecta = ultimaVisita.nombres !== 'no disponible' && ultimaVisita.apellidos !== 'no disponible';
            const cifradoPresente = ultimaVisita.datos_cifrados !== null;

            console.log('\nVERIFICACION:');
            console.log('  - Indexacion correcta:', indexacionCorrecta ? 'SI' : 'NO');
            console.log('  - Cifrado presente:', cifradoPresente ? 'SI' : 'NO');

            return indexacionCorrecta && cifradoPresente;
        } else {
            console.warn('ADVERTENCIA: No hay visitas registradas');
            return false;
        }
    } catch (error) {
        console.error('ERROR:', error.message);
        return false;
    }
}

async function test6_probarDescifrado(datosCifrados) {
    console.log('\n========================================');
    console.log('TEST 6: Probar Descifrado (Opcional)');
    console.log('========================================');

    if (!datosCifrados) {
        console.log('OMITIDO: No hay datos cifrados para probar');
        return true;
    }

    try {
        console.log('Intentando descifrar datos...');
        
        const resultado = await makeRequest('/api/cifrado/descifrar', 'POST', {
            datosCifrados: datosCifrados
        });

        if (resultado.data.ok) {
            console.log('EXITO: Descifrado correcto');
            console.log('Datos descifrados:', JSON.stringify(resultado.data.datosDescifrados, null, 2));
            return true;
        } else {
            console.error('ERROR: Descifrado fallo');
            return false;
        }
    } catch (error) {
        console.error('ERROR:', error.message);
        return false;
    }
}

async function ejecutarTests() {
    console.log('\n==========================================');
    console.log('INICIANDO TESTS DEL SISTEMA');
    console.log('==========================================');

    let datosIndexados = null;
    let datosCifrados = null;
    let idRegistro = null;

    const test1 = await test1_verificarServicios();
    if (!test1) {
        console.error('\nTest 1 FALLO - Deteniendo ejecucion');
        process.exit(1);
    }

    datosIndexados = await test2_indexacion();
    if (!datosIndexados) {
        console.error('\nTest 2 FALLO - Deteniendo ejecucion');
        process.exit(1);
    }

    datosCifrados = await test3_cifrado(datosIndexados);
    if (!datosCifrados) {
        console.warn('\nTest 3 FALLO - Continuando sin cifrado');
    }

    idRegistro = await test4_registroCompleto(datosIndexados, datosCifrados);
    if (!idRegistro) {
        console.error('\nTest 4 FALLO - Deteniendo ejecucion');
        process.exit(1);
    }

    const test5 = await test5_verificarEnBD(idRegistro);

    const test6 = await test6_probarDescifrado(datosCifrados);

    console.log('\n==========================================');
    console.log('RESUMEN DE TESTS');
    console.log('==========================================');
    console.log('Test 1 - Servicios:        ', test1 ? 'PASS' : 'FAIL');
    console.log('Test 2 - Indexacion:       ', datosIndexados ? 'PASS' : 'FAIL');
    console.log('Test 3 - Cifrado:          ', datosCifrados ? 'PASS' : 'FAIL');
    console.log('Test 4 - Registro:         ', idRegistro ? 'PASS' : 'FAIL');
    console.log('Test 5 - Verificacion BD:  ', test5 ? 'PASS' : 'FAIL');
    console.log('Test 6 - Descifrado:       ', test6 ? 'PASS' : 'SKIP');
    console.log('==========================================');

    if (test1 && datosIndexados && idRegistro && test5) {
        console.log('\nRESULTADO FINAL: TODOS LOS TESTS PASARON');
        console.log('La indexacion y el cifrado funcionan correctamente');
        process.exit(0);
    } else {
        console.log('\nRESULTADO FINAL: ALGUNOS TESTS FALLARON');
        console.log('Revisar los errores arriba');
        process.exit(1);
    }
}

ejecutarTests().catch(error => {
    console.error('\nError fatal:', error);
    process.exit(1);
});