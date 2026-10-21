// Resumen: lo que necesita atención hoy y los números principales
import { db, persist } from '../../data/store.js';
import { esc } from '../../utils/html.js';
import { registerActions } from '../../ui/actions.js';
import { toast, emptyRow } from '../ui.js';
import { casosPendientes, resolver } from '../moderar.js';
import { sugerencia, nombreCaso, nombreDecision, entradasManual, guardarRegla, quitarRegla, REGLAS_FIJAS, CASOS } from '../manual.js';

let rerender = () => {};
export function setResumenRerender(fn) { rerender = fn; }
import { isSponsored, diasRestantesPatrocinio, PRECIO_PATROCINIO } from '../../features/sponsors.js';
import { nuevosVip } from '../vip.js';

export function renderResumen() {
    const semana = Date.now() - 7 * 86400000;
    const resenasSemana = db.reviews.filter(r => new Date(r.fecha).getTime() > semana).length;
    const activos = db.locales.filter(l => isSponsored(l));
    const porVencer = activos.filter(l => diasRestantesPatrocinio(l) <= 7);
    const reportesAbiertos = db.reports.filter(r => r.estado === 'abierto');
    const pendientes = db.moderation.length + db.videos.filter(v => v.estado === 'pendiente').length + db.reviews.filter(r => r.estado === 'pendiente').length;
    const usuarios = new Set(db.reviews.map(r => r.usuario.id)).size;
    const sinCarta = db.locales.filter(l => !(l.menu || []).length);

    const atencion = [
        ...reportesAbiertos.slice(0, 5).map(r => ({ icon: '⚠️', text: `Reporte: ${r.tipo}${r.localId ? ` en ${db.locales.find(l => l.id === r.localId)?.nombre || ''}` : ''}`, go: 'reportes' })),

        ...porVencer.map(l => ({ icon: '⏳', text: `El destacado de ${l.nombre} vence en ${diasRestantesPatrocinio(l)} día(s)`, go: 'patrocinios' })),
        ...nuevosVip().map(v => ({ icon: '👑', text: `${v.usuario.nombre} (@${v.usuario.username || ''}) lleva ${v.visitas} visitas en ${v.local.nombre} este mes: será cliente VIP al cerrar el mes`, go: 'metricas' })),
        ...sinCarta.map(l => ({ icon: '📋', text: `${l.nombre} no tiene carta cargada`, go: 'cartas' }))
    ];

    const casos = casosPendientes();

    return `
        <h1 class="adm-title">Resumen</h1>
        <div class="adm-kpis">
            <div class="adm-kpi"><span>Locales</span><b>${db.locales.length}</b></div>
            <div class="adm-kpi"><span>Reseñas (7 días)</span><b>${resenasSemana}</b><small>${db.reviews.length} en total</small></div>
            <div class="adm-kpi"><span>Usuarios con reseñas</span><b>${usuarios}</b></div>
            <div class="adm-kpi ${reportesAbiertos.length ? 'warn' : ''}"><span>Reportes abiertos</span><b>${reportesAbiertos.length}</b></div>
            <div class="adm-kpi ${pendientes ? 'warn' : ''}"><span>Por moderar</span><b>${pendientes}</b></div>
            <div class="adm-kpi"><span>Destacados activos</span><b>${activos.length}</b><small>$${(activos.length * PRECIO_PATROCINIO).toLocaleString('es-CL')} / mes</small></div>
        </div>

        <section class="adm-card">
            <h2>Requiere atención</h2>
            ${atencion.length ? `<ul class="adm-attention">${atencion.map(a => `
                <li><span>${a.icon}</span><span>${esc(a.text)}</span><button class="adm-btn small" data-action="adm-go" data-view="${a.go}">Revisar</button></li>`).join('')}</ul>`
                : casos.length ? '' : emptyRow('Todo al día. No hay nada pendiente.')}
            ${casos.length ? asistente(casos) : ''}
        </section>
        ${manual()}
    `;
}

/** Casos de moderación con la decisión que sugiere el manual */
function asistente(casos) {
    const conSugerencia = casos.filter(c => sugerencia(c.tipo));
    return `
        <h3 class="adm-subtitle">🛡️ ${casos.length} caso(s) por moderar</h3>
        <ul class="adm-attention">${casos.slice(0, 8).map(c => {
            const s = sugerencia(c.tipo);
            return `
            <li>
                <span>${s ? '🤖' : '🛡️'}</span>
                <span>${esc(c.descripcion)}<small class="adm-muted-cell">${esc(nombreCaso(c.tipo, c.detalle))}
                    ${s ? ` · ${s.fuente === 'regla' ? 'Tu regla' : `Lo has hecho ${s.veces} de ${s.total} veces`}: <b>${esc(nombreDecision(c.tipo, s.decision))}</b>` : ' · Sin decisiones anteriores: decide tú y el asistente aprende'}</small></span>
                <span class="adm-row-actions">
                    ${s ? `<button class="adm-btn small primary" data-action="adm-asist-hacer" data-base="${esc(c.base)}" data-id="${esc(c.id)}" data-decision="${esc(s.decision)}">${esc(nombreDecision(c.tipo, s.decision))}</button>` : ''}
                    <button class="adm-btn small" data-action="adm-go" data-view="moderacion">Revisar</button>
                </span>
            </li>`;
        }).join('')}</ul>
        ${casos.length > 8 ? `<p class="adm-help">Y ${casos.length - 8} más en Moderación.</p>` : ''}
        ${conSugerencia.length > 1 ? `<div class="adm-form-actions"><span class="adm-muted-cell">El asistente tiene sugerencia para ${conSugerencia.length} caso(s).</span>
            <button class="adm-btn" data-action="adm-asist-todo">🤖 Aplicar todas las sugerencias</button></div>` : ''}`;
}

