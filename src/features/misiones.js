// Misiones, insignias y "Descubrir platos". Solo para cuentas registradas.
import { state } from '../state.js';
import { getLocal, publishedReviews, loadSearchHistory } from '../data/store.js';
import { categoriasDePlato } from '../data/categorias.js';
import { registerActions } from '../ui/actions.js';
import { emptyState } from '../ui/cards.js';
import { esc, safeUrl } from '../utils/html.js';
import { timeAgo } from '../utils/time.js';
import { levelProgress, levelName, computeLogros, computeMisiones, userReviews, LOCALES_PARA_INSIGNIA } from './gamification.js';
import { likeButton } from './review-card.js';
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
            <button class="misiones-tab-btn active" data-action="misiones-tab" data-tab="retos">Retos e insignias</button>
            <button class="misiones-tab-btn" data-action="misiones-tab" data-tab="descubrir">Descubrir platos 📸</button>
        </div>
        <div id="misionesContent"></div>
    `;
    renderRetos();
}

function renderRetos() {
    const misiones = computeMisiones();
    const logros = computeLogros();
    const visibles = logros.filter(l => l.visible);
    const ocultas = logros.length - visibles.length;

    document.getElementById('misionesContent').innerHTML = `
        <h3 class="subsection-title">Tus retos gastronómicos</h3>
        <div class="mission-grid">
            ${misiones.map(m => `
                <div class="card mission-card ${m.completada ? 'is-done' : ''}">
                    <div class="mission-head"><h4>${m.icono} ${esc(m.titulo)}</h4><span>${m.completada ? '✅' : `${m.progreso}/${m.total}`}</span></div>
                    <p>${esc(m.descripcion)}</p>
                    <div class="bar"><div style="width:${(m.progreso / m.total) * 100}%;"></div></div>
                    <p class="mission-reward">🎁 ${esc(m.recompensa)}</p>
                </div>`).join('')}
        </div>
        <div class="logros-section">
            <h3 class="subsection-title">🏅 Insignias gastronómicas</h3>
            <p class="muted">Se desbloquean al probar ${LOCALES_PARA_INSIGNIA} platos del mismo tipo en locales distintos. Las demás están ocultas: ¡descúbrelas!</p>
            <div class="logros-grid">
                ${visibles.map(l => `
                    <div class="logro-card ${l.unlocked ? 'unlocked' : 'locked'}">
                        ${l.unlocked ? '<div class="logro-unlocked-badge">✅</div>' : ''}
                        <div class="logro-emoji">${l.emoji}</div>
                        <div class="logro-titulo">${esc(l.titulo)}</div>
                        <div class="logro-progress">${l.unlocked ? esc(l.descripcion) : `${l.count}/${l.required} locales · ${esc(l.descripcion)}`}</div>
                    </div>`).join('')}
                ${Array.from({ length: Math.min(ocultas, 8) }, () => `
                    <div class="logro-card hidden-logro" aria-label="Insignia oculta">
                        <div class="logro-emoji">❔</div>
                        <div class="logro-titulo">Insignia oculta</div>
                        <div class="logro-progress">Sigue probando sabores</div>
                    </div>`).join('')}
            </div>
            ${ocultas > 8 ? `<p class="muted">Y ${ocultas - 8} insignias ocultas más.</p>` : ''}
        </div>
    `;
}

// =================== DESCUBRIR PLATOS ===================

/** Qué le gusta al usuario: su producto favorito, lo que ha buscado y lo que ha reseñado */
function preferencias() {
    const peso = {};
    const sumar = (cat, n) => { peso[cat] = (peso[cat] || 0) + n; };
    if (state.user?.productoFavorito) sumar(state.user.productoFavorito, 5);
    loadSearchHistory().forEach(t => categoriasDePlato(t).forEach(c => sumar(c, 2)));
    userReviews().forEach(r => r.productos.forEach(p => categoriasDePlato(p).forEach(c => sumar(c, 1))));
    return peso;
}

/**
 * Arma el feed: fotos ordenadas por tus gustos con algo de azar, y cada 3 fotos
 * intercala una reseña nueva y luego una antigua, siempre de personas distintas a la anterior.
 */
export function buildDiscoverFeed(now = Date.now()) {
    const pref = preferencias();
    const fotos = publishedReviews()
        .filter(r => r.usuario.id !== state.user?.id)
        .flatMap(r => (r.fotos || []).map(f => ({ foto: f, review: r })));
    const score = x => categoriasDePlato(x.foto.item).reduce((s, c) => s + (pref[c] || 0), 0) + Math.random() * 2;
    const nuevas = fotos.filter(x => now - new Date(x.review.fecha).getTime() <= 7 * 86400000).sort((a, b) => new Date(b.review.fecha) - new Date(a.review.fecha));
    const antiguas = fotos.filter(x => !nuevas.includes(x)).sort(() => Math.random() - 0.5);
    const porGusto = [...fotos].sort((a, b) => score(b) - score(a));

    const usados = new Set();
    const feed = [];
    const tomar = lista => {
        const ultimo = feed[feed.length - 1]?.review.usuario.id;
        const x = lista.find(c => !usados.has(c.foto.id) && c.review.usuario.id !== ultimo) || lista.find(c => !usados.has(c.foto.id));
        if (x) { usados.add(x.foto.id); feed.push(x); }
        return !!x;
    };
    while (usados.size < fotos.length) {
        tomar(porGusto);
        tomar(porGusto);
        if (!tomar(nuevas)) tomar(porGusto);
        if (!tomar(antiguas)) tomar(porGusto);
    }
    return feed;
}

function openPhotoFeed() {
    slides = buildDiscoverFeed();
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
            ${slides.map(({ foto, review }) => {
                const local = getLocal(review.localId);
                return `
                <div class="photo-slide">
                    <img class="photo-slide-bg" src="${esc(safeUrl(foto.url))}" alt="${esc(foto.item)}">
                    <div class="photo-slide-overlay"></div>
                    <div class="photo-slide-info">
                        <h3>${esc(foto.item)}</h3>
                        <p><b>${esc(local?.nombre || '')}</b> · @${esc(review.usuario.username || review.usuario.nombre)} · ${esc(timeAgo(review.fecha))}</p>
                        <p class="photo-quote">"${esc(review.comentario.slice(0, 90))}${review.comentario.length > 90 ? '…' : ''}"</p>
                        <button class="video-local-btn" data-action="photo-go-local" data-id="${local?.id}">¡Me tentó! Ver local</button>
                    </div>
                    <div class="photo-slide-actions">${likeButton(foto, 'like-photo-item', { review: review.id })}</div>
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
    }
});

