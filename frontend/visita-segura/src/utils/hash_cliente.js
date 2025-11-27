// frontend/visita-segura/src/utils/hash_cliente.js

/**
 * Cliente de seguridad para el frontend
 * Compatible con React y jsQR
 */
class Hash_cliente {
  constructor() {
    this.apiBase = 'https://localhost:3001';
  }

  /**
   * Prepara solicitud segura para el backend
   * @param {Object} datos - Datos a enviar
   * @returns {Object} Headers y body preparados
   */
  async prepararSolicitudSegura(datos) {
    try {
      const timestamp = Date.now();
      const nonce = this._generarNonce();
      
      const payload = {
        ...datos,
        timestamp,
        nonce
      };

      // El backend calculará el hash con la clave secreta
      // Frontend solo envía datos + nonce + timestamp
      
      return {
        headers: {
          'Content-Type': 'application/json',
          'x-timestamp': timestamp.toString(),
          'x-nonce': nonce,
          // Nota: El hash se calcula en el backend para mayor seguridad
        },
        body: JSON.stringify(payload)
      };

    } catch (error) {
      console.error('Error preparando solicitud segura:', error);
      throw error;
    }
  }

  /**
   * Envía solicitud segura al backend
   * @param {String} endpoint - Endpoint destino
   * @param {Object} datos - Datos a enviar
   * @param {String} method - Método HTTP
   */
  async enviarSolicitudSegura(endpoint, datos, method = 'POST') {
    try {
      const solicitud = await this.prepararSolicitudSegura(datos);
      
      const response = await fetch(`${this.apiBase}${endpoint}`, {
        method: method,
        headers: solicitud.headers,
        body: solicitud.body
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error en solicitud');
      }

      return await response.json();

    } catch (error) {
      console.error('Error en solicitud segura:', error);
      throw error;
    }
  }

  _generarNonce() {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }
}

export default Hash_cliente;