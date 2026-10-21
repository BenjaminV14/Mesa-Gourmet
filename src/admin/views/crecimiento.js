// Reportes para locales: cuánta gente le llevó la app a cada local en un mes, para mostrárselo al dueño.
// Visitas a la ficha, contactos (WhatsApp, llamadas, cómo llegar), reseñas, fotos, "quiero ir", favoritos y clientes VIP.
import { db, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { MESES, topClientes, vipsDeLocal } from '../../data/metrics.js';
import { emptyRow, toast } from '../ui.js';

let rerender = () => {};
let localId = null;
let mesOffset = 0;
let busqueda = '';
export function setCrecimientoRerender(fn) { rerender = fn; }

const REDES = ['instagram', 'facebook', 'tiktok', 'web'];
const mesDe = offset => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + offset, 15); };
const etiquetaMes = d => `${MESES[d.getMonth()]} ${d.getFullYear()}`;
const enMes = (fecha, d) => { const f = new Date(fecha); return f.getFullYear() === d.getFullYear() && f.getMonth() === d.getMonth(); };
const hastaFinDe = (fecha, d) => new Date(fecha) < new Date(d.getFullYear(), d.getMonth() + 1, 1);

/** Números de un local en el mes de la fecha d */
export function numerosDelMes(id, d) {
    const m = (db.metricas || []).filter(x => x.localId === id && enMes(x.fecha, d));
    const contar = (...tipos) => m.filter(x => tipos.includes(x.tipo)).length;
    const resenas = db.reviews.filter(r => r.localId === id && r.estado === 'publicada' && enMes(r.fecha, d));
    const quiero = (db.quieroIrLocales || []).filter(x => x.localId === id);
    const favs = (db.favoritosLocales || []).filter(x => x.localId === id);
    const nota = resenas.length ? resenas.reduce((s, r) => s + (r.notaComida + r.notaServicio) / 2, 0) / resenas.length : null;
    return {
        vistas: contar('vista'),
        personas: new Set(m.filter(x => x.tipo === 'vista').map(x => x.usuarioId || `anon-${x.fecha}`)).size,
        whatsapp: contar('whatsapp'),
        llamar: contar('llamar'),
        comoLlegar: contar('como_llegar'),
        carta: contar('carta'),
        redes: contar(...REDES),
        compartir: contar('compartir'),
        resenas: resenas.length,
        visitantes: new Set(resenas.map(r => r.usuario.id)).size,
        fotos: resenas.reduce((s, r) => s + (r.fotos || []).length, 0),
        nota,
        quieroIr: quiero.filter(x => !x.fecha || hastaFinDe(x.fecha, d)).length,
        quieroIrNuevos: quiero.filter(x => x.fecha && enMes(x.fecha, d)).length,
        favoritos: favs.filter(x => !x.fecha || hastaFinDe(x.fecha, d)).length,
        favoritosNuevos: favs.filter(x => x.fecha && enMes(x.fecha, d)).length,
        frecuentes: topClientes(id, d).filter(c => c.esClienteDelMes).length
    };
}

function variacion(actual, anterior) {
    if (!anterior && !actual) return '';
    if (!anterior) return '<small class="adm-delta up">nuevo</small>';
    const p = Math.round((actual - anterior) / anterior * 100);
    if (!p) return '<small class="adm-delta">= mes anterior</small>';
    return `<small class="adm-delta ${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p)}% vs mes anterior</small>`;
}

function tile(titulo, valor, anterior, detalle = '') {
    return `<div class="adm-kpi"><span>${esc(titulo)}</span><b>${valor}</b>${anterior === undefined ? '' : variacion(valor, anterior)}${detalle ? `<small class="adm-muted-cell">${detalle}</small>` : ''}</div>`;
}

