// frontend/visita-segura/src/utils/hash_cliente.js

/**
 * Cliente de Hash para el Frontend
 * Genera hashes HMAC-SHA256 compatibles con el backend
 */
class Hash_cliente {
  constructor() {
    // IMPORTANTE: Esta clave DEBE coincidir con la del backend
    // En producción, deberías obtenerla de variables de entorno
    this.claveSecreta = "clave-secreta-visitasegura-2025";
    
    console.log('[HASH_CLIENT] Cliente de seguridad inicializado');
  }

  /**
   * Genera hash HMAC-SHA256 para datos del frontend
   * @param {Object} datos - Datos a incluir en el hash
   * @returns {Object} Hash, timestamp, nonce y payload
   */
  generarHashFrontend(datos) {
    try {
      const timestamp = Date.now();
      const nonce = this._generarNonce();
      
      // Crear payload con estructura EXACTA que espera el backend
      const payload = {
        accion: datos.accion,
        datosCifrados: datos.datosCifrados,
        tipo_evento: datos.tipo_evento,
        timestamp: timestamp,
        nonce: nonce,
        origen: 'frontend'
      };

      // Ordenar alfabéticamente las claves (igual que el backend)
      const stringPayload = this._ordenarYStringify(payload);
      
      console.log('[HASH_CLIENT] Payload para hash:', stringPayload);

      // Generar hash usando Web Crypto API
      return this._generarHashAsync(stringPayload, timestamp, nonce, payload);

    } catch (error) {
      console.error('[HASH_CLIENT] Error generando hash:', error);
      throw error;
    }
  }

  /**
   * Genera hash usando SubtleCrypto (moderno y seguro)
   * @private
   */
  async _generarHashAsync(stringPayload, timestamp, nonce, payload) {
    try {
      // Convertir clave y mensaje a ArrayBuffer
      const encoder = new TextEncoder();
      const keyData = encoder.encode(this.claveSecreta);
      const messageData = encoder.encode(stringPayload);

      // Importar clave para HMAC
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );

      // Generar hash
      const signature = await crypto.subtle.sign(
        'HMAC',
        cryptoKey,
        messageData
      );

      // Convertir ArrayBuffer a hex
      const hashArray = Array.from(new Uint8Array(signature));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      console.log('[HASH_CLIENT] Hash generado:', hash.substring(0, 20) + '...');

      return {
        hash: hash,
        timestamp: timestamp,
        nonce: nonce,
        payload: payload
      };

    } catch (error) {
      console.error('[HASH_CLIENT] Error en generación async:', error);
      
      // Fallback: usar implementación síncrona simple (menos segura)
      console.warn('[HASH_CLIENT] Usando fallback simple hash');
      return this._generarHashFallback(stringPayload, timestamp, nonce, payload);
    }
  }

  /**
   * Fallback simple para navegadores sin Web Crypto API
   * @private
   */
  _generarHashFallback(stringPayload, timestamp, nonce, payload) {
    // Implementación simple de hash (NO TAN SEGURO - solo para desarrollo)
    const simpleHash = this._hashSimple(this.claveSecreta + stringPayload);
    
    console.warn('[HASH_CLIENT] Usando hash simple (no recomendado para producción)');
    
    return {
      hash: simpleHash,
      timestamp: timestamp,
      nonce: nonce,
      payload: payload
    };
  }

  /**
   * Hash simple para fallback
   * @private
   */
  _hashSimple(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }

  /**
   * Ordena objeto alfabéticamente y convierte a JSON
   * DEBE coincidir EXACTAMENTE con el backend
   * @private
   */
  _ordenarYStringify(objeto) {
    if (!objeto || typeof objeto !== 'object') {
      console.error('[HASH_CLIENT] Objeto inválido para ordenar:', objeto);
      return JSON.stringify({});
    }
    
    const ordenado = {};
    Object.keys(objeto).sort().forEach(key => {
      if (objeto[key] !== undefined && objeto[key] !== null) {
        ordenado[key] = objeto[key];
      }
    });
    
    // IMPORTANTE: Sin espacios ni saltos de línea
    return JSON.stringify(ordenado);
  }

  /**
   * Genera nonce único
   * @private
   */
  _generarNonce() {
    // Generar 16 bytes aleatorios y convertir a hex
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Valida formato de timestamp
   * @param {number} timestamp - Timestamp a validar
   * @returns {boolean}
   */
  validarTimestamp(timestamp) {
    const ahora = Date.now();
    const diff = Math.abs(ahora - timestamp);
    
    // Máximo 30 segundos de diferencia
    return diff < 30000;
  }
}

export default Hash_cliente;