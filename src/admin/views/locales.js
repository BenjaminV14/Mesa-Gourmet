// Locales: crear, editar y eliminar la ficha de cada local
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc, safeUrl } from '../../utils/html.js';
import { DIAS_SEMANA, estadoHorario } from '../../utils/time.js';
import { isSponsored } from '../../features/sponsors.js';
import { notaActual, DIETAS as DIETAS_APP } from '../../data/metrics.js';
import { CARACTERISTICAS_KEYWORDS } from '../survey.js';
import { banco, eliminarLocal } from './encuesta-form.js';
import { field, textarea, val, toast, confirmDialog, statusPill } from '../ui.js';
import { compressImage } from '../../services/ai.js';

export const CARACTERISTICAS = Object.keys(CARACTERISTICAS_KEYWORDS);

const DIETAS = DIETAS_APP.map(d => [d.key, `${d.emoji} ${d.label}`]);

// Datos para la sección "Antes de ir" de la ficha
const EXTRAS = [
    ['slogan', 'Slogan o frase del local', 'Ej: El sabor de la casa'],
    ['cartaUrl', 'Link de la carta oficial', 'https://…'],
    ['referencia', 'Punto de referencia', 'Ej: Frente a la plaza'],
    ['horarioFeriados', 'Horario en feriados', 'Ej: Feriados de 13:00 a 18:00'],
    ['mediosPago', 'Medios de pago', 'Efectivo, débito, crédito, transferencia'],
    ['capacidad', 'Capacidad', 'Ej: 40 personas, 10 mesas'],
    ['ambiente', 'Ambiente y público', 'Ej: Familiar, estudiantes'],
    ['tematica', 'Temática o decoración', 'Ej: Rústica, años 80'],
    ['horasPeak', 'Horas con más gente', 'Ej: 13:00 a 15:00'],
    ['diasPeak', 'Días con más gente', 'Ej: Viernes y sábado'],
    ['notaAcceso', 'Para llegar o entrar', 'Ej: Tiene escalera, sin rampa']
];
const ORDEN_DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

let editingId = null;
let filtro = '';
let rerender = () => {};

export function setLocalesRerender(fn) { rerender = fn; }
export function editLocal(id) { editingId = id ?? null; }

