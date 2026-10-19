// Navegación entre pestañas, cabecera y buscador
import { state, isLoggedIn } from '../state.js';
import { registerActions } from '../ui/actions.js';
import { initials } from '../utils/html.js';
import { requireAccount } from './auth.js';
import { renderInicio, renderResults, trackSearch } from './inicio.js';
import { renderMapa, destroyMap, focusLocalOnMap } from './mapa.js';
import { renderTop } from './top.js';
import { renderMisiones } from './misiones.js';
import { renderResenas } from './resenas.js';
import { renderPerfil } from './perfil.js';
import { hideLocalDetail } from './detalle.js';

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
    if (state.currentView !== 'inicio') switchTab('inicio');
    else renderInicio();
    clearTimeout(searchTimer);
    searchTimer = setTimeout(trackSearch, 900);
}

let listenersReady = false;

export function setupNavigation() {
    if (listenersReady) return;
    listenersReady = true;
    const input = document.getElementById('searchInput');
    const panel = document.getElementById('searchOptionsPanel');

    input.addEventListener('focus', () => { if (!input.value) panel.classList.remove('hidden'); });
    input.addEventListener('input', () => {
        panel.classList.toggle('hidden', !!input.value);
        // Mientras escribe solo se actualizan los resultados, sin redibujar toda la pantalla
        if (state.currentView === 'inicio' && document.getElementById('resultsContainer') && !!state.query === !!input.value.trim()) {
            state.query = input.value.trim();
            renderResults();
            clearTimeout(searchTimer);
            searchTimer = setTimeout(trackSearch, 900);
        } else {
            applySearch(input.value);
        }
    });
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { panel.classList.add('hidden'); input.blur(); }
        if (e.key === 'Escape') { panel.classList.add('hidden'); }
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
        document.getElementById('searchOptionsPanel').classList.add('hidden');
        applySearch(term);
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
