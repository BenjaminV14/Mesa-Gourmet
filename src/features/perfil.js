// Perfil del comensal. Solo para cuentas registradas.
import { state } from '../state.js';
import { db, persist, saveSession, getLocal } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';
import { esc, safeUrl, initials } from '../utils/html.js';
import { timeAgo } from '../utils/time.js';
import { levelProgress, levelName, visitedLocalesCount, computeLogros, userReviews } from './gamification.js';
import { logout } from './auth.js';

const PRODUCTOS_FAVORITOS = [
    ['Pisco Sour', '🍸'], ['Café', '☕'], ['Ceviche', '🦐'], ['Sushi', '🍣'], ['Empanada', '🥟'],
    ['Completo', '🌭'], ['Pizza', '🍕'], ['Hamburguesa', '🍔'], ['Pasta', '🍝'], ['Lomo Saltado', '🥩']
];

export function showWelcomeIfNeeded() {
    if (!state.user || state.isGuest || state.user.bienvenidaVista) return;
    openSheet({
        id: 'welcome',
        title: '¡Bienvenido/a a Mesa Gourmet!',
        body: `
            <p class="sheet-text">¿Cuál es tu producto favorito? Desbloqueas tu primera insignia.</p>
            <div class="fav-products-grid">
                ${PRODUCTOS_FAVORITOS.map(([name, emoji]) => `
                    <button class="fav-product-btn" data-action="pick-fav-product" data-name="${esc(name)}"><span>${emoji}</span><span>${esc(name)}</span></button>`).join('')}
            </div>`,
        actions: [{ label: 'Elegir después', action: 'skip-welcome', variant: 'ghost' }],
        dismissible: false
    });
}

export function renderPerfil() {
    if (!state.user || state.isGuest) return;
    const u = state.user;
    const { count, level, next, progress } = levelProgress();
    const favoritos = db.locales.filter(l => (u.favoritos || []).includes(l.id));
    const logros = computeLogros();
    const unlocked = logros.filter(l => l.unlocked);
    const misResenas = userReviews().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    document.getElementById('mainContent').innerHTML = `
        <section class="profile-hero">
            <div class="profile-avatar-large">${esc(initials(u.nombre))}</div>
            <h2>${esc(u.nombre)}</h2>
            <p class="muted">${esc(u.email)}</p>
            <div class="profile-level-pill">⭐ Nivel ${level} · ${esc(levelName(level))}</div>
            <div class="profile-progress-bar"><div class="profile-progress-fill" style="width:${progress}%;"></div></div>
            <p class="profile-progress-label">${count} reseña${count !== 1 ? 's' : ''} · faltan ${Math.max(0, next - count)} para el nivel ${level + 1}</p>
        </section>

        <section class="profile-section">
            <div class="profile-section-title">📊 Tus números</div>
            <div class="stats-grid">
                <div class="stat-card"><div class="stat-value">${count}</div><div class="stat-label">Reseñas</div></div>
                <div class="stat-card"><div class="stat-value">${visitedLocalesCount()}</div><div class="stat-label">Locales visitados</div></div>
                <div class="stat-card"><div class="stat-value">${favoritos.length}</div><div class="stat-label">Favoritos</div></div>
                <div class="stat-card"><div class="stat-value">${unlocked.length}</div><div class="stat-label">Logros</div></div>
            </div>
        </section>

        <section class="profile-section">
            <div class="profile-section-title">🏅 Insignias</div>
            <div class="badges-vitrina">
                ${u.productoFavorito
                    ? `<div class="vitrina-badge vitrina-badge-fav unlocked"><span class="vitrina-badge-emoji">⭐</span><span>Experto en ${esc(u.productoFavorito)}</span></div>`
                    : `<button class="vitrina-badge vitrina-badge-fav locked" data-action="open-welcome"><span class="vitrina-badge-emoji">⭐</span><span>Elige tu producto favorito</span></button>`}
                ${logros.map(l => `
                    <div class="vitrina-badge ${l.unlocked ? 'unlocked' : 'locked'}">
                        <span class="vitrina-badge-emoji">${l.emoji}</span>
                        <div class="vitrina-badge-title">${esc(l.titulo)}</div>
                        ${l.unlocked ? '' : `<small>${l.count}/${l.required}</small>`}
                    </div>`).join('')}
            </div>
        </section>

        <section class="profile-section">
            <div class="profile-section-title">❤️ Locales favoritos</div>
            ${favoritos.length ? `<div class="review-list">${favoritos.map(local => `
                <button class="card picker-card" data-action="open-local" data-id="${local.id}">
                    <img src="${esc(safeUrl(local.imagen))}" alt="">
                    <span><b>${esc(local.nombre)}</b><small>${esc(local.tipo)}</small></span>
                    <span class="rank-score">${(local.notaMG || 0).toFixed(1)} ★</span>
                </button>`).join('')}</div>`
                : '<p class="muted">Toca el ❤️ en un local para guardarlo aquí.</p>'}
        </section>

        <section class="profile-section">
            <div class="profile-section-title">✍️ Mis reseñas</div>
            ${misResenas.length ? `<div class="review-list">${misResenas.map(r => `
                <button class="card picker-card" data-action="open-local" data-id="${r.localId}" data-tab="resenas">
                    <span><b>${esc(getLocal(r.localId)?.nombre || '')}</b><small>${esc(timeAgo(r.fecha))} · ${r.estado === 'pendiente' ? 'En revisión' : 'Publicada'}</small></span>
                    <span class="rank-score">${((r.notaComida + r.notaServicio) / 2).toFixed(1)} ★</span>
                </button>`).join('')}</div>`
                : '<p class="muted">Aún no escribes reseñas.</p>'}
        </section>

        <section class="profile-section">
            <div class="profile-section-title">⚙️ Cuenta y privacidad</div>
            <div class="settings-list">
                <button class="settings-row" data-action="edit-name">✏️ Cambiar mi nombre</button>
                <button class="settings-row" data-action="download-data">📦 Descargar mis datos</button>
                <button class="settings-row danger" data-action="delete-account">🗑️ Eliminar mi cuenta</button>
                <button class="settings-row danger" data-action="logout">🚪 Cerrar sesión</button>
            </div>
        </section>
    `;
}

