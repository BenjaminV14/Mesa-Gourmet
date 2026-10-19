// Avisos y ventanas emergentes de la app (reemplazan alert(), que no funciona bien en apps móviles)
import { esc } from '../utils/html.js';
import { registerActions } from './actions.js';

export function showToast(message, duration = 3000) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 400);
    }, duration);
}

/**
 * Hoja inferior genérica. `body` es HTML ya escapado; `actions` son botones { label, action, data, variant }.
 */
export function openSheet({ id = 'sheet', title, body = '', actions = [], dismissible = true }) {
    closeSheet(id);
    const overlay = document.createElement('div');
    overlay.className = 'sheet-overlay';
    overlay.id = id;
    overlay.innerHTML = `
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="${id}-title">
            <div class="sheet-handle"></div>
            ${title ? `<h2 class="sheet-title" id="${id}-title">${esc(title)}</h2>` : ''}
            <div class="sheet-body">${body}</div>
            ${actions.length ? `<div class="sheet-actions">
                ${actions.map(a => `<button class="sheet-btn ${a.variant || ''}" data-action="${a.action}" ${Object.entries(a.data || {}).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${esc(a.label)}</button>`).join('')}
            </div>` : ''}
        </div>
    `;
    if (dismissible) {
        overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(id); });
    }
    document.body.appendChild(overlay);
    return overlay;
}

export function closeSheet(id = 'sheet') {
    document.getElementById(id)?.remove();
}

registerActions({
    'close-sheet': el => closeSheet(el.closest('.sheet-overlay')?.id)
});
