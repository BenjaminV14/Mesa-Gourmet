// Patrocinios ("Destacado mensual" a $29.990): activar, renovar y desactivar
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { todayIso } from '../../utils/time.js';
import { isSponsored, diasRestantesPatrocinio, PRECIO_PATROCINIO } from '../../features/sponsors.js';
import { toast, confirmDialog, statusPill, pedirNumero } from '../ui.js';
import { normalize } from '../../utils/text.js';

let rerender = () => {};
let busqueda = '';
export function setPatrociniosRerender(fn) { rerender = fn; }

const precio = n => `$${(n * PRECIO_PATROCINIO).toLocaleString('es-CL')}`;

function sumarMes(iso, meses = 1) {
    const d = new Date(`${iso}T12:00:00`);
    d.setMonth(d.getMonth() + meses);
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

function filas() {
    const lista = db.locales.filter(l => !busqueda || normalize(l.nombre).includes(normalize(busqueda)));
    if (!lista.length) return '<tr><td colspan="5" class="adm-muted-cell">Ningún local coincide con la búsqueda.</td></tr>';
    return lista.map(l => `
        <tr>
            <td><b>${esc(l.nombre)}</b></td>
            <td>${estado(l)}</td>
            <td>${esc(l.patrocinio?.desde || '—')}</td>
            <td>${esc(l.patrocinio?.hasta || '—')}</td>
            <td><div class="adm-row-actions">
                ${isSponsored(l)
                    ? `<button class="adm-btn small" data-action="adm-sponsor-renew" data-id="${l.id}" data-meses="1">Renovar +1 mes</button>
                       <button class="adm-btn small" data-action="adm-sponsor-varios" data-id="${l.id}" data-modo="renovar">Varios meses…</button>
                       <button class="adm-btn small danger" data-action="adm-sponsor-stop" data-id="${l.id}">Desactivar</button>`
                    : `<button class="adm-btn small primary" data-action="adm-sponsor-start" data-id="${l.id}" data-meses="1">Activar 1 mes</button>
                       <button class="adm-btn small" data-action="adm-sponsor-varios" data-id="${l.id}" data-modo="activar">Varios meses…</button>`}
            </div></td>
        </tr>`).join('');
}

function activar(local, meses) {
    const desde = todayIso();
    local.patrocinio = { plan: meses > 1 ? `Destacado ${meses} meses` : 'Destacado mensual', precio: PRECIO_PATROCINIO * meses, desde, hasta: sumarMes(desde, meses), historial: [...(local.patrocinio?.historial || [])] };
    persist();
    toast(`${local.nombre} destacado hasta el ${local.patrocinio.hasta} (${precio(meses)})`);
    rerender();
}

function renovar(local, meses) {
    const p = local.patrocinio;
    const siguiente = new Date(`${p.hasta}T12:00:00`);
    siguiente.setDate(siguiente.getDate() + 1);
    p.historial = [...(p.historial || []), { desde: p.desde, hasta: p.hasta }];
    p.desde = todayIso(siguiente);
    p.hasta = sumarMes(p.desde, meses);
    persist();
    toast(`Renovado hasta el ${p.hasta} (${precio(meses)})`);
    rerender();
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
        <input class="adm-search" type="search" placeholder="Buscar local…" value="${esc(busqueda)}" data-input="adm-sponsor-buscar" aria-label="Buscar local">
        <div class="adm-table-wrap">
            <table class="adm-table adm-sponsor-table">
                <thead><tr><th>Local</th><th>Estado</th><th>Desde</th><th>Hasta</th><th class="adm-actions-col">Acciones</th></tr></thead>
                <tbody id="sponsorFilas">${filas()}</tbody>
            </table>
        </div>
        <p class="adm-help">Las impresiones y clics de cada destacado (para mostrarle resultados al local) se verán aquí al conectar las estadísticas (docs/HOSTING.md).</p>
    `;
}

registerActions({
    'adm-sponsor-buscar': el => {
        busqueda = el.value;
        document.getElementById('sponsorFilas').innerHTML = filas();
    },
    'adm-sponsor-start': el => activar(getLocal(Number(el.dataset.id)), 1),
    'adm-sponsor-renew': el => renovar(getLocal(Number(el.dataset.id)), 1),
    'adm-sponsor-varios': el => {
        const local = getLocal(Number(el.dataset.id));
        const accion = el.dataset.modo === 'renovar' ? 'renovar' : 'activar';
        pedirNumero(`¿Cuántos meses quieres ${accion} el destacado de ${local.nombre}?`, {
            min: 1, max: 24, valor: 3, sufijo: 'meses', detalle: n => `Total: ${precio(n)} (${n} × ${precio(1)})`
        }, meses => (accion === 'renovar' ? renovar(local, meses) : activar(local, meses)));
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
