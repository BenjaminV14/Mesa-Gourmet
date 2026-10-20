// Importar encuesta: sube el Excel con las respuestas de los locales y se cargan solas en la app
import readExcelFile from 'read-excel-file/browser';
import { db, persist } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { TARGETS, guessTarget, sheetsToResponses, parseCsv, planImport } from '../survey.js';
import { toast, statusPill } from '../ui.js';
import { renderResponder, renderPreguntas, preguntaPorTexto, crearLocal, setEncuestaFormRerender } from './encuesta-form.js';

let step = 'subir';      // subir -> asignar -> revisar
let archivo = null;      // { nombre, formato, preguntas, respuestas }
let mapping = {};
let plan = [];
let rerender = () => {};
let tab = 'responder';   // responder | preguntas | importar

export function setEncuestaRerender(fn) { rerender = fn; setEncuestaFormRerender(fn); }

// Usa el dato del banco de preguntas si el encabezado coincide; si no, lo adivina
function targetFor(pregunta) {
    return preguntaPorTexto(pregunta)?.uso || guessTarget(pregunta);
}

async function readFile(file) {
    if (/\.csv$/i.test(file.name)) return parseCsv(await file.text());
    // Todas las hojas del Excel: [{ sheet, data: [[celda, ...], ...] }]
    return readExcelFile(file);
}

function sampleAnswer(pregunta) {
    const r = archivo.respuestas.find(x => String(x.respuestas[pregunta] ?? '').trim());
    const v = r ? r.respuestas[pregunta] : '';
    return v instanceof Date ? v.toLocaleDateString('es-CL') : String(v ?? '');
}

function renderSubir() {
    return `
        <section class="adm-card">
            <h2>1. Sube el archivo de la encuesta</h2>
            <p class="adm-help">Acepta Excel (.xlsx) o CSV. Sirven dos formatos:</p>
            <ul class="adm-help adm-bullets">
                <li><b>Una fila por local</b> y una columna por pregunta. Es lo que descarga Google Forms o Microsoft Forms.</li>
                <li><b>Una hoja por local</b> con dos columnas: Pregunta | Respuesta.</li>
            </ul>
            <p class="adm-help">Para archivos .xls antiguos: ábrelos en Excel y usa "Guardar como" → Libro de Excel (.xlsx).</p>
            <label class="adm-btn primary">Elegir archivo<input type="file" accept=".xlsx,.csv" data-change="adm-survey-file" hidden></label>
        </section>
        <section class="adm-card">
            <h2>Para las próximas encuestas</h2>
            <p class="adm-help">Crea la encuesta en <b>Google Forms</b>: las respuestas quedan en una planilla de Google Sheets.
            Cuando quieras actualizar la app, descarga la planilla (Archivo → Descargar → Microsoft Excel) y súbela aquí.
            Cada local que responda de nuevo se actualiza; los demás quedan igual.</p>
        </section>`;
}

