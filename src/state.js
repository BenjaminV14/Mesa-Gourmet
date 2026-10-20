// Estado de la interfaz compartido entre pantallas
import { loadSession } from './data/store.js';

// Centro de Talca: se usa mientras el usuario no comparte su ubicación
export const TALCA_CENTER = { lat: -35.4264, lng: -71.6554 };

// Completa los campos nuevos en cuentas guardadas con versiones anteriores
export function normalizeUser(u) {
    if (!u) return null;
    const base = String(u.email || u.nombre || 'usuario').split('@')[0];
    return {
        favoritos: [],
        quieroIr: [],
        siguiendo: [],
        guardados: { resenas: [], videos: [] },
        preferencias: { notificaciones: true, mostrarEnRanking: true, perfilPublico: true },
        ...u,
        username: u.username || base.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_.]/g, '').slice(0, 24) || 'usuario'
    };
}

export const FILTROS_VACIOS = () => ({
    dietas: [],            // vegano, vegetariano, sinGluten, sinLactosa
    abiertoAhora: false,
    caracteristicas: [],   // nombres de características
    tipos: [],             // ids de categorías de comida
    distanciaMax: 0,       // km (0 = sin límite)
    notaMin: 0,
    soloDestacados: false
});

export const state = {
    user: normalizeUser(loadSession()),   // { id, nombre, username, email, favoritos, quieroIr, siguiendo, guardados } o null
    isGuest: false,
    currentView: 'inicio',
    query: '',
    filtros: FILTROS_VACIOS(),
    modoInicio: 'recomendados',   // 'recomendados' | 'cerca'
    userLocation: { ...TALCA_CENTER },
    hasRealLocation: false,
    currentLocalId: null,
    randomCount: 0
};

export function isLoggedIn() {
    return !state.isGuest && !!state.user;
}
