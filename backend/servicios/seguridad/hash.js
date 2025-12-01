// servicios/seguridad/hash.js - VERSIÓN COMPLETA CORREGIDA
const crypto = require("crypto");

class ServicioHash {
  constructor() {
    this.claveSecreta = process.env.HASH_SECRET || "clave-secreta-visitasegura-2025";

    console.log('[SECURITY INIT] Clave secreta cargada:', this.claveSecreta);
    console.log('[SECURITY INIT] Longitud de clave:', this.claveSecreta.length);
    console.log('[SECURITY INIT] ¿Usando variable de entorno?:', !!process.env.HASH_SECRET);

    this.tiempoExpiracion = 30000; // 30 segundos
    this.noncesUsados = new Map();
    this.limpiarInterval = setInterval(() => this.limpiarNoncesExpirados(), 60000);
  }

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

  validarHashFrontend(datosRecibidos, hashRecibido, reqMethod = 'POST') {
    try {
      console.log('[SECURITY DEBUG] === INICIO VALIDACIÓN HASH ===');
      
      if (!datosRecibidos || typeof datosRecibidos !== 'object') {
        return { valido: false, error: "Datos de solicitud inválidos" };
      }

      // DEBUG: Mostrar exactamente qué datos llegan
      console.log('[SECURITY DEBUG] Datos recibidos CRUDOS:', JSON.stringify(datosRecibidos));

      if (!['POST', 'PUT', 'DELETE'].includes(reqMethod)) {
        return { valido: true, error: null };
      }

      if (!hashRecibido || !datosRecibidos.timestamp || !datosRecibidos.nonce) {
        return { valido: false, error: "Headers de seguridad requeridos" };
      }

      const timestamp = parseInt(datosRecibidos.timestamp);
      if (isNaN(timestamp)) {
        return { valido: false, error: "Timestamp inválido" };
      }
      
      if (Date.now() - timestamp > this.tiempoExpiracion) {
        return { valido: false, error: "Solicitud expirada" };
      }

      if (timestamp > Date.now() + 5000) {
        return { valido: false, error: "Timestamp del futuro" };
      }

      if (!datosRecibidos.nonce || datosRecibidos.nonce.length < 10) {
        return { valido: false, error: "Nonce inválido" };
      }

      if (this.noncesUsados.has(datosRecibidos.nonce)) {
        return { valido: false, error: "Nonce ya utilizado" };
      }

      // Crear payload EXACTAMENTE igual al frontend
      const payloadReconstruido = {
        accion: datosRecibidos.accion,
        datosCifrados: datosRecibidos.datosCifrados,
        tipo_evento: datosRecibidos.tipo_evento,
        timestamp: timestamp,
        nonce: datosRecibidos.nonce,
        origen: 'frontend'
      };

      const stringPayload = this._ordenarYStringify(payloadReconstruido);
      
      console.log('[SECURITY DEBUG] Payload para hash:', stringPayload);

      const hashCalculado = crypto
        .createHmac('sha256', this.claveSecreta)
        .update(stringPayload)
        .digest('hex');

      console.log('[SECURITY DEBUG] Hash comparison:', {
        calculado: hashCalculado,
        recibido: hashRecibido,
        sonIguales: hashCalculado === hashRecibido
      });

      let sonIguales = false;
      try {
        sonIguales = crypto.timingSafeEqual(
          Buffer.from(hashCalculado, 'hex'),
          Buffer.from(hashRecibido, 'hex')
        );
      } catch (e) {
        return { valido: false, error: "Hash inválido - formato incorrecto" };
      }

      if (sonIguales) {
        this.noncesUsados.set(datosRecibidos.nonce, Date.now());
        console.log('[SECURITY DEBUG] ✅ VALIDACIÓN EXITOSA');
        return {
          valido: true,
          error: null,
          payload: payloadReconstruido
        };
      } else {
        console.log('[SECURITY DEBUG] ❌ HASH NO COINCIDE');
        
        // DEBUG DETALLADO para identificar la diferencia
        console.log('[SECURITY DEBUG] ANALISIS DE DIFERENCIA:');
        const payloadFromFrontend = '{"accion":"entrada","datosCifrados":"test_cifrado_data_123","nonce":"d5680ec8b377da6b904760fc49f4f658","origen":"frontend","timestamp":1764546879251,"tipo_evento":"Visita"}';
        console.log('Frontend payload:', payloadFromFrontend);
        console.log('Backend payload: ', stringPayload);
        console.log('¿Son iguales?:', payloadFromFrontend === stringPayload);
        
        return {
          valido: false,
          error: "Hash inválido - datos manipulados",
          payload: null
        };
      }

    } catch (error) {
      console.error('[SECURITY ERROR] Error en validación:', error);
      return { 
        valido: false, 
        error: "Error interno en validación de seguridad" 
      };
    }
  }

