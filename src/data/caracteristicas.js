// Nombres de las características. Antes algunas traían el detalle entre paréntesis
// ("Apto para Fumadores (Solo en Terraza)", "Mascotas (Solo en Terraza)"); ahora el nombre va solo
// y el detalle ("Solo en la terraza") se escribe aparte, en caracteristicasDetalle.
const RENOMBRES = {
    'Mascotas (Solo en Terraza)': ['Ingreso de Mascotas', 'Solo en la terraza'],
    'Apto para Fumadores (Solo en Terraza)': ['Apto para Fumadores', 'Solo en la terraza'],
    // "Delivery" a secas venía de la pregunta por las apps (PedidosYa, Uber Eats...)
    'Delivery': ['Delivery por apps']
};

// Ya no se usan: "Apto para menores de edad" es lo normal (ahora se marca lo contrario, "Solo mayores de 18")
const RETIRADAS = ['Apto para menores de edad'];

/** Corrige los nombres antiguos de un local (sin perder el detalle) y quita detalles huérfanos */
export function normalizarCaracteristicas(local) {
    const detalle = { ...(local.caracteristicasDetalle || {}) };
    const lista = [];
    const tiene = c => (local.caracteristicas || []).includes(c);
    for (const c of local.caracteristicas || []) {
        if (RETIRADAS.includes(c)) continue;
        // "Barra" era ambiguo (a veces un mesón): solo es barra de tragos si el local vende alcohol
        const nuevo = c === 'Barra'
            ? (tiene('Venta de Alcohol') && !/mes[oó]n/i.test(detalle.Barra || '') ? ['Barra de tragos'] : null)
            : RENOMBRES[c];
        if (c === 'Barra' && !nuevo) continue;
        if (nuevo) {
            const [nombre, texto] = nuevo;
            if (!detalle[nombre] && (detalle[c] || texto)) detalle[nombre] = detalle[c] || texto;
            if (!lista.includes(nombre)) lista.push(nombre);
        } else if (!lista.includes(c)) {
            lista.push(c);
        }
    }
    // Un detalle sin su característica (o vacío) no se muestra en ninguna parte: se borra
    Object.keys(detalle).forEach(k => { if (!detalle[k] || !lista.includes(k)) delete detalle[k]; });
    local.caracteristicas = lista;
    local.caracteristicasDetalle = detalle;
    return local;
}
