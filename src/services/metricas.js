// Métricas de cada local: visitas a su ficha y clics en WhatsApp, llamar, cómo llegar, la carta y sus redes.
// Sirven para los reportes que el administrador le muestra a cada local (cuánta gente le llevó la app).
// No guardan datos personales: solo el local, el tipo de acción, la fecha y, si hay cuenta, quién fue.
import { remoto, supabase } from './supabase.js';
import { db, guardarLocal } from '../data/store.js';
import { state, isLoggedIn } from '../state.js';

const MAXIMO_DEMO = 5000;

export function registrarMetrica(localId, tipo) {
    if (!localId || !tipo) return;
    const usuarioId = isLoggedIn() ? state.user.id : null;
    if (remoto) {
        supabase.from('metricas_locales')
            .insert({ local_id: localId, tipo, usuario_id: /^[0-9a-f-]{36}$/i.test(usuarioId || '') ? usuarioId : null })
            .then(() => {}, () => {});
        return;
    }
    db.metricas = [...(db.metricas || []), { localId, tipo, usuarioId, fecha: new Date().toISOString() }].slice(-MAXIMO_DEMO);
    guardarLocal();
}

// Cualquier enlace o botón con data-metrica="whatsapp" data-local="3" se cuenta solo
document.addEventListener('click', e => {
    const el = e.target.closest?.('[data-metrica]');
    if (el) registrarMetrica(Number(el.dataset.local), el.dataset.metrica);
});
