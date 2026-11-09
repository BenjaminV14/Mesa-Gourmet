// Perfil del comensal: identidad (nombre y @usuario), estadísticas, insignias, guardados, "Quiero ir",
// favoritos, reseñas propias y configuración. Solo para cuentas registradas.
import { state, FILTROS_VACIOS } from '../state.js';
import { db, persist, saveSession, getLocal } from '../data/store.js';
import { TIPOS_PLATO, getTipo, buscarTipos } from '../data/tipos-plato.js';
import { vipDeUsuario, miTop50, MINIMO_TOP50, MESES } from '../data/metrics.js';
import { compressImage } from '../services/ai.js';
import { remoto, supabase } from '../services/supabase.js';
import { cropperHtml, abrirRecorte, fotoRecortada, cerrarRecorte } from '../ui/avatar-cropper.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';
import { esc, safeUrl, avatarContent } from '../utils/html.js';
import { levelProgress, levelName, visitedLocalesCount, computeLogros, userReviews } from './gamification.js';
import { reviewCard } from './review-card.js';
import { logout } from './auth.js';
import { canInstall } from '../services/pwa.js';
import { DIETAS } from '../data/metrics.js';

let tab = 'actividad';

/** Borra las fotos (reseñas y perfil) y videos de la persona en Supabase Storage: todo vive en la carpeta con su id */
async function borrarMisArchivos(uid) {
    for (const bucket of ['fotos-resenas', 'videos']) {
        const rutas = [];
        const recorrer = async (carpeta, nivel = 0) => {
            const { data } = await supabase.storage.from(bucket).list(carpeta, { limit: 1000 });
            for (const item of data || []) {
                const ruta = `${carpeta}/${item.name}`;
                if (item.id) rutas.push(ruta);          // archivo
                else if (nivel < 3) await recorrer(ruta, nivel + 1);   // subcarpeta (una por reseña)
            }
        };
        await recorrer(uid).catch(() => {});
        for (let i = 0; i < rutas.length; i += 100) await supabase.storage.from(bucket).remove(rutas.slice(i, i + 100)).catch(() => {});
    }
}
let avatarNuevo; // foto elegida en "Editar perfil" que se guarda al presionar Guardar

export function showWelcomeIfNeeded() {
    if (!state.user || state.isGuest || state.user.bienvenidaVista) return;
    openSheet({
        id: 'welcome',
        title: `¡Bienvenido/a, ${state.user.nombre.split(' ')[0]}!`,
        body: `
            <p class="sheet-text">¿Cuál es tu comida favorita? Será tu primera insignia visible; las demás están ocultas y las irás descubriendo.</p>
            <div class="fav-search"><span aria-hidden="true">🔍</span><input id="favSearch" type="search" placeholder="Busca: completo, pastel de choclo, ceviche…" autocomplete="off" data-input="fav-search" aria-label="Buscar comida favorita"></div>
            <div class="fav-products-grid" id="favGrid">${favGrid(TIPOS_PLATO)}</div>`,
        actions: [{ label: 'Elegir después', action: 'skip-welcome', variant: 'ghost' }],
        dismissible: false
    });
}

function favGrid(tipos) {
    return tipos.length
        ? tipos.map(t => `<button class="fav-product-btn" data-action="pick-fav-product" data-cat="${t.id}"><span>${t.emoji}</span><span>${esc(t.nombre)}</span></button>`).join('')
        : '<p class="sheet-text">No encontramos esa comida. Prueba con otra palabra.</p>';
}

function localRow(local, extra = '') {
    return `<button class="card picker-card" data-action="open-local" data-id="${local.id}">
        <img src="${esc(safeUrl(local.imagen))}" alt="">
        <span><b>${esc(local.nombre)}</b><small>${esc(local.tipo)}${extra}</small></span>
        <span class="chev">›</span>
    </button>`;
}