  _ordenarYStringify(objeto) {
    if (!objeto || typeof objeto !== 'object') {
      console.error('[SECURITY ERROR] Objeto inválido para ordenar:', objeto);
      return JSON.stringify({});
    }
    
    const ordenado = {};
    Object.keys(objeto).sort().forEach(key => {
      if (objeto[key] !== undefined && objeto[key] !== null) {
        // CORRECCIÓN CRÍTICA: No modificar los valores, mantenerlos exactamente como vienen
        ordenado[key] = objeto[key];
      }
    });
    
    // CORRECCIÓN: Usar JSON.stringify sin modificar espacios
    return JSON.stringify(ordenado);
  }

  limpiarNoncesExpirados() {
    const ahora = Date.now();
    const tiempoMaximoRetencion = this.tiempoExpiracion * 2;
    
    for (let [nonce, timestamp] of this.noncesUsados.entries()) {
      if (ahora - timestamp > tiempoMaximoRetencion) {
        this.noncesUsados.delete(nonce);
      }
    }
  }

  middlewareProteccion() {
    return (req, res, next) => {
      const hashHeader = req.headers['x-hash-seguridad'];
      const timestampHeader = req.headers['x-timestamp'];
      const nonceHeader = req.headers['x-nonce'];

      if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
        console.log(`[SECURITY] Validando seguridad para: ${req.method} ${req.path}`);
        
        if (!hashHeader || !timestampHeader || !nonceHeader) {
          console.log('[SECURITY] Faltan headers de seguridad');
          return res.status(401).json({
            error: "Headers de seguridad requeridos",
            requeridos: ['x-hash-seguridad', 'x-timestamp', 'x-nonce']
          });
        }

        try {
          // Asegurar que req.body existe
          const bodyData = req.body || {};
          
          const datosParaValidar = {
            ...bodyData,
            timestamp: timestampHeader,
            nonce: nonceHeader
          };

          console.log('[SECURITY DEBUG] Datos completos para validación:', {
            bodyKeys: Object.keys(bodyData),
            timestamp: timestampHeader,
            nonce: nonceHeader
          });

          const validacion = this.validarHashFrontend(datosParaValidar, hashHeader, req.method);
          
          if (!validacion.valido) {
            console.log('[SECURITY] Validación fallida:', validacion.error);
            return res.status(401).json({
              error: "Solicitud rechazada por seguridad",
              detalle: validacion.error
            });
          }

          console.log('[SECURITY] Validación exitosa');
          req.datosValidados = validacion.payload;
          
        } catch (error) {
          // Manejar errores en el middleware
          console.error('[SECURITY ERROR] Error en middleware:', error);
          return res.status(500).json({
            error: "Error interno del servidor en validación de seguridad"
          });
        }
      }

      next();
    };
  }

  destruir() {
    if (this.limpiarInterval) {
      clearInterval(this.limpiarInterval);
    }
  }
}

module.exports = ServicioHash;