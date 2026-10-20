// Encuesta en vivo: registras las respuestas de cada dueño mientras conversas con él.
// Cada respuesta se guarda sola y, si la pregunta está conectada a un dato de la app
// (baño, WiFi, horario, Instagram...), la ficha del local se actualiza al instante.
// También se edita aquí el banco de preguntas: texto, sugerencia, sección y a qué dato va.
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { TALCA_CENTER } from '../../state.js';
import { TARGETS, planImport } from '../survey.js';
import { SECCIONES, DEFAULT_PREGUNTAS } from '../preguntas.js';
import { toast, confirmDialog } from '../ui.js';

let localId = null;
let soloPendientes = false;
let rerender = () => {};
const timers = {};

export function setEncuestaFormRerender(fn) { rerender = fn; }

// =================== BANCO DE PREGUNTAS ===================

export function banco() {
    if (!db.encuesta || !Array.isArray(db.encuesta.preguntas)) {
        db.encuesta = { preguntas: DEFAULT_PREGUNTAS.map(p => ({ ...p })) };
        persist();
    }
    return db.encuesta.preguntas;
}

// Pregunta del banco que coincide con un encabezado del Excel (por texto o sugerencia)
export function preguntaPorTexto(texto) {
    const t = normalize(texto);
    return banco().find(p => normalize(p.texto) === t || (p.sugerencia && normalize(p.sugerencia) === t)) || null;
}

const targetLabel = id => TARGETS.find(t => t.id === id)?.label || id;

function usoPill(uso) {
    if (uso === 'interno') return '<span class="adm-pill muted">🔒 Solo para ti</span>';
    if (uso === 'ignorar') return '<span class="adm-pill muted">No se usa</span>';
    return `<span class="adm-pill ok">📱 ${esc(targetLabel(uso).replace(/^Característica: /, ''))}</span>`;
}

// =================== LOCALES ===================

export function crearLocal(nombre, extra = {}) {
    const id = Math.max(0, ...db.locales.map(l => l.id)) + 1;
    const local = {
        id, nombre, tipo: 'Restaurante', lat: TALCA_CENTER.lat, lng: TALCA_CENTER.lng,
        menu: [], promociones: [], eventos: [], distinciones: [], etiquetas: [], caracteristicas: [], caracteristicasDetalle: {},
        horariosSemana: { Lunes: 'Cerrado', Martes: 'Cerrado', Miércoles: 'Cerrado', Jueves: 'Cerrado', Viernes: 'Cerrado', Sábado: 'Cerrado', Domingo: 'Cerrado' },
        vegano: 0, vegetariano: 0, sinGluten: 0, sinLactosa: 0,
        ...extra
    };
    db.locales.push(local);
    return local;
}

function respuestas(local) {
    local.encuesta = local.encuesta || {};
    local.encuesta.respuestas = local.encuesta.respuestas || {};
    return local.encuesta.respuestas;
}

// Respuesta guardada para una pregunta (por id; las importadas antes del banco quedaron por texto)
function respuestaDe(local, p) {
    const r = local.encuesta?.respuestas || {};
    return r[p.id] ?? r[p.texto] ?? '';
}

/** Aplica todas las respuestas conectadas del local a sus datos en la app. Devuelve los avisos. */
function aplicarRespuestas(local) {
    const preguntas = banco();
    const r = {};
    const mapping = {};
    for (const p of preguntas) {
        if (p.uso === 'interno' || p.uso === 'ignorar') continue;
        const valor = String(respuestaDe(local, p)).trim();
        if (!valor) continue;
        r[p.id] = valor;
        mapping[p.id] = p.uso;
    }
    const nombreP = preguntas.find(p => p.uso === 'nombre');
    const nombre = (nombreP && String(respuestaDe(local, nombreP)).trim()) || local.nombre;
    r.__nombre = nombre;
    mapping.__nombre = 'nombre';
    // Se compara contra una copia con el nombre nuevo para que planImport reconozca al local
    const [plan] = planImport([{ fila: 'Formulario', respuestas: r }], mapping, [{ ...local, nombre }]);
    Object.assign(local, plan.resultado, { nombre });
    local.encuesta.actualizada = new Date().toISOString();
    persist();
    return plan.avisos.filter(a => !a.startsWith('Local nuevo'));
}

// =================== VISTA: RESPONDER ===================

