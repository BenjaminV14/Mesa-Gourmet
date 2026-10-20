// Locales: crear, editar y eliminar la ficha de cada local
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc, safeUrl } from '../../utils/html.js';
import { DIAS_SEMANA, estadoHorario } from '../../utils/time.js';
import { isSponsored } from '../../features/sponsors.js';
import { field, textarea, val, toast, confirmDialog, statusPill } from '../ui.js';

export const CARACTERISTICAS = [
    'Baño / WC', 'WiFi Disponible', 'Terraza', 'Mascotas (Solo en Terraza)', 'Ingreso de Mascotas', 'Seguridad Completa',
    'Calefacción', 'Aire Acondicionado / Ventilación', 'Acceso Discapacitados', 'Estacionamiento', 'Bicicletero',
    'Venta de Alcohol', 'Apto para Fumadores (Solo en Terraza)', 'Acepta Edenred / BAES', 'Delivery'
];

const DIETAS = [['vegano', '🌱 Vegano'], ['vegetariano', '🥬 Vegetariano'], ['sinGluten', '🌾 Sin gluten'], ['sinLactosa', '🥛 Sin lactosa']];
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
                <thead><tr><th>Local</th><th>Tipo</th><th>Estado ahora</th><th>Nota</th><th>Platos</th><th></th></tr></thead>
                <tbody>
                    ${lista.map(l => `
                        <tr>
                            <td><div class="adm-local-cell"><img src="${esc(safeUrl(l.imagen))}" alt=""><b>${esc(l.nombre)}</b> ${isSponsored(l) ? statusPill('★ Destacado', 'gold') : ''}</div></td>
                            <td>${esc(l.tipo)}</td>
                            <td>${esc(estadoHorario(l).etiqueta)}</td>
                            <td>${(l.notaMG || 0).toFixed(1)}</td>
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
                    ${field('Instagram (usuario)', 'f_instagram', l.instagram)}
                    ${field('TikTok (usuario)', 'f_tiktok', l.tiktok)}
                    ${field('Sitio web', 'f_website', l.website, { type: 'url', placeholder: 'https://' })}
                    ${field('Foto principal (URL)', 'f_imagen', l.imagen, { type: 'url', placeholder: 'https://' })}
                    ${textarea('Descripción', 'f_descripcion', l.descripcion)}
                    ${field('Palabras clave para el buscador (separadas por coma)', 'f_etiquetas', (l.etiquetas || []).join(', '), { full: true, placeholder: 'peruano, ceviche, mariscos' })}
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
                <div class="adm-checks">
                    ${CARACTERISTICAS.map((c, i) => `<label><input type="checkbox" id="f_c_${i}" ${(l.caracteristicas || []).includes(c) ? 'checked' : ''}> ${esc(c)}</label>`).join('')}
                </div>
            </section>

            <section class="adm-card">
                <h2>Opciones dietéticas (0 = no tiene, 5 = excelente)</h2>
                <div class="adm-grid">
                    ${DIETAS.map(([key, label]) => field(label, `f_d_${key}`, l[key] || 0, { type: 'number', attrs: 'min="0" max="5" step="1"' })).join('')}
                </div>
            </section>

            ${l.encuesta ? `
            <section class="adm-card">
                <h2>Respuestas de la encuesta</h2>
                <p class="adm-help">Importadas el ${esc(new Date(l.encuesta.fecha).toLocaleDateString('es-CL'))} desde ${esc(l.encuesta.archivo)}.</p>
                <dl class="adm-survey-answers">
                    ${Object.entries(l.encuesta.respuestas).filter(([, v]) => String(v ?? '').trim()).map(([q, v]) => `<dt>${esc(q)}</dt><dd>${esc(v)}</dd>`).join('')}
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
        instagram: val('f_instagram').replace(/^@/, ''),
        tiktok: val('f_tiktok').replace(/^@/, ''),
        website,
        imagen: val('f_imagen'),
        descripcion: val('f_descripcion'),
        etiquetas: val('f_etiquetas').split(',').map(s => s.trim()).filter(Boolean),
        lat, lng,
        horariosSemana: horarios,
        caracteristicas: CARACTERISTICAS.filter((_, i) => document.getElementById(`f_c_${i}`).checked),
        ...Object.fromEntries(DIETAS.map(([key]) => [key, Math.max(0, Math.min(5, Number(val(`f_d_${key}`)) || 0))]))
    };

    if (editingId === 'nuevo') {
        const id = Math.max(0, ...db.locales.map(l => l.id)) + 1;
        db.locales.push({ id, notaComida: 0, notaServicio: 0, notaMG: 0, menu: [], promociones: [], eventos: [], distinciones: [], ...datos });
    } else {
        Object.assign(getLocal(editingId), datos);
    }
    persist();
    toast('Local guardado');
    editingId = null;
    rerender();
}

registerActions({
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
            db.locales = db.locales.filter(l => l.id !== local.id);
            db.reviews = db.reviews.filter(r => r.localId !== local.id);
            db.videos = db.videos.filter(v => v.localId !== local.id);
            persist();
            editingId = null;
            toast('Local eliminado');
            rerender();
        }, 'Eliminar');
    }
});

document.addEventListener('submit', e => {
    if (e.target.id === 'admLocalForm') saveForm(e);
});
