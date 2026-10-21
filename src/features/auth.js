// Inicio de sesión y registro.
// En línea (Supabase): cuentas reales con confirmación por correo, ingreso con Google y recuperación de contraseña.
// DEMO (sin Supabase): la cuenta se guarda solo en este navegador y la contraseña NO se guarda.
import { state, isLoggedIn, normalizeUser } from '../state.js';
import { saveSession } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';

// "benjamin.vergara92@gmail.com" -> "Benjamin Vergara". Con Google (al conectar Supabase) llega el nombre real de la cuenta.
function nombreDesdeCorreo(email) {
    const partes = email.split('@')[0].replace(/\d+/g, ' ').split(/[._\-+\s]+/).filter(p => p.length > 1);
    const nombre = partes.slice(0, 3).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    return nombre.length >= 2 ? nombre : email.split('@')[0];
}
import { track } from '../services/analytics.js';
import { remoto, supabase, urlDeRetorno, mensajeError, googleActivo } from '../services/supabase.js';
import { cargarUsuario, cargarTodo } from '../data/remoto.js';

let onEnterApp = () => {};
let entrando = false;
let mode = 'login';

export function initAuth({ onEnter }) {
    onEnterApp = onEnter;
    setMode('login');
    document.getElementById('authForm').addEventListener('submit', handleSubmit);
    if (remoto) {
        // Al volver desde el correo de confirmación o desde Google, Supabase trae la sesión en la dirección
        supabase.auth.onAuthStateChange((event, session) => {
            // Se espera un instante: dentro de este aviso no se deben hacer otras consultas a Supabase
            setTimeout(() => {
                if (event === 'PASSWORD_RECOVERY') abrirNuevaClave();
                else if (event === 'SIGNED_IN' && session && !state.user) entrarConSesion(session, 'inicio_sesion');
            }, 0);
        });
    }
}

/** Carga la cuenta y los datos que dependen de ella (likes, eventos, promos) y entra a la app */
export async function entrarConSesion(session, evento = null) {
    if (entrando) return;
    entrando = true;
    try {
        await cargarUsuario(session);
        await cargarTodo();
        if (evento) track(evento, { metodo: session.user.app_metadata?.provider || 'correo' });
        document.getElementById('authForm').reset();
        showInfo('');
        onEnterApp();
    } catch (err) {
        showError(mensajeError(err));
    } finally {
        entrando = false;
    }
}

function abrirNuevaClave() {
    openSheet({
        id: 'nuevaClave',
        title: 'Elige tu nueva contraseña',
        body: `<form class="sheet-form"><label for="nuevaClaveInput">Nueva contraseña</label>
            <input type="password" id="nuevaClaveInput" minlength="8" autocomplete="new-password" placeholder="Mínimo 8 caracteres">
            <p class="form-error" id="nuevaClaveError" hidden></p></form>`,
        actions: [{ label: 'Guardar contraseña', action: 'auth-save-password', variant: 'primary' }],
        dismissible: false
    });
}

function setMode(newMode) {
    mode = newMode;
    document.querySelectorAll('[data-auth-mode]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.authMode === mode);
        btn.setAttribute('aria-selected', btn.dataset.authMode === mode);
    });
    document.querySelectorAll('.register-only').forEach(el => el.hidden = mode !== 'register');
    document.querySelectorAll('.login-only').forEach(el => el.hidden = mode !== 'login');
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
    if (message) showInfo('');
}

function showInfo(message) {
    const el = document.getElementById('authInfo');
    if (!el) return;
    el.textContent = message;
    el.hidden = !message;
}

async function handleSubmitRemoto(nombre, email, password) {
    const boton = document.getElementById('authSubmit');
    const texto = boton.textContent;
    boton.disabled = true;
    boton.textContent = 'Un momento…';
    showError('');
    try {
        if (mode === 'register') {
            const { data, error } = await supabase.auth.signUp({
                email, password, options: { data: { nombre }, emailRedirectTo: urlDeRetorno() }
            });
            if (error) throw error;
            if (!data.session) {
                track('registro', { metodo: 'correo' });
                showInfo(`¡Listo! Te enviamos un correo a ${email}. Ábrelo y toca el enlace para activar tu cuenta (revisa también spam). Volverás aquí con tu sesión iniciada.`);
                return;
            }
            await entrarConSesion(data.session, 'registro');
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            await entrarConSesion(data.session, 'inicio_sesion');
        }
    } catch (err) {
        showError(mensajeError(err));
    } finally {
        boton.disabled = false;
        boton.textContent = texto;
    }
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
    if (remoto) return handleSubmitRemoto(nombre, email, password);

    const previous = state.user && state.user.email === email ? state.user : null;
    state.user = normalizeUser(previous || {
        id: email,
        email,
        nombre: nombre || nombreDesdeCorreo(email),
        productoFavorito: null,
        bienvenidaVista: false,
        creado: new Date().toISOString()
    });
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
    if (remoto) supabase.auth.signOut().catch(() => {});
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
    'auth-google': async () => {
        if (!remoto) return showToast('El ingreso con Google se activa al conectar Supabase.');
        if (!await googleActivo()) return showError('El ingreso con Google aún no está activado. Por ahora crea tu cuenta con correo y contraseña.');
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: urlDeRetorno() } });
        if (error) showError(mensajeError(error));
    },
    'auth-forgot': async () => {
        const email = document.getElementById('authEmail').value.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showError('Escribe tu correo arriba y vuelve a tocar "¿Olvidaste tu contraseña?".');
        if (!remoto) return showToast('La recuperación de contraseña funciona en la versión en línea.');
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlDeRetorno() });
        if (error) return showError(mensajeError(error));
        showInfo(`Te enviamos un correo a ${email} con un enlace para crear una contraseña nueva.`);
    },
    'auth-save-password': async () => {
        const clave = document.getElementById('nuevaClaveInput').value;
        const err = document.getElementById('nuevaClaveError');
        if (clave.length < 8) { err.textContent = 'La contraseña debe tener al menos 8 caracteres.'; err.hidden = false; return; }
        const { error } = await supabase.auth.updateUser({ password: clave });
        if (error) { err.textContent = mensajeError(error); err.hidden = false; return; }
        closeSheet('nuevaClave');
        showToast('Contraseña actualizada.');
    },
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