function progreso(local) {
    const preguntas = banco();
    const hechas = preguntas.filter(p => String(respuestaDe(local, p)).trim()).length;
    return { hechas, total: preguntas.length };
}

function chipsRapidos(p) {
    if (!/^(car|det|dietaN):/.test(p.uso)) return '';
    const opciones = ['Sí', 'No'];
    if (/Mascotas|Fumadores/.test(p.uso)) opciones.push('Solo en terraza');
    if (p.uso === 'car:Mascotas (Solo en Terraza)') opciones.push('En todo el local');
    return `<div class="adm-quick">${opciones.map(o => `<button type="button" class="adm-quick-chip" data-action="adm-ans-quick" data-q="${esc(p.id)}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
}

function placeholder(p) {
    if (p.uso.startsWith('det:WiFi')) return 'Ej: Sí, clave: carlota2026';
    if (p.uso.startsWith('det:')) return 'Ej: Sí, con PedidosYa y Uber Eats';
    if (p.uso.startsWith('dietaN:')) return 'Ej: 3 (empanada de queso, ensalada...)';
    if (p.uso === 'horario') return 'Ej: Lunes a viernes 12:00 a 23:00, sábado 13:00 a 01:00, domingo cerrado';
    if (p.uso === 'instagram' || p.uso === 'tiktok') return '@usuario o link';
    return 'Respuesta del dueño';
}

function preguntaHtml(local, p) {
    const valor = String(respuestaDe(local, p));
    const largo = p.uso === 'horario' || p.uso === 'interno' || valor.length > 60;
    const input = largo
        ? `<textarea id="ans-${esc(p.id)}" rows="2" data-input="adm-ans" data-q="${esc(p.id)}" placeholder="${esc(placeholder(p))}">${esc(valor)}</textarea>`
        : `<input id="ans-${esc(p.id)}" type="text" value="${esc(valor)}" data-input="adm-ans" data-q="${esc(p.id)}" placeholder="${esc(placeholder(p))}">`;
    return `
        <div class="adm-q ${valor.trim() ? 'is-done' : ''}" data-qbox="${esc(p.id)}">
            <label for="ans-${esc(p.id)}" class="adm-q-text">${esc(p.texto)}</label>
            ${p.sugerencia ? `<p class="adm-q-sug">💬 Pregúntalo así: ${esc(p.sugerencia)}</p>` : ''}
            ${input}
            <div class="adm-q-foot">${usoPill(p.uso)}${chipsRapidos(p)}</div>
        </div>`;
}

function renderLocalForm(local) {
    const preguntas = banco();
    const { hechas, total } = progreso(local);
    const extras = Object.entries(local.encuesta?.respuestas || {})
        .filter(([k]) => !preguntas.some(p => p.id === k || p.texto === k) && !k.startsWith('__'));
    const secciones = Object.keys(SECCIONES).map(sec => {
        const lista = preguntas.filter(p => p.seccion === sec && (!soloPendientes || !String(respuestaDe(local, p)).trim()));
        if (!lista.length) return '';
        return `
            <section class="adm-card adm-q-section" style="--sec:${SECCIONES[sec].color}">
                <h2>${esc(SECCIONES[sec].nombre)}</h2>
                ${lista.map(p => preguntaHtml(local, p)).join('')}
            </section>`;
    }).join('');
    return `
        <div class="adm-survey-status" id="admSurveyStatus" role="status">
            <div class="adm-progress"><span style="width:${total ? Math.round(hechas / total * 100) : 0}%"></span></div>
            <span id="admSurveyCount">${hechas} de ${total} respondidas</span>
            <span id="admSurveySaved" class="adm-muted-cell">${local.encuesta?.actualizada ? 'Guardado ✓' : 'Se guarda solo mientras escribes'}</span>
        </div>
        <div id="admSurveyAvisos"></div>
        ${secciones || '<p class="adm-help">¡Todas las preguntas tienen respuesta! 🎉</p>'}
        ${extras.length ? `
            <section class="adm-card">
                <h2>Otras respuestas importadas</h2>
                <p class="adm-help">Vienen del Excel y no coinciden con ninguna pregunta del banco.</p>
                <dl class="adm-dl">${extras.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join('')}</dl>
            </section>` : ''}`;
}

