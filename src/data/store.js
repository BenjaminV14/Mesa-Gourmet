// Capa de datos de la app. Hoy guarda todo en el navegador (localStorage);
// cuando se conecte Supabase, estas mismas funciones leerán y escribirán en la base de datos.
import { buildSeedLocales, buildSeedReviews, buildSeedVideos } from './seed.js';

const STORAGE_KEY = 'mg:v2:data';
const SESSION_KEY = 'mg:v2:session';

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
        moderation: []
    };
}

export const db = readJson(STORAGE_KEY) || freshData();

export function persist() {
    writeJson(STORAGE_KEY, db);
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

// =================== CONSULTAS ===================

export function getLocal(id) {
    return db.locales.find(l => l.id === id) || null;
}

export function reviewsOfLocal(localId) {
    return db.reviews.filter(r => r.localId === localId && r.estado !== 'rechazada');
}

export function publishedReviews() {
    return db.reviews.filter(r => r.estado !== 'rechazada' && r.estado !== 'pendiente');
}

export function approvedVideos() {
    return db.videos.filter(v => v.estado === 'aprobado');
}

// Recalcula las notas del local a partir de sus reseñas publicadas
export function recomputeLocalScores(localId) {
    const local = getLocal(localId);
    const reviews = reviewsOfLocal(localId).filter(r => r.estado === 'publicada');
    if (!local || reviews.length === 0) return;
    const avgC = reviews.reduce((s, r) => s + r.notaComida, 0) / reviews.length;
    const avgS = reviews.reduce((s, r) => s + r.notaServicio, 0) / reviews.length;
    local.notaComida = Number(avgC.toFixed(1));
    local.notaServicio = Number(avgS.toFixed(1));
    local.notaMG = Number(((avgC + avgS) / 2).toFixed(1));
}

export function addReport(report) {
    db.reports.unshift({ id: `rep-${Date.now()}`, fecha: new Date().toISOString(), estado: 'abierto', ...report });
    persist();
}