function tabContent(u) {
    if (tab === 'actividad') {
        const mias = userReviews().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
        return mias.length ? `<div class="review-list">${mias.map(r => reviewCard(r)).join('')}</div>`
            : '<p class="muted center">Aún no escribes reseñas. ¡La primera te da el nivel 1!</p>';
    }
    if (tab === 'guardados') {
        const resenas = u.guardados.resenas.map(id => db.reviews.find(r => String(r.id) === id)).filter(Boolean);
        const videos = u.guardados.videos.map(id => db.videos.find(v => v.id === id)).filter(Boolean);
        return `
            ${videos.length ? `<h4 class="subsection-title">Videos</h4><div class="saved-videos">${videos.map(v => `
                <button class="saved-video" data-action="go-video" data-id="${esc(v.id)}">${v.portada ? `<img src="${esc(safeUrl(v.portada))}" alt="">` : '<span>🎬</span>'}<small>${esc(v.descripcion || v.autor)}</small></button>`).join('')}</div>` : ''}
            ${resenas.length ? `<h4 class="subsection-title">Reseñas</h4><div class="review-list">${resenas.map(r => reviewCard(r)).join('')}</div>` : ''}
            ${!videos.length && !resenas.length ? '<p class="muted center">Toca 📌 en una reseña o video para guardarlo aquí.</p>' : ''}`;
    }
    if (tab === 'quiero') {
        const locales = u.quieroIr.map(getLocal).filter(l => l && l.activo !== false);
        return locales.length ? `<div class="review-list">${locales.map(l => localRow(l)).join('')}</div>`
            : '<p class="muted center">Toca 🔖 "Quiero ir" en un local o una reseña para armar tu lista.</p>';
    }
    const favs = u.favoritos.map(getLocal).filter(l => l && l.activo !== false);
    return favs.length ? `<div class="review-list">${favs.map(l => localRow(l)).join('')}</div>`
        : '<p class="muted center">Toca ❤️ en un local para guardarlo en favoritos.</p>';
}

// Código que el cliente muestra en caja para cobrar el beneficio de su Top 50 (el local revisa que su @ esté en la lista)
const CODIGO_BENEFICIO = 'MESAGOURMET';

/** Primer día del mes como 'AAAA-MM-01' (así se guardan los meses en top50_mes) */
const claveMes = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;

/**
 * Top 50 de clientes, visible solo para la propia persona:
 * - Mes pasado (cerrado): en qué locales quedó, su puesto y el beneficio que ofrece el local este mes.
 * - Este mes: cuántas reseñas lleva en cada local y cuántas le faltan para entrar (mínimo 5).
 */