function manual() {
    const entradas = entradasManual();
    return `
        <section class="adm-card">
            <h2>📖 Manual de decisiones</h2>
            <p class="adm-help">Cada vez que resuelves un caso queda anotado aquí. Cuando repites la misma decisión para el mismo tipo de caso,
            el asistente la sugiere. Conviértela en regla y marca <b>Automático</b> para que el panel la aplique solo a los casos nuevos
            (sin esperar tu revisión). Puedes cambiarla o quitarla cuando quieras.</p>
            ${entradas.length ? `<ul class="adm-list adm-manual">${entradas.map(e => {
                const decision = e.regla?.decision || e.aprendido?.decision;
                const opciones = CASOS[e.tipo.split(':')[0]]?.opciones || {};
                return `
                <li>
                    <div>
                        <b>${esc(nombreCaso(e.tipo.split(':')[0]))}</b>${e.tipo.includes(':') ? ` <span class="adm-pill muted">${esc(e.tipo.split(':')[1].replace(/-/g, ' '))}</span>` : ''}
                        <small>${e.total} decisión(es) anotada(s)${e.aprendido ? ` · ${e.aprendido.veces} de ${e.aprendido.total} veces: ${esc(nombreDecision(e.tipo, e.aprendido.decision))}` : ''}</small>
                    </div>
                    <div class="adm-row-actions">
                        ${e.regla ? `
                            <select class="adm-select" data-change="adm-regla-decision" data-tipo="${esc(e.tipo)}" aria-label="Decisión de la regla">
                                ${Object.entries(opciones).map(([k, label]) => `<option value="${esc(k)}" ${k === e.regla.decision ? 'selected' : ''}>${esc(label)}</option>`).join('')}
                            </select>
                            <label class="adm-check"><input type="checkbox" data-change="adm-regla-auto" data-tipo="${esc(e.tipo)}" ${e.regla.automatico ? 'checked' : ''}> Automático</label>
                            <button class="adm-btn small ghost" data-action="adm-regla-quitar" data-tipo="${esc(e.tipo)}">Quitar regla</button>`
                        : decision ? `<button class="adm-btn small primary" data-action="adm-regla-crear" data-tipo="${esc(e.tipo)}" data-decision="${esc(decision)}">Convertir en regla</button>`
                        : '<span class="adm-muted-cell">Aún sin patrón claro</span>'}
                    </div>
                </li>`;
            }).join('')}</ul>` : '<p class="adm-help">Todavía no hay decisiones anotadas. Resuelve casos en Moderación y aparecerán aquí.</p>'}
            <details class="adm-folder">
                <summary><span class="adm-folder-icon">⚙️</span><b>Reglas fijas de la app</b><span class="adm-folder-meta">${REGLAS_FIJAS.length}</span></summary>
                <ul class="adm-list">${REGLAS_FIJAS.map(r => `<li><div><b>${esc(r.titulo)}</b><small>${esc(r.texto)}</small></div></li>`).join('')}</ul>
            </details>
        </section>`;
}

registerActions({
    'adm-asist-hacer': el => { toast(resolver(el.dataset.base, el.dataset.id, el.dataset.decision)); rerender(); },
    'adm-asist-todo': () => {
        let n = 0;
        for (const c of casosPendientes()) {
            const s = sugerencia(c.tipo);
            if (s) { resolver(c.base, c.id, s.decision, { guardar: false }); n++; }
        }
        persist();
        toast(`${n} caso(s) resuelto(s) según tu manual`);
        rerender();
    },
    'adm-regla-crear': el => {
        guardarRegla(el.dataset.tipo, el.dataset.decision, false);
        toast('Regla creada. Marca "Automático" si quieres que se aplique sola.');
        rerender();
    },
    'adm-regla-decision': el => { const r = db.reglas[el.dataset.tipo]; guardarRegla(el.dataset.tipo, el.value, r.automatico, r.nota); toast('Regla actualizada'); },
    'adm-regla-auto': el => {
        const r = db.reglas[el.dataset.tipo];
        guardarRegla(el.dataset.tipo, r.decision, el.checked, r.nota);
        toast(el.checked ? 'Listo: los casos nuevos de este tipo se resolverán solos' : 'La regla ahora solo sugiere');
        rerender();
    },
    'adm-regla-quitar': el => { quitarRegla(el.dataset.tipo); toast('Regla quitada'); rerender(); }
});
