// Formulario para escribir una reseña con fotos reales de los platos
import { state } from '../state.js';
import { db, persist, getLocal, recomputeLocalScores } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { showToast } from '../ui/feedback.js';
import { esc, initials } from '../utils/html.js';
import { requireAccount } from './auth.js';
import { userReviews, checkLevelUp } from './gamification.js';
import { compressImage, verifyDishPhoto } from '../services/ai.js';
import { track } from '../services/analytics.js';

let photos = {};        // índice del plato -> dataURL comprimida
let onPublished = () => {};

export function setReviewPublishedHandler(fn) {
    onPublished = fn;
}

export function openReviewForm(localId) {
    if (!requireAccount('escribir reseñas')) return;
    const local = getLocal(localId);
    if (!local) return;
    photos = {};
    document.getElementById('reviewModal')?.remove();

    const items = (local.menu || []).filter(m => m.nombre);
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
                <legend>¿Qué consumiste?</legend>
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
                                <label class="dish-photo-uploader" id="photoLabel_${idx}">
                                    📸 Foto
                                    <input type="file" accept="image/*" capture="environment" data-change="dish-photo" data-idx="${idx}" hidden>
                                </label>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </fieldset>

            <label for="sliderComida">Comida: <b id="valComida">7.0</b></label>
            <input type="range" id="sliderComida" min="1" max="10" step="0.5" value="7" class="custom-slider" data-input="score-slider" data-target="valComida">

            <label for="sliderServicio">Servicio: <b id="valServicio">7.0</b></label>
            <input type="range" id="sliderServicio" min="1" max="10" step="0.5" value="7" class="custom-slider" data-input="score-slider" data-target="valServicio">

            <label for="reviewSpend">Consumo total aproximado ($)</label>
            <input type="number" id="reviewSpend" inputmode="numeric" min="0" max="1000000" placeholder="Ej: 15000">

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

async function submitReview(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const local = getLocal(Number(form.dataset.local));
    const items = (local.menu || []).filter(m => m.nombre);

    const seleccion = items
        .map((item, idx) => ({ item, idx, checked: document.getElementById(`checkDish_${idx}`).checked }))
        .filter(s => s.checked);
    if (!seleccion.length) return showFormError('Marca al menos un plato o producto que consumiste.');

    const comentario = document.getElementById('reviewText').value.trim();
    if (comentario.length < 10) return showFormError('Cuéntanos un poco más (mínimo 10 caracteres).');

    const submit = document.getElementById('reviewSubmit');
    submit.disabled = true;
    submit.textContent = 'Revisando fotos…';
    showFormError('');

    const productos = seleccion.map(s => `${s.item.nombre} (x${document.getElementById(`dishCount_${s.idx}`).textContent})`);
    const conFoto = seleccion.find(s => photos[s.idx]);
    let verificacion = null;
    if (conFoto) verificacion = await verifyDishPhoto(photos[conFoto.idx], conFoto.item.nombre);

    const previousCount = userReviews().length;
    const review = {
        id: `r-${Date.now()}`,
        usuario: { id: state.user.id, nombre: state.user.nombre, avatar: initials(state.user.nombre) },
        fecha: new Date().toISOString(),
        localId: local.id,
        productos,
        fotoComida: conFoto ? photos[conFoto.idx] : null,
        fotoVerificada: verificacion?.estado === 'aprobada',
        notaComida: Number(document.getElementById('sliderComida').value),
        notaServicio: Number(document.getElementById('sliderServicio').value),
        comentario,
        spend: Number(document.getElementById('reviewSpend').value) || null,
        likes: 0,
        likedBy: [],
        isDrink: seleccion.every(s => s.item.isDrink),
        estado: verificacion?.estado === 'rechazada' ? 'pendiente' : 'publicada'
    };

    db.reviews.unshift(review);
    if (verificacion && verificacion.estado !== 'aprobada') {
        db.moderation.unshift({ id: `mod-${Date.now()}`, tipo: 'foto', reviewId: review.id, motivo: verificacion.motivo, fecha: review.fecha });
    }
    if (review.estado === 'publicada') recomputeLocalScores(local.id);
    persist();
    track('resena_publicada', { localId: local.id, conFoto: !!conFoto, estado: review.estado });

    document.getElementById('reviewModal').remove();
    if (review.estado === 'pendiente') {
        showToast('La foto no parece corresponder al plato. Tu reseña quedó en revisión.', 4500);
    } else {
        showToast('¡Reseña publicada! Gracias por tu aporte.');
        checkLevelUp(previousCount);
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
        const file = el.files[0];
        if (!file) return;
        if (file.size > 15 * 1024 * 1024) return showToast('La foto pesa más de 15 MB. Elige otra.');
        const label = document.getElementById(`photoLabel_${el.dataset.idx}`);
        try {
            photos[el.dataset.idx] = await compressImage(file);
            label.classList.add('uploaded');
            label.firstChild.textContent = '✅ Foto lista ';
        } catch (err) {
            showToast(err.message);
        }
    },
    'score-slider': el => {
        document.getElementById(el.dataset.target).textContent = Number(el.value).toFixed(1);
    }
});
