// Top y clientes: ranking del mes, cierre mensual de distinciones y "cliente del mes" de cada local
import { db, persist } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { rankingGeneral, topClientes, vipsDeLocal, cerrarMes, MESES } from '../../data/metrics.js';
import { toast, confirmDialog, emptyRow, statusPill } from '../ui.js';

let rerender = () => {};
let mesOffset = 0;   // 0 = mes actual, -1 = mes anterior...

export function setMetricasRerender(fn) { rerender = fn; }

function fechaMes() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + mesOffset, 15);
}

export function renderMetricas() {
    const fecha = fechaMes();
    const mes = `${MESES[fecha.getMonth()]} ${fecha.getFullYear()}`;
    const top = rankingGeneral().slice(0, 10);
    const clientes = db.locales.map(local => ({ local, lista: topClientes(local.id, fecha), vips: vipsDeLocal(local.id, fecha) }))
        .filter(x => x.lista.length || x.vips.length);
    const cierres = [...(db.cierres || [])].reverse();

    return `
        <h1 class="adm-title">Top y clientes</h1>

        <section class="adm-card">
            <h2>Top 10 de Talca ahora</h2>
            <p class="adm-help">Según la nota de los últimos 30 días. El Top 50 completo y las 10 categorías están en la app.</p>
            ${top.length ? `<ol class="adm-rank">${top.map(r => `<li><b>${esc(r.local.nombre)}</b><span>${r.nota.total.toFixed(1)} · ${r.nota.n} reseña(s)</span></li>`).join('')}</ol>` : emptyRow('Aún no hay reseñas en los últimos 30 días.')}
        </section>

        <section class="adm-card">
            <h2>Cerrar el mes</h2>
            <p class="adm-help">🕛 <b>El mes se cierra solo el último día a las 23:59</b>: se guardan las distinciones ("Top 12 · octubre 2026" y Top 10 por categoría)
            en el historial de cada local y la lista de clientes de cada local, con sus VIP para el mes siguiente.
            Si por algún motivo no se cerró, se cierra al abrir este panel. El botón es solo para cerrarlo a mano antes de tiempo (si lo repites, se reemplaza).</p>
            <button class="adm-btn" data-action="adm-close-month">Cerrar ${esc(MESES[new Date().getMonth()])} ${new Date().getFullYear()} ahora</button>
            ${cierres.length ? `
                <div class="adm-table-wrap"><table class="adm-table">
                    <thead><tr><th>Mes</th><th>Distinciones</th><th>Cerrado el</th></tr></thead>
                    <tbody>${cierres.map(c => `<tr><td>${esc(c.mes)}</td><td>${Object.values(c.distinciones).flat().length}</td><td>${esc(new Date(c.fecha).toLocaleDateString('es-CL'))}</td></tr>`).join('')}</tbody>
                </table></div>` : ''}
        </section>

        <section class="adm-card">
            <div class="adm-head">
                <h2>Top 50 clientes por local · ${esc(mes)}</h2>
                <div class="adm-row-actions">
                    <button class="adm-btn small" data-action="adm-month" data-dir="-1" aria-label="Mes anterior">←</button>
                    <button class="adm-btn small" data-action="adm-month" data-dir="1" ${mesOffset >= 0 ? 'disabled' : ''} aria-label="Mes siguiente">→</button>
                </div>
            </div>
            <p class="adm-help">Cada reseña cuenta como una visita. Con <b>5 visitas o más</b> al mismo local en el mes, la persona queda como <b>cliente VIP</b>
            de ese local <b>al cerrar el mes</b>, y se le reconoce durante todo el mes siguiente (👑 en sus reseñas, su perfil y la ficha del local).
            Toca un local para ver su lista.</p>
            ${clientes.length ? `
            <input class="adm-search" type="search" placeholder="Buscar local…" data-input="adm-clientes-buscar" aria-label="Buscar local">
            <div class="adm-folders" id="admClientes">${clientes.map(({ local, lista, vips }) => {
                const candidatos = lista.filter(c => c.esClienteDelMes).length;
                return `
                <details class="adm-folder" data-nombre="${esc(normalize(local.nombre))}">
                    <summary>
                        <span class="adm-folder-icon">📁</span>
                        <b>${esc(local.nombre)}</b>
                        <span class="adm-folder-meta">${lista.length} cliente(s)${candidatos ? ` · ${statusPill(`${candidatos} con 5+ visitas`, 'gold')}` : ''}${vips.length ? ` · 👑 ${vips.length} VIP vigente(s)` : ''}</span>
                    </summary>
                    ${vips.length ? `<p class="adm-help">👑 VIP de este mes (por sus visitas en ${esc(vips[0].mes)}): ${vips.map(v => `<b>${esc(v.usuario.nombre)}</b> (${v.visitas})`).join(', ')}</p>` : ''}
                    ${lista.length ? `<div class="adm-table-wrap"><table class="adm-table">
                        <thead><tr><th>#</th><th>Persona</th><th>Visitas</th><th>Última</th><th></th></tr></thead>
                        <tbody>${lista.map(c => `
                            <tr>
                                <td>${c.puesto}</td>
                                <td>${esc(c.usuario.nombre)} <small class="adm-muted-cell">@${esc(c.usuario.username || '')}</small></td>
                                <td>${c.visitas}</td>
                                <td>${esc(new Date(c.ultima).toLocaleDateString('es-CL'))}</td>
                                <td>${c.esClienteDelMes ? statusPill('👑 Será VIP', 'gold') : statusPill(`Le faltan ${5 - c.visitas}`, 'muted')}</td>
                            </tr>`).join('')}</tbody>
                    </table></div>` : '<p class="adm-help">Sin visitas en este mes.</p>'}
                </details>`;
            }).join('')}</div>` : emptyRow('No hay visitas registradas este mes.')}
        </section>
    `;
}

registerActions({
    'adm-clientes-buscar': el => {
        const q = normalize(el.value);
        document.querySelectorAll('#admClientes .adm-folder').forEach(f => { f.hidden = !!q && !f.dataset.nombre.includes(q); });
    },
    'adm-month': el => { mesOffset = Math.min(0, mesOffset + Number(el.dataset.dir)); rerender(); },
    'adm-close-month': () => confirmDialog('¿Guardar las distinciones de este mes en el historial de los locales?', () => {
        const { mes, total } = cerrarMes();
        persist();
        toast(`${mes}: ${total} distinción(es) guardada(s)`);
        rerender();
    }, 'Cerrar mes')
});
