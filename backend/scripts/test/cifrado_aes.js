const crypto = require('crypto');

// Generar valores REALES
const timestamp = Date.now().toString();
const nonce = crypto.randomUUID();
const body = {
  "datosQR": {
    "run": "12345678-9",
    "num_doc": "ABC123",
    "timestamp": 1234567890
  }
};

// Calcular hash
const datosHash = timestamp + nonce + JSON.stringify(body);
const hashSeguridad = crypto.createHash('sha256').update(datosHash).digest('hex');

console.log('=== COPIA Y PEGA ESTOS VALORES ===');
console.log('x-timestamp:', timestamp);
console.log('x-nonce:', nonce);
console.log('x-hash-seguridad:', hashSeguridad);