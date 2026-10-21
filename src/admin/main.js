// Panel de administración de Mesa Gourmet
import './admin.css';
import { db, persist } from '../data/store.js';
import { cerrarMesPendiente } from '../data/metrics.js';
import { registerActions } from '../ui/actions.js';
import { renderResumen, setResumenRerender } from './views/resumen.js';
import { aplicarReglasAutomaticas } from './moderar.js';
import { toast } from './ui.js';
import { renderLocales, setLocalesRerender, editLocal } from './views/locales.js';
import { renderCartas, setCartasRerender, selectCartaLocal } from './views/cartas.js';
import { renderPatrocinios, setPatrociniosRerender } from './views/patrocinios.js';
import { renderEventos, setEventosRerender } from './views/eventos.js';
import { renderModeracion, setModeracionRerender } from './views/moderacion.js';
import { renderReportes, setReportesHandlers } from './views/reportes.js';
import { renderUsuarios, setUsuariosRerender } from './views/usuarios.js';
import { renderEncuesta, setEncuestaRerender } from './views/encuesta.js';
import { renderMapaAdmin } from './views/mapa.js';
import { renderMetricas, setMetricasRerender } from './views/metricas.js';
import { renderCrecimiento, setCrecimientoRerender } from './views/crecimiento.js';
import { nuevosVip } from './vip.js';
import { remoto } from '../services/supabase.js';
import { iniciarAdminEnLinea } from './acceso.js';

const VIEWS = {
    resumen: { label: 'Resumen', icon: '📊', render: renderResumen },
    locales: { label: 'Locales', icon: '🏪', render: renderLocales },
    mapa: { label: 'Mapa de ubicaciones', icon: '🗺️', render: renderMapaAdmin },
    cartas: { label: 'Cartas', icon: '📋', render: renderCartas },
    encuesta: { label: 'Encuesta a locales', icon: '📝', render: renderEncuesta },
    patrocinios: { label: 'Destacados', icon: '★', render: renderPatrocinios },
    eventos: { label: 'Eventos y promos', icon: '📅', render: renderEventos },
    moderacion: { label: 'Moderación', icon: '🛡️', render: renderModeracion, badge: () => db.reviews.filter(r => r.estado === 'pendiente').length + db.moderation.length + db.videos.filter(v => v.estado === 'pendiente').length + db.reports.filter(r => r.tipo === 'resena' && r.estado === 'abierto').length },
    reportes: { label: 'Reportes', icon: '⚠️', render: renderReportes, badge: () => db.reports.filter(r => r.tipo !== 'resena' && r.estado === 'abierto').length },
    metricas: { label: 'Top y clientes', icon: '🏆', render: renderMetricas, badge: () => nuevosVip().length },
    crecimiento: { label: 'Reportes para locales', icon: '📈', render: renderCrecimiento },
    usuarios: { label: 'Usuarios y datos', icon: '👥', render: renderUsuarios }
};

let current = (location.hash.slice(1) in VIEWS) ? location.hash.slice(1) : 'resumen';

function renderNav() {
    document.getElementById('admNav').innerHTML = Object.entries(VIEWS).map(([key, v]) => {
        const count = v.badge ? v.badge() : 0;
        return `<button class="adm-nav-btn ${key === current ? 'active' : ''}" data-action="adm-go" data-view="${key}" ${key === current ? 'aria-current="page"' : ''}>
            <span class="adm-nav-icon">${v.icon}</span><span>${v.label}</span>${count ? `<span class="adm-badge">${count}</span>` : ''}
        </button>`;
    }).join('');
}

// Las reglas automáticas del manual resuelven solas los casos nuevos
function reglasAutomaticas() {
    const n = aplicarReglasAutomaticas();
    if (n) toast(`🤖 ${n} caso(s) resuelto(s) solos con tus reglas automáticas`);
}

function render() {
    renderNav();
    const main = document.getElementById('admMain');
    main.innerHTML = VIEWS[current].render();
}

function go(view, localId = null) {
    if (!(view in VIEWS)) return;
    if (view === 'locales') editLocal(localId);
    if (view === 'cartas') selectCartaLocal(localId);
    current = view;
    history.replaceState(null, '', `#${view}`);
    render();
    window.scrollTo(0, 0);
}

[setResumenRerender, setLocalesRerender, setCartasRerender, setEncuestaRerender, setPatrociniosRerender, setEventosRerender, setModeracionRerender, setUsuariosRerender, setMetricasRerender, setCrecimientoRerender]
    .forEach(set => set(render));
setReportesHandlers(render, go);

registerActions({
    'adm-go': el => go(el.dataset.view),
    'adm-go-cartas': el => go('cartas', Number(el.dataset.id))
});

// Permite volver con el botón atrás o abrir una sección por link (admin.html#encuesta)
window.addEventListener('hashchange', () => {
    const view = location.hash.slice(1);
    if (view in VIEWS && view !== current) go(view);
});

// Si la app cambia los datos en otra pestaña (por ejemplo, llega una reseña), se refresca el panel
// (no se redibuja mientras escribes en un formulario, para no perder lo que estás escribiendo)
window.addEventListener('mg:data-changed', () => {
    reglasAutomaticas();
    const activo = document.activeElement;
    if (activo && activo.closest('#admMain') && /INPUT|TEXTAREA|SELECT/.test(activo.tagName)) renderNav();
    else render();
});

// En línea hay que ingresar con la cuenta de administrador; en la demo se entra directo
if (remoto) iniciarAdminEnLinea(() => { reglasAutomaticas(); render(); });
else {
    const nota = document.getElementById('admNota');
    nota.hidden = false;
    nota.textContent = 'Versión de prueba sin conexión: los cambios quedan solo en este navegador. Para el panel real usa el link publicado (…/admin.html).';
    if (cerrarMesPendiente()) persist();
    reglasAutomaticas();
    render();
}
