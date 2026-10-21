// Nombres de las características. Antes algunas traían el detalle entre paréntesis
// ("Apto para Fumadores (Solo en Terraza)", "Mascotas (Solo en Terraza)"); ahora el nombre va solo
// y el detalle ("Solo en la terraza") se escribe aparte, en caracteristicasDetalle.
const RENOMBRES = {
    'Mascotas (Solo en Terraza)': ['Ingreso de Mascotas', 'Solo en la terraza'],
    'Apto para Fumadores (Solo en Terraza)': ['Apto para Fumadores', 'Solo en la terraza']
};

/** Corrige los nombres antiguos de un local (sin perder el detalle) */
export function normalizarCaracteristicas(local) {
    const detalle = { ...(local.caracteristicasDetalle || {}) };
    const lista = [];
    for (const c of local.caracteristicas || []) {
        const nuevo = RENOMBRES[c];
        if (nuevo) {
            const [nombre, texto] = nuevo;
            if (!detalle[nombre]) detalle[nombre] = detalle[c] || texto;
            delete detalle[c];
            if (!lista.includes(nombre)) lista.push(nombre);
        } else if (!lista.includes(c)) {
            lista.push(c);
        }
    }
    local.caracteristicas = lista;
    local.caracteristicasDetalle = detalle;
    return local;
}
