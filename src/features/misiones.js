// Misiones, logros y "Descubrir platos" (fotos de la comunidad). Solo para cuentas registradas.
import { db, persist, getLocal, publishedReviews } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { emptyState } from '../ui/cards.js';
import { esc, safeUrl } from '../utils/html.js';
import { levelProgress, levelName, visitedLocalesCount, computeLogros } from './gamification.js';
import { likeButton, toggleLike, userLiked } from './review-card.js';
import { showLocalDetail } from './detalle.js';

let slides = [];
let index = 0;

export function renderMisiones() {
    const { count, level, next, progress } = levelProgress();
    document.getElementById('mainContent').innerHTML = `
        <div class="misiones-level-header">
            <div class="misiones-level-badge">Nivel ${level}</div>
            <div class="misiones-level-info">
                <div class="misiones-level-name">${esc(levelName(level))}</div>
                <div class="misiones-level-bar-bg"><div class="misiones-level-bar-fill" style="width:${progress}%;"></div></div>
            </div>
            <div class="misiones-count">${count}/${next} reseñas</div>
        </div>
        <div class="misiones-tabs" role="tablist">
            <button class="misiones-tab-btn active" data-action="misiones-tab" data-tab="retos">Retos</button>
            <button class="misiones-tab-btn" data-action="misiones-tab" data-tab="descubrir">Descubrir platos 📸</button>
        </div>
        <div id="misionesContent"></div>
    `;
    renderRetos();
}

function renderRetos() {
    const visited = visitedLocalesCount();
    const logros = computeLogros();
    const misiones = [
        { titulo: '🍕 Primer bocado', descripcion: 'Reseña tu primer local.', total: 1, recompensa: 'Insignia Novicio' },
        { titulo: '🌮 Explorador gourmet', descripcion: 'Reseña 3 locales distintos de Talca.', total: 3, recompensa: 'Nivel 2 + medalla' },
        { titulo: '🍜 Crítico consagrado', descripcion: 'Reseña 7 locales distintos.', total: 7, recompensa: 'Nivel 3 + insignia' },
        { titulo: '📸 Leyenda culinaria', descripcion: 'Reseña 10 locales distintos.', total: 10, recompensa: 'Nivel 4 + título' }
    ].map(m => ({ ...m, progreso: Math.min(m.total, visited), completada: visited >= m.total }));

    document.getElementById('misionesContent').innerHTML = `
        <h3 class="subsection-title">Tus retos gastronómicos</h3>
        <div class="review-list">
            ${misiones.map(m => `
                <div class="card mission-card ${m.completada ? 'is-done' : ''}">
                    <div class="mission-head"><h4>${m.titulo}</h4><span>${m.completada ? '✅ Listo' : '⏳ En marcha'}</span></div>
                    <p>${m.descripcion}</p>
                    <div class="mission-progress"><span>Locales reseñados</span><span>${m.progreso} / ${m.total}</span></div>
                    <div class="bar"><div style="width:${(m.progreso / m.total) * 100}%;"></div></div>
                    <p class="mission-reward">🎁 ${m.recompensa}</p>
                </div>`).join('')}
        </div>
        <div class="logros-section">
            <h3 class="subsection-title">🏅 Logros gastronómicos</h3>
            <p class="muted">Desbloquea insignias probando 5 veces el mismo tipo de plato.</p>
            <div class="logros-grid">
                ${logros.map(l => `
                    <div class="logro-card ${l.unlocked ? 'unlocked' : 'locked'}">
                        ${l.unlocked ? '<div class="logro-unlocked-badge">✅</div>' : ''}
                        <div class="logro-emoji">${l.emoji}</div>
                        <div class="logro-titulo">${esc(l.titulo)}</div>
                        <div class="logro-progress">${l.unlocked ? esc(l.descripcion) : `${l.count}/${l.required} · ${esc(l.descripcion)}`}</div>
                    </div>`).join('')}
            </div>
        </div>
    `;
}

// =================== DESCUBRIR PLATOS (fotos de reseñas) ===================

