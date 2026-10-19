// Resumen: lo que necesita atención hoy y los números principales
import { db } from '../../data/store.js';
import { esc } from '../../utils/html.js';
import { isSponsored, diasRestantesPatrocinio, PRECIO_PATROCINIO } from '../../features/sponsors.js';
import { emptyRow } from '../ui.js';

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
        ...(pendientes ? [{ icon: '🛡️', text: `${pendientes} elemento(s) esperando moderación`, go: 'moderacion' }] : []),
        ...porVencer.map(l => ({ icon: '⏳', text: `El destacado de ${l.nombre} vence en ${diasRestantesPatrocinio(l)} día(s)`, go: 'patrocinios' })),
        ...sinCarta.map(l => ({ icon: '📋', text: `${l.nombre} no tiene carta cargada`, go: 'cartas' }))
    ];

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
                : emptyRow('Todo al día. No hay nada pendiente.')}
        </section>
    `;
}
