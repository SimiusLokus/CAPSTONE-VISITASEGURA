// verify_secret_key.js
const crypto = require('crypto');

class SecretKeyVerifier {
    constructor() {
        this.possibleKeys = [
            "clave-secreta-visitasegura-2025",
            "clave-secreta-visitasegura",
            "clave-secreta-2025", 
            "clave-secreta",
            "visitasegura-2025",
            "visitasegura",
            // Agrega otras claves que puedas haber usado
        ];
    }

    testAllKeys() {
        console.log('=== VERIFICANDO CLAVES SECRETAS ===\n');
        
        const testData = '{"accion":"entrada","datosCifrados":"test_cifrado_data_123","nonce":"7fd9f9a93b010a5fa95b9c8f4a210ac0","origen":"frontend","timestamp":1764547583786,"tipo_evento":"Visita"}';
        const expectedHash = 'a57744dcae4ac775479b453223468ac897e2441292074271abc8ae32a00086e0';

        console.log('Test Data:', testData);
        console.log('Hash Esperado:', expectedHash);
        console.log('\nProbando claves...\n');

        let found = false;
        
        this.possibleKeys.forEach((key, index) => {
            const hash = crypto
                .createHmac('sha256', key)
                .update(testData)
                .digest('hex');

            const matches = hash === expectedHash;
            console.log(`${index + 1}. Clave: "${key}"`);
            console.log(`   Hash:    ${hash}`);
            console.log(`   Coincide: ${matches ? '✅ SÍ' : '❌ NO'}`);
            console.log('');
            
            if (matches) {
                found = true;
                console.log('🎉 CLAVE ENCONTRADA:', key);
            }
        });

        if (!found) {
            console.log('🔴 NINGUNA CLAVE COINCIDE');
            console.log('\nPOSIBLES SOLUCIONES:');
            console.log('1. Verifica que la clave en el backend sea EXACTAMENTE: "clave-secreta-visitasegura-2025"');
            console.log('2. Verifica que no haya espacios extras al principio/final');
            console.log('3. Verifica que estés usando la misma clave en todos los lugares');
        }
    }
}

// Ejecutar verificación
if (require.main === module) {
    const verifier = new SecretKeyVerifier();
    verifier.testAllKeys();
}