function openPhotoFeed() {
    slides = publishedReviews().filter(r => r.fotoComida).sort(() => Math.random() - 0.5);
    index = 0;
    if (!slides.length) {
        document.getElementById('misionesContent').innerHTML = emptyState('📷', 'Aún no hay fotos de la comunidad. ¡Sube la primera con tu reseña!');
        return;
    }
    const overlay = document.createElement('div');
    overlay.id = 'photoFeedOverlay';
    overlay.className = 'photo-feed-overlay';
    overlay.innerHTML = `
        <div class="photo-feed-header">
            <button class="photo-feed-close" data-action="photo-close" aria-label="Cerrar">✕</button>
            <span class="photo-feed-counter" id="photoFeedCounter"></span>
        </div>
        <div class="photo-feed-track" id="photoFeedTrack">
            ${slides.map(r => {
                const local = getLocal(r.localId);
                return `
                <div class="photo-slide">
                    <img class="photo-slide-bg" src="${esc(safeUrl(r.fotoComida))}" alt="">
                    <div class="photo-slide-overlay"></div>
                    <div class="photo-slide-info">
                        <h3>${esc(local?.nombre || '')}</h3>
                        <p><b>Degustó:</b> ${esc(r.productos.join(', '))}</p>
                        <p class="photo-quote">"${esc(r.comentario.slice(0, 90))}${r.comentario.length > 90 ? '…' : ''}"</p>
                        <button class="video-local-btn" data-action="photo-go-local" data-id="${local?.id}">¡Me tentó! Ver local</button>
                    </div>
                    <div class="photo-slide-actions">${likeButton(r, 'like-photo')}</div>
                </div>`;
            }).join('')}
        </div>
        <button class="photo-nav-btn prev" data-action="photo-nav" data-dir="-1" aria-label="Anterior">◀</button>
        <button class="photo-nav-btn next" data-action="photo-nav" data-dir="1" aria-label="Siguiente">▶</button>
    `;
    document.body.appendChild(overlay);
    let startX = 0;
    overlay.addEventListener('touchstart', e => { startX = e.changedTouches[0].pageX; }, { passive: true });
    overlay.addEventListener('touchend', e => {
        const diff = e.changedTouches[0].pageX - startX;
        if (Math.abs(diff) > 50) navigate(diff < 0 ? 1 : -1);
    }, { passive: true });
    updatePosition();
}

function navigate(dir) {
    index = Math.max(0, Math.min(slides.length - 1, index + dir));
    updatePosition();
}

function updatePosition() {
    document.getElementById('photoFeedTrack').style.transform = `translateX(-${index * 100}%)`;
    document.getElementById('photoFeedCounter').textContent = `${index + 1} / ${slides.length}`;
    document.querySelector('.photo-nav-btn.prev').classList.toggle('disabled', index === 0);
    document.querySelector('.photo-nav-btn.next').classList.toggle('disabled', index === slides.length - 1);
}

function closePhotoFeed() {
    document.getElementById('photoFeedOverlay')?.remove();
    document.querySelectorAll('.misiones-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'retos'));
    renderRetos();
}

registerActions({
    'misiones-tab': el => {
        document.querySelectorAll('.misiones-tab-btn').forEach(b => b.classList.toggle('active', b === el));
        if (el.dataset.tab === 'retos') renderRetos(); else openPhotoFeed();
    },
    'photo-nav': el => navigate(Number(el.dataset.dir)),
    'photo-close': () => closePhotoFeed(),
    'photo-go-local': el => {
        closePhotoFeed();
        showLocalDetail(el.dataset.id);
    },
    'like-photo': el => {
        const review = db.reviews.find(r => String(r.id) === el.dataset.id);
        if (!review) return;
        const liked = toggleLike(review);
        // Los likes en fotos también suman popularidad a los platos del menú
        const local = getLocal(review.localId);
        review.productos.forEach(p => {
            const nombre = p.split(' (x')[0].toLowerCase();
            const item = (local?.menu || []).find(m => m.nombre.toLowerCase() === nombre);
            if (item) item.likes = Math.max(0, (item.likes || 0) + (liked ? 1 : -1));
        });
        persist();
        el.classList.toggle('is-liked', userLiked(review));
        el.innerHTML = `${userLiked(review) ? '❤️' : '🤍'} <span>${review.likes}</span>`;
    }
});
