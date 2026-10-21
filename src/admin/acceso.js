// Acceso al panel en la versión en línea: hay que iniciar sesión con una cuenta de administrador.
// Las reglas de Supabase igual impiden que alguien sin rol "admin" cambie datos, aunque abra esta página.
import { supabase, mensajeError, urlDeRetorno, googleActivo } from '../services/supabase.js';
import { cargarTodo, cargarUsuario, configurarAvisos, escucharCambios } from '../data/remoto.js';
import { state } from '../state.js';
import { registerActions } from '../ui/actions.js';
import { esc } from '../utils/html.js';
import { toast } from './ui.js';

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
                <div class="adm-form-actions">
                    <button type="button" class="adm-btn" data-action="adm-login-google">Entrar con Google</button>
                    <button type="submit" class="adm-btn primary">Entrar</button>
                </div>
            </form>
        </section>`;
    document.getElementById('admLoginForm').addEventListener('submit', async e => {
        e.preventDefault();
        const { data, error } = await supabase.auth.signInWithPassword({
            email: document.getElementById('admEmail').value.trim().toLowerCase(),
            password: document.getElementById('admPassword').value
        });
        if (error) return pantallaIngreso(esc(mensajeError(error)));
        await verificar(data.session);
    });
}

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
    document.querySelector('.adm-demo-note').innerHTML = `Conectado como <b>${esc(usuario.email)}</b>. Los cambios se guardan en Supabase y se ven al instante en la app.
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
    'adm-logout': async () => {
        await supabase.auth.signOut();
        state.user = null;
        location.reload();
    }
});
