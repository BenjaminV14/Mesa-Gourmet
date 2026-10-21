// Filtros del inicio: dietas, abierto ahora, distancia, nota mínima, tipo de comida y características.
import { state, FILTROS_VACIOS } from '../state.js';
import { registerActions } from '../ui/actions.js';
import { estaAbierto, estadoHorario } from '../utils/time.js';
import { esc } from '../utils/html.js';
import { CATEGORIAS, categoriasDePlato } from '../data/categorias.js';
import { DIETAS, dietaLocal, notaActual } from '../data/metrics.js';
import { isSponsored, distanceTo } from './sponsors.js';
import { search } from './search.js';
import { track } from '../services/analytics.js';

export const CARACTERISTICAS_FILTRO = [
    ['WiFi Disponible', '📶 WiFi'],
    ['Terraza', '🪑 Terraza'],
    ['Mascotas', '🐾 Pet-friendly'],
    ['Estacionamiento', '🚗 Estacionamiento'],
    ['Acceso Discapacitados', '♿ Accesible'],
    ['Apto para Fumadores', '🚬 Zona fumadores'],
    ['Venta de Alcohol', '🍺 Alcohol'],
    ['Delivery', '🛵 Delivery'],
    ['Baño / WC', '🚻 Baño'],
    ['Calefacción', '🔥 Calefacción'],
    ['Aire Acondicionado / Ventilación', '❄️ Aire acondicionado'],
    ['Acepta Edenred / BAES', '💳 JUNAEB / Edenred']
];

const DISTANCIAS = [[0, 'Sin límite'], [0.5, '500 m'], [1, '1 km'], [2, '2 km'], [5, '5 km']];
const NOTAS = [[0, 'Cualquiera'], [7, '7+'], [8, '8+'], [9, '9+']];

export function activeFilterCount(f = state.filtros) {
    return f.dietas.length + f.caracteristicas.length + f.tipos.length +
        (f.abiertoAhora ? 1 : 0) + (f.distanciaMax ? 1 : 0) + (f.notaMin ? 1 : 0) + (f.soloDestacados ? 1 : 0);
}

function tieneCaracteristica(local, nombre) {
    // "Mascotas" y "Apto para Fumadores" cubren las variantes (solo terraza / todo el local)
    return (local.caracteristicas || []).some(c => c === nombre || c.startsWith(nombre));
}

export function cumpleFiltros(local, f = state.filtros) {
    if (f.dietas.some(d => dietaLocal(local, d).cantidad === 0)) return false;
    if (f.abiertoAhora && !estaAbierto(local)) return false;
    if (f.distanciaMax && distanceTo(local) > f.distanciaMax) return false;
    if (f.notaMin && notaActual(local.id).total < f.notaMin) return false;
    if (f.soloDestacados && !isSponsored(local)) return false;
    if (f.caracteristicas.some(c => !tieneCaracteristica(local, c))) return false;
    if (f.tipos.length && !f.tipos.some(t => (local.menu || []).some(m => categoriasDePlato(m.nombre).includes(t)))) return false;
    return true;
}

/**
 * Resultado para el inicio: busca, filtra y ordena según el modo.
 * - Recomendados: destacados primero, luego mejor nota (los cercanos desempatan)
 * - Cerca de ti: por distancia
 */
const PRIORIDAD_ESTADO = { abierto: 0, 'cierra-pronto': 0, 'abre-pronto': 1, cerrado: 2 };

export function resultadosInicio() {
    const result = search(state.query);
    result.locales = result.locales.filter(r => cumpleFiltros(r.local));
    result.platos = result.platos.filter(p => cumpleFiltros(p.local));
    if (!state.query) {
        // Primero los abiertos, después los que abren pronto y al final los cerrados
        const abierto = l => PRIORIDAD_ESTADO[estadoHorario(l).codigo] ?? 2;
        if (state.modoInicio === 'cerca') {
            result.locales.sort((a, b) => (abierto(a.local) - abierto(b.local)) || (distanceTo(a.local) - distanceTo(b.local)));
        } else {
            result.locales.sort((a, b) =>
                (abierto(a.local) - abierto(b.local)) ||
                (isSponsored(b.local) - isSponsored(a.local)) ||
                (notaActual(b.local.id).total - notaActual(a.local.id).total) ||
                (distanceTo(a.local) - distanceTo(b.local)));
        }
    }
    return result;
}