export function renderResponder() {
    banco();
    const local = localId ? getLocal(localId) : null;
    return `
        <section class="adm-card">
            <h2>¿Qué local estás encuestando?</h2>
            <div class="adm-survey-pick">
                <select class="adm-select" data-change="adm-ans-local" aria-label="Local">
                    <option value="">Elige un local…</option>
                    ${db.locales.map(l => {
                        const { hechas, total } = progreso(l);
                        return `<option value="${l.id}" ${l.id === localId ? 'selected' : ''}>${esc(l.nombre)} · ${hechas}/${total}</option>`;
                    }).join('')}
                </select>
                <button class="adm-btn ghost" data-action="adm-ans-new">＋ Local nuevo</button>
                ${local ? `<label class="adm-check"><input type="checkbox" data-change="adm-ans-pending" ${soloPendientes ? 'checked' : ''}> Solo preguntas sin responder</label>` : ''}
            </div>
            <p class="adm-help">Las preguntas con <span class="adm-pill ok">📱</span> actualizan la ficha del local apenas escribes. Las <span class="adm-pill muted">🔒 Solo para ti</span> quedan guardadas aquí y no las ve nadie más.</p>
        </section>
        ${local ? renderLocalForm(local) : ''}`;
}

function guardarRespuesta(qid, valor) {
    const local = getLocal(localId);
    if (!local) return;
    respuestas(local)[qid] = valor;
    // Si existía la respuesta guardada por texto (importada), se reemplaza por la del id
    const p = banco().find(x => x.id === qid);
    if (p && p.texto in local.encuesta.respuestas) delete local.encuesta.respuestas[p.texto];
    const avisos = aplicarRespuestas(local);
    const { hechas, total } = progreso(local);
    document.getElementById('admSurveyCount').textContent = `${hechas} de ${total} respondidas`;
    document.querySelector('#admSurveyStatus .adm-progress span').style.width = `${Math.round(hechas / total * 100)}%`;
    const hora = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('admSurveySaved').textContent = `Guardado ✓ ${hora}`;
    document.querySelector(`[data-qbox="${CSS.escape(qid)}"]`)?.classList.toggle('is-done', !!valor.trim());
    document.getElementById('admSurveyAvisos').innerHTML = avisos.map(a => `<p class="adm-warning">⚠️ ${esc(a)}</p>`).join('');
}

// =================== VISTA: PREGUNTAS ===================

