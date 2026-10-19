// Patrocinios pagados por los locales (plan "Destacado mensual").
// Un local patrocinado sale primero en listas y búsquedas, con estrella en el mapa,
// y aparece en 1 de cada 3 recomendaciones aleatorias. Se apaga solo al pasar la fecha "hasta".
import { db } from '../data/store.js';
import { state } from '../state.js';
import { todayIso } from '../utils/time.js';
import { distanceKm } from '../utils/geo.js';

export const PRECIO_PATROCINIO = 29990;

export function isSponsored(local, date = new Date()) {
    const p = local.patrocinio;
    if (!p || !p.desde || !p.hasta) return false;
    const hoy = todayIso(date);
    return p.desde <= hoy && hoy <= p.hasta;
}

export function diasRestantesPatrocinio(local, date = new Date()) {
    if (!isSponsored(local, date)) return 0;
    const fin = new Date(`${local.patrocinio.hasta}T23:59:59`);
    return Math.max(0, Math.ceil((fin - date) / 86400000));
}

export function distanceTo(local) {
    return distanceKm(state.userLocation, { lat: local.lat, lng: local.lng });
}

// Patrocinados primero (los más cercanos antes); el resto mantiene su orden
export function sponsoredFirst(locales) {
    const sponsored = locales.filter(l => isSponsored(l)).sort((a, b) => distanceTo(a) - distanceTo(b));
    const rest = locales.filter(l => !isSponsored(l));
    return [...sponsored, ...rest];
}

// Elige un local al azar dando más probabilidad a los cercanos
function pickNearby(candidates, excludeId) {
    const pool = candidates.filter(l => l.id !== excludeId);
    const list = pool.length ? pool : candidates;
    if (!list.length) return null;
    const weights = list.map(l => 1 / (0.5 + distanceTo(l)));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = Math.random() * total;
    for (let i = 0; i < list.length; i++) {
        r -= weights[i];
        if (r <= 0) return list[i];
    }
    return list[list.length - 1];
}

let lastRandomId = null;

// Recomendación aleatoria: cada tercera vez muestra un local patrocinado cercano
export function pickRandomLocal() {
    state.randomCount++;
    const sponsored = db.locales.filter(l => isSponsored(l));
    const useSponsored = state.randomCount % 3 === 0 && sponsored.length > 0;
    const pick = pickNearby(useSponsored ? sponsored : db.locales, lastRandomId);
    lastRandomId = pick ? pick.id : null;
    return pick;
}
