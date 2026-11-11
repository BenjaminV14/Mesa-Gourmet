// Eventos (cartelera), promociones y descuentos con tarjetas de todos los locales, con buscador.
// Los eventos pasados y las promociones vencidas dejan de mostrarse solos en la app.
// Los descuentos con tarjeta se guardan como promociones con tipo 'tarjeta' (todo el día, sin horario).
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { DIAS_SEMANA, formatFechaEvento, promoVigente, horarioPromo, esDescuentoTarjeta } from '../../utils/time.js';
import { field, textarea, val, toast, confirmDialog, emptyRow } from '../ui.js';
import { nuevoId } from '../../utils/id.js';
import { buscadorLocal } from '../buscador-local.js';

let localId = null;
let busqueda = '';
let verPasados = false;
let filtroLocal = null; // local elegido arriba: se ve solo lo que tiene activo
let rerender = () => {};
export function setEventosRerender(fn) { rerender = fn; }

const coincide = (...textos) => !busqueda || textos.some(t => normalize(t || '').includes(normalize(busqueda)));
const delFiltro = l => !filtroLocal || l.id === filtroLocal;
const hoyIso = () => new Date().toISOString().slice(0, 10);
const promoVencida = p => !!p.hasta && p.hasta < hoyIso();
const eventoProximo = e => new Date(e.inicio).getTime() + 4 * 3600000 >= Date.now();

/** Lo que tiene activo el local elegido arriba */
function resumenLocal() {
    const local = filtroLocal ? getLocal(filtroLocal) : null;
    if (!local) return '<p class="adm-help">Elige un local para ver solo sus eventos próximos, promociones y descuentos con tarjetas que siguen activos.</p>';
    const eventos = (local.eventos || []).filter(eventoProximo).length;
    const promos = (local.promociones || []).filter(p => !esDescuentoTarjeta(p) && !promoVencida(p)).length;
    const tarjetas = (local.promociones || []).filter(p => esDescuentoTarjeta(p) && !promoVencida(p)).length;
    const n = (x, uno, varios) => `${x} ${x === 1 ? uno : varios}`;
    return `<div class="adm-ev-resumen">
        <p><b>${esc(local.nombre)}</b> tiene ${n(eventos, 'evento próximo', 'eventos próximos')} · ${n(promos, 'promoción activa', 'promociones activas')} · ${n(tarjetas, 'descuento con tarjeta', 'descuentos con tarjetas')}.</p>
        <button class="adm-btn small ghost" data-action="adm-ev-ver-todos">Ver todos los locales</button>
    </div>`;
}

function refrescarListas() {
    document.getElementById('evResumen').innerHTML = resumenLocal();
    document.getElementById('evLista').innerHTML = listaEventos();
    document.getElementById('promoLista').innerHTML = listaPromos();
    document.getElementById('tarjetaLista').innerHTML = listaPromos(true);
}

/** Deja el mismo local elegido en los tres formularios de abajo */
function preseleccionar(local) {
    localId = local.id;
    ['ev_local', 'pr_local', 'tj_local'].forEach(id => {
        const oculto = document.getElementById(id);
        if (oculto) { oculto.value = local.id; document.getElementById(`${id}_q`).value = local.nombre; }
    });
}

function listaEventos() {
    const ahora = Date.now();
    const todos = db.locales.filter(delFiltro).flatMap(l => (l.eventos || []).map(e => ({ ...e, local: l })))
        .filter(e => coincide(e.titulo, e.descripcion, e.local.nombre))
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    // Un evento sigue "vigente" hasta 4 horas después de empezar (igual que en la app)
    const proximos = todos.filter(e => new Date(e.inicio).getTime() + 4 * 3600000 >= ahora);
    if (filtroLocal) verPasados = false;
    const pasados = todos.filter(e => !proximos.includes(e)).reverse();
    const fila = e => `
        <li>
            <div><b>${esc(e.titulo)}</b><small>${esc(e.local.nombre)} · ${esc(formatFechaEvento(e.inicio))}${e.descripcion ? ` · ${esc(e.descripcion)}` : ''}</small></div>
            <button class="adm-btn small danger" data-action="adm-ev-delete" data-local="${e.local.id}" data-id="${esc(e.id)}">Eliminar</button>
        </li>`;
    return `
        ${proximos.length ? `<ul class="adm-list">${proximos.map(fila).join('')}</ul>` : emptyRow(busqueda ? 'Ningún evento coincide con la búsqueda.' : 'No hay eventos próximos.')}
        ${pasados.length && !filtroLocal ? `<button class="adm-link" data-action="adm-ev-pasados">${verPasados ? 'Ocultar' : 'Ver'} ${pasados.length} evento(s) pasado(s)</button>
            ${verPasados ? `<ul class="adm-list is-past">${pasados.map(fila).join('')}</ul>` : ''}` : ''}`;
}

