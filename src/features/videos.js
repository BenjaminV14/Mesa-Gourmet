// Videos de TikTok e Instagram que los usuarios comparten evaluando locales.
// Se muestran con el reproductor oficial de cada red (embed), así no se copian ni se guardan los videos.
import { state } from '../state.js';
import { db, persist, getLocal, approvedVideos } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';
import { esc } from '../utils/html.js';
import { timeAgo } from '../utils/time.js';
import { requireAccount } from './auth.js';
import { likeButton, toggleLike, userLiked } from './review-card.js';
import { track } from '../services/analytics.js';

/**
 * Reconoce un link de TikTok o Instagram y devuelve la URL del reproductor oficial.
 * Devuelve null si el link no es válido.
 */
export function parseVideoUrl(raw) {
    let url;
    try {
        url = new URL(raw.trim());
    } catch {
        return null;
    }
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'tiktok.com' || host === 'm.tiktok.com') {
        const match = url.pathname.match(/\/video\/(\d{8,25})/);
        return match ? { plataforma: 'tiktok', embed: `https://www.tiktok.com/embed/v2/${match[1]}`, url: url.href } : null;
    }
    if (host === 'instagram.com') {
        const match = url.pathname.match(/^\/(reel|reels|p)\/([A-Za-z0-9_-]{5,40})/);
        return match ? { plataforma: 'instagram', embed: `https://www.instagram.com/${match[1] === 'p' ? 'p' : 'reel'}/${match[2]}/embed`, url: url.href } : null;
    }
    return null;
}

export function videoTeaser(video) {
    const local = getLocal(video.localId);
    return `
    <button class="video-teaser" data-action="open-video" data-id="${esc(video.id)}">
        <span class="video-teaser-thumb ${esc(video.plataforma)}">▶</span>
        <span class="video-teaser-info">
            <b>🎬 ${esc(video.autor)}</b>
            <span>${esc(video.descripcion || 'Video de la comunidad')}</span>
            ${local ? `<small>${esc(local.nombre)}</small>` : ''}
        </span>
    </button>`;
}

function videoSlide(video) {
    const local = getLocal(video.localId);
    const parsed = video.url ? parseVideoUrl(video.url) : null;
    return `
    <section class="video-slide" data-video-id="${esc(video.id)}" data-embed="${parsed ? esc(parsed.embed) : ''}">
        <div class="video-frame ${esc(video.plataforma)}">
            ${parsed ? '<div class="video-loading">Cargando video…</div>' : `
                <div class="video-demo">
                    <span class="video-demo-icon">${video.plataforma === 'tiktok' ? '🎵' : '📸'}</span>
                    <p>Aquí se reproduce el video de ${video.plataforma === 'tiktok' ? 'TikTok' : 'Instagram'} de <b>${esc(video.autor)}</b>.</p>
                    <small>Video de ejemplo: aún no hay un link real cargado.</small>
                </div>`}
        </div>
        <div class="video-overlay">
            <div class="video-meta">
                <b>${esc(video.autor)}</b> · <span>${esc(timeAgo(video.fecha))}</span>
                <p>${esc(video.descripcion || '')}</p>
                ${local ? `<button class="video-local-btn" data-action="open-local" data-id="${local.id}">📍 ${esc(local.nombre)} · Ver local</button>` : ''}
            </div>
            <div class="video-side">
                ${likeButton(video, 'like-video')}
                ${video.url ? `<a class="video-side-btn" href="${esc(video.url)}" target="_blank" rel="noopener" aria-label="Abrir en la app original">↗</a>` : ''}
            </div>
        </div>
    </section>`;
}

let observer = null;