function chip(group, value, label, active) {
    return `<button type="button" class="filter-chip ${active ? 'is-on' : ''}" data-action="filter-toggle" data-group="${group}" data-value="${esc(value)}" aria-pressed="${active}">${label}</button>`;
}

let draft = null;
let onApply = () => {};

function countMatches(f) {
    const saved = state.filtros;
    state.filtros = f;
    const n = resultadosInicio().locales.length;
    state.filtros = saved;
    return n;
}

function renderPanel() {
    const f = draft;
    const panel = document.getElementById('filtersPanel');
    panel.innerHTML = `
        <header class="filters-head">
            <h2 id="filtersTitle">Filtros</h2>
            <button class="filters-close" data-action="filters-close" aria-label="Cerrar">✕</button>
        </header>
        <div class="filters-body">
            <section>
                <h3>Disponibilidad</h3>
                <div class="filter-chips">
                    ${chip('abiertoAhora', '1', '🟢 Abierto ahora', f.abiertoAhora)}
                    ${chip('soloDestacados', '1', '★ Solo destacados', f.soloDestacados)}
                </div>
            </section>
            <section>
                <h3>Distancia</h3>
                <div class="filter-segment">${DISTANCIAS.map(([v, l]) => chip('distanciaMax', v, l, f.distanciaMax === v)).join('')}</div>
            </section>
            <section>
                <h3>Nota mínima</h3>
                <div class="filter-segment">${NOTAS.map(([v, l]) => chip('notaMin', v, l, f.notaMin === v)).join('')}</div>
            </section>
            <section>
                <h3>Necesidades alimentarias</h3>
                <div class="filter-chips">${DIETAS.map(d => chip('dietas', d.key, `${d.emoji} ${d.label}`, f.dietas.includes(d.key))).join('')}</div>
            </section>
            <section>
                <h3>Tipo de comida</h3>
                <div class="filter-chips">${CATEGORIAS.map(c => chip('tipos', c.id, `${c.emoji} ${c.nombre}`, f.tipos.includes(c.id))).join('')}</div>
            </section>
            <section>
                <h3>Características del local</h3>
                <div class="filter-chips">${CARACTERISTICAS_FILTRO.map(([v, l]) => chip('caracteristicas', v, l, f.caracteristicas.includes(v))).join('')}</div>
            </section>
        </div>
        <footer class="filters-foot">
            <button class="filters-clear" data-action="filters-clear">Limpiar</button>
            <button class="filters-apply" data-action="filters-apply">Ver ${countMatches(f)} locales</button>
        </footer>`;
}

export function openFilters(applyFn) {
    onApply = applyFn;
    draft = JSON.parse(JSON.stringify(state.filtros));
    document.getElementById('filtersOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'filtersOverlay';
    overlay.className = 'filters-overlay';
    overlay.innerHTML = '<div class="filters-panel" id="filtersPanel" role="dialog" aria-modal="true" aria-labelledby="filtersTitle"></div>';
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
    renderPanel();
}

registerActions({
    'filter-toggle': el => {
        const { group, value } = el.dataset;
        if (Array.isArray(draft[group])) {
            draft[group] = draft[group].includes(value) ? draft[group].filter(v => v !== value) : [...draft[group], value];
        } else if (typeof draft[group] === 'boolean') {
            draft[group] = !draft[group];
        } else {
            draft[group] = Number(value);
        }
        const scroll = document.querySelector('.filters-body')?.scrollTop || 0;
        renderPanel();
        document.querySelector('.filters-body').scrollTop = scroll;
    },
    'filters-clear': () => { draft = FILTROS_VACIOS(); renderPanel(); },
    'filters-close': () => document.getElementById('filtersOverlay')?.remove(),
    'filters-apply': () => {
        state.filtros = draft;
        document.getElementById('filtersOverlay')?.remove();
        track('filtros_aplicados', { cantidad: activeFilterCount() });
        onApply();
    }
});
