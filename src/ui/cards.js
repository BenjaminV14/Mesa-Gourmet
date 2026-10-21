// Piezas de interfaz reutilizadas en varias pantallas
import { esc, safeUrl, formatPrice } from '../utils/html.js';
import { estadoHorario } from '../utils/time.js';
import { notas30, fotosDePlato } from '../data/metrics.js';
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

const STAR_PATH = 'M12 2.5l2.9 6.06 6.6.82-4.86 4.57 1.25 6.55L12 17.3l-5.89 3.2 1.25-6.55L2.5 9.38l6.6-.82z';
let starSeq = 0;

/**
 * Cinco estrellas pintadas en proporción exacta a la nota (escala 1 a 10).
 * Ej.: 8,5 -> 85%: cuatro estrellas llenas y la quinta pintada en un 25%.
 */
export function ratingStars(rating, size = 16) {
    const value = Math.max(0, Math.min(10, Number(rating) || 0));
    const stars = Array.from({ length: 5 }, (_, i) => {
        const fill = Math.max(0, Math.min(1, value / 2 - i));
        const id = `st${++starSeq}`;
        return `<svg class="star" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">
            <path d="${STAR_PATH}" class="star-empty"/>
            ${fill > 0 ? `<clipPath id="${id}"><rect width="${(fill * 24).toFixed(2)}" height="24"/></clipPath><path d="${STAR_PATH}" class="star-full" clip-path="url(#${id})"/>` : ''}
        </svg>`;
    }).join('');
    return `<span class="stars" role="img" aria-label="Nota ${value.toFixed(1)} de 10">${stars}</span>`;
}

export function notaLabel(nota) {
    if (nota.periodo === '30d') return `${nota.n} reseña${nota.n === 1 ? '' : 's'} en 30 días`;
    if (nota.periodo === 'historica') return 'Nota histórica';
    return 'Sin reseñas aún';
}

// Comida y servicio de los últimos 30 días, para las tarjetas
function notasTarjeta(local) {
    const n = notas30(local.id);
    if (!n) return { total: 0, html: '<span class="rating-breakdowns">Sin reseñas en los últimos 30 días</span>' };
    return {
        total: n.total,
        html: `<span class="rating-split" title="Promedio de los últimos 30 días">🍽️ <b>${n.comida.toFixed(1)}</b> · 🤵 <b>${n.servicio.toFixed(1)}</b></span>`
    };
}

export function localCard(local, { platos = [] } = {}) {
    const nota30 = notasTarjeta(local);
    const estado = estadoHorario(local);
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
            <p class="card-meta card-meta-strong">${esc(estado.detalle)} · 📍 ${esc(formatDistance(distanceTo(local)))}</p>
            <div class="card-rating">
                ${ratingStars(nota30.total)}
                <span class="rating-score">${nota30.total ? nota30.total.toFixed(1) : '–'}</span>
                ${nota30.html}
            </div>
            ${platos.length ? `<div class="card-matches">${platos.slice(0, 3).map(p => `<span class="match-pill">${esc(p.nombre)} · ${esc(formatPrice(p.precio))}</span>`).join('')}</div>` : ''}
            <div class="card-actions">
                <button class="btn btn-primary" data-action="open-local" data-id="${local.id}" data-tab="menu">📋 Ver carta</button>
                <button class="btn btn-icon fav-btn ${isFav ? 'is-fav' : ''}" data-action="toggle-fav" data-id="${local.id}" aria-label="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}" aria-pressed="${isFav}">❤️</button>
            </div>
        </div>
    </article>`;
}

export function dishResult({ local, item }) {
    const sponsored = isSponsored(local);
    const foto = fotosDePlato(local.id, item.nombre).sort((a, b) => (b.likes || 0) - (a.likes || 0))[0];
    return `
    <button class="dish-result ${sponsored ? 'is-sponsored' : ''}" data-action="open-local" data-id="${local.id}" data-tab="menu">
        <img src="${esc(safeUrl(foto ? foto.url : item.imagen))}" alt="" loading="lazy">
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