/** Barras de los últimos 6 meses: personas que vieron la ficha */
function tendencia(id) {
    const meses = [-5, -4, -3, -2, -1, 0].map(o => mesDe(mesOffset + o));
    const valores = meses.map(d => numerosDelMes(id, d).vistas);
    const max = Math.max(1, ...valores);
    if (!valores.some(Boolean)) return '<p class="adm-help adm-trend-vacio">📊 Aquí verás la evolución de las visitas a la ficha mes a mes, apenas se empiecen a registrar.</p>';
    return `
        <figure class="adm-trend" aria-label="Visitas a la ficha en los últimos 6 meses">
            <figcaption>Visitas a la ficha · últimos 6 meses</figcaption>
            <div class="adm-trend-bars">${meses.map((d, i) => `
                <div class="adm-trend-col" title="${esc(etiquetaMes(d))}: ${valores[i]} visita(s)">
                    <span class="adm-trend-val">${i === meses.length - 1 || valores[i] === max ? valores[i] : ''}</span>
                    <span class="adm-trend-bar" style="height:${Math.max(2, Math.round(valores[i] / max * 100))}%"></span>
                    <span class="adm-trend-mes">${esc(MESES[d.getMonth()].slice(0, 3))}</span>
                </div>`).join('')}
            </div>
        </figure>`;
}

function textoResumen(local, n, mes) {
    return [
        `📈 Mesa Gourmet · ${local.nombre} · ${mes}`,
        `👀 ${n.vistas} visitas a su ficha en la app`,
        `📲 ${n.whatsapp + n.llamar} contactos (${n.whatsapp} por WhatsApp, ${n.llamar} llamadas)`,
        `🧭 ${n.comoLlegar} personas pidieron cómo llegar`,
        `📋 ${n.carta} vieron su carta · ${n.redes} fueron a sus redes`,
        `⭐ ${n.resenas} reseñas de ${n.visitantes} persona(s) que fueron al local${n.nota ? ` · nota promedio ${n.nota.toFixed(1)}` : ''}`,
        `📸 ${n.fotos} fotos de sus platos`,
        `📍 ${n.quieroIr} personas quieren ir (${n.quieroIrNuevos} nuevas este mes) · ❤️ ${n.favoritos} lo tienen en favoritos`,
        `👑 ${n.frecuentes} cliente(s) con 5 visitas o más (serán VIP el próximo mes)`
    ].join('\n');
}

function reporteLocal(local) {
    const d = mesDe(mesOffset);
    const mes = etiquetaMes(d);
    const n = numerosDelMes(local.id, d);
    const a = numerosDelMes(local.id, mesDe(mesOffset - 1));
    const vips = vipsDeLocal(local.id, d);
    const sinMetricas = !(db.metricas || []).some(x => x.localId === local.id);
    return `
        <section class="adm-card adm-report" id="admReporte">
            <div class="adm-head">
                <div>
                    <h2>${esc(local.nombre)} · ${esc(mes)}</h2>
                    <p class="adm-help">Lo que Mesa Gourmet le trajo al local este mes.</p>
                </div>
                <div class="adm-row-actions adm-no-print">
                    <button class="adm-btn small" data-action="adm-crec-mes" data-dir="-1" aria-label="Mes anterior">←</button>
                    <button class="adm-btn small" data-action="adm-crec-mes" data-dir="1" ${mesOffset >= 0 ? 'disabled' : ''} aria-label="Mes siguiente">→</button>
                </div>
            </div>
            ${sinMetricas ? '<p class="adm-warning adm-no-print">Aún no hay visitas ni clics registrados para este local. Se empiezan a contar desde que la app está en línea (y ejecutaste la actualización 2 de la base de datos).</p>' : ''}
            <h3 class="adm-subtitle">Gente que la app llevó al local</h3>
            <div class="adm-kpis">
                ${tile('Visitas a su ficha', n.vistas, a.vistas)}
                ${tile('Contactos', n.whatsapp + n.llamar, a.whatsapp + a.llamar, `${n.whatsapp} WhatsApp · ${n.llamar} llamadas`)}
                ${tile('Pidieron cómo llegar', n.comoLlegar, a.comoLlegar)}
                ${tile('Vieron la carta o redes', n.carta + n.redes, a.carta + a.redes, `${n.carta} carta · ${n.redes} redes`)}
            </div>
            <h3 class="adm-subtitle">Visitas y reseñas</h3>
            <div class="adm-kpis">
                ${tile('Reseñas en la app', n.resenas, a.resenas)}
                ${tile('Personas que fueron', n.visitantes, a.visitantes, 'Escribieron reseña')}
                ${tile('Nota promedio', n.nota ? n.nota.toFixed(1) : '—', undefined, a.nota ? `Mes anterior: ${a.nota.toFixed(1)}` : '')}
                ${tile('Fotos de sus platos', n.fotos, a.fotos)}
            </div>
            <h3 class="adm-subtitle">Interés y clientes fieles</h3>
            <div class="adm-kpis">
                ${tile('Quieren ir', n.quieroIr, undefined, `${n.quieroIrNuevos} nuevos este mes`)}
                ${tile('En favoritos', n.favoritos, undefined, `${n.favoritosNuevos} nuevos este mes`)}
                ${tile('Clientes con 5+ visitas', n.frecuentes, a.frecuentes, 'Serán VIP el mes siguiente')}
                ${tile('VIP este mes', vips.length, undefined)}
            </div>
            ${tendencia(local.id)}
            <div class="adm-form-actions adm-no-print">
                <button class="adm-btn" data-action="adm-crec-copiar">📋 Copiar resumen para WhatsApp</button>
                <button class="adm-btn primary" data-action="adm-crec-imprimir">🖨️ Imprimir o guardar PDF</button>
            </div>
            <textarea id="admCrecTexto" class="adm-hidden-text" readonly aria-hidden="true" tabindex="-1">${esc(textoResumen(local, n, mes))}</textarea>
        </section>`;
}

