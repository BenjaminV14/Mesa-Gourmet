// Pantalla de inicio: "Recomendados" y "Cerca de ti", búsqueda y filtros
import { state, FILTROS_VACIOS } from '../state.js';
import { isSponsored, pickRandomLocal } from './sponsors.js';
import { resultadosInicio, openFilters, activeFilterCount } from './filters.js';
import { localCard, dishResult, emptyState } from '../ui/cards.js';
import { registerActions } from '../ui/actions.js';
import { showToast } from '../ui/feedback.js';
import { esc } from '../utils/html.js';
import { track } from '../services/analytics.js';
import { showLocalDetail } from './detalle.js';

export function renderInicio() {
    const main = document.getElementById('mainContent');
    const filtros = activeFilterCount();
    main.innerHTML = `
        <div class="home-head">
            ${state.query
                ? `<h2 class="section-title">Resultados para "${esc(state.query)}"</h2>`
                : `<div class="segmented" role="tablist" aria-label="Cómo ordenar los locales">
                    <button class="segmented-btn ${state.modoInicio === 'recomendados' ? 'is-on' : ''}" role="tab" aria-selected="${state.modoInicio === 'recomendados'}" data-action="home-mode" data-mode="recomendados">⭐ Recomendados</button>
                    <button class="segmented-btn ${state.modoInicio === 'cerca' ? 'is-on' : ''}" role="tab" aria-selected="${state.modoInicio === 'cerca'}" data-action="home-mode" data-mode="cerca">📍 Cerca de ti</button>
                </div>`}
            <button class="filters-btn ${filtros ? 'has-filters' : ''}" data-action="open-filters">
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M7 12h10M10 18h4" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg>
                Filtros${filtros ? `<span class="filters-count">${filtros}</span>` : ''}
            </button>
        </div>
        ${!state.query && state.modoInicio === 'cerca' && !state.hasRealLocation
            ? `<button class="location-hint" data-action="ask-location">📍 Estamos usando el centro de Talca. <b>Activar mi ubicación</b></button>` : ''}
        ${state.query ? '' : `<button class="random-btn" data-action="random-local">🎲 ¿No sabes qué comer? Te recomendamos uno</button>`}
        <div id="resultsContainer"></div>
    `;
    renderResults();
    trackSearch();
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
    const result = resultadosInicio();
    lastResult = result;

    let html = '';
    if (result.correcciones.size) {
        const texto = result.tokens.map(t => result.correcciones.get(t) || t).join(' ');
        html += `<p class="search-hint">Mostrando resultados para <b>${esc(texto)}</b></p>`;
    }
    if (activeFilterCount()) {
        html += `<p class="search-hint">${activeFilterCount()} filtro(s) activo(s) · <button class="link-btn" data-action="clear-filters">Quitar filtros</button></p>`;
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

registerActions({
    'home-mode': el => {
        state.modoInicio = el.dataset.mode;
        track('modo_inicio', { modo: state.modoInicio });
        renderInicio();
    },
    'ask-location': () => {
        if (!navigator.geolocation) return showToast('Tu dispositivo no permite obtener la ubicación.');
        navigator.geolocation.getCurrentPosition(pos => {
            state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            state.hasRealLocation = true;
            renderInicio();
        }, () => showToast('No pudimos acceder a tu ubicación. Revisa los permisos del navegador.'));
    },
    'random-local': () => {
        const local = pickRandomLocal();
        if (!local) return;
        track('recomendacion_aleatoria', { localId: local.id, destacado: isSponsored(local) });
        showLocalDetail(local.id);
    },
    'open-filters': () => openFilters(() => { if (state.currentView === 'inicio') renderInicio(); }),
    'clear-filters': () => {
        state.filtros = FILTROS_VACIOS();
        renderInicio();
    }
});
