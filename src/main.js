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
import './features/perfil-publico.js';
import { setupPwa } from './services/pwa.js';
import { remoto, supabase, mensajeError } from './services/supabase.js';
import { cargarTodo, cargarUsuario, configurarAvisos, escucharCambios } from './data/remoto.js';
import { showToast } from './ui/feedback.js';

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
configurarAvisos(msg => showToast(`No se pudo guardar: ${msg}`, 4500));
setupPwa();

// Escape cierra la ficha del local (útil en computador)
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('detailView').classList.contains('hidden') && !document.querySelector('.sheet-overlay, #reviewModal')) {
        hideLocalDetail();
    }
});
track('app_abierta');

if (remoto) {
    iniciarEnLinea();
} else if (state.user) {
    // Sesión guardada: entra directo sin pedir login otra vez
    enterApp({ withSplash: false });
}

// En línea: se cargan los locales y reseñas desde Supabase; si ya había sesión, entra directo
async function iniciarEnLinea() {
    const aviso = document.createElement('div');
    aviso.className = 'app-cargando';
    aviso.textContent = 'Cargando locales…';
    document.body.appendChild(aviso);
    const invitado = document.querySelector('[data-action="auth-guest"]');
    invitado.disabled = true;
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            await cargarUsuario(session);
            await cargarTodo();
            enterApp({ withSplash: false });
        } else {
            await cargarTodo();
        }
    } catch (err) {
        console.error(err);
        showToast(`No se pudieron cargar los datos: ${mensajeError(err)}`, 6000);
    } finally {
        aviso.remove();
        invitado.disabled = false;
    }
    // Reseñas, fotos y videos nuevos de otras personas llegan solos
    escucharCambios(() => {
        if (state.currentView === 'inicio') renderResults();
        refreshLocalDetail();
    });
}