function tablaTodos() {
    const d = mesDe(mesOffset);
    const lista = db.locales.filter(l => !busqueda || normalize(l.nombre).includes(normalize(busqueda)))
        .map(l => ({ l, n: numerosDelMes(l.id, d) }))
        .sort((x, y) => (y.n.vistas + y.n.resenas) - (x.n.vistas + x.n.resenas));
    if (!lista.length) return emptyRow('Ningún local coincide con la búsqueda.');
    return `
        <div class="adm-table-wrap"><table class="adm-table">
            <thead><tr><th>Local</th><th>Visitas ficha</th><th>Contactos</th><th>Cómo llegar</th><th>Reseñas</th><th>Quieren ir</th><th></th></tr></thead>
            <tbody>${lista.map(({ l, n }) => `
                <tr>
                    <td><b>${esc(l.nombre)}</b></td><td>${n.vistas}</td><td>${n.whatsapp + n.llamar}</td><td>${n.comoLlegar}</td>
                    <td>${n.resenas}</td><td>${n.quieroIr}</td>
                    <td><button class="adm-btn small" data-action="adm-crec-ver" data-id="${l.id}">Ver reporte</button></td>
                </tr>`).join('')}
            </tbody>
        </table></div>`;
}

export function renderCrecimiento() {
    if (!db.locales.length) return `<h1 class="adm-title">Reportes para locales</h1>${emptyRow('Primero crea un local.')}`;
    const local = localId ? getLocal(localId) : null;
    return `
        <h1 class="adm-title">Reportes para locales</h1>
        <p class="adm-help">Cuánta gente le llevó la app a cada local: visitas a su ficha, contactos, reseñas y quiénes quieren ir.
        Elige un local para ver su reporte del mes y compártelo con el dueño.</p>
        ${local ? reporteLocal(local) : ''}
        <section class="adm-card adm-no-print">
            <h2>Todos los locales · ${esc(etiquetaMes(mesDe(mesOffset)))}</h2>
            <input class="adm-search" type="search" placeholder="Buscar local…" value="${esc(busqueda)}" data-input="adm-crec-buscar" aria-label="Buscar local">
            <div id="admCrecTabla">${tablaTodos()}</div>
        </section>`;
}

registerActions({
    'adm-crec-buscar': el => { busqueda = el.value; document.getElementById('admCrecTabla').innerHTML = tablaTodos(); },
    'adm-crec-ver': el => { localId = Number(el.dataset.id); rerender(); window.scrollTo(0, 0); },
    'adm-crec-mes': el => { mesOffset = Math.min(0, mesOffset + Number(el.dataset.dir)); rerender(); },
    'adm-crec-copiar': async () => {
        const texto = document.getElementById('admCrecTexto').value;
        try { await navigator.clipboard.writeText(texto); toast('Resumen copiado. Pégalo en WhatsApp o en un correo.'); }
        catch { toast('No se pudo copiar automáticamente.', 'error'); }
    },
    'adm-crec-imprimir': () => window.print()
});