function top50Html(u) {
    const hoy = new Date();
    const pasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 15);
    const clavePasado = claveMes(pasado);
    // En línea viene de Supabase (top50_mes); en la demo se calcula desde las reseñas
    const cerrados = Array.isArray(u.top50)
        ? u.top50.filter(t => t.mes === clavePasado).map(t => ({ local: getLocal(t.localId), puesto: t.puesto, visitas: t.resenas })).filter(t => t.local)
        : miTop50(u.id, pasado).filter(t => t.puesto);
    const actual = miTop50(u.id, hoy);
    if (!cerrados.length && !actual.length) return '';
    const mesPasado = MESES[pasado.getMonth()];
    return `
        <section class="profile-section top50-card">
            <div class="profile-section-title">🏆 Tu Top 50 de clientes <button class="link-btn small" data-action="top50-info">¿Cómo funciona?</button></div>
            ${cerrados.map(t => `
                <div class="top50-win">
                    <div><b>👑 #${t.puesto} en ${esc(t.local.nombre)}</b><small>${t.visitas} reseñas en ${esc(mesPasado)}</small></div>
                    ${t.local.beneficioTop50 ? `<div class="top50-benefit">🎁 ${esc(t.local.beneficioTop50)}<br>
                        <span>Muestra en caja el código <b>${CODIGO_BENEFICIO}</b> y tu usuario <b>@${esc(u.username)}</b>.</span></div>` : ''}
                </div>`).join('')}
            ${actual.length ? `<p class="sheet-text small">Este mes (${esc(MESES[hoy.getMonth()])}), con ${MINIMO_TOP50} reseñas o más en un local entras a su Top 50:</p>
            <div class="top50-progress">${actual.slice(0, 6).map(t => `
                <button class="top50-row" data-action="open-local" data-id="${t.local.id}">
                    <span>${esc(t.local.nombre)}</span>
                    <span class="top50-bar"><i style="width:${Math.min(100, t.visitas / MINIMO_TOP50 * 100)}%"></i></span>
                    <small>${t.puesto ? `#${t.puesto} provisional` : `${t.visitas}/${MINIMO_TOP50} · faltan ${t.faltan}`}</small>
                </button>`).join('')}</div>` : ''}
            ${!u.comparteConLocales ? `<p class="sheet-text small">🔒 Hoy los locales no ven tu nombre. Si quieres que puedan reconocerte y ofrecerte beneficios,
                actívalo en <button class="link-btn small" data-action="settings-privacy">Privacidad</button>.</p>` : ''}
        </section>`;
}

export function renderPerfil() {
    if (!state.user || state.isGuest) return;
    const u = state.user;
    const { count, level, next, progress } = levelProgress();
    const logros = computeLogros().filter(l => l.visible);
    const fav = getTipo(u.productoFavorito);
    const vip = vipDeUsuario(u.id);
    const tabs = [['actividad', 'Mis reseñas'], ['guardados', 'Guardados'], ['quiero', 'Quiero ir'], ['favoritos', 'Favoritos']];

    document.getElementById('mainContent').innerHTML = `
        <section class="profile-card">
            <div class="profile-cover"></div>
            <div class="profile-identity">
                <button class="profile-avatar-large" data-action="edit-profile" aria-label="Cambiar foto de perfil">${avatarContent(u)}<span class="avatar-edit">📷</span></button>
                <div class="profile-names">
                    <h2>${esc([u.nombre, u.apellido].filter(Boolean).join(' '))}</h2>
                    <p>@${esc(u.username)} · <span class="muted">${esc(u.email)}</span></p>
                </div>
                <button class="chip-btn" data-action="edit-profile">✏️ Editar</button>
            </div>
            <div class="profile-level">
                <div class="profile-level-pill">⭐ Nivel ${level} · ${esc(levelName(level))}</div>
                <div class="profile-progress-bar"><div class="profile-progress-fill" style="width:${progress}%;"></div></div>
                <p class="profile-progress-label">${count} reseña${count !== 1 ? 's' : ''} · faltan ${Math.max(0, next - count)} para el nivel ${level + 1}</p>
            </div>
            <div class="profile-stats">
                <div><b>${count}</b><span>Reseñas</span></div>
                <div><b>${visitedLocalesCount()}</b><span>Locales</span></div>
                <div><b>${u.siguiendo.length}</b><span>Siguiendo</span></div>
                <div><b>${logros.filter(l => l.unlocked).length}</b><span>Insignias</span></div>
            </div>
            <div class="profile-badges">
                ${vip.map(l => `<button class="badge-chip is-vip" data-action="open-local" data-id="${l.id}">👑 Cliente VIP de ${esc(l.nombre)}</button>`).join('')}
                ${fav ? `<span class="badge-chip is-fav">${fav.emoji} Fan de ${esc(fav.nombre.toLowerCase())}</span>` : '<button class="badge-chip" data-action="open-welcome">⭐ Elige tu comida favorita</button>'}
                ${logros.filter(l => l.unlocked).map(l => `<span class="badge-chip">${l.emoji} ${esc(l.titulo)}</span>`).join('')}
            </div>
        </section>

        ${top50Html(u)}

        <div class="profile-tabs" role="tablist">
            ${tabs.map(([k, l]) => `<button class="profile-tab ${tab === k ? 'is-on' : ''}" role="tab" aria-selected="${tab === k}" data-action="profile-tab" data-tab="${k}">${l}</button>`).join('')}
        </div>
        <div id="profileTabContent">${tabContent(u)}</div>

        <section class="profile-section">
            <div class="profile-section-title">⚙️ Configuración</div>
            <div class="settings-list">
                <button class="settings-row" data-action="settings-notif">🔔 Notificaciones <span class="chev">›</span></button>
                <button class="settings-row" data-action="settings-diet">🥗 Mis necesidades alimentarias <span class="chev">›</span></button>
                <button class="settings-row" data-action="settings-privacy">🔒 Privacidad <span class="chev">›</span></button>
                <button class="settings-row" data-action="open-welcome">⭐ Cambiar mi comida favorita <span class="chev">›</span></button>
                <button class="settings-row" data-action="install-app" ${canInstall() ? '' : 'hidden'}>📲 Instalar la app en este dispositivo</button>
                <button class="settings-row" data-action="show-terms">📄 Términos y condiciones</button>
                <button class="settings-row" data-action="show-privacy">🛡️ Política de privacidad</button>
                <button class="settings-row" data-action="download-data">📦 Descargar mis datos</button>
                <button class="settings-row danger" data-action="delete-account">🗑️ Eliminar mi cuenta</button>
                <button class="settings-row danger" data-action="logout">🚪 Cerrar sesión</button>
            </div>
        </section>
    `;
}

function toggleRow(id, label, checked, desc = '') {
    return `<label class="toggle-row" for="${id}">
        <span><b>${esc(label)}</b>${desc ? `<small>${esc(desc)}</small>` : ''}</span>
        <input type="checkbox" id="${id}" ${checked ? 'checked' : ''} class="switch">
    </label>`;
}

registerActions({
    'profile-tab': el => {
        tab = el.dataset.tab;
        renderPerfil();
    },
    'go-video': el => {
        import('./navigation.js').then(m => {
            m.switchTab('resenas');
            import('./resenas.js').then(r => r.renderResenas('videos', el.dataset.id));
        });
    },
    'pick-fav-product': el => {
        state.user.productoFavorito = el.dataset.cat;
        state.user.bienvenidaVista = true;
        saveSession(state.user);
        closeSheet('welcome');
        const c = getTipo(el.dataset.cat);
        showToast(`${c.emoji} Insignia visible: ${c.insignia}`);
        if (state.currentView === 'perfil') renderPerfil();
    },
    'fav-search': el => { document.getElementById('favGrid').innerHTML = favGrid(buscarTipos(el.value)); },
    'skip-welcome': () => {
        state.user.bienvenidaVista = true;
        saveSession(state.user);
        closeSheet('welcome');
    },
    'open-welcome': () => {
        state.user.bienvenidaVista = false;
        showWelcomeIfNeeded();
    },
    'avatar-file': async el => {
        const file = el.files[0];
        if (!file) return;
        try {
            // Se reduce la foto y se abre el ajuste (mover y zoom). Con Supabase pasa por la misma revisión de IA que las fotos de platos
            abrirRecorte(await compressImage(file, 1000, 0.88));
            document.getElementById('avatarPreview').hidden = true;
        } catch (err) {
            showToast(err.message || 'No se pudo usar esa imagen.');
        }
    },
    'avatar-remove': () => {
        avatarNuevo = null;
        cerrarRecorte();
        document.getElementById('cropperBox').hidden = true;
        document.getElementById('avatarPreview').hidden = false;
        document.getElementById('avatarPreview').innerHTML = avatarContent({ nombre: state.user.nombre });
    },
    'edit-profile': () => openSheet({
        id: 'editProfile',
        title: 'Editar perfil',
        body: `<form class="sheet-form">
            <div class="avatar-picker">
                <span class="profile-avatar-large" id="avatarPreview">${avatarContent(state.user)}</span>
                <div>
                    <label class="btn btn-outline avatar-upload">📷 Subir foto de perfil<input type="file" id="avatarFile" accept="image/*" data-change="avatar-file" hidden></label>
                    ${state.user.avatarUrl ? '<button type="button" class="link-btn" data-action="avatar-remove">Quitar foto</button>' : ''}
                    <p class="sheet-text small">Una foto de tu cara o la que te represente. Se revisa que sea apropiada.</p>
                </div>
            </div>
            ${cropperHtml()}
            <label for="newName">Nombre</label><input id="newName" maxlength="40" value="${esc(state.user.nombre)}">
            <label for="newApellido">Apellido</label><input id="newApellido" maxlength="40" value="${esc(state.user.apellido || '')}">
            <p class="sheet-text small">Tu apellido no se muestra en la app. Solo se comparte con un local si quedas en su Top 50 y lo autorizas en Privacidad.</p>
            <label for="newUsername">Nombre de usuario</label>
            <div class="input-prefix"><span>@</span><input id="newUsername" maxlength="24" value="${esc(state.user.username)}" autocapitalize="none" spellcheck="false"></div>
            <p class="sheet-text small">Tu usuario está ligado a tu correo ${esc(state.user.email)}. Solo letras, números, punto y guion bajo.</p>
            <p class="form-error" id="profileError" hidden></p>
        </form>`,
        actions: [{ label: 'Guardar', action: 'save-profile', variant: 'primary' }, { label: 'Cancelar', action: 'close-sheet', variant: 'ghost' }]
    }),
    'save-profile': () => {
        const recorte = fotoRecortada();
        if (recorte) avatarNuevo = recorte;
        const nombre = document.getElementById('newName').value.trim();
        const apellido = document.getElementById('newApellido')?.value.trim() || '';
        const username = document.getElementById('newUsername').value.trim().toLowerCase();
        const err = document.getElementById('profileError');
        const fail = m => { err.textContent = m; err.hidden = false; };
        if (nombre.length < 2) return fail('El nombre debe tener al menos 2 letras.');
        if (!/^[a-z0-9_.]{3,24}$/.test(username)) return fail('El usuario debe tener entre 3 y 24 caracteres: letras, números, punto o guion bajo.');
        if (db.reviews.some(r => r.usuario.username === username && r.usuario.id !== state.user.id)) return fail('Ese nombre de usuario ya está en uso.');
        state.user.nombre = nombre;
        state.user.apellido = apellido;
        state.user.username = username;
        if (avatarNuevo !== undefined) state.user.avatarUrl = avatarNuevo;
        avatarNuevo = undefined;
        cerrarRecorte();
        db.reviews.filter(r => r.usuario.id === state.user.id).forEach(r => {
            r.usuario.nombre = nombre;
            r.usuario.username = username;
            r.usuario.avatarUrl = state.user.avatarUrl || null;
        });
        persist();
        saveSession(state.user);
        closeSheet('editProfile');
        document.getElementById('userName').textContent = nombre.split(' ')[0];
        document.getElementById('userAvatar').innerHTML = avatarContent(state.user);
        renderPerfil();
    },
    'settings-notif': () => {
        const p = state.user.preferencias;
        openSheet({
            id: 'settingsSheet',
            title: 'Notificaciones',
            body: `<div class="toggle-list">
                ${toggleRow('pref_promos', 'Promociones de mis favoritos', p.notifPromos ?? true, 'Te avisamos cuando un local favorito publique una promo o evento')}
                ${toggleRow('pref_seguidores', 'Nuevos seguidores y "me gusta"', p.notifSocial ?? true)}
                ${toggleRow('pref_recordatorio', 'Recordarme reseñar', p.notifRecordatorio ?? false, 'Un aviso al día siguiente de visitar un local')}
                ${toggleRow('pref_novedades', 'Novedades de Mesa Gourmet', p.notifNovedades ?? false)}
            </div><p class="sheet-text small">Las notificaciones al celular se activan al instalar la app.</p>`,
            actions: [{ label: 'Guardar', action: 'save-notif', variant: 'primary' }]
        });
    },
    'save-notif': () => {
        Object.assign(state.user.preferencias, {
            notifPromos: document.getElementById('pref_promos').checked,
            notifSocial: document.getElementById('pref_seguidores').checked,
            notifRecordatorio: document.getElementById('pref_recordatorio').checked,
            notifNovedades: document.getElementById('pref_novedades').checked
        });
        saveSession(state.user);
        closeSheet('settingsSheet');
        showToast('Preferencias guardadas');
    },
    'settings-diet': () => {
        const dietas = state.user.preferencias.dietas || [];
        openSheet({
            id: 'settingsSheet',
            title: 'Mis necesidades alimentarias',
            body: `<p class="sheet-text">Se aplicarán como filtro cada vez que abras la app.</p><div class="toggle-list">
                ${DIETAS.map(d => toggleRow(`diet_${d.key}`, `${d.emoji} ${d.label}`, dietas.includes(d.key))).join('')}
            </div>`,
            actions: [{ label: 'Guardar', action: 'save-diet', variant: 'primary' }]
        });
    },
    'save-diet': () => {
        state.user.preferencias.dietas = DIETAS.filter(d => document.getElementById(`diet_${d.key}`).checked).map(d => d.key);
        state.filtros = { ...FILTROS_VACIOS(), dietas: [...state.user.preferencias.dietas] };
        saveSession(state.user);
        closeSheet('settingsSheet');
        showToast('Guardado. Ya se aplican en el inicio.');
    },
    'settings-privacy': () => {
        const p = state.user.preferencias;
        openSheet({
            id: 'settingsSheet',
            title: 'Privacidad',
            body: `<div class="toggle-list">
                ${toggleRow('priv_publico', 'Perfil público', p.perfilPublico ?? true, 'Otros pueden ver tus reseñas y seguirte')}
                ${toggleRow('priv_comparte', 'Compartir mi nombre con los locales donde sea Top 50', !!state.user.comparteConLocales, 'Si quedas en el Top 50 de clientes de un local, le enviamos tu nombre, apellido y @usuario una vez al mes para que pueda ofrecerte beneficios. Si lo desactivas, igual ves tu puesto, pero el local no recibe tus datos.')}
                ${toggleRow('priv_ubicacion', 'Usar mi ubicación', p.usarUbicacion ?? true, 'Solo para mostrar locales cercanos; no la guardamos')}
            </div>`,
            actions: [{ label: 'Guardar', action: 'save-privacy', variant: 'primary' }]
        });
    },
    'top50-info': () => openSheet({
        id: 'top50Info',
        title: 'Top 50 de clientes',
        body: `<div class="sheet-text">
            <p>Cada local tiene su Top 50 de clientes del mes: las personas con <b>${MINIMO_TOP50} reseñas o más</b> en ese local durante el mes
            (cada reseña cuenta como una visita y solo se puede reseñar un local una vez al día). Si hay empate, queda primero quien llegó antes a esa cantidad.</p>
            <p>Al terminar el mes se cierra la lista. Cada local puede, <b>si quiere</b>, ofrecer un beneficio a su Top 50 (por ejemplo un descuento),
            que verás aquí. El beneficio lo entrega y define el local, no Mesa Gourmet.</p>
            <p><b>Tu privacidad:</b> tu puesto solo lo ves tú. El local recibe tu nombre, apellido y @usuario solo si lo autorizas en Privacidad,
            y la lista se borra de nuestros sistemas al cerrar el mes siguiente.</p>
            <p>Las reseñas deben ser reales y de tu propia visita: las reseñas falsas o hechas solo para subir en el ranking se eliminan y pueden bloquear la cuenta.</p>
        </div>`,
        actions: [{ label: 'Entendido', action: 'close-sheet', variant: 'primary' }]
    }),
    'save-privacy': () => {
        Object.assign(state.user.preferencias, {
            perfilPublico: document.getElementById('priv_publico').checked,
            usarUbicacion: document.getElementById('priv_ubicacion').checked
        });
        state.user.comparteConLocales = document.getElementById('priv_comparte').checked;
        // Las reseñas propias llevan la preferencia para que otros vean (o no) el perfil
        db.reviews.filter(r => r.usuario.id === state.user.id).forEach(r => { r.usuario.perfilPublico = state.user.preferencias.perfilPublico !== false; });
        persist();
        saveSession(state.user);
        closeSheet('settingsSheet');
        showToast('Privacidad actualizada');
        if (state.currentView === 'perfil') renderPerfil();
    },
    // Derecho de acceso y portabilidad (Ley 21.719)
    'download-data': () => {
        const data = {
            cuenta: state.user,
            resenas: userReviews(),
            videos: db.videos.filter(v => v.usuarioId === state.user.id),
            reportes: db.reports.filter(r => r.usuario?.id === state.user.id)
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'mis-datos-mesa-gourmet.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    // Derecho de supresión. Apple y Google exigen poder borrar la cuenta desde la app.
    'delete-account': () => openSheet({
        id: 'deleteAccount',
        title: '¿Eliminar tu cuenta?',
        body: '<p class="sheet-text">Se borrarán al instante tu cuenta, tu perfil, tus reseñas, tus fotos, tus videos, tus favoritos y tu lugar en los Top 50 de clientes. Esta acción no se puede deshacer. Si quieres una copia antes, usa "Descargar mis datos".</p>',
        actions: [{ label: 'Sí, eliminar mi cuenta', action: 'confirm-delete', variant: 'danger' }, { label: 'Cancelar', action: 'close-sheet', variant: 'ghost' }]
    }),
    'confirm-delete': async () => {
        const id = state.user.id;
        if (remoto) {
            // Derecho de supresión (Ley 21.719): primero se borran los archivos (fotos y videos) y luego la cuenta,
            // que en la base de datos borra en cascada todo lo demás (eliminar_mi_cuenta en actualizacion-3.sql).
            try {
                await borrarMisArchivos(id);
                const { error } = await supabase.rpc('eliminar_mi_cuenta');
                if (error) {
                    // Si la función aún no existe en el servidor, se borra lo publicado y queda la solicitud para el administrador
                    if (!/eliminar_mi_cuenta|function|404/i.test(error.message || '')) throw error;
                    await supabase.from('reportes').insert({ usuario_id: id, tipo: 'otro', estado: 'abierto', detalle: `Solicitud de eliminación de cuenta: ${state.user.email}` });
                    for (const tabla of ['resenas', 'videos', 'favoritos', 'quiero_ir', 'guardados']) await supabase.from(tabla).delete().eq('usuario_id', id);
                    await supabase.from('seguidores').delete().eq('seguidor_id', id);
                }
            } catch (err) {
                return showToast('No se pudo completar. Inténtalo de nuevo o escríbenos.');
            }
            db.reviews = db.reviews.filter(r => r.usuario.id !== id);
            db.videos = db.videos.filter(v => v.usuarioId !== id);
            closeSheet('deleteAccount');
            showToast('Tu cuenta y todo lo que publicaste fueron eliminados.', 5000);
            return logout();
        }
        db.reviews = db.reviews.filter(r => r.usuario.id !== id);
        db.videos = db.videos.filter(v => v.usuarioId !== id);
        [...db.reviews, ...db.videos, ...db.reviews.flatMap(r => r.fotos || [])].forEach(item => {
            if ((item.likedBy || []).includes(id)) {
                item.likedBy = item.likedBy.filter(x => x !== id);
                item.likes = Math.max(0, (item.likes || 0) - 1);
            }
        });
        persist();
        closeSheet('deleteAccount');
        showToast('Tu cuenta fue eliminada.');
        logout();
    }
});

