// Ranking de la comunidad. Los patrocinios NO influyen aquí: el Top solo depende de las notas.
import { db, reviewsOfLocal } from '../data/store.js';
import { esc, safeUrl } from '../utils/html.js';

const MIN_RESENAS = 20;

export function renderTop() {
    const sorted = [...db.locales].sort((a, b) => (b.notaMG || 0) - (a.notaMG || 0)).slice(0, 50);
    const [first, second, third] = sorted;
    const rest = sorted.slice(3);

    const podium = (local, cls, label) => local ? `
        <button class="podium-column ${cls}" data-action="open-local" data-id="${local.id}">
            ${cls === 'first' ? '<div class="crown">👑</div>' : ''}
            <img src="${esc(safeUrl(local.imagen))}" class="podium-img" alt="">
            <div class="place-label">${label}</div>
            <div class="podium-name">${esc(local.nombre)}</div>
            <div class="podium-score">${(local.notaMG || 0).toFixed(1)} ★</div>
        </button>` : '';

    document.getElementById('mainContent').innerHTML = `
        <div class="top-head">
            <h2 class="section-title">🏆 Top Gourmet de Talca</h2>
            <p>El ranking de la comunidad</p>
        </div>
        <div class="podium-container">
            ${podium(second, 'second', '🥈 2° lugar')}
            ${podium(first, 'first', '🏆 Rey Gourmet')}
            ${podium(third, 'third', '🥉 3° lugar')}
        </div>
        <h3 class="subsection-title">Clasificación</h3>
        <div class="review-list">
            ${rest.map((local, i) => `
                <button class="card picker-card" data-action="open-local" data-id="${local.id}">
                    <span class="rank-num">${i + 4}</span>
                    <img src="${esc(safeUrl(local.imagen))}" alt="">
                    <span><b>${esc(local.nombre)}</b><small>${esc(local.tipo)} · ${reviewsOfLocal(local.id).length} reseñas</small></span>
                    <span class="rank-score">${(local.notaMG || 0).toFixed(1)} ★</span>
                </button>`).join('')}
        </div>
        <div class="top50-footer-note">
            <span>ℹ️</span>
            <span>Para entrar al Top 50 oficial un local necesita al menos <strong>${MIN_RESENAS} reseñas verificadas</strong>. Los locales destacados (publicidad) no suben en este ranking.</span>
        </div>
    `;
}
