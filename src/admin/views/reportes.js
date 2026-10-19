// Reportes de los usuarios sobre información incorrecta de los locales
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { timeAgo } from '../../utils/time.js';
import { toast, emptyRow, statusPill } from '../ui.js';

const TIPOS = {
    menu: 'Platos o precios desactualizados',
    horario: 'Horario incorrecto',
    cerrado: 'El local cerró',
    datos: 'Dirección o teléfono incorrectos',
    otro: 'Otro'
};

let verResueltos = false;
let rerender = () => {};
let goTo = () => {};
export function setReportesHandlers(render, navigate) { rerender = render; goTo = navigate; }

export function renderReportes() {
    const lista = db.reports.filter(r => r.tipo !== 'resena' && (verResueltos || r.estado === 'abierto'));
    return `
        <div class="adm-head">
            <h1 class="adm-title">Reportes de usuarios</h1>
            <label class="adm-toggle"><input type="checkbox" data-change="adm-rep-toggle" ${verResueltos ? 'checked' : ''}> Ver resueltos</label>
        </div>
        <p class="adm-help">Los usuarios avisan cuando un precio, horario o dato del local está mal. Corrígelo en la ficha o en la carta y marca el reporte como resuelto.</p>
        <section class="adm-card">
            ${lista.length ? `<ul class="adm-list">${lista.map(r => `
                <li>
                    <div>
                        <b>${esc(TIPOS[r.tipo] || r.tipo)}</b> · ${esc(getLocal(r.localId)?.nombre || 'Local eliminado')}
                        ${r.estado === 'resuelto' ? statusPill('Resuelto', 'ok') : statusPill('Abierto', 'warn')}
                        <small>${esc(r.usuario?.nombre || 'Usuario')} · ${esc(timeAgo(r.fecha))}</small>
                        ${r.detalle ? `<p class="adm-quote">"${esc(r.detalle)}"</p>` : ''}
                    </div>
                    <div class="adm-row-actions">
                        <button class="adm-btn small" data-action="adm-rep-fix" data-local="${r.localId}" data-tipo="${esc(r.tipo)}">Corregir</button>
                        ${r.estado === 'abierto' ? `<button class="adm-btn small primary" data-action="adm-rep-done" data-id="${esc(r.id)}">Marcar resuelto</button>` : ''}
                    </div>
                </li>`).join('')}</ul>` : emptyRow('No hay reportes abiertos.')}
        </section>
    `;
}

registerActions({
    'adm-rep-toggle': el => { verResueltos = el.checked; rerender(); },
    'adm-rep-done': el => {
        db.reports.find(r => r.id === el.dataset.id).estado = 'resuelto';
        persist();
        toast('Reporte resuelto');
        rerender();
    },
    'adm-rep-fix': el => goTo(el.dataset.tipo === 'menu' ? 'cartas' : 'locales', Number(el.dataset.local))
});
