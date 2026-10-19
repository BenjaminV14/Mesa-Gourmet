// Piezas de interfaz reutilizadas en varias pantallas
import { esc, safeUrl, formatPrice } from '../utils/html.js';
import { estadoHorario, horarioHoy } from '../utils/time.js';
import { formatDistance } from '../utils/geo.js';
import { isSponsored, distanceTo } from '../features/sponsors.js';
import { state, isLoggedIn } from '../state.js';

export function estadoBadge(local) {
    const estado = estadoHorario(local);
    return `<span class="badge estado-${estado.codigo}" title="${esc(estado.detalle)}">${esc(estado.etiqueta)}</span>`;
}

export function sponsoredBadge(local) {
    return isSponsored(local) ? `<span class="badge-sponsored" title="Publicidad pagada por el local">★ Destacado</span>` : '';
}

export function ratingStars(rating) {
    const fill = Math.max(0, Math.min(100, (rating / 10) * 100));
    return `<div class="star-rating-outer" aria-label="Nota ${rating.toFixed(1)} de 10"><div class="star-rating-inner" style="width:${fill}%;"></div></div>`;
}

export function localCard(local, { platos = [] } = {}) {
    const rating = local.notaMG || 0;
    const estado = estadoHorario(local);
    const hoy = horarioHoy(local);
    const isFav = isLoggedIn() && (state.user.favoritos || []).includes(local.id);
    const sponsored = isSponsored(local);

    return `
    <article class="card local-card ${sponsored ? 'is-sponsored' : ''}" data-action="open-local" data-id="${local.id}">
        <div class="card-img-wrapper">
            <img src="${esc(safeUrl(local.imagen))}" alt="" loading="lazy">
        </div>
        <div class="card-body">
            <div class="card-header">
                <h3 class="card-title">${esc(local.nombre)}</h3>
                ${estadoBadge(local)}
            </div>
            <p class="card-meta">${esc(local.tipo)} ${sponsoredBadge(local)}</p>
            <p class="card-meta card-meta-strong">${esc(estado.detalle)} · ${esc(formatDistance(distanceTo(local)))}</p>
            <p class="card-meta">Hoy: ${esc(hoy.rango)}</p>
            <div class="card-rating">
                ${ratingStars(rating)}
                <span class="rating-score">${rating.toFixed(1)}</span>
                <span class="rating-breakdowns">🍽️ ${(local.notaComida || 0).toFixed(1)} · 🤵 ${(local.notaServicio || 0).toFixed(1)}</span>
            </div>
            ${platos.length ? `<div class="card-matches">${platos.slice(0, 3).map(p => `<span class="match-pill">${esc(p.nombre)} · ${esc(formatPrice(p.precio))}</span>`).join('')}</div>` : ''}
            <div class="card-actions">
                <button class="btn btn-primary" data-action="open-local" data-id="${local.id}" data-tab="menu">📋 Ver menú</button>
                <button class="btn btn-icon fav-btn ${isFav ? 'is-fav' : ''}" data-action="toggle-fav" data-id="${local.id}" aria-label="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}" aria-pressed="${isFav}">❤️</button>
            </div>
        </div>
    </article>`;
}

export function dishResult({ local, item }) {
    const sponsored = isSponsored(local);
    return `
    <button class="dish-result ${sponsored ? 'is-sponsored' : ''}" data-action="open-local" data-id="${local.id}" data-tab="menu">
        <img src="${esc(safeUrl(item.imagen))}" alt="" loading="lazy">
        <span class="dish-result-info">
            <span class="dish-result-name">${esc(item.nombre)}</span>
            <span class="dish-result-local">${esc(local.nombre)} ${sponsored ? '<span class="badge-sponsored">★ Destacado</span>' : ''}</span>
        </span>
        <span class="dish-result-price">${esc(formatPrice(item.precio))}</span>
    </button>`;
}

export function emptyState(icon, text) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${text}</p></div>`;
}
