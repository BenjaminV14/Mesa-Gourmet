// Cartas: editar platos y precios de cada local, o importar una carta completa pegando el texto
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { toast, confirmDialog, emptyRow } from '../ui.js';
import { DIETAS } from '../../data/metrics.js';

let localId = null;
let importPreview = null;
let rerender = () => {};

export function setCartasRerender(fn) { rerender = fn; }
export function selectCartaLocal(id) { if (id) { localId = id; importPreview = null; } }

/**
 * Convierte texto de una carta en platos. Las líneas sin precio se toman como categoría.
 *   ENTRADAS
 *   Ceviche clásico ........ $9.500
 *   Papa a la huancaína - 5800
 */
export function parseMenuText(text) {
    let categoria = 'Otros';
    const items = [];
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        if (!line) continue;
        const match = line.match(/^(.*?)[\s.\-–—:|$]*\$?\s*(\d{1,3}(?:[.,]\d{3})+|\d{3,7})\s*$/);
        if (match && match[1].trim().length >= 2) {
            items.push({ nombre: match[1].replace(/[\s.\-–—:|]+$/, '').trim(), categoria, precio: Number(match[2].replace(/[.,]/g, '')) });
        } else if (line.length <= 40 && !/\d/.test(line)) {
            categoria = line.replace(/[:\-–—]+$/, '').trim().toLowerCase().replace(/^\p{L}/u, c => c.toUpperCase());
        }
    }
    return items;
}

