// Top y clientes: ranking del mes, cierre mensual de distinciones y "cliente del mes" de cada local
import { db, persist } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { rankingGeneral, clientesFrecuentes, cerrarMes, MESES } from '../../data/metrics.js';
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
    const clientes = db.locales.map(local => ({ local, lista: clientesFrecuentes(local.id, fecha) }))
        .filter(x => x.lista.length);
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
            <p class="adm-help">Guarda las distinciones del mes ("Top 12 · octubre 2026" y Top 10 por categoría) para que queden en el historial de cada local.
            Hazlo el último día del mes. Si lo repites, se reemplaza el cierre de ese mes.</p>
            <button class="adm-btn primary" data-action="adm-close-month">Cerrar ${esc(MESES[new Date().getMonth()])} ${new Date().getFullYear()}</button>
            ${cierres.length ? `
                <div class="adm-table-wrap"><table class="adm-table">
                    <thead><tr><th>Mes</th><th>Distinciones</th><th>Cerrado el</th></tr></thead>
                    <tbody>${cierres.map(c => `<tr><td>${esc(c.mes)}</td><td>${Object.values(c.distinciones).flat().length}</td><td>${esc(new Date(c.fecha).toLocaleDateString('es-CL'))}</td></tr>`).join('')}</tbody>
                </table></div>` : ''}
        </section>

        <section class="adm-card">
            <div class="adm-head">
                <h2>Clientes frecuentes · ${esc(mes)}</h2>
                <div class="adm-row-actions">
                    <button class="adm-btn small" data-action="adm-month" data-dir="-1" aria-label="Mes anterior">←</button>
                    <button class="adm-btn small" data-action="adm-month" data-dir="1" ${mesOffset >= 0 ? 'disabled' : ''} aria-label="Mes siguiente">→</button>
                </div>
            </div>
            <p class="adm-help">Cada reseña cuenta como una visita. Con <b>5 visitas o más</b> al mismo local en el mes, la persona es <b>cliente del mes</b> de ese local.</p>
            ${clientes.length ? clientes.map(({ local, lista }) => `
                <h3 class="adm-subtitle">${esc(local.nombre)}</h3>
                <div class="adm-table-wrap"><table class="adm-table">
                    <thead><tr><th>Persona</th><th>Visitas</th><th>Última</th><th></th></tr></thead>
                    <tbody>${lista.slice(0, 10).map(c => `
                        <tr>
                            <td>${esc(c.usuario.nombre)} <small class="adm-muted-cell">@${esc(c.usuario.username || '')}</small></td>
                            <td>${c.visitas}</td>
                            <td>${esc(new Date(c.ultima).toLocaleDateString('es-CL'))}</td>
                            <td>${c.esClienteDelMes ? statusPill('🏅 Cliente del mes', 'gold') : statusPill(`Le faltan ${5 - c.visitas}`, 'muted')}</td>
                        </tr>`).join('')}</tbody>
                </table></div>`).join('') : emptyRow('No hay visitas registradas este mes.')}
        </section>
    `;
}

registerActions({
    'adm-month': el => { mesOffset = Math.min(0, mesOffset + Number(el.dataset.dir)); rerender(); },
    'adm-close-month': () => confirmDialog('¿Guardar las distinciones de este mes en el historial de los locales?', () => {
        const { mes, total } = cerrarMes();
        persist();
        toast(`${mes}: ${total} distinción(es) guardada(s)`);
        rerender();
    }, 'Cerrar mes')
});
