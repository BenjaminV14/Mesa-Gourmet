// Tarjeta de reseña: todas las fotos en un carrusel (cada una con sus propios "me gusta"), seguir a la persona,
// guardar la reseña y "Quiero ir". No hay comentarios: la reseña queda como opinión de quien la escribe.
import { state, isLoggedIn } from '../state.js';
import { db, persist, getLocal, addReport, saveSession } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { showToast } from '../ui/feedback.js';
import { esc, safeUrl, avatarContent } from '../utils/html.js';
import { vipsDeLocal } from '../data/metrics.js';
import { timeAgo } from '../utils/time.js';
import { requireAccount } from './auth.js';
import { track } from '../services/analytics.js';

export function userLiked(item) {
    return isLoggedIn() && (item.likedBy || []).includes(state.user.id);
}

// Agrega o quita el like del usuario actual. Devuelve true si quedó marcado.
export function toggleLike(item) {
    item.likedBy = item.likedBy || [];
    const idx = item.likedBy.indexOf(state.user.id);
    if (idx > -1) {
        item.likedBy.splice(idx, 1);
        item.likes = Math.max(0, (item.likes || 0) - 1);
        return false;
    }
    item.likedBy.push(state.user.id);
    item.likes = (item.likes || 0) + 1;
    return true;
}

export function likeButton(item, action, extra = {}) {
    const liked = userLiked(item);
    const attrs = Object.entries(extra).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    return `<button class="like-btn ${liked ? 'is-liked' : ''}" data-action="${action}" data-id="${esc(item.id)}" ${attrs} aria-pressed="${liked}" aria-label="Me gusta">${liked ? '❤️' : '🤍'} <span>${item.likes || 0}</span></button>`;
}

function siguiendo(userId) {
    return isLoggedIn() && state.user.siguiendo.includes(userId);
}

export function reviewCard(r, { showLocal = true } = {}) {
    const local = getLocal(r.localId);
    const propia = isLoggedIn() && r.usuario.id === state.user.id;
    const guardada = isLoggedIn() && state.user.guardados.resenas.includes(String(r.id));
    const fotos = r.fotos || [];
    return `
    <article class="card review-card" data-review="${esc(r.id)}">
        <div class="review-head">
            <div class="avatar">${avatarContent(r.usuario)}</div>
            <div class="review-author">
                <b>${esc(r.usuario.nombre)}${local && vipsDeLocal(local.id).some(c => c.usuario.id === r.usuario.id) ? ` <span class="vip-badge" title="Cliente VIP de ${esc(local.nombre)}">👑 VIP</span>` : ''}</b>
                <span>${r.usuario.username ? `@${esc(r.usuario.username)} · ` : ''}${esc(timeAgo(r.fecha))}</span>
            </div>
            ${propia ? '' : `<button class="follow-btn ${siguiendo(r.usuario.id) ? 'is-on' : ''}" data-action="follow-user" data-user="${esc(r.usuario.id)}">${siguiendo(r.usuario.id) ? 'Siguiendo' : 'Seguir'}</button>`}
        </div>
        ${showLocal && local ? `<button class="review-local" data-action="open-local" data-id="${local.id}"><img src="${esc(safeUrl(local.imagen))}" alt=""> ${esc(local.nombre)}</button>` : ''}
        ${fotos.length ? `
        <div class="photo-carousel" data-carousel="${esc(r.id)}">
            <div class="photo-track" data-carousel-track>
                ${fotos.map((f, i) => `
                <figure class="review-photo-item" data-index="${i}">
                    <img src="${esc(safeUrl(f.url))}" alt="Foto de ${esc(f.item)}" loading="lazy">
                    <figcaption>
                        <span>${esc(f.item)} ${f.verificada ? '<span class="verified-dot" title="Foto verificada">✔</span>' : ''}</span>
                        ${likeButton(f, 'like-photo-item', { review: r.id })}
                    </figcaption>
                </figure>`).join('')}
            </div>
            ${fotos.length > 1 ? `
            <button class="carousel-btn prev" data-action="photo-step" data-dir="-1" aria-label="Foto anterior" hidden>‹</button>
            <button class="carousel-btn next" data-action="photo-step" data-dir="1" aria-label="Foto siguiente">›</button>
            <span class="carousel-count">1 / ${fotos.length}</span>` : ''}
        </div>` : ''}
        <p class="review-dishes">🍴 ${esc((r.productos || []).join(', '))}</p>
        <div class="review-scores">
            <span>🍽️ Comida <b>${r.notaComida.toFixed(1)}</b></span>
            <span>🤵 Servicio <b>${r.notaServicio.toFixed(1)}</b></span>
            ${r.precioPersona ? `<span>💵 ${esc(r.precioPersona)} por persona</span>` : ''}
        </div>
        <p class="review-text">"${esc(r.comentario)}"</p>
        <div class="review-foot">
            ${likeButton(r, 'like-review')}
            <div class="review-foot-actions">
                ${local && !propia ? `<button class="mini-action quiero-btn ${isLoggedIn() && state.user.quieroIr.includes(local.id) ? 'is-on' : ''}" data-action="toggle-quiero" data-id="${local.id}">🔖 Quiero ir</button>` : ''}
                <button class="mini-action ${guardada ? 'is-on' : ''}" data-action="save-review" data-id="${esc(r.id)}" aria-pressed="${guardada}">${guardada ? '📌 Guardada' : '📌 Guardar'}</button>
                <button class="report-mini" data-action="report-review" data-id="${esc(r.id)}" aria-label="Reportar reseña">⚑</button>
            </div>
        </div>
    </article>`;
}