function listaPromos(tarjetas = false) {
    // i = posición en local.promociones (para eliminar), antes de separar promociones y descuentos
    const todas = db.locales.filter(delFiltro).flatMap(l => (l.promociones || []).map((p, i) => ({ ...p, i, local: l })))
        .filter(p => esDescuentoTarjeta(p) === tarjetas)
        // Con un local elegido arriba se ven solo las activas (vigentes o programadas)
        .filter(p => !filtroLocal || !promoVencida(p))
        .filter(p => coincide(p.descripcion, p.metodo, p.local.nombre));
    const estado = p => promoVigente(p) ? '<span class="adm-pill ok">Vigente</span>'
        : promoVencida(p) ? '<span class="adm-pill muted">Vencida</span>' : '<span class="adm-pill info">Programada</span>';
    return todas.length ? `<ul class="adm-list">${todas.map(p => `
        <li>
            <div><b>${esc(p.icono || '🏷️')} ${esc(p.descripcion)}</b> ${estado(p)}
                <small>${esc(p.local.nombre)} · ${(p.dias || []).map(d => DIAS_SEMANA[d].slice(0, 3)).join(', ')} · ${esc(horarioPromo(p))}${p.metodo ? ` · ${esc(p.metodo)}` : ''}${p.desde || p.hasta ? ` · ${p.desde ? `desde ${esc(p.desde)}` : ''} ${p.hasta ? `hasta ${esc(p.hasta)}` : ''}` : ' · sin fecha de término'}</small></div>
            <button class="adm-btn small danger" data-action="adm-promo-delete" data-local="${p.local.id}" data-index="${p.i}">Eliminar</button>
        </li>`).join('')}</ul>` : emptyRow(busqueda ? 'Nada coincide con la búsqueda.' : tarjetas ? 'Sin descuentos con tarjetas.' : 'Sin promociones.');
}

const selectorLocal = id => buscadorLocal(id, { valor: localId });

const diasHtml = pref => `<fieldset class="adm-days full"><legend>Días</legend>
    ${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" id="${pref}_d_${d}"> ${DIAS_SEMANA[d].slice(0, 3)}</label>`).join('')}
    <button type="button" class="adm-link" data-action="adm-ev-todos-dias" data-pref="${pref}">Todos</button>
