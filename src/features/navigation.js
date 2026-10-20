// Navegación entre pestañas, cabecera y buscador
import { state, isLoggedIn } from '../state.js';
import { registerActions } from '../ui/actions.js';
import { requireAccount } from './auth.js';
import { renderInicio, trackSearch } from './inicio.js';
import { search } from './search.js';
import { db, loadSearchHistory, pushSearchHistory, clearSearchHistory } from '../data/store.js';
import { CATEGORIAS } from '../data/categorias.js';
import { esc, safeUrl, formatPrice, initials } from '../utils/html.js';
import { normalize } from '../utils/text.js';
import { estaAbierto, estadoHorario } from '../utils/time.js';
import { formatDistance } from '../utils/geo.js';
import { distanceTo } from './sponsors.js';
import { renderMapa, destroyMap, focusLocalOnMap } from './mapa.js';
import { renderTop } from './top.js';
import { renderMisiones } from './misiones.js';
import { renderResenas } from './resenas.js';
import { renderPerfil } from './perfil.js';
import { hideLocalDetail, showLocalDetail } from './detalle.js';

const RENDERERS = {
    inicio: renderInicio,
    mapa: renderMapa,
    top50: renderTop,
    misiones: renderMisiones,
    resenas: renderResenas,
    perfil: renderPerfil
};

// Pestañas que necesitan cuenta, con el texto que se muestra al invitado
const REQUIERE_CUENTA = {
    misiones: 'tener misiones, niveles y logros',
    perfil: 'tener tu perfil'
};

export function switchTab(tab) {
    if (REQUIERE_CUENTA[tab] && !requireAccount(REQUIERE_CUENTA[tab])) return;
    if (state.currentView === 'mapa' && tab !== 'mapa') destroyMap();
    state.currentView = tab;
    document.querySelectorAll('.nav-tab').forEach(btn => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle('active-tab', active);
        if (active) btn.setAttribute('aria-current', 'page'); else btn.removeAttribute('aria-current');
    });
    document.getElementById('mainContent').innerHTML = '';
    window.scrollTo(0, 0);
    (RENDERERS[tab] || renderInicio)();
}

export function updateHeader() {
    const avatar = document.getElementById('userAvatar');
    const name = document.getElementById('userName');
    if (isLoggedIn()) {
        avatar.textContent = initials(state.user.nombre);
        name.textContent = state.user.nombre.split(' ')[0];
    } else {
        avatar.textContent = 'G';
        name.textContent = 'Invitado';
    }
}

let searchTimer = null;

function applySearch(value) {
    state.query = value.trim();
    if (state.query) pushSearchHistory(state.query);
    document.getElementById('searchOptionsPanel').classList.add('hidden');
    if (state.currentView !== 'inicio') switchTab('inicio');
    else renderInicio();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(trackSearch, 900);
}

const POPULARES = ['completo', 'ceviche', 'sushi', 'café', 'empanadas', 'pizza', 'terraza', 'vegetariano'];

function suggestionRow(action, data, icon, title, subtitle = '') {
    const attrs = Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ');
    return `<button class="suggestion" role="option" data-action="${action}" ${attrs}>
        <span class="suggestion-icon">${icon}</span>
        <span class="suggestion-text"><b>${esc(title)}</b>${subtitle ? `<small>${esc(subtitle)}</small>` : ''}</span>
    </button>`;
}

