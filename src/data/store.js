// Capa de datos de la app. Hoy guarda todo en el navegador (localStorage);
// cuando se conecte Supabase, estas mismas funciones leerán y escribirán en la base de datos.
import { buildSeedLocales, buildSeedReviews, buildSeedVideos } from './seed.js';

const STORAGE_KEY = 'mg:v5:data';
const SESSION_KEY = 'mg:v2:session';
const HISTORY_KEY = 'mg:v2:busquedas';

function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeJson(key, value) {
    try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        console.warn('No se pudo guardar en el navegador:', err);
    }
}

function freshData() {
    return {
        locales: buildSeedLocales(),
        reviews: buildSeedReviews(),
        videos: buildSeedVideos(),
        reports: [],
        moderation: [],
        // Banco de preguntas de la encuesta a los dueños (se completa en el panel)
        encuesta: null,
        // Distinciones registradas al cerrar cada mes
        cierres: []
    };
}

export const db = readJson(STORAGE_KEY) || freshData();

export function persist() {
    writeJson(STORAGE_KEY, db);
}

// Si los datos cambian en otra pestaña (por ejemplo, el panel aprueba una reseña), se avisa a la app.
// Con Supabase esto se reemplaza por las suscripciones en tiempo real.
if (typeof window !== 'undefined') {
    window.addEventListener('storage', e => {
        if (e.key !== STORAGE_KEY || !e.newValue) return;
        try {
            Object.assign(db, JSON.parse(e.newValue));
            window.dispatchEvent(new CustomEvent('mg:data-changed'));
        } catch { /* datos inválidos: se ignoran */ }
    });
}

if (!readJson(STORAGE_KEY)) persist();

export function resetDemoData() {
    Object.assign(db, freshData());
    persist();
}

// =================== SESIÓN ===================

export function loadSession() {
    return readJson(SESSION_KEY);
}

export function saveSession(user) {
    writeJson(SESSION_KEY, user);
}

// Búsquedas recientes del usuario (en este dispositivo)
export function loadSearchHistory() {
    return readJson(HISTORY_KEY) || [];
}

export function pushSearchHistory(term) {
    const t = String(term || '').trim();
    if (t.length < 2) return;
    const list = loadSearchHistory().filter(x => x.toLowerCase() !== t.toLowerCase());
    list.unshift(t);
    writeJson(HISTORY_KEY, list.slice(0, 8));
}

export function clearSearchHistory() {
    writeJson(HISTORY_KEY, null);
}

// =================== CONSULTAS ===================

export function getLocal(id) {
    return db.locales.find(l => l.id === id) || null;
}

export function reviewsOfLocal(localId) {
    return db.reviews.filter(r => r.localId === localId && r.estado !== 'rechazada');
}

export function publishedReviews() {
    return db.reviews.filter(r => r.estado === 'publicada');
}

export function approvedVideos() {
    return db.videos.filter(v => v.estado === 'aprobado');
}

// Las notas se calculan al mostrar (ver metrics.js); esto solo existe por compatibilidad
export function recomputeLocalScores() {}

export function addReport(report) {
    db.reports.unshift({ id: `rep-${Date.now()}`, fecha: new Date().toISOString(), estado: 'abierto', ...report });
    persist();
}
