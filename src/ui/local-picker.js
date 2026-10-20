// Buscador para elegir un local: al abrirlo muestra primero tus locales recientes
// (los que buscaste o reseñaste hace poco y tus favoritos); al escribir, busca entre todos.
import { state, isLoggedIn } from '../state.js';
import { db, loadSearchHistory } from '../data/store.js';
import { search } from '../features/search.js';
import { esc, safeUrl } from '../utils/html.js';
import { normalize } from '../utils/text.js';
import { registerActions } from './actions.js';

const pickers = new Map();

function recentLocales() {
    const ids = [];
    const push = id => { if (id && !ids.includes(id)) ids.push(id); };
    // Locales que buscó por nombre
    loadSearchHistory().forEach(t => {
        const l = db.locales.find(x => normalize(x.nombre).includes(normalize(t)));
        if (l) push(l.id);
    });
    if (isLoggedIn()) {
        db.reviews.filter(r => r.usuario.id === state.user.id)
            .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
            .forEach(r => push(r.localId));
        state.user.favoritos.forEach(push);
        state.user.quieroIr.forEach(push);
    }
    return ids.map(id => db.locales.find(l => l.id === id)).filter(Boolean);
}

function optionRow(pickerId, local, tag = '') {
    return `<button type="button" class="picker-option" data-action="picker-choose" data-picker="${pickerId}" data-id="${local.id}">
        <img src="${esc(safeUrl(local.imagen))}" alt="">
        <span><b>${esc(local.nombre)}</b><small>${esc(local.tipo)}${local.direccion ? ` · ${esc(local.direccion)}` : ''}</small></span>
        ${tag ? `<em>${tag}</em>` : ''}
    </button>`;
}

function renderOptions(pickerId) {
    const picker = pickers.get(pickerId);
    const list = document.getElementById(`${pickerId}-list`);
    if (!list) return;
    const q = picker.query.trim();
    let html = '';
    if (!q) {
        const recientes = recentLocales();
        if (recientes.length) html += `<p class="picker-label">Tus recientes</p>${recientes.slice(0, 5).map(l => optionRow(pickerId, l, '🕘')).join('')}`;
        const resto = db.locales.filter(l => !recientes.includes(l)).sort((a, b) => a.nombre.localeCompare(b.nombre));
        if (resto.length) html += `<p class="picker-label">Todos los locales</p>${resto.map(l => optionRow(pickerId, l)).join('')}`;
    } else {
        const r = search(q).locales.map(x => x.local);
        html = r.length ? r.map(l => optionRow(pickerId, l)).join('') : '<p class="picker-empty">No encontramos ese local. Revisa cómo se escribe.</p>';
    }
    list.innerHTML = html;
}

/**
 * Devuelve el HTML del buscador. Cuando el usuario elige, se llama onChoose(local).
 * Si ya hay un local elegido, muestra la selección con opción de cambiarla.
 */
export function localPicker(pickerId, { onChoose, placeholder = 'Escribe el nombre del local…', selected = null } = {}) {
    pickers.set(pickerId, { onChoose, query: '', selected });
    return `<div class="local-picker" id="${pickerId}">
        ${selected ? selectedHtml(pickerId, selected) : searchHtml(pickerId, placeholder)}
    </div>`;
}

function searchHtml(pickerId, placeholder) {
    return `<div class="picker-search">
            <span aria-hidden="true">🔍</span>
            <input type="search" id="${pickerId}-input" placeholder="${esc(placeholder)}" autocomplete="off" data-input="picker-type" data-picker="${pickerId}" aria-label="Buscar local">
        </div>
        <div class="picker-list" id="${pickerId}-list" role="listbox"></div>`;
}

function selectedHtml(pickerId, local) {
    return `<div class="picker-selected">
        <img src="${esc(safeUrl(local.imagen))}" alt="">
        <span><b>${esc(local.nombre)}</b><small>${esc(local.tipo)}</small></span>
        <button type="button" class="link-btn" data-action="picker-reset" data-picker="${pickerId}">Cambiar</button>
    </div>`;
}

export function mountPicker(pickerId) {
    renderOptions(pickerId);
}

registerActions({
    'picker-type': el => {
        const picker = pickers.get(el.dataset.picker);
        picker.query = el.value;
        renderOptions(el.dataset.picker);
    },
    'picker-choose': el => {
        const picker = pickers.get(el.dataset.picker);
        const local = db.locales.find(l => l.id === Number(el.dataset.id));
        picker.selected = local;
        const box = document.getElementById(el.dataset.picker);
        if (box) box.innerHTML = selectedHtml(el.dataset.picker, local);
        picker.onChoose?.(local);
    },
    'picker-reset': el => {
        const picker = pickers.get(el.dataset.picker);
        picker.selected = null;
        picker.query = '';
        const box = document.getElementById(el.dataset.picker);
        box.innerHTML = searchHtml(el.dataset.picker, 'Escribe el nombre del local…');
        renderOptions(el.dataset.picker);
        document.getElementById(`${el.dataset.picker}-input`)?.focus();
        picker.onChoose?.(null);
    }
});
