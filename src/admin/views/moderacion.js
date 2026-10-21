// Moderación: reseñas en revisión, fotos sin verificar, videos pendientes y contenido reportado
import { db, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc, safeUrl } from '../../utils/html.js';
import { timeAgo } from '../../utils/time.js';
import { parseVideoUrl } from '../../features/videos.js';
import { toast, emptyRow, statusPill } from '../ui.js';
import { resolver } from '../moderar.js';
import { sugerencia, tipoCaso, nombreDecision } from '../manual.js';

/** "🤖 Sueles: Quitar la foto (4 de 4)" según el manual de decisiones */
function pista(tipo) {
    const s = sugerencia(tipo);
    if (!s) return '';
    const texto = s.fuente === 'regla' ? `Tu regla: ${nombreDecision(tipo, s.decision)}` : `Sueles: ${nombreDecision(tipo, s.decision)} (${s.veces} de ${s.total})`;
    return ` <span class="adm-pill info">🤖 ${esc(texto)}</span>`;
}

let rerender = () => {};
export function setModeracionRerender(fn) { rerender = fn; }

function reviewBlock(r, motivo, actions, tipo = '') {
    const local = getLocal(r.localId);
    return `
    <article class="adm-mod-item">
        ${(r.fotos || []).length ? `<div class="adm-mod-photos">${r.fotos.map(f => `
            <figure class="${f.verificada === false ? 'is-doubt' : ''}"><img src="${esc(safeUrl(f.url))}" alt="Foto de ${esc(f.item)}"><figcaption>${esc(f.item)}${f.verificada === false ? ' · sin verificar' : ''}</figcaption></figure>`).join('')}</div>` : ''}
        <div class="adm-mod-body">
            <p><b>${esc(r.usuario.nombre)}</b> en <b>${esc(local?.nombre || '¿?')}</b> · ${esc(timeAgo(r.fecha))}</p>
            ${motivo ? `<p>${statusPill(motivo, 'warn')}${tipo ? pista(tipo) : ''}</p>` : ''}
            <p class="adm-quote">"${esc(r.comentario)}"</p>
            <p class="adm-help">Platos: ${esc((r.productos || []).join(', '))} · Comida ${r.notaComida} · Servicio ${r.notaServicio}</p>
            <div class="adm-row-actions">${actions}</div>
        </div>
    </article>`;
}