export function renderPreguntas() {
    const preguntas = banco();
    return `
        <section class="adm-card">
            <h2>Banco de preguntas</h2>
            <p class="adm-help">Edita el texto, usa la redacción sugerida y elige a qué dato de la app va cada respuesta.
            Los cambios se guardan solos. Las respuestas ya registradas no se pierden al cambiar el texto.</p>
            <div class="adm-form-actions">
                <button class="adm-btn ghost" data-action="adm-q-reset">Restaurar preguntas originales</button>
            </div>
        </section>
        ${Object.entries(SECCIONES).map(([sec, info]) => {
            const lista = preguntas.filter(p => p.seccion === sec);
            return `
            <section class="adm-card adm-q-section" style="--sec:${info.color}">
                <h2>${esc(info.nombre)} <small class="adm-muted-cell">${lista.length}</small></h2>
                ${lista.map(p => `
                <div class="adm-qedit">
                    <div class="adm-qedit-main">
                        <input type="text" value="${esc(p.texto)}" data-change="adm-q-edit" data-q="${esc(p.id)}" data-field="texto" aria-label="Texto de la pregunta">
                        ${p.sugerencia ? `<p class="adm-q-sug">💡 ${esc(p.sugerencia)} <button class="adm-link" data-action="adm-q-use" data-q="${esc(p.id)}">Usar sugerencia</button></p>` : ''}
                        <div class="adm-qedit-row">
                            <select class="adm-select" data-change="adm-q-edit" data-q="${esc(p.id)}" data-field="uso" aria-label="Dato en la app">
                                ${TARGETS.filter(t => t.id !== 'ignorar').map(t => `<option value="${esc(t.id)}" ${p.uso === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
                            </select>
                            <select class="adm-select" data-change="adm-q-edit" data-q="${esc(p.id)}" data-field="seccion" aria-label="Sección">
                                ${Object.entries(SECCIONES).map(([k, s]) => `<option value="${k}" ${p.seccion === k ? 'selected' : ''}>${esc(s.nombre)}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="adm-qedit-tools">
                        <button class="adm-icon-btn" data-action="adm-q-move" data-q="${esc(p.id)}" data-dir="-1" aria-label="Subir">↑</button>
                        <button class="adm-icon-btn" data-action="adm-q-move" data-q="${esc(p.id)}" data-dir="1" aria-label="Bajar">↓</button>
                        <button class="adm-icon-btn danger" data-action="adm-q-delete" data-q="${esc(p.id)}" aria-label="Eliminar">✕</button>
                    </div>
                </div>`).join('')}
                <button class="adm-btn ghost small" data-action="adm-q-add" data-sec="${sec}">＋ Agregar pregunta</button>
            </section>`;
        }).join('')}`;
}

const pregunta = id => banco().find(p => p.id === id);

registerActions({
    'adm-ans-local': el => { localId = el.value ? Number(el.value) : null; rerender(); },
    'adm-ans-pending': el => { soloPendientes = el.checked; rerender(); },
    'adm-ans-new': () => {
        const local = crearLocal('Local nuevo');
        persist();
        localId = local.id;
        toast('Local creado. Escribe su nombre en la primera pregunta.');
        rerender();
    },
    'adm-ans': el => {
        const qid = el.dataset.q;
        clearTimeout(timers[qid]);
        document.getElementById('admSurveySaved').textContent = 'Guardando…';
        timers[qid] = setTimeout(() => guardarRespuesta(qid, el.value), 500);
    },
    'adm-ans-quick': el => {
        const input = document.getElementById(`ans-${el.dataset.q}`);
        // "Sí" + lo que ya estaba escrito como detalle ("Sí, clave: ...")
        const resto = input.value.replace(/^(s[ií]|no|solo en terraza|en todo el local)\s*[,.:;-]?\s*/i, '');
        input.value = el.dataset.value === 'No' ? 'No' : resto ? `${el.dataset.value}, ${resto}` : el.dataset.value;
        guardarRespuesta(el.dataset.q, input.value);
        input.focus();
    },
    'adm-q-edit': el => {
        const p = pregunta(el.dataset.q);
        if (!p) return;
        p[el.dataset.field] = el.dataset.field === 'texto' ? el.value.trim() || p.texto : el.value;
        persist();
        if (el.dataset.field !== 'texto') rerender();
        toast('Pregunta actualizada');
    },
    'adm-q-use': el => {
        const p = pregunta(el.dataset.q);
        p.texto = p.sugerencia;
        p.sugerencia = '';
        persist();
        rerender();
    },
    'adm-q-move': el => {
        const lista = banco();
        const i = lista.findIndex(p => p.id === el.dataset.q);
        const sec = lista[i].seccion;
        // Busca la pregunta vecina de la misma sección
        let j = i + Number(el.dataset.dir);
        while (j >= 0 && j < lista.length && lista[j].seccion !== sec) j += Number(el.dataset.dir);
        if (j < 0 || j >= lista.length) return;
        [lista[i], lista[j]] = [lista[j], lista[i]];
        persist();
        rerender();
    },
    'adm-q-delete': el => {
        const p = pregunta(el.dataset.q);
        confirmDialog(`¿Eliminar la pregunta "${p.texto}"? Las respuestas que ya registraste quedan guardadas en cada local.`, () => {
            db.encuesta.preguntas = banco().filter(x => x.id !== p.id);
            persist();
            rerender();
        }, 'Eliminar');
    },
    'adm-q-add': el => {
        const lista = banco();
        const id = `q${Date.now().toString(36)}`;
        // Se inserta al final de su sección
        const ultima = lista.map(p => p.seccion).lastIndexOf(el.dataset.sec);
        lista.splice(ultima + 1, 0, { id, seccion: el.dataset.sec, texto: 'Nueva pregunta', uso: 'interno', sugerencia: '' });
        persist();
        rerender();
        setTimeout(() => document.querySelector(`[data-q="${id}"][data-field="texto"]`)?.select(), 0);
    },
    'adm-q-reset': () => confirmDialog('¿Volver a las preguntas originales? Se pierden los cambios de texto y las preguntas que agregaste (las respuestas quedan guardadas).', () => {
        db.encuesta = null;
        banco();
        rerender();
    }, 'Restaurar')
});