// Panel bajo el buscador: recientes y sugerencias si está vacío; resultados en vivo mientras escribe
function renderSearchPanel(value) {
    const panel = document.getElementById('searchOptionsPanel');
    const q = value.trim();
    let html = '';
    if (!q) {
        const recientes = loadSearchHistory();
        if (recientes.length) {
            html += `<div class="panel-section"><div class="panel-title"><h3>Tus búsquedas recientes</h3><button class="link-btn" data-action="clear-history">Borrar</button></div>
                <div class="quick-pills">${recientes.map(t => `<button class="search-chip" data-action="quick-search" data-search="${esc(t)}">🕘 ${esc(t)}</button>`).join('')}</div></div>`;
        }
        const cerca = db.locales.filter(l => estaAbierto(l)).sort((a, b) => distanceTo(a) - distanceTo(b)).slice(0, 3);
        if (cerca.length) {
            html += `<div class="panel-section"><h3>Abiertos ahora cerca de ti</h3>${cerca.map(l => suggestionRow('suggest-local', { id: l.id }, `<img src="${esc(safeUrl(l.imagen))}" alt="">`, l.nombre, `${l.tipo} · ${formatDistance(distanceTo(l))}`)).join('')}</div>`;
        }
        html += `<div class="panel-section"><h3>Lo más buscado en Talca</h3><div class="quick-pills">${POPULARES.map(t => `<button class="search-chip" data-action="quick-search" data-search="${esc(t)}">🔥 ${esc(t)}</button>`).join('')}</div></div>`;
        html += `<div class="panel-section"><h3>Tipos de comida</h3><div class="quick-pills">${CATEGORIAS.map(c => `<button class="search-chip" data-action="quick-search" data-search="${esc(c.nombre.toLowerCase())}">${c.emoji} ${esc(c.nombre)}</button>`).join('')}</div></div>`;
    } else {
        const r = search(q);
        html += suggestionRow('quick-search', { search: q }, '🔍', `Ver todos los resultados para "${q}"`, `${r.locales.length} local(es) · ${r.platos.length} plato(s)`);
        r.locales.slice(0, 4).forEach(({ local }) => {
            html += suggestionRow('suggest-local', { id: local.id }, `<img src="${esc(safeUrl(local.imagen))}" alt="">`, local.nombre, `${local.tipo} · ${estadoHorario(local).etiqueta}`);
        });
        r.platos.slice(0, 4).forEach(({ local, item }) => {
            html += suggestionRow('suggest-dish', { id: local.id }, '🍽️', item.nombre, `${local.nombre} · ${formatPrice(item.precio)}`);
        });
        CATEGORIAS.filter(c => normalize(c.nombre).startsWith(normalize(q)) || c.keywords.some(k => normalize(k).startsWith(normalize(q)))).slice(0, 2)
            .forEach(c => { html += suggestionRow('quick-search', { search: c.nombre.toLowerCase() }, c.emoji, c.nombre, 'Tipo de comida'); });
        if (r.correcciones.size) {
            const texto = r.tokens.map(t => r.correcciones.get(t) || t).join(' ');
            html = `<p class="panel-hint">¿Quisiste decir <b>${esc(texto)}</b>?</p>` + html;
        }
    }
    panel.innerHTML = html;
    panel.classList.remove('hidden');
}

let listenersReady = false;

export function setupNavigation() {
    if (listenersReady) return;
    listenersReady = true;
    const input = document.getElementById('searchInput');
    const panel = document.getElementById('searchOptionsPanel');
    if (state.user && !state.isGuest) input.placeholder = `¿Qué se te antoja hoy, ${state.user.nombre.split(' ')[0]}?`;

    input.addEventListener('focus', () => renderSearchPanel(input.value));
    input.addEventListener('input', () => {
        renderSearchPanel(input.value);
        // Si borra todo, vuelve a los recomendados
        if (!input.value.trim() && state.query) {
            state.query = '';
            if (state.currentView === 'inicio') renderInicio();
        }
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { applySearch(input.value); input.blur(); }
        if (e.key === 'Escape') { panel.classList.add('hidden'); input.blur(); }
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !panel.contains(e.target)) panel.classList.add('hidden');
    });
}

registerActions({
    'nav': el => {
        hideLocalDetail();
        switchTab(el.dataset.tab);
    },
    'quick-search': el => {
        const term = el.dataset.search === 'todo' ? '' : el.dataset.search;
        document.getElementById('searchInput').value = term;
        applySearch(term);
    },
    'suggest-local': el => {
        pushSearchHistory(document.getElementById('searchInput').value || '');
        document.getElementById('searchOptionsPanel').classList.add('hidden');
        showLocalDetail(el.dataset.id);
    },
    'suggest-dish': el => {
        pushSearchHistory(document.getElementById('searchInput').value || '');
        document.getElementById('searchOptionsPanel').classList.add('hidden');
        showLocalDetail(el.dataset.id, 'menu');
    },
    'clear-history': () => {
        clearSearchHistory();
        renderSearchPanel(document.getElementById('searchInput').value);
    },
    'clear-search': () => {
        document.getElementById('searchInput').value = '';
        state.query = '';
        if (state.currentView === 'mapa') renderMapa(); else renderInicio();
    },
    'focus-map': el => {
        const id = Number(el.dataset.id);
        hideLocalDetail();
        state.query = '';
        document.getElementById('searchInput').value = '';
        switchTab('mapa');
        setTimeout(() => focusLocalOnMap(id), 400);
    }
});