</fieldset>`;
const diasMarcados = pref => [0, 1, 2, 3, 4, 5, 6].filter(d => document.getElementById(`${pref}_d_${d}`).checked);

export function renderEventos() {
    if (!db.locales.length) return emptyRow('Primero crea un local.');
    return `
        <div class="adm-head">
            <h1 class="adm-title">Eventos y promociones</h1>
        </div>
        <section class="adm-card">
            <h2>Ver un local</h2>
            ${buscadorLocal('ver_local', { etiqueta: '', valor: filtroLocal, placeholder: 'Busca un local para ver lo que tiene activo…', onElegir: local => { filtroLocal = local.id; preseleccionar(local); refrescarListas(); } })}
            <div id="evResumen">${resumenLocal()}</div>
        </section>
        <input class="adm-search" type="search" id="evBuscar" placeholder="Buscar por evento, promoción, banco o local…" value="${esc(busqueda)}" data-input="adm-ev-buscar" aria-label="Buscar eventos y promociones">

        <section class="adm-card">
            <h2>Cartelera</h2>
            <div id="evLista">${listaEventos()}</div>
        </section>

        <section class="adm-card">
            <h2>Promociones</h2>
            <p class="adm-help">Con fecha de término, la promoción desaparece sola de la app al día siguiente. Sin fecha, se muestra hasta que la elimines.</p>
            <div id="promoLista">${listaPromos()}</div>
        </section>

        <section class="adm-card">
            <h2>Descuentos con tarjetas</h2>
            <p class="adm-help">Descuentos por pagar con un banco o tarjeta (ej: 20% con Banco Estado los martes). Se muestran en la ficha del local, en su propia sección.</p>
            <div id="tarjetaLista">${listaPromos(true)}</div>
        </section>

        <div class="adm-two">
            <section class="adm-card">
                <h2>Agregar evento</h2>
                <form id="admEventForm" class="adm-grid adm-inline-form" novalidate>
                    ${selectorLocal('ev_local')}
                    ${field('Título del evento', 'ev_titulo', '', { placeholder: 'Ej: Noche de jazz', full: true })}
                    ${field('Fecha y hora', 'ev_inicio', '', { type: 'datetime-local', full: true })}
                    ${textarea('Descripción', 'ev_desc', '', { rows: 2 })}
                    <div class="adm-form-actions full"><span></span><button class="adm-btn primary" type="submit">Agregar evento</button></div>
                </form>
            </section>
            <section class="adm-card">
                <h2>Agregar promoción</h2>
                <form id="admPromoForm" class="adm-grid adm-inline-form" novalidate>
                    ${selectorLocal('pr_local')}
                    ${field('Descripción', 'pr_desc', '', { placeholder: 'Ej: 2x1 en schop', full: true })}
                    ${field('Ícono (emoji)', 'pr_icono', '🏷️', { attrs: 'maxlength="4"' })}
                    ${field('Medio de pago', 'pr_metodo', '', { placeholder: 'Ej: Débito Banco Estado' })}
                    ${field('Desde (hora)', 'pr_ini', '18:00', { type: 'time' })}
                    ${field('Hasta (hora)', 'pr_fin', '21:00', { type: 'time' })}
                    ${field('Vigente desde (fecha)', 'pr_desde', '', { type: 'date' })}
                    ${field('Vigente hasta (fecha)', 'pr_hasta', '', { type: 'date' })}
                    ${diasHtml('pr')}
                    <div class="adm-form-actions full"><span></span><button class="adm-btn primary" type="submit">Agregar promoción</button></div>
                </form>
            </section>
            <section class="adm-card">
                <h2>Agregar descuento con tarjeta</h2>
                <form id="admTarjetaForm" class="adm-grid adm-inline-form" novalidate>
                    ${selectorLocal('tj_local')}
                    ${field('Banco o tarjeta', 'tj_banco', '', { placeholder: 'Ej: Banco Estado, Tarjeta Cencosud' })}
                    ${field('Descuento', 'tj_desc', '', { placeholder: 'Ej: 20%' })}
                    ${field('Condiciones (opcional)', 'tj_cond', '', { placeholder: 'Ej: tope $10.000, solo crédito', full: true })}
                    ${field('Vigente desde (fecha)', 'tj_desde', '', { type: 'date' })}
                    ${field('Vigente hasta (fecha)', 'tj_hasta', '', { type: 'date' })}
                    ${diasHtml('tj')}
                    <div class="adm-form-actions full"><span></span><button class="adm-btn primary" type="submit">Agregar descuento</button></div>
                </form>
            </section>
        </div>
    `;
}

registerActions({
    'adm-ev-buscar': el => {
        busqueda = el.value;
        refrescarListas();
    },
    'adm-ev-ver-todos': () => {
        filtroLocal = null;
        const q = document.getElementById('ver_local_q');
        if (q) { q.value = ''; document.getElementById('ver_local').value = ''; }
        refrescarListas();
    },
    'adm-ev-todos-dias': el => {
        const cajas = [0, 1, 2, 3, 4, 5, 6].map(d => document.getElementById(`${el.dataset.pref}_d_${d}`));
        const marcar = cajas.some(c => !c.checked);
        cajas.forEach(c => { c.checked = marcar; });
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
        const local = getLocal(Number(val('ev_local')));
        if (!local) return toast('Elige el local en la lista que aparece al escribir su nombre.', 'error');
        localId = local.id;
        local.eventos = [...(local.eventos || []), { id: nuevoId(), titulo, inicio: new Date(inicio).toISOString(), descripcion: val('ev_desc') }];
        persist();
        toast(`Evento agregado a ${local.nombre}`);
        rerender();
    }
    if (e.target.id === 'admPromoForm') {
        e.preventDefault();
        const descripcion = val('pr_desc');
        const dias = diasMarcados('pr');
        if (!descripcion) return toast('Escribe la descripción de la promoción.', 'error');
        if (!dias.length) return toast('Elige al menos un día.', 'error');
        const desde = val('pr_desde');
        const hasta = val('pr_hasta');
        if (desde && hasta && hasta < desde) return toast('La fecha "hasta" debe ser después de "desde".', 'error');
        const local = getLocal(Number(val('pr_local')));
        if (!local) return toast('Elige el local en la lista que aparece al escribir su nombre.', 'error');
        localId = local.id;
        local.promociones = [...(local.promociones || []), {
            descripcion, icono: val('pr_icono') || '🏷️', metodo: val('pr_metodo'), dias, horaInicio: val('pr_ini'), horaFin: val('pr_fin'), desde, hasta
        }];
        persist();
        toast(`Promoción agregada a ${local.nombre}`);
        rerender();
    }
    if (e.target.id === 'admTarjetaForm') {
        e.preventDefault();
        const banco = val('tj_banco');
        let descuento = val('tj_desc');
        const dias = diasMarcados('tj');
        if (!banco || !descuento) return toast('Escribe el banco o tarjeta y el descuento.', 'error');
        if (!dias.length) return toast('Elige al menos un día.', 'error');
        if (/^\d+$/.test(descuento)) descuento += '%';
        const desde = val('tj_desde');
        const hasta = val('tj_hasta');
        if (desde && hasta && hasta < desde) return toast('La fecha "hasta" debe ser después de "desde".', 'error');
        const local = getLocal(Number(val('tj_local')));
        if (!local) return toast('Elige el local en la lista que aparece al escribir su nombre.', 'error');
        localId = local.id;
        const cond = val('tj_cond');
        local.promociones = [...(local.promociones || []), {
            tipo: 'tarjeta', icono: '💳', metodo: banco, dias, horaInicio: '', horaFin: '', desde, hasta,
            descripcion: `${descuento}${/%$/.test(descuento) ? ' de descuento' : ''} con ${banco}${cond ? ` (${cond})` : ''}`
        }];
        persist();
        toast(`Descuento agregado a ${local.nombre}`);
        rerender();
    }
});
