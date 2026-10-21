// Acceso al panel en la versión en línea: hay que iniciar sesión con una cuenta de administrador.
// Las reglas de Supabase igual impiden que alguien sin rol "admin" cambie datos, aunque abra esta página.
import { supabase, mensajeError, urlDeRetorno, googleActivo } from '../services/supabase.js';
import { cargarTodo, cargarUsuario, configurarAvisos, escucharCambios } from '../data/remoto.js';
import { state } from '../state.js';
import { registerActions } from '../ui/actions.js';
import { esc } from '../utils/html.js';
import { toast } from './ui.js';
import { cerrarMesPendiente } from '../data/metrics.js';
import { persist } from '../data/store.js';

let alEntrar = () => {};

function pantallaIngreso(mensaje = '', tipo = 'error') {
    document.getElementById('admNav').innerHTML = '';
    document.getElementById('admMain').innerHTML = `
        <section class="adm-card adm-login">
            <h1 class="adm-title">Panel de administración</h1>
            <p class="adm-help">Ingresa con tu cuenta de Mesa Gourmet. Solo las cuentas con rol de administrador pueden usar el panel.</p>
            <form id="admLoginForm" class="adm-form" novalidate>
                <label class="adm-field full" for="admEmail"><span>Correo</span><input type="email" id="admEmail" autocomplete="email" required></label>
                <label class="adm-field full" for="admPassword"><span>Contraseña</span><input type="password" id="admPassword" autocomplete="current-password" required></label>
                ${mensaje ? `<p class="${tipo === 'error' ? 'adm-error' : 'adm-help'}">${mensaje}</p>` : ''}
                <button type="button" class="adm-link" data-action="adm-login-forgot">¿Olvidaste tu contraseña?</button>
                <div class="adm-form-actions">
                    <button type="button" class="adm-btn" data-action="adm-login-google">Entrar con Google</button>
                    <button type="submit" class="adm-btn primary">Entrar</button>
                </div>
            </form>
        </section>`;
    document.getElementById('admLoginForm').addEventListener('submit', async e => {
        e.preventDefault();
        const correo = correoEscrito();
        const { data, error } = await supabase.auth.signInWithPassword({ email: correo, password: document.getElementById('admPassword').value });
        if (error) {
            const sinConfirmar = /email not confirmed/i.test(error.message || '');
            pantallaIngreso(esc(mensajeError(error)) + (sinConfirmar ? ' <button type="button" class="adm-link" data-action="adm-login-resend">Reenviar correo de confirmación</button>' : ''));
            document.getElementById('admEmail').value = correo;
            return;
        }
        await verificar(data.session);
    });
}

const correoEscrito = () => document.getElementById('admEmail')?.value.trim().toLowerCase() || '';

async function verificar(session) {
    const usuario = await cargarUsuario(session);
    if (usuario.rol !== 'admin') {
        return pantallaIngreso(`Ingresaste como <b>${esc(usuario.email)}</b>, pero esa cuenta no es administradora.
            Para darle el rol, en Supabase abre <b>SQL Editor</b> y ejecuta:<br>
            <code>update public.perfiles set rol = 'admin' where id = (select id from auth.users where email = '${esc(usuario.email)}');</code><br>
            Luego recarga esta página. <button type="button" class="adm-link" data-action="adm-logout">Cerrar sesión</button>`);
    }
    document.getElementById('admMain').innerHTML = '<p class="adm-help">Cargando datos…</p>';
    await cargarTodo({ admin: true });
    // Respaldo por si el servidor no cerró el mes pasado
    if (cerrarMesPendiente()) persist();
    const nota = document.getElementById('admNota');
    nota.hidden = false;
    nota.innerHTML = `Conectado como <b>${esc(usuario.email)}</b>. Los cambios se guardan en línea y se ven al instante en la app.
        <button type="button" class="adm-link" data-action="adm-logout">Cerrar sesión</button>`;
    escucharCambios();
    alEntrar();
}

export async function iniciarAdminEnLinea(render) {
    alEntrar = render;
    configurarAvisos(msg => toast(`No se pudo guardar: ${msg}`, 'error'));
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await verificar(session).catch(err => pantallaIngreso(esc(mensajeError(err))));
    else pantallaIngreso();
}

registerActions({
    'adm-login-google': async () => {
        if (!await googleActivo()) return pantallaIngreso('El ingreso con Google aún no está activado en Supabase. Usa tu correo y contraseña.');
        const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: urlDeRetorno() } });
        if (error) pantallaIngreso(esc(mensajeError(error)));
    },
    'adm-login-resend': async () => {
        const email = correoEscrito();
        const { error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: urlDeRetorno() } });
        pantallaIngreso(error ? esc(mensajeError(error)) : `Te enviamos otro correo de confirmación a <b>${esc(email)}</b>. Ábrelo (revisa spam) y vuelve a entrar.`, error ? 'error' : 'info');
        document.getElementById('admEmail').value = email;
    },
    'adm-login-forgot': async () => {
        const email = correoEscrito();
        if (!email) return pantallaIngreso('Escribe tu correo y vuelve a tocar "¿Olvidaste tu contraseña?".');
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: urlDeRetorno().replace(/admin\.html$/, '') });
        pantallaIngreso(error ? esc(mensajeError(error)) : `Te enviamos un link a <b>${esc(email)}</b> para crear una contraseña nueva. Después vuelve a este panel.`, error ? 'error' : 'info');
        document.getElementById('admEmail').value = email;
    },
    'adm-logout': async () => {
        await supabase.auth.signOut();
        state.user = null;
        location.reload();
    }
});
