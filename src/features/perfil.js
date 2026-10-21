// Perfil del comensal: identidad (nombre y @usuario), estadísticas, insignias, guardados, "Quiero ir",
// favoritos, reseñas propias y configuración. Solo para cuentas registradas.
import { state, FILTROS_VACIOS } from '../state.js';
import { db, persist, saveSession, getLocal } from '../data/store.js';
import { TIPOS_PLATO, getTipo, buscarTipos } from '../data/tipos-plato.js';
import { vipDeUsuario } from '../data/metrics.js';
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
        const locales = u.quieroIr.map(getLocal).filter(Boolean);
        return locales.length ? `<div class="review-list">${locales.map(l => localRow(l)).join('')}</div>`
            : '<p class="muted center">Toca 🔖 "Quiero ir" en un local o una reseña para armar tu lista.</p>';
    }
    const favs = u.favoritos.map(getLocal).filter(Boolean);
    return favs.length ? `<div class="review-list">${favs.map(l => localRow(l)).join('')}</div>`
        : '<p class="muted center">Toca ❤️ en un local para guardarlo en favoritos.</p>';
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
                    <h2>${esc(u.nombre)}</h2>
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
            <label for="newName">Nombre visible</label><input id="newName" maxlength="40" value="${esc(state.user.nombre)}">
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
        const username = document.getElementById('newUsername').value.trim().toLowerCase();
        const err = document.getElementById('profileError');
        const fail = m => { err.textContent = m; err.hidden = false; };
        if (nombre.length < 2) return fail('El nombre debe tener al menos 2 letras.');
        if (!/^[a-z0-9_.]{3,24}$/.test(username)) return fail('El usuario debe tener entre 3 y 24 caracteres: letras, números, punto o guion bajo.');
        if (db.reviews.some(r => r.usuario.username === username && r.usuario.id !== state.user.id)) return fail('Ese nombre de usuario ya está en uso.');
        state.user.nombre = nombre;
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
                ${toggleRow('priv_ranking', 'Participar como cliente frecuente', p.mostrarEnRanking ?? true, 'Los locales pueden ofrecerte beneficios si los visitas seguido')}
                ${toggleRow('priv_ubicacion', 'Usar mi ubicación', p.usarUbicacion ?? true, 'Solo para mostrar locales cercanos; no la guardamos')}
            </div>`,
            actions: [{ label: 'Guardar', action: 'save-privacy', variant: 'primary' }]
        });
    },
    'save-privacy': () => {
        Object.assign(state.user.preferencias, {
            perfilPublico: document.getElementById('priv_publico').checked,
            mostrarEnRanking: document.getElementById('priv_ranking').checked,
            usarUbicacion: document.getElementById('priv_ubicacion').checked
        });
        saveSession(state.user);
        closeSheet('settingsSheet');
        showToast('Privacidad actualizada');
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
        body: '<p class="sheet-text">Se borrarán tu perfil, tus reseñas, tus fotos, tus videos y tus favoritos. Esta acción no se puede deshacer.</p>',
        actions: [{ label: 'Sí, eliminar mi cuenta', action: 'confirm-delete', variant: 'danger' }, { label: 'Cancelar', action: 'close-sheet', variant: 'ghost' }]
    }),
    'confirm-delete': async () => {
        const id = state.user.id;
        if (remoto) {
            // Se borra todo lo publicado por la persona y queda la solicitud para borrar la cuenta (Ley 21.719).
            // El administrador elimina el acceso en Supabase > Authentication > Users dentro de 30 días.
            try {
                await supabase.from('reportes').insert({ usuario_id: id, tipo: 'otro', estado: 'abierto', detalle: `Solicitud de eliminación de cuenta: ${state.user.email}` });
                for (const tabla of ['resenas', 'videos', 'favoritos', 'quiero_ir', 'guardados']) await supabase.from(tabla).delete().eq('usuario_id', id);
                await supabase.from('seguidores').delete().eq('seguidor_id', id);
            } catch (err) {
                return showToast('No se pudo completar. Inténtalo de nuevo o escríbenos.');
            }
            db.reviews = db.reviews.filter(r => r.usuario.id !== id);
            closeSheet('deleteAccount');
            showToast('Borramos tus reseñas, fotos y videos. Tu cuenta se elimina por completo en los próximos días.', 5000);
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