export function renderModeracion() {
    const pendientes = db.reviews.filter(r => r.estado === 'pendiente');
    const fotos = db.moderation.filter(m => m.tipo === 'foto').map(m => ({ m, r: db.reviews.find(r => r.id === m.reviewId) })).filter(x => x.r && x.r.estado === 'publicada');
    const reportadas = db.reports.filter(rep => rep.tipo === 'resena' && rep.estado === 'abierto')
        .map(rep => ({ rep, r: db.reviews.find(r => String(r.id) === String(rep.reviewId)) })).filter(x => x.r);
    const videos = db.videos.filter(v => v.estado === 'pendiente');

    return `
        <h1 class="adm-title">Moderación</h1>

        <section class="adm-card">
            <h2>Reseñas en revisión (${pendientes.length})</h2>
            <p class="adm-help">La IA detectó que la foto podría no corresponder al plato. No son visibles hasta que las apruebes.
            Lo que decidas queda en el <b>manual de decisiones</b> (Resumen): si repites la misma decisión, el asistente la sugiere y puede hacerla sola.</p>
            ${pendientes.length ? pendientes.map(r => reviewBlock(r, 'Foto dudosa', `
                <button class="adm-btn small primary" data-action="adm-review-approve" data-id="${esc(r.id)}">Aprobar</button>
                <button class="adm-btn small danger" data-action="adm-review-reject" data-id="${esc(r.id)}">Rechazar</button>`, tipoCaso('resena-revision'))).join('') : emptyRow('Nada pendiente.')}
        </section>

        <section class="adm-card">
            <h2>Fotos sin verificar (${fotos.length})</h2>
            <p class="adm-help">Reseñas publicadas cuya foto no pudo revisar la IA. Confirma que la foto muestra el plato.</p>
            ${fotos.length ? fotos.map(({ m, r }) => reviewBlock(r, m.motivo || 'Sin verificar', `
                <button class="adm-btn small primary" data-action="adm-photo-ok" data-id="${esc(m.id)}">La foto está bien</button>
                <button class="adm-btn small danger" data-action="adm-photo-remove" data-id="${esc(m.id)}">Quitar foto</button>`, tipoCaso('foto', m.motivo || 'Sin verificar'))).join('') : emptyRow('Nada pendiente.')}
        </section>

        <section class="adm-card">
            <h2>Reseñas reportadas por usuarios (${reportadas.length})</h2>
            ${reportadas.length ? reportadas.map(({ rep, r }) => reviewBlock(r, `Reportada por ${rep.usuario?.nombre || 'un usuario'}`, `
                <button class="adm-btn small" data-action="adm-report-dismiss" data-id="${esc(rep.id)}">Mantener reseña</button>
                <button class="adm-btn small danger" data-action="adm-report-remove" data-id="${esc(rep.id)}">Ocultar reseña</button>`, tipoCaso('resena-reportada'))).join('') : emptyRow('Nada reportado.')}
        </section>

        <section class="adm-card">
            <h2>Videos por aprobar (${videos.length})</h2>
            ${videos.length ? videos.map(v => {
                const parsed = parseVideoUrl(v.url || '');
                return `
                <article class="adm-mod-item">
                    <div class="adm-mod-body">
                        <p><b>${esc(v.autor)}</b> · ${esc(v.plataforma)} · ${esc(getLocal(v.localId)?.nombre || '')} · ${esc(timeAgo(v.fecha))}</p>
                        <p>${esc(v.descripcion || '')}</p>
                        ${v.motivoRevision ? `<p>${statusPill(v.motivoRevision, 'warn')}</p>` : ''}
                        ${pista(tipoCaso('video', v.archivoId ? 'subido desde la app' : v.plataforma)) ? `<p>${pista(tipoCaso('video', v.archivoId ? 'subido desde la app' : v.plataforma))}</p>` : ''}
                        ${v.archivoId
                            ? `${v.portada ? `<img class="adm-video-thumb" src="${esc(safeUrl(v.portada))}" alt="Portada del video">` : ''}<p class="adm-help">Video subido desde la app. Revisa los cuadros y la descripción antes de publicar.</p>`
                            : parsed ? `<p><a href="${esc(parsed.url)}" target="_blank" rel="noopener">Abrir video en ${v.plataforma === 'tiktok' ? 'TikTok' : 'Instagram'} ↗</a></p>` : statusPill('Link inválido', 'warn')}
                        <div class="adm-row-actions">
                            <button class="adm-btn small primary" data-action="adm-video-approve" data-id="${esc(v.id)}">Publicar</button>
                            <button class="adm-btn small danger" data-action="adm-video-reject" data-id="${esc(v.id)}">Rechazar</button>
                        </div>
                    </div>
                </article>`;
            }).join('') : emptyRow('Nada pendiente.')}
        </section>
    `;
}

function done(msg) {
    toast(msg);
    rerender();
}

registerActions({
    'adm-review-approve': el => done(resolver('resena-revision', el.dataset.id, 'aprobar')),
    'adm-review-reject': el => done(resolver('resena-revision', el.dataset.id, 'rechazar')),
    'adm-photo-ok': el => done(resolver('foto', el.dataset.id, 'ok')),
    'adm-photo-remove': el => done(resolver('foto', el.dataset.id, 'quitar')),
    'adm-report-dismiss': el => done(resolver('resena-reportada', el.dataset.id, 'mantener')),
    'adm-report-remove': el => done(resolver('resena-reportada', el.dataset.id, 'ocultar')),
    'adm-video-approve': el => done(resolver('video', el.dataset.id, 'publicar')),
    'adm-video-reject': el => done(resolver('video', el.dataset.id, 'rechazar'))
});
