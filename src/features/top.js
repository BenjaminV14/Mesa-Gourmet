// Top 50: ranking general (el más importante) y rankings por tipo de comida, en pestañas deslizables.
// La nota usada es la de los últimos 30 días. Los destacados pagados NO influyen en el ranking.
import { rankingGeneral, rankingCategoria } from '../data/metrics.js';
import { CATEGORIAS_TOP } from '../data/categorias.js';
import { registerActions } from '../ui/actions.js';
import { emptyState, ratingStars } from '../ui/cards.js';
import { esc, safeUrl } from '../utils/html.js';

const TABS = [{ id: 'general', nombre: 'General', emoji: '🏆' }, ...CATEGORIAS_TOP];

function podium(rows) {
    const [first, second, third] = rows;
    const col = (r, cls, medal) => r ? `
        <button class="podium-col ${cls}" data-action="open-local" data-id="${r.local.id}">
            <span class="podium-medal">${medal}</span>
            <img src="${esc(safeUrl(r.local.imagen))}" alt="">
            <b class="podium-name">${esc(r.local.nombre)}</b>
            <span class="podium-score">${r.nota.total.toFixed(1)}</span>
            <span class="podium-step">${r.puesto}°</span>
        </button>` : '<div class="podium-col empty"></div>';
    return `<div class="podium">${col(second, 'second', '🥈')}${col(first, 'first', '👑')}${col(third, 'third', '🥉')}</div>`;
}

function pane(tab) {
    const rows = tab.id === 'general' ? rankingGeneral() : rankingCategoria(tab.id);
    if (!rows.length) return emptyState(tab.emoji, `Aún no hay suficientes reseñas de ${tab.nombre.toLowerCase()} para armar este ranking.`);
    return `
        ${podium(rows)}
        <div class="rank-list">
            ${rows.slice(3).map(r => `
                <button class="rank-row" data-action="open-local" data-id="${r.local.id}">
                    <span class="rank-num">${r.puesto}</span>
                    <img src="${esc(safeUrl(r.local.imagen))}" alt="">
                    <span class="rank-info"><b>${esc(r.local.nombre)}</b><small>${esc(r.local.tipo)} · ${r.nota.n} reseña(s)</small></span>
                    <span class="rank-score">${ratingStars(r.nota.total, 13)} ${r.nota.total.toFixed(1)}</span>
                </button>`).join('')}
        </div>
        <p class="top-note">${tab.id === 'general'
            ? 'Ranking con la nota de los últimos 30 días. Los 50 primeros reciben la distinción del mes.'
            : `Los 10 primeros en ${tab.nombre.toLowerCase()} reciben la distinción de la categoría.`}</p>`;
}

export function renderTop() {
    document.getElementById('mainContent').innerHTML = `
        <div class="top-head">
            <h2 class="section-title">Top 50 de Talca</h2>
            <p>El ranking de la comunidad</p>
        </div>
        <div class="top-tabs" role="tablist">
            ${TABS.map((t, i) => `<button class="top-tab ${i === 0 ? 'is-on' : ''}" role="tab" data-action="top-tab" data-index="${i}">${t.emoji} ${esc(t.nombre)}</button>`).join('')}
        </div>
        <div class="top-pager" id="topPager">
            ${TABS.map(t => `<section class="top-pane" aria-label="Top ${esc(t.nombre)}">${pane(t)}</section>`).join('')}
        </div>
    `;
    const pager = document.getElementById('topPager');
    let timer = null;
    // Al deslizar, se marca la pestaña correspondiente
    pager.addEventListener('scroll', () => {
        clearTimeout(timer);
        timer = setTimeout(() => setActive(Math.round(pager.scrollLeft / pager.clientWidth)), 80);
    }, { passive: true });
}

function setActive(i) {
    document.querySelectorAll('.top-tab').forEach((b, j) => {
        b.classList.toggle('is-on', i === j);
        b.setAttribute('aria-selected', i === j);
        if (i === j) b.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
}

registerActions({
    'top-tab': el => {
        const i = Number(el.dataset.index);
        const pager = document.getElementById('topPager');
        pager.scrollTo({ left: i * pager.clientWidth, behavior: 'smooth' });
        setActive(i);
    }
});
