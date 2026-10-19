// Herramientas de texto para el buscador: normalizar, singularizar y comparar con tolerancia a errores.

export function normalize(text) {
    return String(text || '')
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/ñ/g, 'n')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

export function tokenize(text) {
    return normalize(text).split(' ').filter(Boolean);
}

// "restaurantes" -> "restaurant", "empanadas" -> "empanada", "rolls" -> "roll"
export function singular(word) {
    if (word.length > 4 && word.endsWith('es') && !/[aeiou]es$/.test(word)) return word.slice(0, -2);
    if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
    return word;
}

// Clave fonética aproximada para el español de Chile: "pisa" y "pizza" quedan iguales
export function phonetic(word) {
    return word
        .replace(/ch/g, '#')
        .replace(/h/g, '')
        .replace(/#/g, 'ch')
        .replace(/qu/g, 'k')
        .replace(/c([ei])/g, 's$1')
        .replace(/c/g, 'k')
        .replace(/z/g, 's')
        .replace(/x/g, 'ks')
        .replace(/v/g, 'b')
        .replace(/ll/g, 'y')
        .replace(/gu([ei])/g, 'g$1')
        .replace(/(.)\1+/g, '$1');
}

// Distancia de edición, contando como un solo error dos letras vecinas invertidas ("piazz")
export function levenshtein(a, b) {
    if (a === b) return 0;
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
            }
        }
    }
    return d[a.length][b.length];
}

function maxErrors(length) {
    if (length <= 3) return 0;
    if (length <= 6) return 1;
    return 2;
}

/**
 * Compara una palabra buscada con una palabra del contenido.
 * Devuelve la calidad de la coincidencia: 1 exacta, 0.85 prefijo/plural, 0.6 con error de tipeo, 0 sin coincidencia.
 */
export function matchWord(query, word) {
    if (!query || !word) return 0;
    if (word === query) return 1;
    const qs = singular(query);
    const ws = singular(word);
    if (qs === ws) return 0.95;
    if (query.length >= 3 && (word.startsWith(query) || ws.startsWith(qs))) return 0.85;

    const qp = phonetic(qs);
    const wp = phonetic(ws);
    if (qp === wp) return 0.75;
    const allowed = maxErrors(qp.length);
    if (allowed > 0 && Math.abs(qp.length - wp.length) <= allowed && levenshtein(qp, wp) <= allowed) return 0.6;
    // Palabra a medio escribir con un error ("hamburgu" vs "hamburguesa")
    if (qp.length >= 5 && wp.length > qp.length && levenshtein(qp, wp.slice(0, qp.length)) <= 1) return 0.5;
    return 0;
}
