// Estado de la interfaz compartido entre pantallas
import { loadSession } from './data/store.js';

// Centro de Talca: se usa mientras el usuario no comparte su ubicación
export const TALCA_CENTER = { lat: -35.4264, lng: -71.6554 };

export const state = {
    user: loadSession(),          // { id, nombre, email, favoritos: [], ... } o null
    isGuest: false,
    currentView: 'inicio',
    query: '',
    dietary: { vegano: false, celiaco: false, sinLactosa: false },
    userLocation: { ...TALCA_CENTER },
    hasRealLocation: false,
    currentLocalId: null,
    randomCount: 0
};

export function isLoggedIn() {
    return !state.isGuest && !!state.user;
}
