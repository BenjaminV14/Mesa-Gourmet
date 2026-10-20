// Pestaña Reseñas: dos paneles que se deslizan (Reseñas | Videos).
// Las reseñas con fotos van primero; cada 3 reseñas aparece un video. Se actualiza sola cuando llegan reseñas nuevas.
import { state, isLoggedIn } from '../state.js';
import { publishedReviews, approvedVideos } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { emptyState } from '../ui/cards.js';
import { localPicker, mountPicker } from '../ui/local-picker.js';
import { reviewCard } from './review-card.js';
import { videoTeaser, renderVideoFeed } from './videos.js';
import { openReviewForm } from './review-form.js';
import { requireAccount } from './auth.js';

let currentPane = 'resenas';
let filtro = 'todas';   // 'todas' | 'siguiendo'
let vistos = 0;

function ordenadas() {
    let reviews = publishedReviews();
    if (filtro === 'siguiendo' && isLoggedIn()) reviews = reviews.filter(r => state.user.siguiendo.includes(r.usuario.id));
    const conFoto = r => ((r.fotos || []).length > 0 ? 1 : 0);
    return reviews.sort((a, b) => conFoto(b) - conFoto(a) || new Date(b.fecha) - new Date(a.fecha));
}

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
    const reviews = ordenadas();
    const videos = approvedVideos();
    vistos = publishedReviews().length;
    let html = `
        <div class="section-head">
            <div class="segmented small" role="tablist">
                <button class="segmented-btn ${filtro === 'todas' ? 'is-on' : ''}" data-action="resenas-filtro" data-filtro="todas">Todas</button>
                <button class="segmented-btn ${filtro === 'siguiendo' ? 'is-on' : ''}" data-action="resenas-filtro" data-filtro="siguiendo">Siguiendo</button>
            </div>
            <button class="chip-btn chip-gold" data-action="pick-local-review">✍️ Escribir reseña</button>
        </div>
        <div id="newReviewsBanner"></div>`;
    if (!reviews.length) {
        return html + (filtro === 'siguiendo'
            ? emptyState('👥', 'Aún no sigues a nadie, o las personas que sigues no han publicado. Toca "Seguir" en una reseña.')
            : emptyState('✍️', 'Aún no hay reseñas.'));
    }
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
        if (e.target.closest('.local-picker, input, textarea')) return;
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) setPane(dx < 0 ? 'videos' : 'resenas');
    }, { passive: true });
}

function openLocalPicker() {
    if (!requireAccount('escribir reseñas')) return;
    const pane = document.getElementById('resenasPane');
    pane.innerHTML = `
        <div class="section-head">
            <h3 class="section-title">¿Qué local quieres reseñar?</h3>
            <button class="chip-btn" data-action="resenas-pane" data-pane="resenas">← Volver</button>
        </div>
        ${localPicker('reviewLocalPicker', { onChoose: local => { if (local) openReviewForm(local.id); } })}`;
    mountPicker('reviewLocalPicker');
    document.getElementById('reviewLocalPicker-input')?.focus();
}

// Aviso de reseñas nuevas (llegan desde otra pestaña o, con Supabase, en tiempo real)
function onDataChanged() {
    if (state.currentView !== 'resenas' || currentPane !== 'resenas') return;
    const nuevas = publishedReviews().length - vistos;
    const banner = document.getElementById('newReviewsBanner');
    if (banner && nuevas > 0) {
        banner.innerHTML = `<button class="new-reviews-btn" data-action="resenas-refresh">⬆ ${nuevas} reseña${nuevas === 1 ? ' nueva' : 's nuevas'}</button>`;
    }
}
window.addEventListener('mg:data-changed', onDataChanged);

export function refreshResenas() {
    const pane = document.getElementById('resenasPane');
    if (pane && currentPane === 'resenas') pane.innerHTML = renderReviewsPane();
}

registerActions({
    'resenas-pane': el => {
        if (el.dataset.pane === 'resenas') document.getElementById('resenasPane').innerHTML = renderReviewsPane();
        setPane(el.dataset.pane);
    },
    'resenas-filtro': el => {
        if (el.dataset.filtro === 'siguiendo' && !requireAccount('ver a quién sigues')) return;
        filtro = el.dataset.filtro;
        refreshResenas();
    },
    'resenas-refresh': () => {
        refreshResenas();
        document.getElementById('resenasPane')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    },
    'open-video': el => setPane('videos', el.dataset.id),
    'pick-local-review': () => openLocalPicker()
});
