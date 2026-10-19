// Usuarios y respaldo de datos
import { db, persist, resetDemoData } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { timeAgo } from '../../utils/time.js';
import { toast, confirmDialog, emptyRow } from '../ui.js';

let rerender = () => {};
export function setUsuariosRerender(fn) { rerender = fn; }

export function renderUsuarios() {
    const porUsuario = new Map();
    db.reviews.forEach(r => {
        const u = porUsuario.get(r.usuario.id) || { ...r.usuario, resenas: 0, ultima: r.fecha, reportes: 0 };
        u.resenas++;
        if (new Date(r.fecha) > new Date(u.ultima)) u.ultima = r.fecha;
        porUsuario.set(r.usuario.id, u);
    });
    db.reports.forEach(rep => {
        if (rep.tipo === 'resena') {
            const r = db.reviews.find(x => String(x.id) === String(rep.reviewId));
            if (r && porUsuario.has(r.usuario.id)) porUsuario.get(r.usuario.id).reportes++;
        }
    });
    const usuarios = [...porUsuario.values()].sort((a, b) => b.resenas - a.resenas);

    return `
        <h1 class="adm-title">Usuarios</h1>
        <p class="adm-help">En la demo solo aparecen quienes escribieron reseñas en este navegador. Con Supabase verás todas las cuentas, cuándo se registraron y podrás bloquear a quien haga spam.</p>
        <section class="adm-card">
            ${usuarios.length ? `
            <div class="adm-table-wrap"><table class="adm-table">
                <thead><tr><th>Nombre</th><th>Reseñas</th><th>Última actividad</th><th>Veces reportado</th></tr></thead>
                <tbody>${usuarios.map(u => `
                    <tr><td><b>${esc(u.nombre)}</b><br><small>${esc(u.id)}</small></td><td>${u.resenas}</td><td>${esc(timeAgo(u.ultima))}</td><td>${u.reportes}</td></tr>`).join('')}
                </tbody>
            </table></div>` : emptyRow('Sin usuarios todavía.')}
        </section>

        <h1 class="adm-title">Respaldo de datos</h1>
        <section class="adm-card">
            <p class="adm-help">Descarga una copia de todos los datos (locales, cartas, reseñas, videos, reportes) o restaura una copia anterior.</p>
            <div class="adm-row-actions">
                <button class="adm-btn primary" data-action="adm-export">Descargar respaldo</button>
                <label class="adm-btn">Restaurar respaldo<input type="file" accept="application/json" data-change="adm-import" hidden></label>
                <button class="adm-btn danger" data-action="adm-reset">Volver a los datos de ejemplo</button>
            </div>
        </section>
    `;
}

registerActions({
    'adm-export': () => {
        const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `mesa-gourmet-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
    'adm-import': el => {
        const file = el.files[0];
        if (!file) return;
        file.text().then(text => {
            const data = JSON.parse(text);
            if (!Array.isArray(data.locales) || !Array.isArray(data.reviews)) throw new Error('formato');
            confirmDialog(`¿Reemplazar los datos actuales por el respaldo (${data.locales.length} locales, ${data.reviews.length} reseñas)?`, () => {
                Object.assign(db, { videos: [], reports: [], moderation: [], ...data });
                persist();
                toast('Respaldo restaurado');
                rerender();
            }, 'Restaurar');
        }).catch(() => toast('El archivo no es un respaldo válido de Mesa Gourmet.', 'error'));
    },
    'adm-reset': () => confirmDialog('¿Borrar todo y volver a los datos de ejemplo?', () => {
        resetDemoData();
        toast('Datos de ejemplo restaurados');
        rerender();
    }, 'Borrar todo')
});
