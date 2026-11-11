// Cartas: primero la lista de locales con buscador; al abrir uno se sube la carta (fotos, PDF, planilla o texto),
// la IA lee los platos y marca qué dietas cumple cada uno, y se revisa antes de guardar.
// En la carta guardada se pueden seleccionar varios platos y borrarlos de una vez.
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { toast, confirmDialog, emptyRow } from '../ui.js';
import { DIETAS, dietaLocal } from '../../data/metrics.js';
import { analizarDietasCarta, sugerirDietas } from '../../services/dietas.js';
import { leerArchivosCarta } from '../carta-archivo.js';

let localId = null;
let importPreview = null;
let reemplazar = false; // el import reemplaza la carta entera en vez de agregar platos
let busqueda = '';
let rerender = () => {};

export function setCartasRerender(fn) { rerender = fn; }
export function selectCartaLocal(id) { localId = id || null; importPreview = null; reemplazar = false; }

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
    // Si se reemplaza la carta, los platos que ya estaban no cuentan como repetidos
    const enCarta = new Set(reemplazar ? [] : menu.map(m => clave(m.nombre)).filter(Boolean));
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
            <p><b>${importPreview.length}</b> platos detectados. Corrige el nombre, la categoría, el precio o las dietas antes de guardarlos.
            Las filas en amarillo son dudosas: revisa sobre todo las marcadas 🌾 sin gluten.</p>
            ${(local.menu || []).length ? `<label class="adm-check-line"><input type="checkbox" data-change="adm-import-reemplazar" ${reemplazar ? 'checked' : ''}>
                <span><b>Reemplazar la carta actual</b> (${(local.menu || []).length} platos): se borran los que no estén en la nueva. Los que se repiten conservan sus fotos y likes.</span></label>` : ''}
            <div class="adm-table-wrap">
                <table class="adm-table adm-menu-table">
                    <thead><tr><th>Plato</th><th>Categoría</th><th>Precio</th><th>Bebida</th><th title="Vegetariano, vegano, sin gluten, sin lactosa">Apto para</th><th></th><th></th></tr></thead>
                    <tbody>${importPreview.map((p, i) => `
                        <tr class="${problemas[i] ? 'is-dup' : ''} ${p.dudoso ? 'is-doubt' : ''}" ${p.nota ? `title="${esc(p.nota)}"` : ''}>
                            <td><input id="ip_nombre_${i}" value="${esc(p.nombre)}" data-input="adm-import-edit" aria-label="Nombre del plato">${p.descripcion ? `<small class="adm-muted-cell">${esc(p.descripcion)}</small>` : ''}</td>
                            <td><input id="ip_cat_${i}" value="${esc(p.categoria || '')}" list="admCategorias" aria-label="Categoría"></td>
                            <td><input id="ip_precio_${i}" type="number" min="0" step="10" value="${p.precio || 0}" aria-label="Precio"></td>
                            <td class="center"><input id="ip_drink_${i}" type="checkbox" ${p.isDrink ? 'checked' : ''} aria-label="Es bebida"></td>
                            <td><div class="adm-diet-checks">${DIETAS.map(d => `<label title="${esc(d.label)}"><input type="checkbox" id="ip_d_${d.key}_${i}" ${(p.dietas || []).includes(d.key) ? 'checked' : ''} aria-label="${esc(d.label)}">${d.emoji}</label>`).join('')}</div></td>
                            <td class="adm-dup-cell">${problemas[i] ? `⚠️ ${esc(problemas[i])}` : ''}</td>
                            <td><button class="adm-btn small danger" data-action="adm-import-remove" data-index="${i}" aria-label="Quitar">✕</button></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            <div class="adm-form-actions">
                <button class="adm-btn ghost" data-action="adm-import-cancel">Cancelar</button>
                ${malos ? `<button class="adm-btn" data-action="adm-import-dedupe">Quitar ${malos} repetido(s)</button>` : '<span></span>'}
                <button class="adm-btn primary" data-action="adm-import-confirm" ${malos ? 'disabled title="Corrige o quita los platos repetidos primero"' : ''}>${reemplazar ? `Reemplazar la carta con ${importPreview.length} platos` : `Agregar ${importPreview.length} platos`}</button>
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

    const menu = local.menu || [];
    return `
        <div class="adm-head">
            <button class="adm-btn ghost" data-action="adm-carta-back">← Todas las cartas</button>
        </div>
        <h1 class="adm-title">Carta de ${esc(local.nombre)}</h1>
        <datalist id="admCategorias">${categorias.map(c => `<option value="${esc(c)}">`).join('')}</datalist>

        <section class="adm-card adm-subir-carta">
            <h2>📸 Subir la carta</h2>
            <p class="adm-help">Sube fotos de la carta (puedes elegir varias, una por página), un PDF, un Excel o un .csv.
            La IA lee los platos y precios y marca qué dietas cumple cada uno: vegetariano 🥬, vegano 🌱, sin gluten 🌾 y sin lactosa 🥛.
            Antes de guardar lo revisas y corriges.</p>
            <div class="adm-form-actions adm-import-file">
                <label class="adm-btn primary" id="admImportFileBtn">📄 Elegir fotos o archivo<input type="file" multiple accept=".pdf,.xlsx,.csv,.txt,.md,image/*,application/pdf,text/plain" data-change="adm-import-file" hidden></label>
                <span class="adm-muted-cell" id="admImportEstado"></span>
            </div>
            <details class="adm-pegar-texto">
                <summary>O pega el texto de la carta</summary>
                <p class="adm-help">Desde la web, Instagram o un PDF. Las líneas sin precio se usan como categoría.</p>
                <textarea id="admImportText" rows="7" class="adm-textarea" placeholder="ENTRADAS&#10;Ceviche clásico ...... $9.500&#10;Papa a la huancaína - 5.800&#10;BEBIDAS&#10;Pisco sour 4800"></textarea>
                <div class="adm-form-actions"><span></span><button class="adm-btn" data-action="adm-import-preview">Revisar antes de importar</button></div>
            </details>
            ${importPreview ? previewHtml(local) : ''}
        </section>

        <section class="adm-card">
            <h2>${menu.length} platos y bebidas</h2>
            ${local.celiacoSeguro === false ? `<p class="adm-warning">🌾 En la encuesta, este local dijo que no se protege (o no sabe si se protege) de la contaminación cruzada con gluten.
                Por eso la app no muestra ningún plato como apto para celíacos, aunque esté marcado aquí.</p>` : ''}
            ${menu.length ? `
            <div class="adm-sel-bar" id="admSelBar" hidden>
                <span id="admSelN"></span>
                <button class="adm-btn small danger" data-action="adm-dish-delete-sel">🗑 Eliminar seleccionados</button>
                <button class="adm-btn small ghost" data-action="adm-dish-sel-none">Quitar selección</button>
            </div>
            <div class="adm-table-wrap">
                <table class="adm-table adm-menu-table">
                    <thead><tr><th class="center"><input type="checkbox" id="m_sel_all" data-change="adm-dish-sel-all" aria-label="Seleccionar todos"></th><th>Plato</th><th>Categoría</th><th>Precio</th><th>Bebida</th><th title="Vegetariano, vegano, sin gluten, sin lactosa">Apto para</th><th>Foto (URL)</th><th>❤️</th><th></th></tr></thead>
                    <tbody>
                        ${menu.map((m, i) => `
                        <tr>
                            <td class="center"><input type="checkbox" class="adm-dish-sel" id="m_sel_${i}" data-change="adm-dish-sel" aria-label="Seleccionar ${esc(m.nombre || 'plato')}"></td>
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
            <p class="adm-help">Marca la casilla de la izquierda para seleccionar varios platos y eliminarlos juntos.
            Las dietas son sugerencias de la IA: revísalas (sobre todo sin gluten, por los celíacos) y presiona "Guardar carta".</p>` : emptyRow('Esta carta está vacía. Súbela arriba o agrega platos uno a uno.')}
            <div class="adm-form-actions">
                <button class="adm-btn" data-action="adm-dish-add">＋ Agregar plato</button>
                ${menu.length ? `<button class="adm-btn" data-action="adm-diet-detect">🤖 Revisar dietas con IA</button>
                <button class="adm-btn primary" data-action="adm-carta-save">Guardar carta</button>` : ''}
            </div>
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
        isDrink: document.getElementById(`ip_drink_${i}`)?.checked ?? p.isDrink,
        dietas: document.getElementById(`ip_d_${DIETAS[0].key}_${i}`) ? DIETAS.filter(d => document.getElementById(`ip_d_${d.key}_${i}`).checked).map(d => d.key) : (p.dietas || [])
    }));
}

function mostrarPreview(platos) {
    importPreview = platos.map(p => ({ ...p, isDrink: p.isDrink ?? esBebida(p.categoria) }));
    const text = document.getElementById('admImportText')?.value || '';
    const abierto = document.querySelector('.adm-pegar-texto')?.open;
    rerender();
    const area = document.getElementById('admImportText');
    if (area) area.value = text;
    if (abierto) document.querySelector('.adm-pegar-texto').open = true;
    document.getElementById('admImportPreview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/** Platos recién leídos: la IA marca sus dietas y se muestran para revisar */
async function revisarPlatos(platos) {
    const estado = document.getElementById('admImportEstado');
    if (estado) estado.textContent = `🤖 Revisando las dietas de ${platos.length} platos…`;
    const analisis = await analizarDietasCarta(platos);
    if (estado) estado.textContent = '';
    mostrarPreview(platos.map((p, i) => ({ ...p, dietas: analisis[i].dietas, dudoso: analisis[i].dudoso, nota: analisis[i].nota })));
}

const seleccionados = () => [...document.querySelectorAll('.adm-dish-sel')].map((c, i) => c.checked ? i : -1).filter(i => i > -1);
function actualizarSeleccion() {
    const n = seleccionados().length;
    const total = document.querySelectorAll('.adm-dish-sel').length;
    const barra = document.getElementById('admSelBar');
    if (barra) barra.hidden = n === 0;
    const texto = document.getElementById('admSelN');
    if (texto) texto.textContent = `${n} seleccionado(s)`;
    const todos = document.getElementById('m_sel_all');
    if (todos) { todos.checked = n > 0 && n === total; todos.indeterminate = n > 0 && n < total; }
    document.querySelectorAll('.adm-dish-sel').forEach(c => c.closest('tr')?.classList.toggle('is-selected', c.checked));
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
    'adm-dish-sel': () => actualizarSeleccion(),
    'adm-dish-sel-all': el => {
        document.querySelectorAll('.adm-dish-sel').forEach(c => { c.checked = el.checked; });
        actualizarSeleccion();
    },
    'adm-dish-sel-none': () => {
        document.querySelectorAll('.adm-dish-sel').forEach(c => { c.checked = false; });
        actualizarSeleccion();
    },
    'adm-dish-delete-sel': () => {
        const local = getLocal(localId);
        const menu = readTable(local);
        const borrar = new Set(seleccionados());
        if (!borrar.size) return;
        const nombres = [...borrar].slice(0, 5).map(i => `"${menu[i].nombre || 'sin nombre'}"`).join(', ');
        confirmDialog(`¿Eliminar ${borrar.size} plato(s) de la carta? ${nombres}${borrar.size > 5 ? ' y otros' : ''}.`, () => {
            local.menu = menu.filter((_, i) => !borrar.has(i));
            persist();
            toast(`${borrar.size} plato(s) eliminado(s)`);
            rerender();
        }, 'Eliminar');
    },
    'adm-import-reemplazar': el => {
        importPreview = readPreview();
        reemplazar = el.checked;
        mostrarPreview(importPreview);
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
        revisarPlatos(platos);
    },
    'adm-import-file': async el => {
        const files = [...(el.files || [])];
        el.value = '';
        if (!files.length) return;
        const estado = document.getElementById('admImportEstado');
        const boton = document.getElementById('admImportFileBtn');
        boton?.classList.add('is-busy');
        const nombre = files.length > 1 ? `${files.length} archivos` : files[0].name;
        if (estado) estado.textContent = files.some(f => f.type.startsWith('image/')) ? '🤖 La IA está leyendo la carta…' : `Leyendo ${nombre}…`;
        try {
            const { texto, platos } = await leerArchivosCarta(files);
            const todos = [...platos];
            if (texto !== undefined) {
                document.getElementById('admImportText').value = texto;
                todos.push(...parseMenuText(texto));
                if (!todos.length) {
                    document.querySelector('.adm-pegar-texto').open = true;
                    throw new Error('Leí el texto del archivo pero no encontré precios. Revísalo en "O pega el texto de la carta" y corrígelo.');
                }
            }
            await revisarPlatos(todos);
            toast(`Revisa los platos detectados en ${nombre}`);
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
        el.textContent = '🤖 Revisar dietas con IA';
        toast(cambios ? `${cambios} marca(s) sugerida(s). Revisa las filas destacadas y guarda la carta.` : 'La carta ya estaba bien marcada.');
    },
    'adm-import-cancel': () => { importPreview = null; reemplazar = false; rerender(); },
    'adm-import-confirm': () => {
        const local = getLocal(localId);
        const menu = readTable(local);
        const nuevos = readPreview();
        if (duplicados(nuevos, menu).some(Boolean)) return toast('Hay platos repetidos o sin nombre. Corrígelos o quítalos primero.', 'error');
        // Los platos llegan con las dietas revisadas en la tabla (sugeridas por la IA o por reglas)
        const limpio = ({ dudoso, nota, ...p }) => ({ ...p, dietas: p.dietas || sugerirDietas(p) });
        const guardar = lista => {
            local.menu = lista;
            persist();
            importPreview = null;
            reemplazar = false;
            rerender();
        };
        if (!reemplazar) {
            guardar([...menu, ...nuevos.map(p => ({ ...limpio(p), imagen: '', likes: 0 }))]);
            return toast(`${nuevos.length} platos agregados`);
        }
        // Reemplazar: los platos que ya estaban (mismo nombre) conservan su id, foto y likes
        const antes = new Map(menu.map(m => [clave(m.nombre), m]));
        const nueva = nuevos.map(p => {
            const previo = antes.get(clave(p.nombre));
            return previo ? { ...previo, ...limpio(p) } : { ...limpio(p), imagen: '', likes: 0 };
        });
        const borrados = menu.filter(m => !nueva.some(n => clave(n.nombre) === clave(m.nombre))).length;
        confirmDialog(`¿Reemplazar la carta? Quedarán ${nueva.length} platos${borrados ? ` y se borrarán ${borrados} que no están en la nueva` : ''}.`, () => {
            guardar(nueva);
            toast('Carta reemplazada');
        }, 'Reemplazar');
    }
});
