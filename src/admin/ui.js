// Utilidades de interfaz del panel de administración
import { esc } from '../utils/html.js';
import { registerActions } from '../ui/actions.js';

export function toast(message, kind = 'ok') {
    const el = document.createElement('div');
    el.className = `adm-toast ${kind}`;
    el.setAttribute('role', 'status');
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2200);
    setTimeout(() => el.remove(), 2600);
}

let pendingConfirm = null;

// Confirmación dentro de la página (en vez de confirm(), que algunos navegadores bloquean)
export function confirmDialog(message, onConfirm, confirmLabel = 'Confirmar') {
    pendingConfirm = onConfirm;
    document.getElementById('admDialog')?.remove();
    const el = document.createElement('div');
    el.id = 'admDialog';
    el.className = 'adm-dialog-backdrop';
    el.innerHTML = `
        <div class="adm-dialog" role="alertdialog" aria-modal="true">
            <p>${esc(message)}</p>
            <div class="adm-dialog-actions">
                <button class="adm-btn ghost" data-action="adm-dialog-cancel">Cancelar</button>
                <button class="adm-btn danger" data-action="adm-dialog-ok">${esc(confirmLabel)}</button>
            </div>
        </div>`;
    document.body.appendChild(el);
    el.querySelector('[data-action="adm-dialog-ok"]').focus();
}

/** Pide un número en una ventanita (por ejemplo, cuántos meses). onConfirm recibe el número elegido. */
export function pedirNumero(mensaje, { min = 1, max = 12, valor = 2, sufijo = '', detalle = () => '' } = {}, onConfirm) {
    pendingConfirm = () => onConfirm(Math.max(min, Math.min(max, Number(document.getElementById('admDialogNumero').value) || min)));
    document.getElementById('admDialog')?.remove();
    const el = document.createElement('div');
    el.id = 'admDialog';
    el.className = 'adm-dialog-backdrop';
    el.innerHTML = `
        <div class="adm-dialog" role="dialog" aria-modal="true">
            <p>${esc(mensaje)}</p>
            <label class="adm-numero"><input type="number" id="admDialogNumero" min="${min}" max="${max}" value="${valor}"> ${esc(sufijo)}</label>
            <p class="adm-help" id="admDialogDetalle">${esc(detalle(valor))}</p>
            <div class="adm-dialog-actions">
                <button class="adm-btn ghost" data-action="adm-dialog-cancel">Cancelar</button>
                <button class="adm-btn primary" data-action="adm-dialog-ok">Confirmar</button>
            </div>
        </div>`;
    document.body.appendChild(el);
    const input = el.querySelector('#admDialogNumero');
    input.addEventListener('input', () => { el.querySelector('#admDialogDetalle').textContent = detalle(Number(input.value) || min); });
    input.select();
}

registerActions({
    'adm-dialog-cancel': () => document.getElementById('admDialog')?.remove(),
    'adm-dialog-ok': () => {
        document.getElementById('admDialog')?.remove();
        pendingConfirm?.();
        pendingConfirm = null;
    }
});

export function field(label, id, value = '', { type = 'text', placeholder = '', attrs = '', full = false } = {}) {
    return `
        <label class="adm-field ${full ? 'full' : ''}" for="${id}">
            <span>${esc(label)}</span>
            <input type="${type}" id="${id}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${attrs}>
        </label>`;
}

export function textarea(label, id, value = '', { rows = 3, placeholder = '' } = {}) {
    return `
        <label class="adm-field full" for="${id}">
            <span>${esc(label)}</span>
            <textarea id="${id}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(value)}</textarea>
        </label>`;
}

export function val(id) {
    return document.getElementById(id)?.value.trim() ?? '';
}

export function emptyRow(text) {
    return `<div class="adm-empty">${esc(text)}</div>`;
}

export function statusPill(text, kind) {
    return `<span class="adm-pill ${kind}">${esc(text)}</span>`;
}
