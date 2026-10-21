// Eventos (cartelera) y promociones de todos los locales, con buscador.
// Los eventos pasados y las promociones vencidas dejan de mostrarse solos en la app.
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { DIAS_SEMANA, formatFechaEvento, promoVigente } from '../../utils/time.js';
import { field, textarea, val, toast, confirmDialog, emptyRow } from '../ui.js';
import { nuevoId } from '../../utils/id.js';

let localId = null;
let busqueda = '';
let verPasados = false;
let rerender = () => {};
export function setEventosRerender(fn) { rerender = fn; }

const coincide = (...textos) => !busqueda || textos.some(t => normalize(t || '').includes(normalize(busqueda)));

function listaEventos() {
    const ahora = Date.now();
    const todos = db.locales.flatMap(l => (l.eventos || []).map(e => ({ ...e, local: l })))
        .filter(e => coincide(e.titulo, e.descripcion, e.local.nombre))
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    // Un evento sigue "vigente" hasta 4 horas después de empezar (igual que en la app)
    const proximos = todos.filter(e => new Date(e.inicio).getTime() + 4 * 3600000 >= ahora);
    const pasados = todos.filter(e => !proximos.includes(e)).reverse();
    const fila = e => `
        <li>
            <div><b>${esc(e.titulo)}</b><small>${esc(e.local.nombre)} · ${esc(formatFechaEvento(e.inicio))}${e.descripcion ? ` · ${esc(e.descripcion)}` : ''}</small></div>
            <button class="adm-btn small danger" data-action="adm-ev-delete" data-local="${e.local.id}" data-id="${esc(e.id)}">Eliminar</button>
        </li>`;
    return `
        ${proximos.length ? `<ul class="adm-list">${proximos.map(fila).join('')}</ul>` : emptyRow(busqueda ? 'Ningún evento coincide con la búsqueda.' : 'No hay eventos próximos.')}
        ${pasados.length ? `<button class="adm-link" data-action="adm-ev-pasados">${verPasados ? 'Ocultar' : 'Ver'} ${pasados.length} evento(s) pasado(s)</button>
            ${verPasados ? `<ul class="adm-list is-past">${pasados.map(fila).join('')}</ul>` : ''}` : ''}`;
}

function listaPromos() {
    const todas = db.locales.flatMap(l => (l.promociones || []).map((p, i) => ({ ...p, i, local: l })))
        .filter(p => coincide(p.descripcion, p.metodo, p.local.nombre));
    const estado = p => promoVigente(p) ? '<span class="adm-pill ok">Vigente</span>'
        : (p.hasta && p.hasta < new Date().toISOString().slice(0, 10)) ? '<span class="adm-pill muted">Vencida</span>' : '<span class="adm-pill info">Programada</span>';
    return todas.length ? `<ul class="adm-list">${todas.map(p => `
        <li>
            <div><b>${esc(p.icono || '🏷️')} ${esc(p.descripcion)}</b> ${estado(p)}
                <small>${esc(p.local.nombre)} · ${(p.dias || []).map(d => DIAS_SEMANA[d].slice(0, 3)).join(', ')} · ${esc(p.horaInicio || '')}–${esc(p.horaFin || '')}${p.metodo ? ` · ${esc(p.metodo)}` : ''}${p.desde || p.hasta ? ` · ${p.desde ? `desde ${esc(p.desde)}` : ''} ${p.hasta ? `hasta ${esc(p.hasta)}` : ''}` : ' · sin fecha de término'}</small></div>
            <button class="adm-btn small danger" data-action="adm-promo-delete" data-local="${p.local.id}" data-index="${p.i}">Eliminar</button>
        </li>`).join('')}</ul>` : emptyRow(busqueda ? 'Ninguna promoción coincide con la búsqueda.' : 'Sin promociones.');
}

