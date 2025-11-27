// backend/servicios/seguridad/cifrado.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class CifradorAES {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.key = this.obtenerOGenerarClave();
        this.encoding = 'hex';
    }

    /**
     * Obtiene o genera una clave AES-256 segura
     */
    obtenerOGenerarClave() {
        const keyPath = path.join(__dirname, '../../../claves/aes.key');
        const keyDir = path.dirname(keyPath);
        
        try {
            // Crear directorio de claves si no existe
            if (!fs.existsSync(keyDir)) {
                fs.mkdirSync(keyDir, { recursive: true });
            }

            // Intentar cargar clave existente
            if (fs.existsSync(keyPath)) {
                const claveExistente = fs.readFileSync(keyPath);
                if (claveExistente.length === 32) { // 256 bits
                    console.log('Clave AES-256 cargada existente');
                    return claveExistente;
                }
            }

            // Generar nueva clave
            const nuevaClave = crypto.randomBytes(32); // 256 bits
            fs.writeFileSync(keyPath, nuevaClave);
            console.log('Nueva clave AES-256 generada y guardada');
            
            return nuevaClave;

        } catch (error) {
            console.error('Error manejando clave AES:', error);
            // Fallback: clave en memoria (solo para desarrollo)
            return crypto.scryptSync('clave-temporal-desarrollo', 'salt', 32);
        }
    }

    /**
     * Cifra texto plano
     * @param {string} textoPlano - Texto a cifrar
     * @returns {Object} Objeto con datos cifrados
     */
    cifrar(textoPlano) {
        try {
            // Generar IV único (Initialization Vector)
            const iv = crypto.randomBytes(16);
            
            // Crear cipher
            const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
            
            // Cifrar
            let cifrado = cipher.update(textoPlano, 'utf8', this.encoding);
            cifrado += cipher.final(this.encoding);
            
            // Obtener auth tag para integridad
            const authTag = cipher.getAuthTag();
            
            return {
                cifrado: cifrado,
                iv: iv.toString(this.encoding),
                authTag: authTag.toString(this.encoding),
                algorithm: this.algorithm
            };

        } catch (error) {
            throw new Error('Error cifrando datos: ' + error.message);
        }
    }

    /**
     * Descifra datos cifrados
     * @param {Object} datosCifrados - Objeto con datos cifrados
     * @returns {string} Texto plano
     */
    descifrar(datosCifrados) {
        try {
            const iv = Buffer.from(datosCifrados.iv, this.encoding);
            const authTag = Buffer.from(datosCifrados.authTag, this.encoding);
            
            // Crear decipher
            const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
            decipher.setAuthTag(authTag);
            
            // Descifrar
            let textoPlano = decipher.update(datosCifrados.cifrado, this.encoding, 'utf8');
            textoPlano += decipher.final('utf8');
            
            return textoPlano;

        } catch (error) {
            throw new Error('Error descifrando datos: ' + error.message);
        }
    }

    /**
     * Cifra un objeto completo (para JSON)
     * @param {Object} objeto - Objeto a cifrar
     * @returns {Object} Objeto cifrado
     */
    cifrarObjeto(objeto) {
        const textoPlano = JSON.stringify(objeto);
        return this.cifrar(textoPlano);
    }

    /**
     * Descifra un objeto
     * @param {Object} datosCifrados - Objeto cifrado
     * @returns {Object} Objeto descifrado
     */
    descifrarObjeto(datosCifrados) {
        const textoPlano = this.descifrar(datosCifrados);
        return JSON.parse(textoPlano);
    }

    /**
     * Cifra para almacenar en SQLite (todo en string)
     * @param {Object} objeto - Objeto a cifrar
     * @returns {string} String para almacenar en BD
     */
    cifrarParaBD(objeto) {
        const cifrado = this.cifrarObjeto(objeto);
        return JSON.stringify(cifrado);
    }

    /**
     * Descifra desde SQLite
     * @param {string} datosString - String de la BD
     * @returns {Object} Objeto descifrado
     */
    descifrarDesdeBD(datosString) {
        const datosCifrados = JSON.parse(datosString);
        return this.descifrarObjeto(datosCifrados);
    }

    /**
     * Cifra datos específicos para QR
     * @param {Object} datosQR - {run, num_doc, timestamp}
     * @returns {string} String cifrado para QR
     */
    cifrarParaQR(datosQR) {
        // Agregar timestamp para evitar replay attacks
        const datosConTimestamp = {
            ...datosQR,
            timestamp: Date.now(),
            version: '1.0'
        };
        
        const cifrado = this.cifrarObjeto(datosConTimestamp);
        
        // Convertir a string base64 para QR
        const datosParaQR = JSON.stringify(cifrado);
        return Buffer.from(datosParaQR).toString('base64');
    }

    /**
     * Descifra datos desde QR
     * @param {string} qrData - String base64 del QR
     * @returns {Object} Datos descifrados
     */
    descifrarDesdeQR(qrData) {
        try {
            // Decodificar base64
            const datosString = Buffer.from(qrData, 'base64').toString('utf8');
            const datosCifrados = JSON.parse(datosString);
            
            // Descifrar
            const datosDescifrados = this.descifrarObjeto(datosCifrados);
            
            // Validar timestamp (máximo 5 minutos de antigüedad)
            const ahora = Date.now();
            const maxEdad = 5 * 60 * 1000; // 5 minutos
            if (ahora - datosDescifrados.timestamp > maxEdad) {
                throw new Error('QR expirado');
            }
            
            return datosDescifrados;

        } catch (error) {
            throw new Error('Error descifrando QR: ' + error.message);
        }
    }
}

module.exports = CifradorAES;