export function renderLocales() {
    if (editingId !== null) return renderForm(editingId === 'nuevo' ? null : getLocal(editingId));
    const lista = db.locales.filter(l => l.nombre.toLowerCase().includes(filtro.toLowerCase()));
    return `
        <div class="adm-head">
            <h1 class="adm-title">Locales</h1>
            <button class="adm-btn primary" data-action="adm-local-new">＋ Nuevo local</button>
        </div>
        <input class="adm-search" type="search" placeholder="Buscar local…" value="${esc(filtro)}" data-input="adm-local-filter" aria-label="Buscar local">
        <div class="adm-table-wrap">
            <table class="adm-table">
                <thead><tr><th>Local</th><th>Tipo</th><th>Estado ahora</th><th>Nota 30 días</th><th>Platos</th><th></th></tr></thead>
                <tbody>
                    ${lista.map(l => `
                        <tr>
                            <td><div class="adm-local-cell"><img src="${esc(safeUrl(l.imagen))}" alt=""><b>${esc(l.nombre)}</b> ${isSponsored(l) ? statusPill('★ Destacado', 'gold') : ''}</div></td>
                            <td>${esc(l.tipo)}</td>
                            <td>${esc(estadoHorario(l).etiqueta)}</td>
                            <td>${notaActual(l.id).total ? notaActual(l.id).total.toFixed(1) : '—'}</td>
                            <td>${(l.menu || []).length}</td>
                            <td class="adm-row-actions"><button class="adm-btn small" data-action="adm-local-edit" data-id="${l.id}">Editar</button></td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderForm(local) {
    const l = local || { nombre: '', tipo: '', direccion: '', telefono: '', whatsapp: '', instagram: '', tiktok: '', website: '', descripcion: '', imagen: '', lat: -35.4264, lng: -71.6554, horariosSemana: {}, caracteristicas: [], etiquetas: [] };
    return `
        <div class="adm-head">
            <h1 class="adm-title">${local ? `Editar: ${esc(l.nombre)}` : 'Nuevo local'}</h1>
            <button class="adm-btn ghost" data-action="adm-local-back">← Volver a la lista</button>
        </div>
        <form id="admLocalForm" class="adm-form" novalidate>
            <section class="adm-card">
                <h2>Datos generales</h2>
                <div class="adm-grid">
                    ${field('Nombre *', 'f_nombre', l.nombre, { attrs: 'required maxlength="80"' })}
                    ${field('Tipo de local *', 'f_tipo', l.tipo, { placeholder: 'Ej: Restaurante Peruano', attrs: 'required' })}
                    ${field('Dirección', 'f_direccion', l.direccion, { full: true })}
                    ${field('Teléfono', 'f_telefono', l.telefono, { placeholder: '+56 9 1234 5678' })}
                    ${field('WhatsApp (solo números)', 'f_whatsapp', l.whatsapp, { placeholder: '56912345678' })}
                    ${field('WhatsApp para reservas (si es otro número)', 'f_whatsappReservas', l.whatsappReservas, { placeholder: 'Vacío = el mismo WhatsApp' })}
                    ${field('Instagram (usuario)', 'f_instagram', l.instagram)}
                    ${field('TikTok (usuario)', 'f_tiktok', l.tiktok)}
                    ${field('Facebook (usuario o página)', 'f_facebook', l.facebook)}
                    ${field('Sitio web', 'f_website', l.website, { type: 'url', placeholder: 'https://' })}
                    <div class="adm-field full adm-logo-field">
                        <span>Logo o foto principal</span>
                        <div class="adm-logo-row">
                            <img id="f_logo_prev" src="${esc(safeUrl(l.imagen) || '')}" alt="" ${l.imagen ? '' : 'hidden'}>
                            <label class="adm-btn small">📷 Subir imagen<input type="file" accept="image/*" data-change="adm-logo-file" hidden></label>
                            <input type="hidden" id="f_imagen" value="${esc(l.imagen || '')}">
                            <small class="adm-muted-cell">Se recorta en cuadrado. Usa el logo del local o una foto de la fachada.</small>
                        </div>
                    </div>
                    ${textarea('Descripción', 'f_descripcion', l.descripcion)}
                    ${field('Palabras clave para el buscador (separadas por coma)', 'f_etiquetas', (l.etiquetas || []).join(', '), { full: true, placeholder: 'peruano, ceviche, mariscos' })}
                </div>
            </section>

            <section class="adm-card">
                <h2>Más datos del local</h2>
                <p class="adm-help">En la ficha se muestran el slogan, la carta oficial, los medios de pago (en Características) y el horario de feriados.
                El resto queda como información para ti.</p>
                <div class="adm-grid">
                    ${EXTRAS.map(([key, label, ph]) => field(label, `f_x_${key}`, l[key] || '', { placeholder: ph })).join('')}
                </div>
            </section>

            <section class="adm-card">
                <h2>Ubicación</h2>
                <p class="adm-help">Para obtener las coordenadas: en Google Maps mantén presionado el local y copia los números que aparecen (ej: -35.4264, -71.6554).</p>
                <div class="adm-grid">
                    ${field('Latitud', 'f_lat', l.lat, { type: 'number', attrs: 'step="0.000001"' })}
                    ${field('Longitud', 'f_lng', l.lng, { type: 'number', attrs: 'step="0.000001"' })}
                    ${field('Pegar coordenadas de Google Maps', 'f_coords', '', { full: true, placeholder: '-35.4264, -71.6554', attrs: 'data-input="adm-paste-coords"' })}
                </div>
            </section>

            <section class="adm-card">
                <h2>Horarios</h2>
                <p class="adm-help">Formato 13:00 - 22:45. Si cierra después de medianoche, escribe por ejemplo 18:00 - 02:00. Deja "Cerrado" si no abre.</p>
                <div class="adm-grid hours">
                    ${ORDEN_DIAS.map(dia => field(dia, `f_h_${DIAS_SEMANA.indexOf(dia)}`, (l.horariosSemana || {})[dia] || 'Cerrado', { attrs: 'pattern="(\\d{1,2}:\\d{2}\\s*-\\s*\\d{1,2}:\\d{2})|Cerrado"' })).join('')}
                </div>
                <button type="button" class="adm-btn small" data-action="adm-copy-hours">Copiar el horario del lunes a todos los días</button>
            </section>

            <section class="adm-card">
                <h2>Características</h2>
                <p class="adm-help">El detalle aparece al tocar la característica en la ficha (ej: la clave del WiFi, "solo en terraza", con qué apps hacen delivery).</p>
                <div class="adm-car-list">
                    ${CARACTERISTICAS.map((c, i) => `
                    <div class="adm-car-row">
                        <label><input type="checkbox" id="f_c_${i}" ${(l.caracteristicas || []).includes(c) ? 'checked' : ''}> ${esc(c)}</label>
                        <input type="text" id="f_cd_${i}" value="${esc((l.caracteristicasDetalle || {})[c] || '')}" placeholder="Detalle (opcional)" aria-label="Detalle de ${esc(c)}">
                    </div>`).join('')}
                </div>
            </section>

            <section class="adm-card">
                <h2>Opciones dietéticas</h2>
                <p class="adm-help">Se calculan desde la carta: al subirla, la app detecta qué platos son vegetarianos, veganos, sin gluten o sin lactosa,
                y tú lo revisas en "Cartas". Estrellas: 1-2 platos = 1★, 3-5 = 2★, 6-8 = 3★, 9-11 = 4★, 12 o más = 5★.</p>
                <ul class="adm-diet-summary">
                    ${DIETAS.map(([key, label]) => `<li>${label}: <b>${(l.menu || []).filter(m => (m.dietas || []).includes(key)).length}</b> plato(s)</li>`).join('')}
                </ul>
                ${local ? `<button type="button" class="adm-btn small" data-action="adm-go-cartas" data-id="${l.id}">Revisar en Cartas →</button>` : ''}
            </section>

            ${l.encuesta?.respuestas ? `
            <section class="adm-card">
                <h2>Respuestas de la encuesta</h2>
                <p class="adm-help">${l.encuesta.archivo ? `Importadas desde ${esc(l.encuesta.archivo)}. ` : ''}Para editarlas, ve a "Encuesta a locales".</p>
                <dl class="adm-survey-answers">
                    ${Object.entries(l.encuesta.respuestas).filter(([, v]) => String(v ?? '').trim()).map(([q, v]) => `<dt>${esc(banco().find(p => p.id === q)?.texto || q)}</dt><dd>${esc(v)}</dd>`).join('')}
                </dl>
            </section>` : ''}

            <p class="adm-error" id="admLocalError" role="alert" hidden></p>
            <div class="adm-form-actions">
                ${local ? `<button type="button" class="adm-btn danger" data-action="adm-local-delete" data-id="${l.id}">Eliminar local</button>` : '<span></span>'}
                <button type="submit" class="adm-btn primary">Guardar cambios</button>
            </div>
        </form>
    `;
}

function saveForm(event) {
    event.preventDefault();
    const error = document.getElementById('admLocalError');
    const fail = msg => { error.textContent = msg; error.hidden = false; error.scrollIntoView({ block: 'center' }); };

    const nombre = val('f_nombre');
    const tipo = val('f_tipo');
    if (!nombre || !tipo) return fail('El nombre y el tipo de local son obligatorios.');
    const lat = Number(val('f_lat'));
    const lng = Number(val('f_lng'));
    if (!(lat < -17 && lat > -56 && lng < -66 && lng > -76)) return fail('Las coordenadas no parecen estar en Chile. Revisa la latitud y longitud.');

    const horarios = {};
    for (const dia of ORDEN_DIAS) {
        const valor = val(`f_h_${DIAS_SEMANA.indexOf(dia)}`) || 'Cerrado';
        if (valor !== 'Cerrado' && !/^\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}$/.test(valor)) return fail(`El horario del ${dia.toLowerCase()} no tiene el formato 13:00 - 22:45.`);
        horarios[dia] = valor;
    }
    const website = val('f_website');
    if (website && !safeUrl(website).startsWith('http')) return fail('El sitio web debe empezar con https://');

    const datos = {
        nombre, tipo,
        direccion: val('f_direccion'),
        telefono: val('f_telefono'),
        whatsapp: val('f_whatsapp').replace(/[^0-9]/g, ''),
        whatsappReservas: val('f_whatsappReservas').replace(/[^0-9]/g, ''),
        instagram: val('f_instagram').replace(/^@/, ''),
        tiktok: val('f_tiktok').replace(/^@/, ''),
        facebook: val('f_facebook').replace(/^@/, '').replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/\/.*$/, ''),
        website,
        imagen: val('f_imagen'),
        descripcion: val('f_descripcion'),
        etiquetas: val('f_etiquetas').split(',').map(s => s.trim()).filter(Boolean),
        lat, lng,
        horariosSemana: horarios,
        caracteristicas: CARACTERISTICAS.filter((_, i) => document.getElementById(`f_c_${i}`).checked),
        caracteristicasDetalle: Object.fromEntries(CARACTERISTICAS.map((c, i) => [c, val(`f_cd_${i}`)]).filter(([, v]) => v)),
        ...Object.fromEntries(EXTRAS.map(([key]) => [key, val(`f_x_${key}`)]))
    };

    if (editingId === 'nuevo') {
        const id = Math.max(0, ...db.locales.map(l => l.id)) + 1;
        db.locales.push({ id, menu: [], promociones: [], eventos: [], distinciones: [], ...datos });
    } else {
        Object.assign(getLocal(editingId), datos);
    }
    persist();
    toast('Local guardado');
    editingId = null;
    rerender();
}