export function renderEventos() {
    if (localId === null && db.locales.length) localId = db.locales[0].id;
    if (!db.locales.length) return emptyRow('Primero crea un local.');
    const opciones = db.locales.map(l => `<option value="${l.id}" ${l.id === localId ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('');

    return `
        <div class="adm-head">
            <h1 class="adm-title">Eventos y promociones</h1>
        </div>
        <input class="adm-search" type="search" id="evBuscar" placeholder="Buscar por local, evento o promoción…" value="${esc(busqueda)}" data-input="adm-ev-buscar" aria-label="Buscar eventos y promociones">

        <section class="adm-card">
            <h2>Cartelera de todos los locales</h2>
            <div id="evLista">${listaEventos()}</div>
        </section>

        <section class="adm-card">
            <h2>Promociones de todos los locales</h2>
            <p class="adm-help">Con fecha de término, la promoción desaparece sola de la app al día siguiente. Sin fecha, se muestra hasta que la elimines.</p>
            <div id="promoLista">${listaPromos()}</div>
        </section>

        <div class="adm-two">
            <section class="adm-card">
                <h2>Agregar evento</h2>
                <form id="admEventForm" class="adm-grid adm-inline-form" novalidate>
                    <label class="adm-field full" for="ev_local"><span>Local</span><select id="ev_local" class="adm-select">${opciones}</select></label>
                    ${field('Título del evento', 'ev_titulo', '', { placeholder: 'Ej: Noche de jazz', full: true })}
                    ${field('Fecha y hora', 'ev_inicio', '', { type: 'datetime-local', full: true })}
                    ${textarea('Descripción', 'ev_desc', '', { rows: 2 })}
                    <div class="adm-form-actions full"><span></span><button class="adm-btn primary" type="submit">Agregar evento</button></div>
                </form>
            </section>
            <section class="adm-card">
                <h2>Agregar promoción</h2>
                <form id="admPromoForm" class="adm-grid adm-inline-form" novalidate>
                    <label class="adm-field full" for="pr_local"><span>Local</span><select id="pr_local" class="adm-select">${opciones}</select></label>
                    ${field('Descripción', 'pr_desc', '', { placeholder: 'Ej: 2x1 en schop', full: true })}
                    ${field('Ícono (emoji)', 'pr_icono', '🏷️', { attrs: 'maxlength="4"' })}
                    ${field('Medio de pago', 'pr_metodo', '', { placeholder: 'Ej: Débito Banco Estado' })}
                    ${field('Desde (hora)', 'pr_ini', '18:00', { type: 'time' })}
                    ${field('Hasta (hora)', 'pr_fin', '21:00', { type: 'time' })}
                    ${field('Vigente desde (fecha)', 'pr_desde', '', { type: 'date' })}
                    ${field('Vigente hasta (fecha)', 'pr_hasta', '', { type: 'date' })}
                    <fieldset class="adm-days full"><legend>Días</legend>
                        ${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" id="pr_d_${d}"> ${DIAS_SEMANA[d].slice(0, 3)}</label>`).join('')}
                    </fieldset>
                    <div class="adm-form-actions full"><span></span><button class="adm-btn primary" type="submit">Agregar promoción</button></div>
                </form>
            </section>
        </div>
    `;
}

registerActions({
    'adm-ev-buscar': el => {
        busqueda = el.value;
        document.getElementById('evLista').innerHTML = listaEventos();
        document.getElementById('promoLista').innerHTML = listaPromos();
    },
    'adm-ev-pasados': () => { verPasados = !verPasados; document.getElementById('evLista').innerHTML = listaEventos(); },
    'adm-ev-delete': el => {
        const local = getLocal(Number(el.dataset.local));
        confirmDialog('¿Eliminar este evento?', () => {
            local.eventos = local.eventos.filter(e => String(e.id) !== el.dataset.id);
            persist();
            rerender();
        }, 'Eliminar');
    },
    'adm-promo-delete': el => {
        const local = getLocal(Number(el.dataset.local));
        confirmDialog('¿Eliminar esta promoción?', () => {
            local.promociones.splice(Number(el.dataset.index), 1);
            persist();
            rerender();
        }, 'Eliminar');
    }
});

document.addEventListener('submit', e => {
    if (e.target.id === 'admEventForm') {
        e.preventDefault();
        const titulo = val('ev_titulo');
        const inicio = val('ev_inicio');
        if (!titulo || !inicio) return toast('Escribe el título y la fecha del evento.', 'error');
        localId = Number(val('ev_local'));
        const local = getLocal(localId);
        local.eventos = [...(local.eventos || []), { id: nuevoId(), titulo, inicio: new Date(inicio).toISOString(), descripcion: val('ev_desc') }];
        persist();
        toast(`Evento agregado a ${local.nombre}`);
        rerender();
    }
    if (e.target.id === 'admPromoForm') {
        e.preventDefault();
        const descripcion = val('pr_desc');
        const dias = [0, 1, 2, 3, 4, 5, 6].filter(d => document.getElementById(`pr_d_${d}`).checked);
        if (!descripcion) return toast('Escribe la descripción de la promoción.', 'error');
        if (!dias.length) return toast('Elige al menos un día.', 'error');
        const desde = val('pr_desde');
        const hasta = val('pr_hasta');
        if (desde && hasta && hasta < desde) return toast('La fecha "hasta" debe ser después de "desde".', 'error');
        localId = Number(val('pr_local'));
        const local = getLocal(localId);
        local.promociones = [...(local.promociones || []), {
            descripcion, icono: val('pr_icono') || '🏷️', metodo: val('pr_metodo'), dias, horaInicio: val('pr_ini'), horaFin: val('pr_fin'), desde, hasta
        }];
        persist();
        toast(`Promoción agregada a ${local.nombre}`);
        rerender();
    }
});
