// Cartas: primero la lista de locales con buscador; al abrir uno se editan sus platos y precios,
// o se importa la carta completa desde texto, PDF, foto o planilla (revisando antes de guardar).
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { toast, confirmDialog, emptyRow } from '../ui.js';
import { DIETAS, dietaLocal } from '../../data/metrics.js';
import { analizarDietasCarta, sugerirDietas } from '../../services/dietas.js';
import { leerArchivoCarta } from '../carta-archivo.js';

let localId = null;
let importPreview = null;
let busqueda = '';
let rerender = () => {};

export function setCartasRerender(fn) { rerender = fn; }
export function selectCartaLocal(id) { localId = id || null; importPreview = null; }

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

const clave = nombre => normalize(nombre || '').replace(/[^a-z0-9ñ ]/g, ' ').replace(/\s+/g, ' ').trim();
const esBebida = categoria => /bebida|trago|cerveza|vino|jugo|cafe|café|coctel|cóctel|schop|licor/i.test(categoria || '');

function filasLocales() {
    const lista = db.locales.filter(l => !busqueda || normalize(l.nombre).includes(normalize(busqueda)));
    if (!lista.length) return emptyRow('Ningún local coincide con la búsqueda.');
    return `<ul class="adm-list adm-carta-locales">${lista.map(l => {
        const menu = l.menu || [];
        const bebidas = menu.filter(m => m.isDrink).length;
        const dietas = DIETAS.map(d => [d, dietaLocal(l, d.key).cantidad]).filter(([, n]) => n);
        return `
        <li>
            <button class="adm-carta-local" data-action="adm-carta-open" data-id="${l.id}">
                <b>${esc(l.nombre)}</b>
                <small>${menu.length ? `${menu.length - bebidas} plato(s) · ${bebidas} bebida(s)` : '⚠️ Sin carta todavía'}
                ${dietas.map(([d, n]) => ` · ${d.emoji} ${n}`).join('')}</small>
            </button>
            <button class="adm-btn small" data-action="adm-carta-open" data-id="${l.id}">Abrir carta</button>
        </li>`;
    }).join('')}</ul>`;
}

/** Marca los platos del import que ya están en la carta o que vienen repetidos */
function duplicados(preview, menu) {
    const enCarta = new Set(menu.map(m => clave(m.nombre)).filter(Boolean));
    const vistos = new Set();
    return preview.map(p => {
        const k = clave(p.nombre);
        if (!k) return 'Sin nombre';
        if (enCarta.has(k)) return 'Ya está en la carta';
        if (vistos.has(k)) return 'Repetido';
        vistos.add(k);
        return '';
    });
}

