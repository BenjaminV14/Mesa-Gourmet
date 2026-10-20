// Formulario de reseña: marca lo que consumiste (en el orden de la carta), sube fotos de cada plato o bebestible,
// pon notas con decimales (0,1 a 10) y el precio aproximado por persona.
import { state } from '../state.js';
import { db, persist, getLocal } from '../data/store.js';
import { cartaLocal } from '../data/metrics.js';
import { registerActions } from '../ui/actions.js';
import { showToast } from '../ui/feedback.js';
import { esc, initials } from '../utils/html.js';
import { requireAccount } from './auth.js';
import { userReviews, checkLevelUp, computeLogros } from './gamification.js';
import { isSponsored } from './sponsors.js';
import { compressImage, verifyDishPhoto } from '../services/ai.js';
import { track } from '../services/analytics.js';

export const PRECIOS_PERSONA = ['Menos de $5.000', '$5.000 – $10.000', '$10.000 – $15.000', '$15.000 – $25.000', 'Más de $25.000'];
const MAX_FOTOS_PLATO = 4;

let photos = {};        // índice del plato -> [dataURL, ...]
let onPublished = () => {};

export function setReviewPublishedHandler(fn) {
    onPublished = fn;
}

function scoreField(id, label) {
    return `
        <div class="score-field">
            <label for="${id}Num">${label}</label>
            <div class="score-inputs">
                <input type="range" id="${id}" min="0.1" max="10" step="0.1" value="7" class="custom-slider" data-input="score-sync" data-target="${id}Num">
                <input type="number" id="${id}Num" min="0.1" max="10" step="0.1" value="7.0" inputmode="decimal" data-input="score-sync" data-target="${id}" aria-label="${label} (número)">
            </div>
        </div>`;
}

export function openReviewForm(localId) {
    if (!requireAccount('escribir reseñas')) return;
    const local = getLocal(localId);
    if (!local) return;
    photos = {};
    document.getElementById('reviewModal')?.remove();

    const items = cartaLocal(local).map(c => c.item);
    const modal = document.createElement('div');
    modal.id = 'reviewModal';
    modal.className = 'detail-view review-modal';
    modal.innerHTML = `
        <header class="detail-header">
            <button class="back-btn" data-action="close-review">✕ Cerrar</button>
            <h1>Nueva reseña</h1>
            <p class="detail-type">${esc(local.nombre)}</p>
        </header>
        <form id="reviewForm" class="review-form" data-local="${local.id}" novalidate>
            <fieldset>
                <legend>¿Qué consumiste? <small>Puedes subir fotos de cada plato o bebestible</small></legend>
                <div class="dish-picker">
                    ${items.map((item, idx) => `
                        <div class="dish-selector-card" id="dishCard_${idx}">
                            <label class="dish-check">
                                <input type="checkbox" id="checkDish_${idx}" data-change="dish-toggle" data-idx="${idx}">
                                <span>${esc(item.nombre)}</span>
                            </label>
                            <div class="dish-controls" id="dishControls_${idx}" hidden>
                                <button type="button" class="dish-counter-btn" data-action="dish-count" data-idx="${idx}" data-diff="-1" aria-label="Menos">−</button>
                                <span id="dishCount_${idx}" class="dish-count">1</span>
                                <button type="button" class="dish-counter-btn" data-action="dish-count" data-idx="${idx}" data-diff="1" aria-label="Más">+</button>
                                <label class="dish-photo-uploader">
                                    📸 Fotos
                                    <input type="file" accept="image/*" multiple data-change="dish-photo" data-idx="${idx}" hidden>
                                </label>
                            </div>
                            <div class="dish-thumbs" id="dishThumbs_${idx}"></div>
                        </div>
                    `).join('')}
                </div>
            </fieldset>

            ${scoreField('scoreComida', 'Nota a la comida')}
            ${scoreField('scoreServicio', 'Nota al servicio')}

            <fieldset>
                <legend>Precio aproximado por persona <small>(opcional)</small></legend>
                <div class="filter-chips">
                    ${PRECIOS_PERSONA.map((p, i) => `<label class="chip-radio"><input type="radio" name="precioPersona" value="${esc(p)}" id="precio_${i}"><span>${esc(p)}</span></label>`).join('')}
                </div>
            </fieldset>

            <label for="reviewText">Tu experiencia</label>
            <textarea id="reviewText" rows="4" maxlength="1000" placeholder="¿Qué tal la comida, la atención y el ambiente?"></textarea>

            <p class="form-error" id="reviewError" role="alert" hidden></p>
            <button type="submit" class="btn-submit" id="reviewSubmit">Publicar reseña ⭐</button>
        </form>
    `;
    document.body.appendChild(modal);
    document.getElementById('reviewForm').addEventListener('submit', submitReview);
}

function showFormError(message) {
    const el = document.getElementById('reviewError');
    el.textContent = message;
    el.hidden = !message;
}

function renderThumbs(idx) {
    const box = document.getElementById(`dishThumbs_${idx}`);
    box.innerHTML = (photos[idx] || []).map((url, i) => `
        <span class="dish-thumb"><img src="${url}" alt=""><button type="button" data-action="dish-photo-remove" data-idx="${idx}" data-i="${i}" aria-label="Quitar foto">✕</button></span>`).join('');
}

