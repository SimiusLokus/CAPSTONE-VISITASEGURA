// CAPSTONE-VISITASEGURA\backend\servicios\seguridad\hash.js

const crypto = require("crypto");

class ServicioHash {
  constructor() {
    this.claveSecreta = process.env.HASH_SECRET || "clave-secreta-visitasegura-2025";
    this.tiempoExpiracion = 30000; // 30 segundos
    this.noncesUsados = new Map(); // Nuevo: almacenar nonces usados con timestamp
    this.limpiarInterval = setInterval(() => this.limpiarNoncesExpirados(), 60000); // Limpiar cada minuto
  }

  /**
   * Genera hash para datos del frontend
   * @param {Object} datos - Datos a hashear
   * @returns {Object} { hash, timestamp, nonce }
   */
  generarHashFrontend(datos) {
    const timestamp = Date.now();
    const nonce = crypto.randomBytes(16).toString('hex');
    
    const payload = {
      ...datos,
      timestamp,
      nonce,
      origen: 'frontend'
    };

    const stringPayload = this._ordenarYStringify(payload);
    const hash = crypto
      .createHmac('sha256', this.claveSecreta)
      .update(stringPayload)
      .digest('hex');

    return {
      hash,
      timestamp,
      nonce,
      payload: payload
    };
  }

  /**
   * Valida hash recibido del frontend
   * @param {Object} datosRecibidos - Datos del request
   * @param {String} hashRecibido - Hash del header
   * @returns {Object} Resultado de validación
   */
  validarHashFrontend(datosRecibidos, hashRecibido) {
    try {
      // 1. Verificar timestamp
      const timestamp = datosRecibidos.timestamp || Date.now();
      if (Date.now() - timestamp > this.tiempoExpiracion) {
        return { valido: false, error: "Solicitud expirada" };
      }

      // 2. Verificar nonce
      if (!datosRecibidos.nonce) {
        return { valido: false, error: "Nonce requerido" };
      }

      // 3. Verificar que el nonce no se haya usado antes (NUEVA PROTECCIÓN)
      if (this.noncesUsados.has(datosRecibidos.nonce)) {
        return { valido: false, error: "Nonce ya utilizado - posible ataque replay" };
      }

      // 4. Reconstruir payload exacto
      const payloadReconstruido = {
        ...datosRecibidos,
        timestamp: parseInt(timestamp),
        nonce: datosRecibidos.nonce,
        origen: 'frontend'
      };

      // 5. Recalcular hash
      const stringPayload = this._ordenarYStringify(payloadReconstruido);
      const hashCalculado = crypto
        .createHmac('sha256', this.claveSecreta)
        .update(stringPayload)
        .digest('hex');

      // 6. Comparación timing-safe
      const sonIguales = crypto.timingSafeEqual(
        Buffer.from(hashCalculado, 'hex'),
        Buffer.from(hashRecibido, 'hex')
      );

      // 7. Si la validación es exitosa, registrar el nonce como usado (NUEVO)
      if (sonIguales) {
        this.noncesUsados.set(datosRecibidos.nonce, Date.now());
      }

      return {
        valido: sonIguales,
        error: sonIguales ? null : "Hash inválido - datos manipulados",
        payload: payloadReconstruido
      };

    } catch (error) {
      return { valido: false, error: "Error en validación: " + error.message };
    }
  }

  /**
   * Limpia nonces expirados para evitar crecimiento infinito de la memoria
   * @private
   */
  limpiarNoncesExpirados() {
    const ahora = Date.now();
    const tiempoMaximoRetencion = this.tiempoExpiracion * 2; // 60 segundos
    
    for (let [nonce, timestamp] of this.noncesUsados.entries()) {
      if (ahora - timestamp > tiempoMaximoRetencion) {
        this.noncesUsados.delete(nonce);
      }
    }
  }

  /**
   * Destructor para limpiar el intervalo
   */
  destruir() {
    if (this.limpiarInterval) {
      clearInterval(this.limpiarInterval);
    }
  }

  /**
   * Middleware para Express - Protege endpoints
   */
  middlewareProteccion() {
    return (req, res, next) => {
      const hashHeader = req.headers['x-hash-seguridad'];
      const timestampHeader = req.headers['x-timestamp'];
      const nonceHeader = req.headers['x-nonce'];

      // Solo aplicar a métodos que modifican datos
      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        if (!hashHeader || !timestampHeader || !nonceHeader) {
          return res.status(401).json({
            error: "Headers de seguridad requeridos",
            requeridos: ['x-hash-seguridad', 'x-timestamp', 'x-nonce']
          });
        }

        const datosParaValidar = {
          ...req.body,
          timestamp: parseInt(timestampHeader),
          nonce: nonceHeader
        };

        const validacion = this.validarHashFrontend(datosParaValidar, hashHeader);
        
        if (!validacion.valido) {
          return res.status(401).json({
            error: "Solicitud rechazada por seguridad",
            detalle: validacion.error
          });
        }

        // Agregar payload validado al request para uso posterior
        req.datosValidados = validacion.payload;
      }

      next();
    };
  }

  /**
   * Ordena y convierte a string para consistencia
   * @private
   */
  _ordenarYStringify(objeto) {
    const ordenado = {};
    Object.keys(objeto).sort().forEach(key => {
      ordenado[key] = objeto[key];
    });
    return JSON.stringify(ordenado);
  }
}

module.exports = ServicioHash;