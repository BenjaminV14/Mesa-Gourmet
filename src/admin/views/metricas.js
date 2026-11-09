// Top y clientes: ranking del mes, cierre mensual de distinciones, Top 50 de clientes de cada local
// y el correo mensual a los locales con su Top 50 (solo con los datos de quienes lo autorizaron).
import { db, persist } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { rankingGeneral, topClientes, vipsDeLocal, cerrarMes, MESES, MINIMO_TOP50 } from '../../data/metrics.js';
import { remoto, supabase, mensajeError } from '../../services/supabase.js';
import { cargarTodo } from '../../data/remoto.js';
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
            <p class="adm-help">Cada reseña publicada cuenta como una visita (máximo una por local al día). Con <b>${MINIMO_TOP50} reseñas o más</b> en el mismo local
            durante el mes, la persona entra al <b>Top 50 de clientes</b> de ese local (y queda como 👑 VIP el mes siguiente).
            Al cerrar el mes se envía la lista al local. Toca un local para ver su lista.</p>
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
                                <td>${c.esClienteDelMes ? statusPill('👑 Top 50', 'gold') : statusPill(`Le faltan ${MINIMO_TOP50 - c.visitas}`, 'muted')}</td>
                            </tr>`).join('')}</tbody>
                    </table></div>` : '<p class="adm-help">Sin visitas en este mes.</p>'}
                </details>`;
            }).join('')}</div>` : emptyRow('No hay visitas registradas este mes.')}
        </section>

        ${correosHtml()}
    `;
}

const nombreMes = clave => { const [y, m] = clave.split('-').map(Number); return `${MESES[m - 1]} ${y}`; };

/** Listas cerradas por local (en línea vienen de Supabase; en la demo se calculan desde las reseñas del mes pasado) */
function listasCerradas() {
    if (Array.isArray(db.top50Listas)) return db.top50Listas;
    const pasado = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15);
    const mes = `${pasado.getFullYear()}-${String(pasado.getMonth() + 1).padStart(2, '0')}-01`;
    return db.locales.flatMap(l => topClientes(l.id, pasado).filter(c => c.esClienteDelMes).map((c, i) => ({
        mes, localId: l.id, puesto: i + 1, resenas: c.visitas, comparte: null, nombre: c.usuario.nombre, apellido: '', username: c.usuario.username
    })));
}

function textoLista(local, mes, personas) {
    const con = personas.filter(p => p.comparte !== false);
    const sin = personas.length - con.length;
    return [
        `Top 50 de clientes de ${local.nombre} · ${nombreMes(mes)} (Mesa Gourmet)`,
        `Personas con ${MINIMO_TOP50} reseñas o más en el mes.`,
        '',
        ...con.map(p => `${p.puesto}. ${[p.nombre, p.apellido].filter(Boolean).join(' ')} · @${p.username} · ${p.resenas} reseñas`),
        ...(sin ? ['', `Además, ${sin} cliente(s) prefirieron no compartir sus datos.`] : []),
        ...(local.beneficioTop50 ? ['', `Beneficio que ofreces: ${local.beneficioTop50} (los clientes muestran el código MESAGOURMET y su @usuario).`] : []),
        '',
        'Estas personas aceptaron que compartamos su nombre y @usuario solo para que puedas ofrecerles un beneficio.',
        'No los uses para otros fines ni los compartas, y elimina esta lista a más tardar al recibir la del próximo mes (Ley 21.719).'
    ].join('\n');
}

function correosHtml() {
    const listas = listasCerradas();
    const meses = [...new Set(listas.map(t => t.mes))].sort().reverse();
    const envios = db.enviosTop50 || [];
    return `
        <section class="adm-card">
            <div class="adm-head">
                <h2>📧 Correo mensual a los locales</h2>
                ${remoto ? `<div class="adm-row-actions">
                    <button class="adm-btn small" data-action="adm-top50-recalcular">Recalcular mes pasado</button>
                    <button class="adm-btn small primary" data-action="adm-top50-enviar">Enviar pendientes ahora</button>
                </div>` : ''}
            </div>
            <p class="adm-help">El día 1 de cada mes a las 10:00 se envía solo a cada local con correo registrado (en <b>Locales</b>) su Top 50 del mes anterior.
            Solo van el nombre, apellido y @usuario de quienes lo autorizaron (✅); el resto se cuenta sin datos (🔒).
            <b>La lista se borra sola al cerrar el mes siguiente</b>; los números del mes (reseñas, clientes, visitas) se guardan sin datos personales.
            Si aún no configuras el envío automático, usa "Copiar" o "Abrir correo" en cada local.</p>
            ${meses.length ? meses.map(mes => `
                <h3 class="adm-subtitle">${esc(nombreMes(mes))}</h3>
                <div class="adm-table-wrap"><table class="adm-table">
                    <thead><tr><th>Local</th><th>Top 50</th><th>Correo</th><th>Estado</th><th></th></tr></thead>
                    <tbody>${db.locales.map(local => {
                        const personas = listas.filter(t => t.mes === mes && t.localId === local.id).sort((a, b) => a.puesto - b.puesto);
                        if (!personas.length) return '';
                        const con = personas.filter(p => p.comparte === true).length;
                        const envio = envios.find(e => e.mes === mes && e.localId === local.id);
                        const correo = local.contacto?.email || '';
                        const estado = envio ? (envio.estado === 'enviado' ? statusPill(`Enviado ${new Date(envio.fecha).toLocaleDateString('es-CL')}`, 'ok')
                            : envio.estado === 'prueba' ? statusPill('Solo prueba (a tu correo)', 'muted') : statusPill('Error', 'warn'))
                            : statusPill(correo ? 'Pendiente' : 'Sin correo', 'muted');
                        return `<tr>
                            <td><b>${esc(local.nombre)}</b>${envio?.detalle ? `<br><small class="adm-muted-cell">${esc(envio.detalle)}</small>` : ''}</td>
                            <td>${personas.length}${remoto ? ` <small class="adm-muted-cell">(✅ ${con} · 🔒 ${personas.length - con})</small>` : ''}</td>
                            <td>${correo ? esc(correo) : '<small class="adm-muted-cell">Agrégalo en Locales</small>'}</td>
                            <td>${estado}</td>
                            <td class="adm-row-actions">
                                <button class="adm-btn small" data-action="adm-top50-copiar" data-mes="${esc(mes)}" data-id="${local.id}">Copiar</button>
                                ${correo ? `<button class="adm-btn small" data-action="adm-top50-mailto" data-mes="${esc(mes)}" data-id="${local.id}">Abrir correo</button>` : ''}
                                ${remoto && correo && envio?.estado === 'enviado' ? `<button class="adm-btn small ghost" data-action="adm-top50-reenviar" data-mes="${esc(mes)}" data-id="${local.id}">Reenviar</button>` : ''}
                            </td>
                        </tr>`;
                    }).join('')}</tbody>
                </table></div>`).join('') : emptyRow('Todavía no hay meses cerrados con clientes en el Top 50.')}
        </section>`;
}

async function invocarEnvio(body) {
    const { data, error } = await supabase.functions.invoke('enviar-top50', { body });
    if (error) {
        const detalle = await error.context?.json?.().catch(() => null);
        throw new Error(detalle?.error || error.message);
    }
    return data;
}

async function recargar() {
    await cargarTodo({ admin: true });
    rerender();
}

registerActions({
    'adm-clientes-buscar': el => {
        const q = normalize(el.value);
        document.querySelectorAll('#admClientes .adm-folder').forEach(f => { f.hidden = !!q && !f.dataset.nombre.includes(q); });
    },
    'adm-month': el => { mesOffset = Math.min(0, mesOffset + Number(el.dataset.dir)); rerender(); },
    'adm-top50-copiar': async el => {
        const local = db.locales.find(l => l.id === Number(el.dataset.id));
        const personas = listasCerradas().filter(t => t.mes === el.dataset.mes && t.localId === local.id).sort((a, b) => a.puesto - b.puesto);
        try {
            await navigator.clipboard.writeText(textoLista(local, el.dataset.mes, personas));
            toast('Lista copiada. Pégala en un correo al local.');
        } catch {
            toast('No se pudo copiar automáticamente.', 'error');
        }
    },
    'adm-top50-mailto': el => {
        const local = db.locales.find(l => l.id === Number(el.dataset.id));
        const personas = listasCerradas().filter(t => t.mes === el.dataset.mes && t.localId === local.id).sort((a, b) => a.puesto - b.puesto);
        const asunto = `Tus mejores clientes de ${nombreMes(el.dataset.mes)} · Mesa Gourmet`;
        location.href = `mailto:${encodeURIComponent(local.contacto.email)}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(textoLista(local, el.dataset.mes, personas))}`;
    },
    'adm-top50-enviar': () => confirmDialog('¿Enviar ahora los correos pendientes del Top 50 a los locales con correo registrado?', async () => {
        try {
            const r = await invocarEnvio({});
            toast(r.modoPrueba ? `Modo prueba: ${r.enviados} correo(s) enviados a tu propio correo` : `${r.enviados} correo(s) enviado(s)`);
            await recargar();
        } catch (err) {
            toast(`No se pudo enviar: ${mensajeError(err)}`, 'error');
        }
    }, 'Enviar'),
    'adm-top50-reenviar': el => confirmDialog('¿Volver a enviar la lista de este mes a este local?', async () => {
        try {
            await invocarEnvio({ mes: el.dataset.mes, local_id: Number(el.dataset.id), reenviar: true });
            toast('Correo reenviado');
            await recargar();
        } catch (err) {
            toast(`No se pudo reenviar: ${mensajeError(err)}`, 'error');
        }
    }, 'Reenviar'),
    'adm-top50-recalcular': () => confirmDialog('¿Recalcular el Top 50 de clientes del mes pasado con las reseñas actuales?', async () => {
        const d = new Date();
        const p = new Date(d.getFullYear(), d.getMonth() - 1, 1);
        const mes = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}-01`;
        const { data, error } = await supabase.rpc('admin_generar_top50', { p_dia: mes });
        if (error) return toast(`No se pudo recalcular: ${mensajeError(error)}`, 'error');
        toast(`${data} persona(s) en el Top 50 de ${nombreMes(mes)}`);
        await recargar();
    }, 'Recalcular'),
    'adm-close-month': () => confirmDialog('¿Guardar las distinciones de este mes en el historial de los locales?', () => {
        const { mes, total } = cerrarMes();
        persist();
        toast(`${mes}: ${total} distinción(es) guardada(s)`);
        rerender();
    }, 'Cerrar mes')
});
