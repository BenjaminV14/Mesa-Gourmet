// Buscador: entiende plurales, tildes, errores de tipeo ("pisa" -> pizza), sinónimos y nombres de platos.
// Los locales patrocinados que coinciden aparecen primero.
import { db } from '../data/store.js';
import { normalize, tokenize, matchWord } from '../utils/text.js';
import { isSponsored, distanceTo } from './sponsors.js';

// Frases que se tratan como una sola palabra
const FRASES = {
    'comida rapida': 'comidarapida',
    'hot dog': 'completo',
    'sin gluten': 'singluten',
    'sin lactosa': 'sinlactosa',
    'pet friendly': 'mascota',
    'aire acondicionado': 'aire'
};

// Palabras equivalentes: buscar la clave también busca sus alternativas
const SINONIMOS = {
    completo: ['completo', 'hotdog', 'italiano', 'dinamico'],
    hamburguesa: ['hamburguesa', 'burger'],
    burger: ['hamburguesa', 'burger'],
    chela: ['cerveza'],
    birra: ['cerveza'],
    cerveza: ['cerveza', 'schop', 'chop'],
    trago: ['pisco', 'coctel', 'cerveza', 'trago', 'sour'],
    sushi: ['sushi', 'roll', 'maki', 'nigiri', 'japonesa'],
    roll: ['roll', 'sushi'],
    cafe: ['cafe', 'cafeteria', 'latte', 'espresso', 'cappuccino', 'americano'],
    cafeteria: ['cafe', 'cafeteria'],
    once: ['cafe', 'cafeteria', 'sandwich', 'pastel'],
    restaurante: ['restaurante', 'restaurant'],
    restaurant: ['restaurante', 'restaurant'],
    comidarapida: ['comidarapida', 'rapida', 'completo', 'empanada', 'hamburguesa'],
    papa: ['papa', 'papas', 'fritas', 'chorrillana'],
    mariscos: ['marisco', 'camaron', 'ceviche', 'jalea'],
    pescado: ['pescado', 'ceviche', 'salmon', 'reineta'],
    carne: ['carne', 'lomo', 'asado', 'cordero', 'filete'],
    peruano: ['peruano', 'peruana', 'ceviche', 'lomo saltado'],
    japones: ['japones', 'japonesa', 'sushi', 'ramen'],
    delivery: ['delivery', 'despacho', 'reparto'],
    wifi: ['wifi'],
    mascota: ['mascota', 'mascotas'],
    estacionamiento: ['estacionamiento', 'parking'],
    postre: ['postre', 'torta', 'helado', 'suspiro', 'tres leches'],
    sanguche: ['sandwich', 'sanguche', 'churrasco', 'barros'],
    sandwich: ['sandwich', 'sanguche', 'churrasco', 'barros']
};

// Términos que se resuelven con el puntaje dietético del local (0 a 5)
const DIETA = { vegano: 'vegano', vegana: 'vegano', vegetariano: 'vegetariano', vegetariana: 'vegetariano', celiaco: 'sinGluten', singluten: 'sinGluten', sinlactosa: 'sinLactosa' };

function prepareQuery(raw) {
    let q = normalize(raw);
    for (const [frase, token] of Object.entries(FRASES)) q = q.replace(new RegExp(`\\b${frase}\\b`, 'g'), token);
    return q.split(' ').filter(t => t && !['de', 'la', 'el', 'los', 'las', 'con', 'en', 'y', 'un', 'una'].includes(t));
}

function alternatives(token) {
    for (const [key, alts] of Object.entries(SINONIMOS)) {
        if (matchWord(token, key) >= 0.75) return [token, ...alts.flatMap(a => tokenize(a))];
    }
    return [token];
}

// Mejor coincidencia de un término dentro de una lista de palabras
function bestMatch(alts, words) {
    let best = { quality: 0, word: null };
    for (const alt of alts) {
        for (const word of words) {
            const quality = matchWord(alt, word) * (alt === alts[0] ? 1 : 0.9);
            if (quality > best.quality) best = { quality, word };
        }
    }
    return best;
}

