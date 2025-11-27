// frontend/visita-segura/src/utils/cifrado_cliente.js

/**
 * Cliente de cifrado para el frontend
 * Delega el cifrado al backend para mayor seguridad
 */
class Cifrado_cliente {
    constructor() {
        // Detectar si estamos en localhost o en producción
        this.apiBase = this._getApiUrl();
    }

    /**
     * Obtener URL base de la API según el entorno
     * @private
     */
    _getApiUrl() {
        if (
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
        ) {
            return "https://localhost:3001";
        }
        return `https://${window.location.hostname}:3001`;
    }

    /**
     * Procesa y cifra datos del QR escaneado mediante el backend
     * @param {Object} datosQR - Datos extraídos del QR
     * @returns {Promise<Object>} Resultado del cifrado
     */
    async procesarQRDesdeBackend(datosQR) {
        try {
            console.log("Enviando datos al backend para cifrado...");
            console.log("Datos a cifrar:", {
                run: datosQR.run?.substring(0, 4) + "***",
                num_doc: datosQR.num_doc?.substring(0, 4) + "***",
                nombres: datosQR.nombres,
                apellidos: datosQR.apellidos
            });

            const response = await fetch(`${this.apiBase}/api/cifrado/procesar-qr`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ datosQR })
            });

            // Verificar respuesta HTTP
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}: Error del servidor`);
            }

            const resultado = await response.json();

            // Verificar que el cifrado fue exitoso
            if (!resultado.ok) {
                throw new Error(resultado.error || "Cifrado falló sin mensaje específico");
            }

            console.log("Cifrado exitoso desde backend");
            console.log("Tamaño datos cifrados:", resultado.datosCifrados?.length || 0, "caracteres");

            return {
                ok: true,
                datosCifrados: resultado.datosCifrados,
                datosOriginales: datosQR,
                metadata: resultado.metadata || {}
            };

        } catch (error) {
            console.error("Error en cifrado:", error.message);
            console.error("Stack:", error.stack);
            
            // FALLBACK CRÍTICO: Si el cifrado falla, devolver datos sin cifrar
            // Esto permite que el sistema siga funcionando aunque con menor seguridad
            console.warn("FALLBACK: Continuando sin cifrado");
            
            return {
                ok: false,
                datosCifrados: null,  // NULL indica que no hay cifrado
                datosOriginales: datosQR,
                error: error.message,
                fallback: true
            };
        }
    }

    /**
     * Verifica el estado del servicio de cifrado
     * @returns {Promise<Object>} Estado del servicio
     */
    async verificarServicio() {
        try {
            const response = await fetch(`${this.apiBase}/api/cifrado/status`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const estado = await response.json();
            console.log("Estado del servicio de cifrado:", estado);
            
            return {
                ok: true,
                estado: estado
            };

        } catch (error) {
            console.error("Error verificando servicio de cifrado:", error);
            return {
                ok: false,
                error: error.message
            };
        }
    }

    /**
     * Test del servicio de cifrado con datos de prueba
     * @returns {Promise<Object>} Resultado del test
     */
    async testCifrado() {
        try {
            const datosPrueba = {
                test: "cifrado_funcional",
                timestamp: Date.now(),
                run: "12345678-9",
                num_doc: "123456789"
            };

            console.log("Iniciando test de cifrado...");

            const response = await fetch(`${this.apiBase}/api/cifrado/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ datos: datosPrueba })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const resultado = await response.json();
            
            if (resultado.ok && resultado.resultado === "exitoso") {
                console.log("Test de cifrado exitoso");
            } else {
                console.warn("Test de cifrado falló");
            }

            return resultado;

        } catch (error) {
            console.error("Error en test de cifrado:", error);
            return {
                ok: false,
                error: error.message
            };
        }
    }

    /**
     * Descifra datos previamente cifrados (para consultas admin)
     * @param {string} datosCifrados - String cifrado
     * @returns {Promise<Object>} Datos descifrados
     */
    async descifrarDatos(datosCifrados) {
        try {
            const response = await fetch(`${this.apiBase}/api/cifrado/descifrar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ datosCifrados })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const resultado = await response.json();
            
            if (!resultado.ok) {
                throw new Error(resultado.error || "Error descifrando");
            }

            return {
                ok: true,
                datosDescifrados: resultado.datosDescifrados
            };

        } catch (error) {
            console.error("Error descifrando datos:", error);
            return {
                ok: false,
                error: error.message
            };
        }
    }
}

export default Cifrado_cliente;