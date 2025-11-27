class Cifrado_cliente {
    constructor() {
        this.apiBase = 'https://localhost:3001';
    }

    async procesarQRDesdeBackend(datosQR) {
        try {
            const response = await fetch(`${this.apiBase}/api/cifrado/procesar-qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ datosQR })
            });

            if (!response.ok) throw new Error('Error del servidor');
            return await response.json();

        } catch (error) {
            console.error('Error en cifrado:', error);
            // FALLBACK CRÍTICO: Si falla el cifrado, devolver datos normales
            return {
                ok: true,
                datosCifrados: null,  // ← null indica que no hay cifrado
                datosOriginales: datosQR
            };
        }
    }
}

export default Cifrado_cliente;