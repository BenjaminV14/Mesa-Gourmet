// Inicio de sesión y registro.
// DEMO: no hay servidor, así que la cuenta se guarda solo en este navegador y la contraseña NO se guarda.
// Con Supabase (docs/SUPABASE.md) esto pasa a ser registro real con verificación por correo.
import { state, isLoggedIn } from '../state.js';
import { saveSession } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';
import { track } from '../services/analytics.js';

let onEnterApp = () => {};
let mode = 'login';

export function initAuth({ onEnter }) {
    onEnterApp = onEnter;
    setMode('login');
    document.getElementById('authForm').addEventListener('submit', handleSubmit);
}

function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('[data-auth-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.authMode === mode);
        btn.setAttribute('aria-selected', btn.dataset.authMode === mode);
    });
    document.querySelectorAll('.register-only').forEach(el => el.hidden = mode !== 'register');
    document.getElementById('authName').required = mode === 'register';
    document.getElementById('authTerms').required = mode === 'register';
    document.getElementById('authPassword').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
    document.getElementById('authSubmit').textContent = mode === 'register' ? 'Crear cuenta' : 'Ingresar';
    showError('');
}

function showError(message) {
    const el = document.getElementById('authError');
    el.textContent = message;
    el.hidden = !message;
}

function handleSubmit(event) {
    event.preventDefault();
    const nombre = document.getElementById('authName').value.trim();
    const email = document.getElementById('authEmail').value.trim().toLowerCase();
    const password = document.getElementById('authPassword').value;

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Escribe un correo válido, por ejemplo nombre@correo.cl.');
    if (password.length < 8) return showError('La contraseña debe tener al menos 8 caracteres.');
    if (mode === 'register') {
        if (nombre.length < 2) return showError('Escribe tu nombre.');
        if (!document.getElementById('authTerms').checked) return showError('Debes aceptar los términos y la política de privacidad.');
    }

    const previous = state.user && state.user.email === email ? state.user : null;
    state.user = previous || {
        id: email,
        email,
        nombre: nombre || email.split('@')[0],
        favoritos: [],
        productoFavorito: null,
        bienvenidaVista: false,
        creado: new Date().toISOString()
    };
    if (nombre) state.user.nombre = nombre;
    state.isGuest = false;
    saveSession(state.user);
    track(mode === 'register' ? 'registro' : 'inicio_sesion', { metodo: 'correo' });
    document.getElementById('authForm').reset();
    onEnterApp();
}

export function enterAsGuest() {
    state.isGuest = true;
    track('entrar_invitado');
    onEnterApp();
}

export function showAuthScreen(newMode = 'login') {
    closeSheet('guestGate');
    setMode(newMode);
    document.getElementById('registerScreen').classList.remove('hidden');
}

export function logout() {
    state.user = null;
    state.isGuest = false;
    saveSession(null);
    document.getElementById('mainHeader').classList.add('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('detailView').classList.add('hidden');
    showAuthScreen('login');
}

/**
 * Devuelve true si hay una cuenta iniciada. Si es invitado, muestra la invitación a registrarse.
 */
export function requireAccount(motivo = 'interactuar') {
    if (isLoggedIn()) return true;
    track('bloqueo_invitado', { motivo });
    openSheet({
        id: 'guestGate',
        title: 'Regístrate para interactuar',
        body: `<p class="sheet-text">Crea tu cuenta gratis para ${motivo}, guardar favoritos, escribir reseñas y subir de nivel.</p>`,
        actions: [
            { label: 'Crear cuenta', action: 'auth-open', data: { mode: 'register' }, variant: 'primary' },
            { label: 'Ya tengo cuenta', action: 'auth-open', data: { mode: 'login' } },
            { label: 'Seguir mirando', action: 'close-sheet', variant: 'ghost' }
        ]
    });
    return false;
}

registerActions({
    'auth-mode': el => setMode(el.dataset.authMode),
    'auth-open': el => showAuthScreen(el.dataset.mode),
    'auth-guest': () => enterAsGuest(),
    'auth-google': () => showToast('El ingreso con Google se activa al conectar Supabase.'),
    'logout': () => logout(),
    'show-terms': () => openSheet({
        id: 'legalSheet',
        title: 'Términos y condiciones',
        body: `<p class="sheet-text">Borrador pendiente de revisión legal. Al usar Mesa Gourmet aceptas publicar reseñas honestas sobre tu propia experiencia, no subir contenido de terceros sin permiso y que moderemos o retiremos contenido que no cumpla estas reglas. Los locales marcados como "Destacado" pagaron por aparecer primero.</p>`,
        actions: [{ label: 'Entendido', action: 'close-sheet', variant: 'primary' }]
    }),
    'show-privacy': () => openSheet({
        id: 'legalSheet',
        title: 'Política de privacidad',
        body: `<p class="sheet-text">Borrador pendiente de revisión legal. Guardamos tu nombre, correo, reseñas, fotos, videos compartidos y, si lo autorizas, tu ubicación aproximada para mostrar locales cercanos. No vendemos tus datos. Puedes descargar tus datos o eliminar tu cuenta desde tu perfil en cualquier momento.</p>`,
        actions: [{ label: 'Entendido', action: 'close-sheet', variant: 'primary' }]
    })
});
