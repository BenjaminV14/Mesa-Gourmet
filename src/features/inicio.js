// Pantalla de inicio: recomendados, búsqueda y filtros dietéticos
import { state } from '../state.js';
import { search } from './search.js';
import { pickRandomLocal, isSponsored } from './sponsors.js';
import { localCard, dishResult, emptyState } from '../ui/cards.js';
import { registerActions } from '../ui/actions.js';
import { esc } from '../utils/html.js';
import { track } from '../services/analytics.js';
import { showLocalDetail } from './detalle.js';

export function renderInicio() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="section-head">
            <h2 class="section-title">${state.query ? 'Resultados' : 'Recomendados'}</h2>
            <button class="chip-btn" data-action="open-filters">🎛️ Filtros${activeDietCount() ? ` (${activeDietCount()})` : ''}</button>
        </div>
        ${state.query ? '' : `<button class="random-btn" data-action="random-local">¡Recomendación aleatoria! 🎲</button>`}
        <div id="resultsContainer"></div>
    `;
    renderResults();
    trackSearch();
}

function activeDietCount() {
    return Object.values(state.dietary).filter(Boolean).length;
}

let lastResult = null;

// Se llama cuando el usuario deja de escribir, para no registrar cada tecla
export function trackSearch() {
    if (!lastResult) return;
    if (state.query) track('busqueda', { termino: state.query, resultados: lastResult.locales.length });
    lastResult.locales.filter(r => isSponsored(r.local))
        .forEach(r => track('impresion_destacado', { localId: r.local.id, origen: state.query ? 'busqueda' : 'inicio' }));
}

export function renderResults() {
    const container = document.getElementById('resultsContainer');
    if (!container) return;
    const result = search(state.query, state.dietary);

    lastResult = result;

    let html = '';
    if (result.correcciones.size) {
        const texto = result.tokens.map(t => result.correcciones.get(t) || t).join(' ');
        html += `<p class="search-hint">Mostrando resultados para <b>${esc(texto)}</b></p>`;
    }

    if (state.query && result.platos.length) {
        html += `
            <h3 class="subsection-title">Platos</h3>
            <div class="dish-results">${result.platos.slice(0, 6).map(dishResult).join('')}</div>
            <h3 class="subsection-title">Locales</h3>`;
    }

    if (!result.locales.length) {
        html += state.query
            ? emptyState('🔍', `No encontramos locales con "${esc(state.query)}". Prueba con otra palabra o revisa los filtros.`)
            : emptyState('🎛️', 'Ningún local cumple los filtros activos.');
    } else {
        html += result.locales.map(r => localCard(r.local, { platos: state.query ? r.platos : [] })).join('');
    }
    container.innerHTML = html;
}

// =================== FILTROS DIETÉTICOS ===================

function updateFilterButtons() {
    ['vegano', 'celiaco', 'sinLactosa'].forEach(type => {
        const btn = document.getElementById(`dietBtn_${type}`);
        if (btn) {
            btn.classList.toggle('is-active', state.dietary[type]);
            btn.setAttribute('aria-pressed', state.dietary[type]);
        }
    });
}

registerActions({
    'random-local': () => {
        const local = pickRandomLocal();
        if (!local) return;
        track('recomendacion_aleatoria', { localId: local.id, destacado: isSponsored(local) });
        showLocalDetail(local.id);
    },
    'open-filters': () => {
        updateFilterButtons();
        document.getElementById('filterModal').classList.remove('hidden');
    },
    'close-filters': () => {
        document.getElementById('filterModal').classList.add('hidden');
        if (state.currentView === 'inicio') renderInicio();
    },
    'toggle-diet': el => {
        const type = el.dataset.diet;
        state.dietary[type] = !state.dietary[type];
        updateFilterButtons();
    }
});
