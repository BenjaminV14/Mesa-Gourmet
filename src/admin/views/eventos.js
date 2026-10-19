// Eventos (cartelera) y promociones de cada local
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { DIAS_SEMANA, formatFechaEvento } from '../../utils/time.js';
import { field, textarea, val, toast, confirmDialog, emptyRow } from '../ui.js';

let localId = null;
let rerender = () => {};
export function setEventosRerender(fn) { rerender = fn; }

export function renderEventos() {
    if (localId === null && db.locales.length) localId = db.locales[0].id;
    const local = getLocal(localId);
    if (!local) return emptyRow('Primero crea un local.');
    const ahora = Date.now();
    const eventos = [...(local.eventos || [])].sort((a, b) => new Date(a.inicio) - new Date(b.inicio));

    return `
        <div class="adm-head">
            <h1 class="adm-title">Eventos y promociones</h1>
            <select class="adm-select" data-change="adm-ev-local" aria-label="Elegir local">
                ${db.locales.map(l => `<option value="${l.id}" ${l.id === localId ? 'selected' : ''}>${esc(l.nombre)}</option>`).join('')}
            </select>
        </div>

        <section class="adm-card">
            <h2>Cartelera de ${esc(local.nombre)}</h2>
            ${eventos.length ? `<ul class="adm-list">${eventos.map(e => `
                <li class="${new Date(e.inicio).getTime() < ahora ? 'is-past' : ''}">
                    <div><b>${esc(e.titulo)}</b><small>${esc(formatFechaEvento(e.inicio))}${e.descripcion ? ` · ${esc(e.descripcion)}` : ''}</small></div>
                    <button class="adm-btn small danger" data-action="adm-ev-delete" data-id="${esc(e.id)}">Eliminar</button>
                </li>`).join('')}</ul>` : emptyRow('Sin eventos.')}
            <form id="admEventForm" class="adm-grid adm-inline-form" novalidate>
                ${field('Título del evento', 'ev_titulo', '', { placeholder: 'Ej: Noche de jazz' })}
                ${field('Fecha y hora', 'ev_inicio', '', { type: 'datetime-local' })}
                ${textarea('Descripción', 'ev_desc', '', { rows: 2 })}
                <div class="adm-form-actions full"><span></span><button class="adm-btn primary" type="submit">Agregar evento</button></div>
            </form>
        </section>

        <section class="adm-card">
            <h2>Promociones de ${esc(local.nombre)}</h2>
            ${(local.promociones || []).length ? `<ul class="adm-list">${local.promociones.map((p, i) => `
                <li>
                    <div><b>${esc(p.icono || '🏷️')} ${esc(p.descripcion)}</b><small>${(p.dias || []).map(d => DIAS_SEMANA[d]).join(', ')} · ${esc(p.horaInicio)}–${esc(p.horaFin)}${p.metodo ? ` · ${esc(p.metodo)}` : ''}</small></div>
                    <button class="adm-btn small danger" data-action="adm-promo-delete" data-index="${i}">Eliminar</button>
                </li>`).join('')}</ul>` : emptyRow('Sin promociones.')}
            <form id="admPromoForm" class="adm-grid adm-inline-form" novalidate>
                ${field('Descripción', 'pr_desc', '', { placeholder: 'Ej: 2x1 en schop', full: true })}
                ${field('Ícono (emoji)', 'pr_icono', '🏷️', { attrs: 'maxlength="4"' })}
                ${field('Medio de pago', 'pr_metodo', '', { placeholder: 'Ej: Débito Banco Estado' })}
                ${field('Desde (hora)', 'pr_ini', '18:00', { type: 'time' })}
                ${field('Hasta (hora)', 'pr_fin', '21:00', { type: 'time' })}
                <fieldset class="adm-days full"><legend>Días</legend>
                    ${[1, 2, 3, 4, 5, 6, 0].map(d => `<label><input type="checkbox" id="pr_d_${d}"> ${DIAS_SEMANA[d].slice(0, 3)}</label>`).join('')}
                </fieldset>
                <div class="adm-form-actions full"><span></span><button class="adm-btn primary" type="submit">Agregar promoción</button></div>
            </form>
        </section>
    `;
}

registerActions({
    'adm-ev-local': el => { localId = Number(el.value); rerender(); },
    'adm-ev-delete': el => {
        const local = getLocal(localId);
        confirmDialog('¿Eliminar este evento?', () => {
            local.eventos = local.eventos.filter(e => e.id !== el.dataset.id);
            persist();
            rerender();
        }, 'Eliminar');
    },
    'adm-promo-delete': el => {
        const local = getLocal(localId);
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
        const local = getLocal(localId);
        local.eventos = [...(local.eventos || []), { id: `ev-${Date.now()}`, titulo, inicio: new Date(inicio).toISOString(), descripcion: val('ev_desc') }];
        persist();
        toast('Evento agregado');
        rerender();
    }
    if (e.target.id === 'admPromoForm') {
        e.preventDefault();
        const descripcion = val('pr_desc');
        const dias = [0, 1, 2, 3, 4, 5, 6].filter(d => document.getElementById(`pr_d_${d}`).checked);
        if (!descripcion) return toast('Escribe la descripción de la promoción.', 'error');
        if (!dias.length) return toast('Elige al menos un día.', 'error');
        const local = getLocal(localId);
        local.promociones = [...(local.promociones || []), {
            descripcion, icono: val('pr_icono') || '🏷️', metodo: val('pr_metodo'), dias, horaInicio: val('pr_ini'), horaFin: val('pr_fin')
        }];
        persist();
        toast('Promoción agregada');
        rerender();
    }
});
