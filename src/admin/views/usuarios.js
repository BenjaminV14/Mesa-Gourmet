// Usuarios y respaldo de datos
import { db, persist, resetDemoData } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { normalize } from '../../utils/text.js';
import { timeAgo } from '../../utils/time.js';
import { toast, confirmDialog, emptyRow } from '../ui.js';
import { remoto } from '../../services/supabase.js';

let rerender = () => {};
let mostrar = 10;
let busqueda = '';
export function setUsuariosRerender(fn) { rerender = fn; }

function listaUsuarios() {
    const porUsuario = new Map();
    // En línea están todas las cuentas registradas; en la demo, quienes escribieron reseñas
    (db.usuarios || []).forEach(u => porUsuario.set(u.id, { ...u, resenas: 0, ultima: u.creado, reportes: 0 }));
    db.reviews.forEach(r => {
        const u = porUsuario.get(r.usuario.id) || { ...r.usuario, resenas: 0, ultima: r.fecha, reportes: 0 };
        u.resenas++;
        if (!u.ultima || new Date(r.fecha) > new Date(u.ultima)) u.ultima = r.fecha;
        porUsuario.set(r.usuario.id, u);
    });
    db.reports.forEach(rep => {
        if (rep.tipo === 'resena') {
            const r = db.reviews.find(x => String(x.id) === String(rep.reviewId));
            if (r && porUsuario.has(r.usuario.id)) porUsuario.get(r.usuario.id).reportes++;
        }
    });
    return [...porUsuario.values()].sort((a, b) => b.resenas - a.resenas || new Date(b.ultima || 0) - new Date(a.ultima || 0));
}

function filas(usuarios) {
    const q = normalize(busqueda);
    const lista = q ? usuarios.filter(u => normalize(`${u.nombre} ${u.username || ''}`).includes(q)) : usuarios;
    if (!lista.length) return emptyRow(q ? 'Nadie coincide con la búsqueda.' : 'Sin usuarios todavía.');
    const visibles = lista.slice(0, mostrar);
    return `
        <div class="adm-table-wrap"><table class="adm-table">
            <thead><tr><th>Nombre</th><th>Reseñas</th><th>${remoto ? 'Registro / actividad' : 'Última actividad'}</th><th>Veces reportado</th></tr></thead>
            <tbody>${visibles.map(u => `
                <tr><td><b>${esc(u.nombre || 'Sin nombre')}</b>${u.rol === 'admin' ? ' <span class="adm-pill info">Admin</span>' : ''}<br><small class="adm-muted-cell">${u.username ? `@${esc(u.username)}` : esc(u.id)}</small></td>
                <td>${u.resenas}</td><td>${u.ultima ? esc(timeAgo(u.ultima)) : '—'}</td><td>${u.reportes}</td></tr>`).join('')}
            </tbody>
        </table></div>
        ${lista.length > mostrar ? `<div class="adm-form-actions"><span class="adm-muted-cell">Mostrando ${visibles.length} de ${lista.length}</span>
            <button class="adm-btn" data-action="adm-users-more">Ver más</button></div>` : ''}`;
}

export function renderUsuarios() {
    const usuarios = listaUsuarios();
    const registrados = remoto ? (db.usuarios || []).length : usuarios.length;
    return `
        <div class="adm-head">
            <h1 class="adm-title">Usuarios</h1>
            <div class="adm-kpi adm-kpi-inline"><span>${remoto ? 'Registrados' : 'Usuarios'}</span><b>${registrados}</b></div>
        </div>
        ${remoto ? '' : '<p class="adm-help">En esta versión de prueba solo aparecen quienes escribieron reseñas en este navegador. En línea verás todas las cuentas registradas.</p>'}
        <section class="adm-card">
            <input class="adm-search" type="search" placeholder="Buscar por nombre o @usuario…" value="${esc(busqueda)}" data-input="adm-users-buscar" aria-label="Buscar usuario">
            <div id="admUsersLista">${filas(usuarios)}</div>
        </section>

        <h1 class="adm-title">Respaldo de datos</h1>
        <section class="adm-card">
            <p class="adm-help">Descarga una copia de todos los datos (locales, cartas, reseñas, videos, reportes) o restaura una copia anterior.</p>
            <div class="adm-row-actions">
                <button class="adm-btn primary" data-action="adm-export">Descargar respaldo</button>
                ${remoto ? '' : `<label class="adm-btn">Restaurar respaldo<input type="file" accept="application/json" data-change="adm-import" hidden></label>
                <button class="adm-btn danger" data-action="adm-reset">Volver a los datos de ejemplo</button>`}
            </div>
        </section>
    `;
}

registerActions({
    'adm-users-more': () => { mostrar += 10; document.getElementById('admUsersLista').innerHTML = filas(listaUsuarios()); },
    'adm-users-buscar': el => {
        busqueda = el.value;
        mostrar = 10;
        document.getElementById('admUsersLista').innerHTML = filas(listaUsuarios());
    },
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