function readScore(id) {
    const v = Number(document.getElementById(`${id}Num`).value);
    return Math.round(Math.min(10, Math.max(0.1, v || 0.1)) * 10) / 10;
}

async function submitReview(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const local = getLocal(Number(form.dataset.local));
    const items = cartaLocal(local).map(c => c.item);

    const seleccion = items
        .map((item, idx) => ({ item, idx, checked: document.getElementById(`checkDish_${idx}`).checked }))
        .filter(s => s.checked);
    if (!seleccion.length) return showFormError('Marca al menos un plato o bebestible que consumiste.');

    const comentario = document.getElementById('reviewText').value.trim();
    if (comentario.length < 10) return showFormError('Cuéntanos un poco más (mínimo 10 caracteres).');

    const submit = document.getElementById('reviewSubmit');
    submit.disabled = true;
    submit.textContent = 'Revisando fotos…';
    showFormError('');

    const reviewId = `r-${Date.now()}`;
    const fotos = [];
    let rechazada = false;
    const pendientes = [];
    for (const s of seleccion) {
        for (const [i, url] of (photos[s.idx] || []).entries()) {
            const v = await verifyDishPhoto(url, s.item.nombre);
            if (v.estado === 'rechazada') rechazada = true;
            if (v.estado !== 'aprobada') pendientes.push(v.motivo);
            fotos.push({ id: `f-${reviewId}-${s.idx}-${i}`, item: s.item.nombre, url, likes: 0, likedBy: [], verificada: v.estado === 'aprobada' });
        }
    }

    const previousCount = userReviews().length;
    const previousLogros = computeLogros();
    const ahora = new Date();
    const hhmm = ahora.toTimeString().slice(0, 5);
    const promoActiva = (local.promociones || []).some(p => (p.dias || []).includes(ahora.getDay()) && (!p.horaInicio || hhmm >= p.horaInicio) && (!p.horaFin || hhmm <= p.horaFin));
    const review = {
        id: reviewId,
        usuario: { id: state.user.id, nombre: state.user.nombre, username: state.user.username, avatar: initials(state.user.nombre) },
        fecha: new Date().toISOString(),
        localId: local.id,
        productos: seleccion.map(s => `${s.item.nombre} (x${document.getElementById(`dishCount_${s.idx}`).textContent})`),
        fotos,
        notaComida: readScore('scoreComida'),
        notaServicio: readScore('scoreServicio'),
        precioPersona: form.querySelector('input[name="precioPersona"]:checked')?.value || null,
        comentario,
        likes: 0,
        likedBy: [],
        isDrink: seleccion.every(s => s.item.isDrink),
        // Para la misión "Cazador de promociones"
        enPromocion: isSponsored(local) || promoActiva,
        estado: rechazada ? 'pendiente' : 'publicada'
    };

    db.reviews.unshift(review);
    if (pendientes.length) {
        db.moderation.unshift({ id: `mod-${Date.now()}`, tipo: 'foto', reviewId: review.id, motivo: pendientes[0], fecha: review.fecha });
    }
    persist();
    track('resena_publicada', { localId: local.id, fotos: fotos.length, estado: review.estado });

    document.getElementById('reviewModal').remove();
    if (review.estado === 'pendiente') {
        showToast('Una foto no parece corresponder al plato. Tu reseña quedó en revisión.', 4500);
    } else {
        showToast('¡Reseña publicada! Gracias por tu aporte.');
        checkLevelUp(previousCount, previousLogros);
    }
    onPublished(local.id);
}

registerActions({
    'close-review': () => document.getElementById('reviewModal')?.remove(),
    'dish-toggle': el => {
        const idx = el.dataset.idx;
        document.getElementById(`dishCard_${idx}`).classList.toggle('selected', el.checked);
        document.getElementById(`dishControls_${idx}`).hidden = !el.checked;
    },
    'dish-count': el => {
        const span = document.getElementById(`dishCount_${el.dataset.idx}`);
        span.textContent = Math.max(1, Math.min(20, Number(span.textContent) + Number(el.dataset.diff)));
    },
    'dish-photo': async el => {
        const idx = el.dataset.idx;
        const files = [...el.files];
        el.value = '';
        photos[idx] = photos[idx] || [];
        for (const file of files) {
            if (photos[idx].length >= MAX_FOTOS_PLATO) { showToast(`Máximo ${MAX_FOTOS_PLATO} fotos por plato.`); break; }
            if (file.size > 15 * 1024 * 1024) { showToast('Una foto pesa más de 15 MB y no se agregó.'); continue; }
            try {
                photos[idx].push(await compressImage(file));
            } catch (err) {
                showToast(err.message);
            }
        }
        renderThumbs(idx);
    },
    'dish-photo-remove': el => {
        photos[el.dataset.idx].splice(Number(el.dataset.i), 1);
        renderThumbs(el.dataset.idx);
    },
    // El deslizador y el número se mantienen sincronizados (pasos de 0,1)
    'score-sync': el => {
        const other = document.getElementById(el.dataset.target);
        const v = Math.min(10, Math.max(0.1, Number(el.value) || 0.1));
        other.value = other.type === 'number' ? v.toFixed(1) : v;
    }
});