function previewHtml(local) {
    const problemas = duplicados(importPreview, local.menu || []);
    const malos = problemas.filter(Boolean).length;
    return `
        <div class="adm-import-preview" id="admImportPreview">
            <p><b>${importPreview.length}</b> platos detectados. Corrige el nombre, la categoría o el precio antes de agregarlos.</p>
            <div class="adm-table-wrap">
                <table class="adm-table adm-menu-table">
                    <thead><tr><th>Plato</th><th>Categoría</th><th>Precio</th><th>Bebida</th><th></th><th></th></tr></thead>
                    <tbody>${importPreview.map((p, i) => `
                        <tr class="${problemas[i] ? 'is-dup' : ''}">
                            <td><input id="ip_nombre_${i}" value="${esc(p.nombre)}" data-input="adm-import-edit" aria-label="Nombre del plato"></td>
                            <td><input id="ip_cat_${i}" value="${esc(p.categoria || '')}" list="admCategorias" aria-label="Categoría"></td>
                            <td><input id="ip_precio_${i}" type="number" min="0" step="10" value="${p.precio || 0}" aria-label="Precio"></td>
                            <td class="center"><input id="ip_drink_${i}" type="checkbox" ${p.isDrink ? 'checked' : ''} aria-label="Es bebida"></td>
                            <td class="adm-dup-cell">${problemas[i] ? `⚠️ ${esc(problemas[i])}` : ''}</td>
                            <td><button class="adm-btn small danger" data-action="adm-import-remove" data-index="${i}" aria-label="Quitar">✕</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="adm-form-actions">
                <button class="adm-btn ghost" data-action="adm-import-cancel">Cancelar</button>
                ${malos ? `<button class="adm-btn" data-action="adm-import-dedupe">Quitar ${malos} repetido(s)</button>` : '<span></span>'}
                <button class="adm-btn primary" data-action="adm-import-confirm" ${malos ? 'disabled title="Corrige o quita los platos repetidos primero"' : ''}>Agregar ${importPreview.length} platos</button>
            </div>
        </div>`;
}

export function renderCartas() {
    if (!db.locales.length) return `<h1 class="adm-title">Cartas</h1>${emptyRow('Primero crea un local.')}`;
    const local = localId ? getLocal(localId) : null;
    if (!local) {
        localId = null;
        return `
            <h1 class="adm-title">Cartas</h1>
            <p class="adm-help">Elige un local para ver y editar su carta, o importarla desde un PDF, una foto o una planilla.</p>
            <input class="adm-search" type="search" placeholder="Buscar local…" value="${esc(busqueda)}" data-input="adm-carta-buscar" aria-label="Buscar local">
            <div id="cartaLocales">${filasLocales()}</div>`;
    }
    const categorias = [...new Set(db.locales.flatMap(l => (l.menu || []).map(m => m.categoria)).filter(Boolean))];

    return `
        <div class="adm-head">
            <button class="adm-btn ghost" data-action="adm-carta-back">← Todas las cartas</button>
        </div>
        <h1 class="adm-title">Carta de ${esc(local.nombre)}</h1>
        <datalist id="admCategorias">${categorias.map(c => `<option value="${esc(c)}">`).join('')}</datalist>
        <section class="adm-card">
            <h2>${(local.menu || []).length} platos y bebidas</h2>
            ${(local.menu || []).length ? `
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
            <p class="adm-help">🤖 La IA revisa la carta y marca qué platos son vegetarianos 🥬, veganos 🌱, sin gluten 🌾 o sin lactosa 🥛.
            Son sugerencias: revísalas (sobre todo sin gluten, por los celíacos) y presiona "Guardar carta".</p>` : emptyRow('Esta carta está vacía. Agrega platos uno a uno o impórtala abajo.')}
            <div class="adm-form-actions">
                <button class="adm-btn" data-action="adm-dish-add">＋ Agregar plato</button>
                ${(local.menu || []).length ? `<button class="adm-btn" data-action="adm-diet-detect">🤖 Detectar opciones dietéticas</button>
                <button class="adm-btn primary" data-action="adm-carta-save">Guardar carta</button>` : ''}
            </div>
        </section>

        <section class="adm-card">
            <h2>Importar carta</h2>
            <p class="adm-help">Sube la carta como <b>PDF, foto, Excel (.xlsx), .csv o .txt</b>, o pega el texto (desde la web, Instagram o un PDF).
            Las fotos y los PDF escaneados los lee la IA. En el texto, las líneas sin precio se usan como categoría.
            Siempre podrás revisar y corregir antes de agregar, y no se aceptan platos con el mismo nombre.</p>
            <div class="adm-form-actions adm-import-file">
                <label class="adm-btn primary" id="admImportFileBtn">📄 Subir archivo o foto<input type="file" accept=".pdf,.xlsx,.csv,.txt,.md,image/*,application/pdf,text/plain" data-change="adm-import-file" hidden></label>
                <span class="adm-muted-cell" id="admImportEstado"></span>
            </div>
            <textarea id="admImportText" rows="7" class="adm-textarea" placeholder="ENTRADAS&#10;Ceviche clásico ...... $9.500&#10;Papa a la huancaína - 5.800&#10;BEBIDAS&#10;Pisco sour 4800"></textarea>
            <div class="adm-form-actions">
                <span></span>
                <button class="adm-btn" data-action="adm-import-preview">Revisar antes de importar</button>
            </div>
            ${importPreview ? previewHtml(local) : ''}
        </section>
    `;
}

/** Lee la tabla de revisión del import (con lo que el administrador corrigió) */
function readPreview() {
    return importPreview.map((p, i) => ({
        ...p,
        nombre: document.getElementById(`ip_nombre_${i}`)?.value.trim() ?? p.nombre,
        categoria: document.getElementById(`ip_cat_${i}`)?.value.trim() || 'Otros',
        precio: Math.max(0, Number(document.getElementById(`ip_precio_${i}`)?.value) || 0),
        isDrink: document.getElementById(`ip_drink_${i}`)?.checked ?? p.isDrink
    }));
}

function mostrarPreview(platos) {
    importPreview = platos.map(p => ({ ...p, isDrink: p.isDrink ?? esBebida(p.categoria) }));
    const text = document.getElementById('admImportText')?.value || '';
    rerender();
    const area = document.getElementById('admImportText');
    if (area) area.value = text;
    document.getElementById('admImportPreview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function readTable(local) {
    if (!document.getElementById('m_nombre_0')) return [...(local.menu || [])];
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
    'adm-carta-buscar': el => {
        busqueda = el.value;
        document.getElementById('cartaLocales').innerHTML = filasLocales();
    },
    'adm-carta-open': el => { localId = Number(el.dataset.id); importPreview = null; rerender(); window.scrollTo(0, 0); },
    'adm-carta-back': () => { localId = null; importPreview = null; rerender(); },
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
        const vistos = new Map();
        for (const [i, m] of menu.entries()) {
            const k = clave(m.nombre);
            if (vistos.has(k)) {
                toast(`"${m.nombre}" está dos veces (filas ${vistos.get(k) + 1} y ${i + 1}). Cambia el nombre o elimina una.`, 'error');
                return document.getElementById(`m_nombre_${i}`).focus();
            }
            vistos.set(k, i);
        }
        local.menu = menu;
        persist();
        toast('Carta guardada');
        rerender();
    },
    'adm-import-preview': () => {
        const platos = parseMenuText(document.getElementById('admImportText').value);
        if (!platos.length) return toast('No encontré platos con precio en el texto.', 'error');
        mostrarPreview(platos);
    },
    'adm-import-file': async el => {
        const file = el.files?.[0];
        el.value = '';
        if (!file) return;
        const estado = document.getElementById('admImportEstado');
        const boton = document.getElementById('admImportFileBtn');
        boton?.classList.add('is-busy');
        if (estado) estado.textContent = file.type.startsWith('image/') ? '🤖 La IA está leyendo la foto…' : `Leyendo ${file.name}…`;
        try {
            const { texto, platos } = await leerArchivoCarta(file);
            if (texto !== undefined) {
                document.getElementById('admImportText').value = texto;
                const encontrados = parseMenuText(texto);
                if (!encontrados.length) throw new Error('Leí el texto del archivo pero no encontré precios. Revísalo abajo y corrígelo antes de importar.');
                mostrarPreview(encontrados);
            } else {
                mostrarPreview(platos);
            }
            toast(`Revisa los platos detectados en ${file.name}`);
        } catch (err) {
            if (estado) estado.textContent = '';
            toast(err.message || 'No se pudo leer el archivo.', 'error');
        } finally {
            boton?.classList.remove('is-busy');
        }
    },
    'adm-import-edit': () => {
        // Revisa repetidos mientras se escribe, sin redibujar (para no perder el foco)
        const local = getLocal(localId);
        const actual = readPreview();
        const problemas = duplicados(actual, local.menu || []);
        problemas.forEach((p, i) => {
            const fila = document.getElementById(`ip_nombre_${i}`)?.closest('tr');
            fila?.classList.toggle('is-dup', !!p);
            const celda = fila?.querySelector('.adm-dup-cell');
            if (celda) celda.textContent = p ? `⚠️ ${p}` : '';
        });
        const confirmar = document.querySelector('[data-action="adm-import-confirm"]');
        if (confirmar) confirmar.disabled = problemas.some(Boolean);
    },
    'adm-import-remove': el => {
        const resto = readPreview();
        resto.splice(Number(el.dataset.index), 1);
        if (resto.length) mostrarPreview(resto);
        else { importPreview = null; rerender(); }
    },
    'adm-import-dedupe': () => {
        const local = getLocal(localId);
        const actual = readPreview();
        const problemas = duplicados(actual, local.menu || []);
        const quitados = problemas.filter(Boolean).length;
        importPreview = actual.filter((_, i) => !problemas[i]);
        if (!importPreview.length) { importPreview = null; rerender(); return toast('Todos los platos ya estaban en la carta.'); }
        mostrarPreview(importPreview);
        toast(`${quitados} plato(s) repetido(s) quitado(s)`);
    },
    'adm-diet-detect': async el => {
        const local = getLocal(localId);
        const menu = readTable(local);
        el.disabled = true;
        el.textContent = '🤖 Analizando la carta…';
        const resultado = await analizarDietasCarta(menu);
        let cambios = 0;
        menu.forEach((m, i) => {
            const fila = document.getElementById(`m_nombre_${i}`)?.closest('tr');
            DIETAS.forEach(d => {
                const check = document.getElementById(`m_d_${d.key}_${i}`);
                const sugerido = resultado[i].dietas.includes(d.key);
                if (check && check.checked !== sugerido) { check.checked = sugerido; cambios++; fila?.classList.add('is-suggested'); }
            });
            if (resultado[i].dudoso) fila?.classList.add('is-doubt');
        });
        el.disabled = false;
        el.textContent = '🤖 Detectar opciones dietéticas';
        toast(cambios ? `${cambios} marca(s) sugerida(s). Revisa las filas destacadas y guarda la carta.` : 'La carta ya estaba bien marcada.');
    },
    'adm-import-cancel': () => { importPreview = null; rerender(); },
    'adm-import-confirm': () => {
        const local = getLocal(localId);
        const menu = readTable(local);
        const nuevos = readPreview();
        if (duplicados(nuevos, menu).some(Boolean)) return toast('Hay platos repetidos o sin nombre. Corrígelos o quítalos primero.', 'error');
        // Los platos nuevos llegan con las opciones dietéticas detectadas
        local.menu = [...menu, ...nuevos.map(p => ({ ...p, imagen: '', likes: 0, dietas: sugerirDietas(p) }))];
        persist();
        toast(`${nuevos.length} platos agregados`);
        importPreview = null;
        rerender();
    }
});