function updateLikeButton(el, item) {
    const liked = userLiked(item);
    el.classList.toggle('is-liked', liked);
    el.setAttribute('aria-pressed', liked);
    el.innerHTML = `${liked ? '❤️' : '🤍'} <span>${item.likes || 0}</span>`;
}

function findReview(id) {
    return db.reviews.find(r => String(r.id) === String(id));
}

// Carrusel de fotos: la primera que subió la persona y, con la flecha, las siguientes
function syncCarousel(box) {
    const track = box.querySelector('[data-carousel-track]');
    const total = track.children.length;
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const count = box.querySelector('.carousel-count');
    if (count) count.textContent = `${i + 1} / ${total}`;
    const prev = box.querySelector('.carousel-btn.prev');
    const next = box.querySelector('.carousel-btn.next');
    if (prev) prev.hidden = i === 0;
    if (next) next.hidden = i >= total - 1;
}

document.addEventListener('scroll', e => {
    const track = e.target instanceof Element && e.target.closest?.('[data-carousel-track]');
    if (track) syncCarousel(track.parentElement);
}, true);

registerActions({
    'photo-step': el => {
        const box = el.closest('[data-carousel]');
        const track = box.querySelector('[data-carousel-track]');
        track.scrollBy({ left: Number(el.dataset.dir) * track.clientWidth, behavior: 'smooth' });
    },
    'like-review': el => {
        if (!requireAccount('dar me gusta')) return;
        const review = findReview(el.dataset.id);
        if (!review) return;
        const liked = toggleLike(review);
        persist();
        updateLikeButton(el, review);
        track(liked ? 'like_resena' : 'unlike_resena', { reviewId: review.id });
    },
    // Cada foto tiene sus propios "me gusta": la más likeada de cada plato es la que aparece en la carta
    'like-photo-item': el => {
        if (!requireAccount('dar me gusta')) return;
        const review = findReview(el.dataset.review);
        const foto = (review?.fotos || []).find(f => f.id === el.dataset.id);
        if (!foto) return;
        const liked = toggleLike(foto);
        persist();
        document.querySelectorAll(`[data-action="like-photo-item"][data-id="${CSS.escape(foto.id)}"]`).forEach(b => updateLikeButton(b, foto));
        track(liked ? 'like_foto' : 'unlike_foto', { fotoId: foto.id, plato: foto.item });
    },
    'follow-user': el => {
        if (!requireAccount('seguir a otros comensales')) return;
        const id = el.dataset.user;
        const list = state.user.siguiendo;
        const idx = list.indexOf(id);
        if (idx > -1) list.splice(idx, 1); else list.push(id);
        saveSession(state.user);
        document.querySelectorAll(`.follow-btn[data-user="${CSS.escape(id)}"]`).forEach(b => {
            b.classList.toggle('is-on', idx === -1);
            b.textContent = idx === -1 ? 'Siguiendo' : 'Seguir';
        });
        track(idx === -1 ? 'seguir' : 'dejar_de_seguir', { usuario: id });
    },
    'save-review': el => {
        if (!requireAccount('guardar reseñas')) return;
        const id = String(el.dataset.id);
        const list = state.user.guardados.resenas;
        const idx = list.indexOf(id);
        if (idx > -1) list.splice(idx, 1); else list.push(id);
        saveSession(state.user);
        el.classList.toggle('is-on', idx === -1);
        el.textContent = idx === -1 ? '📌 Guardada' : '📌 Guardar';
    },
    'report-review': el => {
        if (!requireAccount('reportar contenido')) return;
        addReport({ tipo: 'resena', reviewId: el.dataset.id, usuario: { id: state.user.id, nombre: state.user.nombre } });
        showToast('Gracias. Un moderador revisará esta reseña.');
    }
});
