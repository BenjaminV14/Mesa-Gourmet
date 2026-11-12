// Métricas de cada local: visitas a su ficha y clics en WhatsApp, llamar, cómo llegar, la carta y sus redes.
// Sirven para los reportes que el administrador le muestra a cada local (cuánta gente le llevó la app).
// No guardan datos personales: solo el local, el tipo de acción, la fecha y, si hay cuenta, quién fue.
import { remoto, supabase } from './supabase.js';
import { db, guardarLocal } from '../data/store.js';
import { state, isLoggedIn } from '../state.js';

const MAXIMO_DEMO = 5000;

// Número al azar que identifica a este navegador (sin datos personales): así cada persona sin cuenta
// cuenta una sola vez por local cada 30 minutos (ver limitar_metricas en actualizacion-6.sql)
function visitante() {
    try {
        let id = localStorage.getItem('mg:visitante');
        if (!id) { id = crypto.randomUUID(); localStorage.setItem('mg:visitante', id); }
        return id;
    } catch {
        return null;
    }
}

export function registrarMetrica(localId, tipo) {
    if (!localId || !tipo) return;
    const usuarioId = isLoggedIn() ? state.user.id : null;
    if (remoto) {
        const fila = { local_id: localId, tipo, usuario_id: /^[0-9a-f-]{36}$/i.test(usuarioId || '') ? usuarioId : null };
        supabase.from('metricas_locales').insert({ ...fila, visitante: visitante() })
            // Si la base aún no tiene la columna "visitante" (actualizacion-6.sql), se registra sin ella
            .then(({ error }) => { if (error && /visitante|column|PGRST204/i.test(`${error.code} ${error.message}`)) return supabase.from('metricas_locales').insert(fila); })
            .then(() => {}, () => {});
        return;
    }
    const quien = usuarioId || visitante();
    const hace30 = Date.now() - 30 * 60000;
    if ((db.metricas || []).some(m => m.localId === localId && m.tipo === tipo && (m.usuarioId || m.visitante) === quien && new Date(m.fecha).getTime() > hace30)) return;
    db.metricas = [...(db.metricas || []), { localId, tipo, usuarioId, visitante: usuarioId ? null : quien, fecha: new Date().toISOString() }].slice(-MAXIMO_DEMO);
    guardarLocal();
}

// Cualquier enlace o botón con data-metrica="whatsapp" data-local="3" se cuenta solo
document.addEventListener('click', e => {
    const el = e.target.closest?.('[data-metrica]');
    if (el) registrarMetrica(Number(el.dataset.local), el.dataset.metrica);
});
