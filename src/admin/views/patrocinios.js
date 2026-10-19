// Patrocinios ("Destacado mensual" a $29.990): activar, renovar y desactivar
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { todayIso } from '../../utils/time.js';
import { isSponsored, diasRestantesPatrocinio, PRECIO_PATROCINIO } from '../../features/sponsors.js';
import { toast, confirmDialog, statusPill } from '../ui.js';

let rerender = () => {};
export function setPatrociniosRerender(fn) { rerender = fn; }

function sumarMes(iso) {
    const d = new Date(`${iso}T12:00:00`);
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
    return todayIso(d);
}

function estado(local) {
    const p = local.patrocinio;
    if (isSponsored(local)) {
        const dias = diasRestantesPatrocinio(local);
        return statusPill(`Activo · ${dias} día(s)`, dias <= 7 ? 'warn' : 'ok');
    }
    if (p && p.desde > todayIso()) return statusPill(`Programado desde ${p.desde}`, 'info');
    if (p) return statusPill(`Venció el ${p.hasta}`, 'muted');
    return statusPill('Sin destacado', 'muted');
}

export function renderPatrocinios() {
    const activos = db.locales.filter(l => isSponsored(l));
    return `
        <h1 class="adm-title">Destacados pagados</h1>
        <p class="adm-help">Plan mensual de $${PRECIO_PATROCINIO.toLocaleString('es-CL')}. Mientras está activo, el local sale primero en el inicio y en las búsquedas que coinciden,
        lleva estrella en el mapa y aparece en 1 de cada 3 recomendaciones aleatorias. Al vencer, todo eso se apaga solo.
        En la app se muestra la etiqueta "★ Destacado" para que el usuario sepa que es publicidad.</p>
        <div class="adm-kpis">
            <div class="adm-kpi"><span>Activos</span><b>${activos.length}</b></div>
            <div class="adm-kpi"><span>Ingreso mensual</span><b>$${(activos.length * PRECIO_PATROCINIO).toLocaleString('es-CL')}</b></div>
        </div>
        <div class="adm-table-wrap">
            <table class="adm-table">
                <thead><tr><th>Local</th><th>Estado</th><th>Desde</th><th>Hasta</th><th></th></tr></thead>
                <tbody>
                    ${db.locales.map(l => `
                    <tr>
                        <td><b>${esc(l.nombre)}</b></td>
                        <td>${estado(l)}</td>
                        <td>${esc(l.patrocinio?.desde || '—')}</td>
                        <td>${esc(l.patrocinio?.hasta || '—')}</td>
                        <td class="adm-row-actions">
                            ${isSponsored(l)
                                ? `<button class="adm-btn small" data-action="adm-sponsor-renew" data-id="${l.id}">Renovar +1 mes</button>
                                   <button class="adm-btn small danger" data-action="adm-sponsor-stop" data-id="${l.id}">Desactivar</button>`
                                : `<button class="adm-btn small primary" data-action="adm-sponsor-start" data-id="${l.id}">Activar 1 mes</button>`}
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
        </div>
        <p class="adm-help">Las impresiones y clics de cada destacado (para mostrarle resultados al local) se verán aquí al conectar las estadísticas (docs/HOSTING.md).</p>
    `;
}

registerActions({
    'adm-sponsor-start': el => {
        const local = getLocal(Number(el.dataset.id));
        const desde = todayIso();
        local.patrocinio = { plan: 'Destacado mensual', precio: PRECIO_PATROCINIO, desde, hasta: sumarMes(desde), historial: [...(local.patrocinio?.historial || [])] };
        persist();
        toast(`${local.nombre} destacado hasta el ${local.patrocinio.hasta}`);
        rerender();
    },
    'adm-sponsor-renew': el => {
        const local = getLocal(Number(el.dataset.id));
        const p = local.patrocinio;
        const siguiente = new Date(`${p.hasta}T12:00:00`);
        siguiente.setDate(siguiente.getDate() + 1);
        p.historial = [...(p.historial || []), { desde: p.desde, hasta: p.hasta }];
        p.hasta = sumarMes(todayIso(siguiente));
        persist();
        toast(`Renovado hasta el ${p.hasta}`);
        rerender();
    },
    'adm-sponsor-stop': el => {
        const local = getLocal(Number(el.dataset.id));
        confirmDialog(`¿Quitar el destacado de ${local.nombre} desde hoy?`, () => {
            const ayer = new Date();
            ayer.setDate(ayer.getDate() - 1);
            local.patrocinio.hasta = todayIso(ayer);
            persist();
            toast('Destacado desactivado');
            rerender();
        }, 'Desactivar');
    }
});