export function renderVideoFeed(container, startId = null) {
    const videos = approvedVideos().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    container.innerHTML = `
        <div class="video-feed-head">
            <p>Videos de la comunidad evaluando locales de Talca</p>
            <button class="chip-btn chip-gold" data-action="share-video">＋ Compartir video</button>
        </div>
        ${videos.length ? `<div class="video-feed" id="videoFeed">${videos.map(videoSlide).join('')}</div>`
            : '<p class="empty-state">Todavía no hay videos. ¡Comparte el primero!</p>'}
    `;
    const feed = document.getElementById('videoFeed');
    if (!feed) return;

    // Carga el reproductor solo del video visible, y libera los que salen de pantalla
    observer?.disconnect();
    observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            const slide = entry.target;
            const frame = slide.querySelector('.video-frame');
            if (!slide.dataset.embed) return;
            if (entry.isIntersecting) {
                if (!frame.querySelector('iframe')) {
                    frame.innerHTML = `<iframe src="${slide.dataset.embed}" title="Video" loading="lazy" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
                    track('ver_video', { videoId: slide.dataset.videoId });
                }
            } else if (frame.querySelector('iframe')) {
                frame.innerHTML = '<div class="video-loading">Cargando video…</div>';
            }
        });
    }, { root: feed, threshold: 0.6 });
    feed.querySelectorAll('.video-slide').forEach(slide => observer.observe(slide));

    if (startId) {
        const target = feed.querySelector(`[data-video-id="${CSS.escape(startId)}"]`);
        if (target) target.scrollIntoView({ block: 'start' });
    }
}

function openShareSheet() {
    if (!requireAccount('compartir videos')) return;
    openSheet({
        id: 'shareVideo',
        title: 'Compartir un video',
        body: `
            <form class="sheet-form" id="shareVideoForm">
                <p class="sheet-text">Pega el link de un video tuyo de TikTok o Instagram evaluando un local. Lo revisamos antes de publicarlo.</p>
                <label for="videoUrl">Link del video</label>
                <input id="videoUrl" type="url" inputmode="url" placeholder="https://www.tiktok.com/@usuario/video/…" required>
                <label for="videoLocal">¿De qué local es?</label>
                <select id="videoLocal">${db.locales.map(l => `<option value="${l.id}">${esc(l.nombre)}</option>`).join('')}</select>
                <label for="videoDesc">Descripción (opcional)</label>
                <input id="videoDesc" type="text" maxlength="120" placeholder="Ej: probé el mejor ramen de Talca">
                <label class="check-row"><input type="checkbox" id="videoOwn"> Confirmo que el video es mío o tengo permiso para compartirlo</label>
                <p class="form-error" id="videoError" hidden></p>
            </form>`,
        actions: [
            { label: 'Enviar a revisión', action: 'send-video', variant: 'primary' },
            { label: 'Cancelar', action: 'close-sheet', variant: 'ghost' }
        ]
    });
}

registerActions({
    'share-video': () => openShareSheet(),
    'send-video': () => {
        const error = document.getElementById('videoError');
        const parsed = parseVideoUrl(document.getElementById('videoUrl').value);
        const fail = msg => { error.textContent = msg; error.hidden = false; };
        if (!parsed) return fail('El link no es de un video de TikTok o Instagram. Copia el link completo desde "Compartir > Copiar enlace".');
        if (!document.getElementById('videoOwn').checked) return fail('Debes confirmar que el video es tuyo o que tienes permiso.');
        if (db.videos.some(v => v.url === parsed.url)) return fail('Ese video ya fue compartido.');
        db.videos.unshift({
            id: `vid-${Date.now()}`,
            plataforma: parsed.plataforma,
            url: parsed.url,
            autor: state.user.nombre,
            usuarioId: state.user.id,
            localId: Number(document.getElementById('videoLocal').value),
            descripcion: document.getElementById('videoDesc').value.trim().slice(0, 120),
            estado: 'pendiente',
            fecha: new Date().toISOString(),
            likes: 0,
            likedBy: []
        });
        persist();
        track('video_compartido', { plataforma: parsed.plataforma });
        closeSheet('shareVideo');
        showToast('¡Gracias! Publicaremos tu video cuando lo revisemos.');
    },
    'like-video': el => {
        if (!requireAccount('dar me gusta')) return;
        const video = db.videos.find(v => v.id === el.dataset.id);
        if (!video) return;
        toggleLike(video);
        persist();
        const liked = userLiked(video);
        el.classList.toggle('is-liked', liked);
        el.setAttribute('aria-pressed', liked);
        el.innerHTML = `${liked ? '❤️' : '🤍'} <span>${video.likes}</span>`;
    }
});
