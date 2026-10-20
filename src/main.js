// Punto de entrada de la app Mesa Gourmet
import './style.css';
import './app.css';
import './desktop.css';
import { state } from './state.js';
import { initAuth } from './features/auth.js';
import { setupNavigation, switchTab, updateHeader } from './features/navigation.js';
import { refreshLocalDetail, hideLocalDetail } from './features/detalle.js';
import { refreshResenas } from './features/resenas.js';
import { setReviewPublishedHandler } from './features/review-form.js';
import { showWelcomeIfNeeded } from './features/perfil.js';
import { renderResults } from './features/inicio.js';
import { track } from './services/analytics.js';
import { setupPwa } from './services/pwa.js';

function requestLocation() {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
        state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.hasRealLocation = true;
        if (state.currentView === 'inicio') renderResults();
    }, () => { /* sin permiso: se usa el centro de Talca */ }, { maximumAge: 300000, timeout: 10000 });
}

function enterApp({ withSplash = true } = {}) {
    document.getElementById('registerScreen').classList.add('hidden');
    const show = () => {
        document.getElementById('mainHeader').classList.remove('hidden');
        document.getElementById('mainContent').classList.remove('hidden');
        document.getElementById('bottomNav').classList.remove('hidden');
        updateHeader();
        // Las necesidades alimentarias guardadas en el perfil se aplican como filtro
        if (state.user && !state.isGuest && state.user.preferencias?.dietas?.length) state.filtros.dietas = [...state.user.preferencias.dietas];
        setupNavigation();
        switchTab('inicio');
        requestLocation();
        setTimeout(showWelcomeIfNeeded, 600);
    };
    if (!withSplash) return show();

    const splash = document.getElementById('splashScreen');
    splash.classList.remove('hidden');
    splash.style.opacity = '1';
    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.classList.add('hidden');
            show();
        }, 400);
    }, 1200);
}

setReviewPublishedHandler(() => {
    refreshLocalDetail();
    if (state.currentView === 'resenas') refreshResenas();
});

initAuth({ onEnter: () => enterApp() });
setupPwa();

// Escape cierra la ficha del local (útil en computador)
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('detailView').classList.contains('hidden') && !document.querySelector('.sheet-overlay, #reviewModal')) {
        hideLocalDetail();
    }
});
track('app_abierta');

// Sesión guardada: entra directo sin pedir login otra vez
if (state.user) enterApp({ withSplash: false });
