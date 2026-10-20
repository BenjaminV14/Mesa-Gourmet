// Videos de la comunidad evaluando locales.
// Se puede subir un video propio (se revisa antes de publicarse) o pegar un link de TikTok/Instagram.
import { state } from '../state.js';
import { db, persist, getLocal, approvedVideos, saveSession } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';
import { localPicker, mountPicker } from '../ui/local-picker.js';
import { esc, safeUrl } from '../utils/html.js';
import { timeAgo } from '../utils/time.js';
import { requireAccount } from './auth.js';
import { likeButton, toggleLike, userLiked } from './review-card.js';
import { saveVideoBlob, getVideoUrl, inspectVideo, MAX_VIDEO_MB, MAX_VIDEO_SEGUNDOS } from '../services/media.js';
import { moderateVideoFrames } from '../services/ai.js';
import { track } from '../services/analytics.js';

/** Reconoce un link de TikTok o Instagram y devuelve la URL del reproductor oficial. */
export function parseVideoUrl(raw) {
    let url;
    try {
        url = new URL(String(raw).trim());
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
        <span class="video-teaser-thumb ${esc(video.plataforma || 'archivo')}" ${video.portada ? `style="background-image:url('${esc(safeUrl(video.portada))}')"` : ''}>▶</span>
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
    const tipo = video.archivoId ? 'archivo' : parsed ? 'embed' : 'demo';
    return `
    <section class="video-slide" data-video-id="${esc(video.id)}" data-tipo="${tipo}" data-embed="${parsed ? esc(parsed.embed) : ''}" data-archivo="${esc(video.archivoId || '')}">
        <div class="video-frame ${esc(video.plataforma || 'archivo')}">
            ${tipo === 'demo' ? `
                <div class="video-demo">
                    <span class="video-demo-icon">${video.plataforma === 'tiktok' ? '🎵' : '📸'}</span>
                    <p>Aquí se reproduce el video de <b>${esc(video.autor)}</b>.</p>
                    <small>Video de ejemplo: aún no hay un video real cargado.</small>
                </div>` : `<div class="video-loading" ${video.portada ? `style="background-image:url('${esc(safeUrl(video.portada))}')"` : ''}>Cargando video…</div>`}
        </div>
        <div class="video-overlay">
            <div class="video-meta">
                <b>${esc(video.autor)}</b> · <span>${esc(timeAgo(video.fecha))}</span>
                <p>${esc(video.descripcion || '')}</p>
                ${local ? `<button class="video-local-btn" data-action="open-local" data-id="${local.id}">📍 ${esc(local.nombre)} · Ver local</button>` : ''}
            </div>
            <div class="video-side">
                ${likeButton(video, 'like-video')}
                <button class="video-side-btn ${state.user?.guardados?.videos?.includes(video.id) ? 'is-on' : ''}" data-action="save-video" data-id="${esc(video.id)}" aria-label="Guardar video">📌</button>
                ${video.url ? `<a class="video-side-btn" href="${esc(safeUrl(video.url))}" target="_blank" rel="noopener" aria-label="Abrir en la app original">↗</a>` : ''}
            </div>
        </div>
    </section>`;
}

let observer = null;

async function loadSlide(slide) {
    const frame = slide.querySelector('.video-frame');
    if (frame.querySelector('iframe, video')) return;
    if (slide.dataset.tipo === 'embed') {
        frame.innerHTML = `<iframe src="${slide.dataset.embed}" title="Video" loading="lazy" allow="encrypted-media; fullscreen; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
    } else if (slide.dataset.tipo === 'archivo') {
        const url = await getVideoUrl(slide.dataset.archivo).catch(() => null);
        frame.innerHTML = url
            ? `<video src="${url}" controls playsinline loop preload="metadata"></video>`
            : '<div class="video-demo"><p>Este video solo está disponible en el dispositivo donde se subió (modo demo).</p></div>';
    }
    track('ver_video', { videoId: slide.dataset.videoId });
}

function unloadSlide(slide) {
    const frame = slide.querySelector('.video-frame');
    const media = frame.querySelector('iframe, video');
    if (!media) return;
    if (media.tagName === 'VIDEO') media.pause();
    else frame.innerHTML = '<div class="video-loading">Cargando video…</div>';
}

export function renderVideoFeed(container, startId = null) {
    const videos = approvedVideos().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    container.innerHTML = `
        <div class="video-feed-head">
            <p>Videos de la comunidad evaluando locales de Talca</p>
            <button class="chip-btn chip-gold" data-action="share-video">＋ Subir video</button>
        </div>
        ${videos.length ? `<div class="video-feed" id="videoFeed">${videos.map(videoSlide).join('')}</div>`
            : '<p class="empty-state">Todavía no hay videos. ¡Sube el primero!</p>'}
    `;
    const feed = document.getElementById('videoFeed');
    if (!feed) return;

    // Solo se carga el video visible; al salir de pantalla se pausa o se libera
    observer?.disconnect();
    observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.target.dataset.tipo === 'demo') return;
            if (entry.isIntersecting) loadSlide(entry.target); else unloadSlide(entry.target);
        });
    }, { root: feed, threshold: 0.6 });
    feed.querySelectorAll('.video-slide').forEach(slide => observer.observe(slide));

    if (startId) {
        const target = feed.querySelector(`[data-video-id="${CSS.escape(startId)}"]`);
        if (target) target.scrollIntoView({ block: 'start' });
    }
}

// =================== SUBIR VIDEO ===================

let upload = { local: null, file: null, info: null };

function openShareSheet() {
    if (!requireAccount('subir videos')) return;
    upload = { local: null, file: null, info: null };
    openSheet({
        id: 'shareVideo',
        title: 'Subir un video',
        body: `
            <form class="sheet-form" id="shareVideoForm">
                <p class="sheet-text">Sube un video tuyo evaluando un local (máx. ${MAX_VIDEO_SEGUNDOS} segundos y ${MAX_VIDEO_MB} MB). Antes de publicarse se revisa que no tenga contenido inapropiado.</p>
                <label>¿De qué local es?</label>
                ${localPicker('videoLocalPicker', { onChoose: local => { upload.local = local; } })}
                <label for="videoFile">Video</label>
                <label class="upload-drop" id="videoDrop">
                    <input type="file" id="videoFile" accept="video/*" data-change="video-file" hidden>
                    <span id="videoDropText">🎬 Toca para elegir un video</span>
                </label>
                <details class="video-link-alt">
                    <summary>¿Ya está en TikTok o Instagram? Pega el link</summary>
                    <input id="videoUrl" type="url" inputmode="url" placeholder="https://www.tiktok.com/@usuario/video/…">
                </details>
                <label for="videoDesc">Descripción</label>
                <input id="videoDesc" type="text" maxlength="120" placeholder="Ej: probé el mejor ramen de Talca">
                <label class="check-row"><input type="checkbox" id="videoOwn"> Confirmo que el video es mío o tengo permiso para compartirlo</label>
                <p class="form-error" id="videoError" hidden></p>
            </form>`,
        actions: [
            { label: 'Enviar a revisión', action: 'send-video', variant: 'primary' },
            { label: 'Cancelar', action: 'close-sheet', variant: 'ghost' }
        ]
    });
    mountPicker('videoLocalPicker');
}

registerActions({
    'share-video': () => openShareSheet(),
    'video-file': async el => {
        const file = el.files[0];
        const text = document.getElementById('videoDropText');
        upload.file = null;
        if (!file) return;
        if (file.size > MAX_VIDEO_MB * 1024 * 1024) { text.textContent = `⚠️ El video pesa más de ${MAX_VIDEO_MB} MB. Elige uno más corto.`; return; }
        text.textContent = 'Revisando el video…';
        try {
            const info = await inspectVideo(file);
            if (info.duracion > MAX_VIDEO_SEGUNDOS + 1) { text.textContent = `⚠️ El video dura más de ${MAX_VIDEO_SEGUNDOS} segundos.`; return; }
            upload.file = file;
            upload.info = info;
            document.getElementById('videoDrop').style.backgroundImage = `url('${info.frames[0]}')`;
            text.textContent = `✅ ${file.name} · ${Math.round(info.duracion)} s`;
        } catch (err) {
            text.textContent = `⚠️ ${err.message}`;
        }
    },
    'send-video': async () => {
        const error = document.getElementById('videoError');
        const fail = msg => { error.textContent = msg; error.hidden = false; };
        const link = document.getElementById('videoUrl').value.trim();
        const parsed = link ? parseVideoUrl(link) : null;
        if (!upload.local) return fail('Elige el local del video.');
        if (!upload.file && !parsed) return fail(link ? 'El link no es de un video de TikTok o Instagram.' : 'Elige un video o pega un link.');
        if (!document.getElementById('videoOwn').checked) return fail('Debes confirmar que el video es tuyo o que tienes permiso.');
        if (parsed && db.videos.some(v => v.url === parsed.url)) return fail('Ese video ya fue compartido.');

        const id = `vid-${Date.now()}`;
        let revision = { estado: 'revision', motivo: 'Pendiente de revisión' };
        if (upload.file) {
            try {
                await saveVideoBlob(id, upload.file);
            } catch {
                return fail('No se pudo guardar el video en este dispositivo. Prueba con uno más liviano.');
            }
            revision = await moderateVideoFrames(upload.info.frames);
        }
        db.videos.unshift({
            id,
            plataforma: parsed ? parsed.plataforma : 'archivo',
            url: parsed ? parsed.url : '',
            archivoId: upload.file ? id : null,
            portada: upload.info ? upload.info.frames[0] : null,
            autor: `@${state.user.username}`,
            usuarioId: state.user.id,
            localId: upload.local.id,
            descripcion: document.getElementById('videoDesc').value.trim().slice(0, 120),
            estado: revision.estado === 'aprobada' ? 'aprobado' : revision.estado === 'rechazada' ? 'rechazado' : 'pendiente',
            motivoRevision: revision.motivo,
            fecha: new Date().toISOString(),
            likes: 0,
            likedBy: []
        });
        persist();
        track('video_subido', { tipo: upload.file ? 'archivo' : 'link' });
        closeSheet('shareVideo');
        showToast(revision.estado === 'rechazada'
            ? 'El video no pasó la revisión de contenido. Si crees que es un error, contáctanos.'
            : '¡Gracias! Publicaremos tu video cuando termine la revisión.');
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
    },
    'save-video': el => {
        if (!requireAccount('guardar videos')) return;
        const list = state.user.guardados.videos;
        const idx = list.indexOf(el.dataset.id);
        if (idx > -1) list.splice(idx, 1); else list.push(el.dataset.id);
        saveSession(state.user);
        el.classList.toggle('is-on', idx === -1);
        showToast(idx === -1 ? 'Video guardado en tu perfil' : 'Video quitado de guardados', 1800);
    }
});
