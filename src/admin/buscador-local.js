// Buscador de locales con sugerencias: escribes letras y abajo aparecen los locales que coinciden.
// Se elige con un clic, o con Enter (el primero) y las flechas. El id del local queda en un input oculto
// con el id que se le pase, así los formularios lo leen con val(id) como si fuera un <select>.
import { db, getLocal } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { esc } from '../utils/html.js';
import { normalize } from '../utils/text.js';

const MAX = 8;
const alElegir = {}; // id del buscador -> función(local) que se llama al elegir

/**
 * HTML del buscador.
 * @param {string} id  id del input oculto con el id del local
 * @param {object} opts { etiqueta, valor (id del local elegido), placeholder, onElegir(local), clase }
 */
export function buscadorLocal(id, { etiqueta = 'Local', valor = null, placeholder = 'Escribe el nombre del local…', onElegir = null, clase = 'full' } = {}) {
    if (onElegir) alElegir[id] = onElegir;
    const elegido = valor ? getLocal(valor) : null;
    return `
        <div class="adm-field adm-ac ${clase}">
            ${etiqueta ? `<span id="${id}_lbl">${esc(etiqueta)}</span>` : ''}
            <input type="search" id="${id}_q" class="adm-ac-input" value="${esc(elegido?.nombre || '')}" placeholder="${esc(placeholder)}"
                data-input="adm-ac-buscar" data-ac="${id}" autocomplete="off" role="combobox" aria-autocomplete="list"
                aria-expanded="false" aria-controls="${id}_list" ${etiqueta ? `aria-labelledby="${id}_lbl"` : `aria-label="${esc(placeholder)}"`}>
            <input type="hidden" id="${id}" value="${elegido ? elegido.id : ''}">
            <ul class="adm-ac-list" id="${id}_list" role="listbox" hidden></ul>
        </div>`;
}

function sugerencias(texto) {
    const q = normalize(texto.trim());
    // Primero por nombre; si ningún nombre coincide, se busca también en el tipo y la dirección
    let lista = db.locales.filter(l => !q || normalize(l.nombre).includes(q));
    if (!lista.length) lista = db.locales.filter(l => normalize(`${l.tipo || ''} ${l.direccion || ''}`).includes(q));
    // Primero los que empiezan con lo escrito
    return lista.sort((a, b) => (normalize(b.nombre).startsWith(q) ? 1 : 0) - (normalize(a.nombre).startsWith(q) ? 1 : 0)).slice(0, MAX);
}

function abrir(input) {
    const id = input.dataset.ac;
    const ul = document.getElementById(`${id}_list`);
    const oculto = document.getElementById(id);
    // Si se cambió el texto, el local elegido antes ya no vale
    const elegido = oculto.value ? getLocal(Number(oculto.value)) : null;
    if (elegido && elegido.nombre !== input.value) oculto.value = '';
    const lista = sugerencias(input.value === elegido?.nombre ? '' : input.value);
    ul.innerHTML = lista.length
        ? lista.map((l, i) => `<li role="option" ${i === 0 ? 'class="is-active"' : ''}><button type="button" data-action="adm-ac-elegir" data-ac="${id}" data-id="${l.id}">
            <b>${esc(l.nombre)}</b>${l.tipo || l.direccion ? `<small>${esc([l.tipo, l.direccion].filter(Boolean).join(' · '))}</small>` : ''}</button></li>`).join('')
        : '<li class="adm-ac-vacio">Ningún local coincide</li>';
    ul.hidden = false;
    input.setAttribute('aria-expanded', 'true');
}

function cerrar(id) {
    const ul = document.getElementById(`${id}_list`);
    if (ul) ul.hidden = true;
    document.getElementById(`${id}_q`)?.setAttribute('aria-expanded', 'false');
}

function elegir(id, localId) {
    const local = getLocal(Number(localId));
    if (!local) return;
    document.getElementById(id).value = local.id;
    document.getElementById(`${id}_q`).value = local.nombre;
    cerrar(id);
    alElegir[id]?.(local);
}

registerActions({
    'adm-ac-buscar': el => abrir(el),
    'adm-ac-elegir': el => elegir(el.dataset.ac, el.dataset.id)
});

document.addEventListener('focusin', e => {
    if (e.target.classList?.contains('adm-ac-input')) abrir(e.target);
});
document.addEventListener('click', e => {
    // Clic fuera del buscador: se cierran las sugerencias
    document.querySelectorAll('.adm-ac-list:not([hidden])').forEach(ul => {
        if (!ul.parentElement.contains(e.target)) cerrar(ul.id.replace(/_list$/, ''));
    });
});
document.addEventListener('keydown', e => {
    const input = e.target;
    if (!input.classList?.contains('adm-ac-input')) return;
    const id = input.dataset.ac;
    const ul = document.getElementById(`${id}_list`);
    const items = [...ul.querySelectorAll('li[role="option"]')];
    const activo = items.findIndex(li => li.classList.contains('is-active'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (ul.hidden) return abrir(input);
        const sig = Math.max(0, Math.min(items.length - 1, activo + (e.key === 'ArrowDown' ? 1 : -1)));
        items.forEach((li, i) => li.classList.toggle('is-active', i === sig));
        items[sig]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        // Enter elige la sugerencia marcada (y no envía el formulario)
        if (!ul.hidden && items.length) {
            e.preventDefault();
            elegir(id, items[Math.max(0, activo)].querySelector('button').dataset.id);
        }
    } else if (e.key === 'Escape') {
        cerrar(id);
    }
});