registerActions({
    'adm-logo-file': async el => {
        const file = el.files[0];
        if (!file) return;
        try {
            const dataUrl = await compressImage(file, 400, 0.85);
            document.getElementById('f_imagen').value = dataUrl;
            const prev = document.getElementById('f_logo_prev');
            prev.src = dataUrl;
            prev.hidden = false;
        } catch (err) {
            toast(err.message || 'No se pudo usar esa imagen.', 'error');
        }
    },
    'adm-local-new': () => { editingId = 'nuevo'; rerender(); },
    'adm-local-edit': el => { editingId = Number(el.dataset.id); rerender(); },
    'adm-local-back': () => { editingId = null; rerender(); },
    'adm-local-filter': el => {
        filtro = el.value;
        rerender();
        const input = document.querySelector('.adm-search');
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
    },
    'adm-paste-coords': el => {
        const match = el.value.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
        if (match) {
            document.getElementById('f_lat').value = match[1];
            document.getElementById('f_lng').value = match[2];
        }
    },
    'adm-copy-hours': () => {
        const lunes = val(`f_h_${DIAS_SEMANA.indexOf('Lunes')}`);
        ORDEN_DIAS.forEach(dia => { document.getElementById(`f_h_${DIAS_SEMANA.indexOf(dia)}`).value = lunes; });
    },
    'adm-local-delete': el => {
        const local = getLocal(Number(el.dataset.id));
        confirmDialog(`¿Eliminar "${local.nombre}"? También se borrarán sus reseñas y videos.`, () => {
            eliminarLocal(local);
            editingId = null;
            toast('Local eliminado');
            rerender();
        }, 'Eliminar');
    }
});

document.addEventListener('submit', e => {
    if (e.target.id === 'admLocalForm') saveForm(e);
});