function renderAsignar() {
    const asignadas = archivo.preguntas.filter(p => mapping[p] !== 'ignorar').length;
    return `
        <section class="adm-card">
            <h2>2. Revisa a qué dato corresponde cada pregunta</h2>
            <p class="adm-help"><b>${esc(archivo.nombre)}</b> · ${esc(archivo.formato)} · ${archivo.respuestas.length} local(es) · ${asignadas} de ${archivo.preguntas.length} preguntas reconocidas.
            Las sugerencias son automáticas; cambia las que no correspondan. Las respuestas completas se guardan igual en la ficha de cada local.</p>
            <div class="adm-table-wrap">
                <table class="adm-table">
                    <thead><tr><th>Pregunta de la encuesta</th><th>Ejemplo de respuesta</th><th>Dato en la app</th></tr></thead>
                    <tbody>
                        ${archivo.preguntas.map((p, i) => `
                        <tr>
                            <td>${esc(p)}</td>
                            <td class="adm-muted-cell">${esc(sampleAnswer(p).slice(0, 60))}</td>
                            <td>
                                <select class="adm-select adm-map-select ${mapping[p] === 'ignorar' ? 'is-ignored' : ''}" data-change="adm-survey-map" data-index="${i}" aria-label="Dato para: ${esc(p)}">
                                    ${TARGETS.map(t => `<option value="${esc(t.id)}" ${mapping[p] === t.id ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}
                                </select>
                            </td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
            ${Object.values(mapping).includes('nombre') ? '' : '<p class="adm-error">Asigna la pregunta que tiene el <b>nombre del local</b>: sin ella no se puede saber a qué local corresponde cada respuesta.</p>'}
            <div class="adm-form-actions">
                <button class="adm-btn ghost" data-action="adm-survey-reset">← Elegir otro archivo</button>
                <button class="adm-btn primary" data-action="adm-survey-plan" ${Object.values(mapping).includes('nombre') ? '' : 'disabled'}>Revisar cambios →</button>
            </div>
        </section>`;
}

function renderRevisar() {
    const aplicables = plan.filter(p => p.aplicable);
    return `
        <section class="adm-card">
            <h2>3. Confirma los cambios</h2>
            <p class="adm-help">${aplicables.filter(p => p.existente).length} local(es) se actualizarán y ${aplicables.filter(p => !p.existente).length} se crearán.
            Nada se guarda hasta que presiones "Importar".</p>
            ${plan.map(p => `
                <article class="adm-plan-item">
                    <div class="adm-plan-head">
                        <b>${esc(p.nombre || '(sin nombre)')}</b>
                        ${!p.aplicable ? statusPill('No se importará', 'warn') : p.existente ? statusPill('Actualizar', 'info') : statusPill('Nuevo local', 'ok')}
                        <small>${esc(p.fila)}</small>
                    </div>
                    ${p.cambios.length ? `<ul class="adm-changes">${p.cambios.map(c => `<li class="${c.startsWith('+') ? 'add' : c.startsWith('−') ? 'del' : ''}">${esc(c)}</li>`).join('')}</ul>` : '<p class="adm-help">Sin cambios: la información ya estaba al día.</p>'}
                    ${p.avisos.map(a => `<p class="adm-warning">⚠️ ${esc(a)}</p>`).join('')}
                </article>`).join('')}
            <div class="adm-form-actions">
                <button class="adm-btn ghost" data-action="adm-survey-back">← Volver a las preguntas</button>
                <button class="adm-btn primary" data-action="adm-survey-apply" ${aplicables.length ? '' : 'disabled'}>Importar ${aplicables.length} local(es)</button>
            </div>
        </section>`;
}

const TABS = [
    ['responder', '✍️ Responder por local'],
    ['preguntas', '📝 Preguntas'],
    ['importar', '📥 Importar Excel']
];

function renderImportar() {
    return `
        <p class="adm-help">Carga las respuestas de los dueños desde Excel: baños, WiFi, zona de fumadores, mascotas, horarios, contacto y más.
        Si los encabezados coinciden con tu banco de preguntas, se usa el dato que elegiste ahí.</p>
        ${step === 'subir' ? renderSubir() : step === 'asignar' ? renderAsignar() : renderRevisar()}`;
}

export function renderEncuesta() {
    return `
        <h1 class="adm-title">Encuesta a locales</h1>
        <div class="adm-tabs" role="tablist">
            ${TABS.map(([k, label]) => `<button class="adm-tab ${tab === k ? 'active' : ''}" role="tab" aria-selected="${tab === k}" data-action="adm-survey-tab" data-tab="${k}">${label}</button>`).join('')}
        </div>
        ${tab === 'responder' ? renderResponder() : tab === 'preguntas' ? renderPreguntas() : renderImportar()}
    `;
}

function applyPlan() {
    let creados = 0, actualizados = 0;
    const fecha = new Date().toISOString();
    for (const p of plan.filter(x => x.aplicable)) {
        // Las respuestas que coinciden con el banco se guardan por pregunta, así aparecen en "Responder por local"
        const nuevas = Object.fromEntries(Object.entries(p.respuestas).map(([k, v]) => [preguntaPorTexto(k)?.id || k, v instanceof Date ? v.toISOString() : v]));
        if (p.existente) {
            const previas = p.existente.encuesta?.respuestas || {};
            Object.assign(p.existente, p.resultado, { encuesta: { fecha, archivo: archivo.nombre, respuestas: { ...previas, ...nuevas } } });
            actualizados++;
        } else {
            crearLocal(p.nombre, { ...p.resultado, encuesta: { fecha, archivo: archivo.nombre, respuestas: nuevas } });
            creados++;
        }
    }
    persist();
    toast(`Encuesta importada: ${actualizados} actualizado(s), ${creados} nuevo(s)`);
    step = 'subir';
    archivo = null;
    plan = [];
    rerender();
}

registerActions({
    'adm-survey-tab': el => { tab = el.dataset.tab; rerender(); },
    'adm-survey-file': async el => {
        const file = el.files[0];
        if (!file) return;
        try {
            const sheets = await readFile(file);
            const parsed = sheetsToResponses(sheets);
            if (!parsed.respuestas.length) throw new Error('vacío');
            archivo = { nombre: file.name, ...parsed };
            mapping = Object.fromEntries(archivo.preguntas.map(p => [p, targetFor(p)]));
            step = 'asignar';
            rerender();
        } catch (err) {
            console.warn(err);
            toast('No pude leer el archivo. Revisa que sea .xlsx o .csv y que tenga las preguntas en la primera fila.', 'error');
        }
    },
    'adm-survey-map': el => {
        mapping[archivo.preguntas[Number(el.dataset.index)]] = el.value;
        rerender();
    },
    'adm-survey-reset': () => { step = 'subir'; archivo = null; rerender(); },
    'adm-survey-plan': () => {
        plan = planImport(archivo.respuestas, mapping, db.locales);
        step = 'revisar';
        rerender();
        window.scrollTo(0, 0);
    },
    'adm-survey-back': () => { step = 'asignar'; rerender(); },
    'adm-survey-apply': () => applyPlan()
});

