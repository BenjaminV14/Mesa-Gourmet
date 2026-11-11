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

// Si ya hay una sesión guardada (o se vuelve del login de Google), se muestra el logo de inmediato
// en vez de la pantalla de ingreso, para que no aparezca el login un instante antes de entrar
let haySesionGuardada = false;
try { haySesionGuardada = remoto && (!!localStorage.getItem('mg-sesion') || /[?&]code=/.test(location.search)); } catch { /* sin acceso al almacenamiento */ }
const splashEl = document.getElementById('splashScreen');
const registroEl = document.getElementById('registerScreen');
if (haySesionGuardada) {
    registroEl.classList.add('hidden');
    splashEl.classList.remove('hidden');
    splashEl.style.opacity = '1';
}

/** Sin sesión válida: se quita el logo y se muestra el ingreso */
function mostrarIngreso() {
    splashEl.classList.add('hidden');
    registroEl.classList.remove('hidden');
}

let entrandoApp = false;
function enterApp({ withSplash = true } = {}) {
    // Puede llamarse dos veces (al cargar y al volver de Google): solo cuenta la primera
    if (entrandoApp || !document.getElementById('mainContent').classList.contains('hidden')) return;
    entrandoApp = true;
    registroEl.classList.add('hidden');
    const show = () => {
        entrandoApp = false;
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
    const splashVisible = !splashEl.classList.contains('hidden');
    if (!withSplash && !splashVisible) return show();

    // La app se arma debajo del logo y el logo se desvanece encima: nunca se ve otra pantalla entremedio
    splashEl.classList.remove('hidden');
    splashEl.style.opacity = '1';
    setTimeout(() => {
        show();
        splashEl.style.opacity = '0';
        setTimeout(() => splashEl.classList.add('hidden'), 500);
    }, splashVisible ? 150 : 1200);
}

setReviewPublishedHandler(() => {
    refreshLocalDetail();
    if (state.currentView === 'resenas') refreshResenas();
});

initAuth({ onEnter: () => enterApp(), arrancando: () => arrancando });
configurarAvisos(msg => showToast(`No se pudo guardar: ${msg}`, 4500));
setupPwa();

// Escape cierra la ficha del local (útil en computador)
document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !document.getElementById('detailView').classList.contains('hidden') && !document.querySelector('.sheet-overlay, #reviewModal')) {
        hideLocalDetail();
    }
});
track('app_abierta');

// Mientras la app arranca, el aviso de "sesión iniciada" de Supabase no debe abrir la app por segunda vez
let arrancando = remoto;

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
            mostrarIngreso();
            await cargarTodo();
        }
    } catch (err) {
        console.error(err);
        if (!state.user) mostrarIngreso();
        showToast(`No se pudieron cargar los datos: ${mensajeError(err)}`, 6000);
    } finally {
        arrancando = false;
        aviso.remove();
        invitado.disabled = false;
    }
    // Reseñas, fotos y videos nuevos de otras personas llegan solos
    escucharCambios(() => {
        if (state.currentView === 'inicio') renderResults();
        refreshLocalDetail();
    });
}
