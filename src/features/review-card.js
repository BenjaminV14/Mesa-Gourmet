// Tarjeta de reseña y "me gusta" por usuario
import { state } from '../state.js';
import { db, persist, getLocal, addReport } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { showToast } from '../ui/feedback.js';
import { esc, safeUrl, initials } from '../utils/html.js';
import { timeAgo } from '../utils/time.js';
import { requireAccount } from './auth.js';
import { track } from '../services/analytics.js';

export function userLiked(item) {
    return !!state.user && !state.isGuest && (item.likedBy || []).includes(state.user.id);
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

export function likeButton(item, action) {
    const liked = userLiked(item);
    return `<button class="like-btn ${liked ? 'is-liked' : ''}" data-action="${action}" data-id="${esc(item.id)}" aria-pressed="${liked}" aria-label="Me gusta">${liked ? '❤️' : '🤍'} <span>${item.likes || 0}</span></button>`;
}

export function reviewCard(r, { showLocal = true } = {}) {
    const local = getLocal(r.localId);
    return `
    <article class="card review-card">
        <div class="review-head">
            <div class="avatar">${esc(r.usuario.avatar || initials(r.usuario.nombre))}</div>
            <div class="review-author">
                <b>${esc(r.usuario.nombre)}</b>
                <span>${esc(timeAgo(r.fecha))}</span>
            </div>
            ${r.fotoVerificada ? '<span class="verified-pill" title="Foto revisada">✔ Foto verificada</span>' : ''}
        </div>
        ${showLocal && local ? `<button class="review-local" data-action="open-local" data-id="${local.id}"><img src="${esc(safeUrl(local.imagen))}" alt=""> ${esc(local.nombre)}</button>` : ''}
        ${r.fotoComida ? `<img class="review-photo" src="${esc(safeUrl(r.fotoComida))}" alt="Foto de ${esc((r.productos || [])[0] || 'la comida')}" loading="lazy">` : ''}
        <p class="review-dishes">🍴 ${esc((r.productos || []).join(', '))}</p>
        <div class="review-scores">
            <span>🍽️ Comida <b>${r.notaComida.toFixed(1)}</b></span>
            <span>🤵 Servicio <b>${r.notaServicio.toFixed(1)}</b></span>
        </div>
        <p class="review-text">"${esc(r.comentario)}"</p>
        <div class="review-foot">
            ${likeButton(r, 'like-review')}
            <button class="report-mini" data-action="report-review" data-id="${esc(r.id)}" aria-label="Reportar reseña">⚑ Reportar</button>
        </div>
    </article>`;
}

function updateLikeButton(el, item) {
    const liked = userLiked(item);
    el.classList.toggle('is-liked', liked);
    el.setAttribute('aria-pressed', liked);
    el.innerHTML = `${liked ? '❤️' : '🤍'} <span>${item.likes || 0}</span>`;
}

registerActions({
    'like-review': el => {
        if (!requireAccount('dar me gusta')) return;
        const review = db.reviews.find(r => String(r.id) === el.dataset.id);
        if (!review) return;
        const liked = toggleLike(review);
        persist();
        updateLikeButton(el, review);
        track(liked ? 'like_resena' : 'unlike_resena', { reviewId: review.id });
    },
    'report-review': el => {
        if (!requireAccount('reportar contenido')) return;
        addReport({ tipo: 'resena', reviewId: el.dataset.id, usuario: { id: state.user.id, nombre: state.user.nombre } });
        showToast('Gracias. Un moderador revisará esta reseña.');
    }
});