registerActions({
    'pick-fav-product': el => {
        state.user.productoFavorito = el.dataset.name;
        state.user.bienvenidaVista = true;
        saveSession(state.user);
        closeSheet('welcome');
        showToast(`🏅 Insignia desbloqueada: Experto en ${el.dataset.name}`);
        if (state.currentView === 'perfil') renderPerfil();
    },
    'skip-welcome': () => {
        state.user.bienvenidaVista = true;
        saveSession(state.user);
        closeSheet('welcome');
    },
    'open-welcome': () => {
        state.user.bienvenidaVista = false;
        showWelcomeIfNeeded();
    },
    'edit-name': () => openSheet({
        id: 'editName',
        title: 'Cambiar mi nombre',
        body: `<form class="sheet-form"><label for="newName">Nombre visible</label><input id="newName" maxlength="40" value="${esc(state.user.nombre)}"></form>`,
        actions: [{ label: 'Guardar', action: 'save-name', variant: 'primary' }, { label: 'Cancelar', action: 'close-sheet', variant: 'ghost' }]
    }),
    'save-name': () => {
        const nombre = document.getElementById('newName').value.trim();
        if (nombre.length < 2) return showToast('El nombre debe tener al menos 2 letras.');
        state.user.nombre = nombre;
        saveSession(state.user);
        closeSheet('editName');
        document.getElementById('userName').textContent = nombre.split(' ')[0];
        document.getElementById('userAvatar').textContent = initials(nombre);
        renderPerfil();
    },
    // Derecho de acceso y portabilidad (Ley 21.719): el usuario puede llevarse sus datos
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
    // Derecho de supresión. Además, Apple y Google exigen poder borrar la cuenta desde la app.
    'delete-account': () => openSheet({
        id: 'deleteAccount',
        title: '¿Eliminar tu cuenta?',
        body: '<p class="sheet-text">Se borrarán tu perfil, tus reseñas, tus videos y tus favoritos. Esta acción no se puede deshacer.</p>',
        actions: [{ label: 'Sí, eliminar mi cuenta', action: 'confirm-delete', variant: 'danger' }, { label: 'Cancelar', action: 'close-sheet', variant: 'ghost' }]
    }),
    'confirm-delete': () => {
        const id = state.user.id;
        db.reviews = db.reviews.filter(r => r.usuario.id !== id);
        db.videos = db.videos.filter(v => v.usuarioId !== id);
        [...db.reviews, ...db.videos].forEach(item => {
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
