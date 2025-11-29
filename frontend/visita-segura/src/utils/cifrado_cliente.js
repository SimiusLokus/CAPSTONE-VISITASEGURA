// frontend/visita-segura/src/utils/cifrado_cliente.js

class Cifrado_cliente {
    constructor() {
        this.apiBase = this.getApiUrl();
    }

    // AGREGADO: Detectar URL correcta del backend
    getApiUrl() {
        if (
            window.location.hostname === "localhost" ||
            window.location.hostname === "127.0.0.1"
        ) {
            return "https://localhost:3001";
        }
        return `https://${window.location.hostname}:3001`;
    }

    // AGREGADO: Validar datos antes de enviar
    validarDatosQR(datosQR) {
        if (!datosQR) {
            throw new Error("Datos QR no proporcionados");
        }
        if (!datosQR.run || !datosQR.num_doc) {
            throw new Error("Datos QR incompletos: se requiere run y num_doc");
        }
        return true;
    }

    // MODIFICADO: Mejor manejo de errores y logs
    async procesarQRDesdeBackend(datosQR) {
        try {
            // AGREGADO: Validar antes de enviar
            this.validarDatosQR(datosQR);

            console.log("Enviando datos para cifrado...", {
                run: datosQR.run,
                num_doc: datosQR.num_doc?.substring(0, 5) + "***"
            });

            const response = await fetch(`${this.apiBase}/api/cifrado/procesar-qr`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ datosQR })
            });

            // MODIFICADO: Manejar errores HTTP especificos
            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch {
                    errorData = { error: `HTTP ${response.status}` };
                }
                
                console.error("Error del servidor de cifrado:", errorData);
                throw new Error(errorData.error || `Error HTTP ${response.status}`);
            }

            const resultado = await response.json();

            // AGREGADO: Validar respuesta del servidor
            if (!resultado.ok) {
                console.error("Servidor reporto error:", resultado.error);
                throw new Error(resultado.error || "Error desconocido en cifrado");
            }

            if (!resultado.datosCifrados) {
                console.error("Respuesta sin datos cifrados:", resultado);
                throw new Error("El servidor no devolvio datos cifrados");
            }

            console.log("Datos cifrados correctamente recibidos");
            
            return resultado;

        } catch (error) {
            console.error('Error critico en cifrado cliente:', error);
            
            // MODIFICADO: NO devolver fallback - propagar error
            throw new Error(`Cifrado fallo: ${error.message}`);
        }
    }

    // AGREGADO: Metodo para verificar estado del servicio
    async verificarServicio() {
        try {
            const response = await fetch(`${this.apiBase}/api/cifrado/status`);
            const data = await response.json();
            console.log("Servicio de cifrado:", data);
            return data;
        } catch (error) {
            console.error("Servicio de cifrado no disponible:", error);
            throw error;
        }
    }
}

export default Cifrado_cliente;