function localFields(local) {
    return {
        nombre: tokenize(local.nombre),
        tipo: tokenize(`${local.tipo} ${(local.etiquetas || []).join(' ')}`),
        caracteristicas: tokenize((local.caracteristicas || []).join(' ')),
        platos: (local.menu || []).filter(m => m.nombre).map(item => ({ item, words: tokenize(`${item.nombre} ${item.categoria || ''}`) }))
    };
}

const PESOS = { nombre: 10, plato: 8, tipo: 6, caracteristicas: 4 };

/**
 * Busca en locales y platos.
 * Devuelve { locales: [{ local, score, platos }], platos: [{ local, item, score }], correcciones: Map }
 */
export function search(raw, dietary = {}) {
    const tokens = prepareQuery(raw);
    const correcciones = new Map();
    const localesResult = [];
    const platosResult = [];

    const candidatos = db.locales.filter(local =>
        !(dietary.vegano && (local.vegano || 0) < 3) &&
        !(dietary.celiaco && (local.sinGluten || 0) < 3) &&
        !(dietary.sinLactosa && (local.sinLactosa || 0) < 3));

    if (!tokens.length) {
        candidatos.forEach(local => localesResult.push({ local, score: 0, platos: [] }));
    }

    // Primera pasada: mejor coincidencia de cada término en cada local
    const analisis = tokens.length ? candidatos.map(local => {
        const fields = localFields(local);
        const porToken = tokens.map(token => {
            const dietKey = DIETA[token];
            if (dietKey && (local[dietKey] || 0) >= 3) return { quality: 1, peso: 5, word: token };
            const alts = alternatives(token);
            const candidates = [
                { peso: PESOS.nombre, ...bestMatch(alts, fields.nombre) },
                { peso: PESOS.tipo, ...bestMatch(alts, fields.tipo) },
                { peso: PESOS.caracteristicas, ...bestMatch(alts, fields.caracteristicas) },
                ...fields.platos.map(p => ({ peso: PESOS.plato, ...bestMatch(alts, p.words) }))
            ];
            return candidates.reduce((a, b) => (b.quality * b.peso > a.quality * a.peso ? b : a));
        });
        return { local, fields, porToken };
    }) : [];

    // Si un término coincide bien en algún local, se descartan sus coincidencias "con error" en los demás
    // (así "completo" no trae locales con "Seguridad Completa")
    const minimoPorToken = tokens.map((_, i) => {
        const mejor = Math.max(0, ...analisis.map(a => a.porToken[i].quality));
        return mejor >= 0.85 ? 0.75 : 0.01;
    });

    for (const { local, fields, porToken } of analisis) {
        if (porToken.some((m, i) => m.quality < minimoPorToken[i])) continue;
        let score = 0;
        porToken.forEach((m, i) => {
            if (m.quality <= 0.75 && m.word && m.word !== tokens[i]) correcciones.set(tokens[i], m.word);
            score += m.quality * m.peso;
        });

        // Platos donde coinciden todos los términos
        const platos = fields.platos
            .map(p => {
                let s = 0;
                for (let i = 0; i < tokens.length; i++) {
                    const m = bestMatch(alternatives(tokens[i]), p.words);
                    if (m.quality < minimoPorToken[i]) return null;
                    s += m.quality;
                }
                return { local, item: p.item, score: s };
            })
            .filter(Boolean);

        platosResult.push(...platos);
        localesResult.push({ local, score, platos: platos.map(p => p.item) });
    }

    const byPriority = (a, b) =>
        (isSponsored(b.local) - isSponsored(a.local)) ||
        (b.score - a.score) ||
        (distanceTo(a.local) - distanceTo(b.local));

    localesResult.sort(tokens.length ? byPriority : (a, b) =>
        (isSponsored(b.local) - isSponsored(a.local)) || (distanceTo(a.local) - distanceTo(b.local)));
    platosResult.sort((a, b) => byPriority(a, b) || ((b.item.likes || 0) - (a.item.likes || 0)));

    return { locales: localesResult, platos: platosResult, correcciones, tokens };
}
