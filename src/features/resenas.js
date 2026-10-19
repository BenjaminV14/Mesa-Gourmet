// Pestaña Reseñas: dos paneles que se deslizan (Reseñas | Videos).
// En el panel de reseñas se intercala un video cada 3 reseñas.
import { db, publishedReviews, approvedVideos } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { emptyState } from '../ui/cards.js';
import { esc, safeUrl } from '../utils/html.js';
import { reviewCard } from './review-card.js';
import { videoTeaser, renderVideoFeed } from './videos.js';
import { openReviewForm } from './review-form.js';
import { requireAccount } from './auth.js';

let currentPane = 'resenas';

export function renderResenas(pane = 'resenas', videoId = null) {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="resenas-tabs" role="tablist">
            <button class="resenas-tab-btn" data-action="resenas-pane" data-pane="resenas" role="tab">📰 Reseñas</button>
            <button class="resenas-tab-btn" data-action="resenas-pane" data-pane="videos" role="tab">🎬 Videos</button>
        </div>
        <div class="dual-wrapper" id="resenasDual">
            <div class="dual-slider" id="resenasSlider">
                <div class="dual-pane" id="resenasPane">${renderReviewsPane()}</div>
                <div class="dual-pane" id="videosPane"></div>
            </div>
        </div>
    `;
    setupSwipe();
    setPane(pane, videoId);
}

function renderReviewsPane() {
    const reviews = publishedReviews().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const videos = approvedVideos();
    let html = `
        <div class="section-head">
            <h3 class="section-title">Reseñas recientes</h3>
            <button class="chip-btn chip-gold" data-action="pick-local-review">✍️ Escribir</button>
        </div>`;
    if (!reviews.length) return html + emptyState('✍️', 'Aún no hay reseñas.');
    html += '<div class="review-list">';
    reviews.forEach((r, i) => {
        html += reviewCard(r);
        const video = videos[Math.floor(i / 3)];
        if ((i + 1) % 3 === 0 && video) html += videoTeaser(video);
    });
    return html + '</div>';
}

function setPane(pane, videoId = null) {
    currentPane = pane;
    document.querySelectorAll('.resenas-tab-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.pane === pane);
        b.setAttribute('aria-selected', b.dataset.pane === pane);
    });
    const slider = document.getElementById('resenasSlider');
    if (!slider) return;
    slider.style.transform = pane === 'videos' ? 'translateX(-50%)' : 'translateX(0)';
    // El panel oculto no debe recibir foco ni lectores de pantalla
    document.getElementById('resenasPane').inert = pane !== 'resenas';
    document.getElementById('videosPane').inert = pane !== 'videos';
    if (pane === 'videos') renderVideoFeed(document.getElementById('videosPane'), videoId);
    else document.getElementById('videosPane').innerHTML = '';
}

// Deslizar horizontalmente cambia de panel; el desplazamiento vertical no se ve afectado
function setupSwipe() {
    const wrapper = document.getElementById('resenasDual');
    let startX = 0, startY = 0;
    wrapper.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    }, { passive: true });
    wrapper.addEventListener('touchend', e => {
        const dx = e.changedTouches[0].clientX - startX;
        const dy = e.changedTouches[0].clientY - startY;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            setPane(dx < 0 ? 'videos' : 'resenas');
        }
    }, { passive: true });
}

function openLocalPicker() {
    if (!requireAccount('escribir reseñas')) return;
    const main = document.getElementById('resenasPane');
    main.innerHTML = `
        <div class="section-head">
            <h3 class="section-title">¿Qué local quieres reseñar?</h3>
            <button class="chip-btn" data-action="resenas-pane" data-pane="resenas">← Volver</button>
        </div>
        <div class="review-list">
            ${db.locales.map(local => `
                <button class="card picker-card" data-action="review-local" data-id="${local.id}">
                    <img src="${esc(safeUrl(local.imagen))}" alt="">
                    <span><b>${esc(local.nombre)}</b><small>${esc(local.tipo)}</small></span>
                    <span class="badge estado-abierto">Reseñar</span>
                </button>`).join('')}
        </div>`;
}

registerActions({
    'resenas-pane': el => {
        if (el.dataset.pane === 'resenas') document.getElementById('resenasPane').innerHTML = renderReviewsPane();
        setPane(el.dataset.pane);
    },
    'open-video': el => setPane('videos', el.dataset.id),
    'pick-local-review': () => openLocalPicker(),
    'review-local': el => openReviewForm(Number(el.dataset.id))
});

export function refreshResenas() {
    const pane = document.getElementById('resenasPane');
    if (pane && currentPane === 'resenas') pane.innerHTML = renderReviewsPane();
}