export function renderCartas() {
    if (localId === null && db.locales.length) localId = db.locales[0].id;
    const local = getLocal(localId);
    const categorias = [...new Set(db.locales.flatMap(l => (l.menu || []).map(m => m.categoria)).filter(Boolean))];

    return `
        <div class="adm-head">
            <h1 class="adm-title">Cartas</h1>
            <select class="adm-select" data-change="adm-carta-local" aria-label="Elegir local">
                ${db.locales.map(l => `<option value="${l.id}" ${l.id === localId ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('')}
            </select>
        </div>
        ${!local ? emptyRow('Primero crea un local.') : `
        <datalist id="admCategorias">${categorias.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <section class="adm-card">
            <h2>${esc(local.nombre)} · ${(local.menu || []).length} platos</h2>
            <div class="adm-table-wrap">
                <table class="adm-table adm-menu-table">
                    <thead><tr><th>Plato</th><th>Categoría</th><th>Precio</th><th>Bebida</th><th title="Vegetariano, vegano, sin gluten, sin lactosa">Apto para</th><th>Foto (URL)</th><th>❤️</th><th></th></tr></thead>
                    <tbody>
                        ${(local.menu || []).map((m, i) => `
                        <tr>
                            <td><input id="m_nombre_${i}" value="${esc(m.nombre)}" aria-label="Nombre del plato"></td>
                            <td><input id="m_cat_${i}" value="${esc(m.categoria || '')}" list="admCategorias" aria-label="Categoría"></td>
                            <td><input id="m_precio_${i}" type="number" min="0" step="10" value="${m.precio || 0}" aria-label="Precio"></td>
                            <td class="center"><input id="m_drink_${i}" type="checkbox" ${m.isDrink ? 'checked' : ''} aria-label="Es bebida"></td>
                            <td><div class="adm-diet-checks">${DIETAS.map(d => `<label title="${esc(d.label)}"><input type="checkbox" id="m_d_${d.key}_${i}" ${(m.dietas || []).includes(d.key) ? 'checked' : ''} aria-label="${esc(d.label)}">${d.emoji}</label>`).join('')}</div></td>
                            <td><input id="m_img_${i}" type="url" value="${esc(m.imagen || '')}" aria-label="Foto"></td>
                            <td>${m.likes || 0}</td>
                            <td><button class="adm-btn small danger" data-action="adm-dish-delete" data-index="${i}" aria-label="Eliminar plato">✕</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="adm-form-actions">
                <button class="adm-btn" data-action="adm-dish-add">＋ Agregar plato</button>
                <button class="adm-btn primary" data-action="adm-carta-save">Guardar carta</button>
            </div>
        </section>

        <section class="adm-card">
            <h2>Importar carta pegando texto</h2>
            <p class="adm-help">Copia la carta desde la web, Instagram o un PDF del local y pégala aquí. Las líneas sin precio se usan como categoría.
            Más adelante esto se hará con IA desde una foto de la carta.</p>
            <textarea id="admImportText" rows="7" class="adm-textarea" placeholder="ENTRADAS&#10;Ceviche clásico ...... $9.500&#10;Papa a la huancaína - 5.800&#10;BEBIDAS&#10;Pisco sour 4800"></textarea>
            <div class="adm-form-actions">
                <span></span>
                <button class="adm-btn" data-action="adm-import-preview">Revisar antes de importar</button>
            </div>
            ${importPreview ? `
                <div class="adm-import-preview">
                    <p><b>${importPreview.length}</b> platos detectados:</p>
                    <ul>${importPreview.map(p => `<li>${esc(p.nombre)} <span>${esc(p.categoria)}</span> <b>$${p.precio.toLocaleString('es-CL')}</b></li>`).join('')}</ul>
                    <div class="adm-form-actions">
                        <button class="adm-btn ghost" data-action="adm-import-cancel">Cancelar</button>
                        <button class="adm-btn primary" data-action="adm-import-confirm">Agregar ${importPreview.length} platos</button>
                    </div>
                </div>` : ''}
        </section>`}
    `;
}

function readTable(local) {
    return (local.menu || []).map((m, i) => ({
        ...m,
        nombre: document.getElementById(`m_nombre_${i}`).value.trim(),
        categoria: document.getElementById(`m_cat_${i}`).value.trim() || 'Otros',
        precio: Math.max(0, Number(document.getElementById(`m_precio_${i}`).value) || 0),
        isDrink: document.getElementById(`m_drink_${i}`).checked,
        dietas: DIETAS.filter(d => document.getElementById(`m_d_${d.key}_${i}`).checked).map(d => d.key),
        imagen: document.getElementById(`m_img_${i}`).value.trim()
    }));
}

registerActions({
    'adm-carta-local': el => { localId = Number(el.value); importPreview = null; rerender(); },
    'adm-dish-add': () => {
        const local = getLocal(localId);
        local.menu = readTable(local);
        local.menu.push({ nombre: '', categoria: '', precio: 0, imagen: '', likes: 0, isDrink: false });
        rerender();
        document.getElementById(`m_nombre_${local.menu.length - 1}`)?.focus();
    },
    'adm-dish-delete': el => {
        const local = getLocal(localId);
        const menu = readTable(local);
        const item = menu[Number(el.dataset.index)];
        confirmDialog(`¿Eliminar "${item.nombre || 'plato sin nombre'}" de la carta?`, () => {
            menu.splice(Number(el.dataset.index), 1);
            local.menu = menu;
            persist();
            rerender();
        }, 'Eliminar');
    },
    'adm-carta-save': () => {
        const local = getLocal(localId);
        const menu = readTable(local);
        const sinNombre = menu.findIndex(m => !m.nombre);
        if (sinNombre > -1) {
            toast(`El plato de la fila ${sinNombre + 1} no tiene nombre.`, 'error');
            return document.getElementById(`m_nombre_${sinNombre}`).focus();
        }
        local.menu = menu;
        persist();
        toast('Carta guardada');
        rerender();
    },
    'adm-import-preview': () => {
        importPreview = parseMenuText(document.getElementById('admImportText').value);
        if (!importPreview.length) {
            importPreview = null;
            return toast('No encontré platos con precio en el texto.', 'error');
        }
        const text = document.getElementById('admImportText').value;
        rerender();
        document.getElementById('admImportText').value = text;
    },
    'adm-import-cancel': () => { importPreview = null; rerender(); },
    'adm-import-confirm': () => {
        const local = getLocal(localId);
        local.menu = [...readTable(local), ...importPreview.map(p => ({ ...p, imagen: '', likes: 0, isDrink: /bebida|trago|cerveza|vino|jugo|cafe|café/i.test(p.categoria) }))];
        persist();
        toast(`${importPreview.length} platos agregados`);
        importPreview = null;
        rerender();
    }
});
