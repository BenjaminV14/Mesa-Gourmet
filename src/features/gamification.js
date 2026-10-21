// Niveles, misiones e insignias del comensal, calculados a partir de sus reseñas.
// Las insignias son por tipo de plato (completo, pastel de choclo, ceviche, tártaro...). Un tipo tiene insignia
// cuando al menos 5 locales lo ofrecen en su carta, y se desbloquea al probarlo en 5 locales distintos.
// Están ocultas: solo la de la comida favorita elegida al inicio se ve desde el principio.
import { state, isLoggedIn } from '../state.js';
import { db } from '../data/store.js';
import { nombreProducto } from '../data/categorias.js';
import { TIPOS_PLATO, LOCALES_CON_TIPO, tipoDePlato, getTipo } from '../data/tipos-plato.js';
import { esc } from '../utils/html.js';
import { registerActions } from '../ui/actions.js';

const LEVEL_NAMES = ['Sin nivel', 'Novicio Gourmet', 'Explorador Gastronómico', 'Crítico Consagrado', 'Sommelier Talquino', 'Embajador Gourmet', 'Maestro Culinario'];
export const LOCALES_PARA_INSIGNIA = 5;

/** Reseñas de una persona (por defecto, la que usa la app) */
export function userReviews(userId = isLoggedIn() ? state.user.id : null) {
    if (!userId) return [];
    return db.reviews.filter(r => r.usuario.id === userId && r.estado !== 'rechazada');
}

export function calculateLevel(count) {
    if (count < 1) return 0;
    if (count < 3) return 1;
    if (count < 7) return 2;
    if (count < 10) return 3;
    return Math.floor(count / 10) + 3;
}

export function requiredForLevel(level) {
    if (level <= 0) return 0;
    return [0, 1, 3, 7][level] ?? 10 * (level - 3);
}

export function levelName(level) {
    return LEVEL_NAMES[level] || `Leyenda Gourmet Nv.${level}`;
}

export function levelProgress() {
    const count = userReviews().length;
    const level = calculateLevel(count);
    const current = requiredForLevel(level);
    const next = requiredForLevel(level + 1);
    const progress = next > current ? Math.min(100, Math.round(((count - current) / (next - current)) * 100)) : 100;
    return { count, level, next, progress };
}

export function visitedLocalesCount() {
    return new Set(userReviews().map(r => r.localId)).size;
}

/** Locales distintos donde el usuario probó cada tipo de plato */
function localesPorTipo(userId) {
    const mapa = {};
    userReviews(userId).forEach(r => (r.productos || []).forEach(p => {
        const tipo = tipoDePlato(nombreProducto(p));
        if (tipo) (mapa[tipo] = mapa[tipo] || new Set()).add(r.localId);
    }));
    return mapa;
}

/** Cuántos locales ofrecen cada tipo de plato en su carta */
export function localesQueOfrecen() {
    const mapa = {};
    db.locales.forEach(l => (l.menu || []).forEach(m => {
        const tipo = tipoDePlato(m.nombre);
        if (tipo) (mapa[tipo] = mapa[tipo] || new Set()).add(l.id);
    }));
    return mapa;
}

/**
 * Insignias: existen para los tipos de plato que ofrecen 5 o más locales (más la comida favorita).
 * Visibles = desbloqueadas + la favorita; el resto quedan ocultas.
 */
export function computeLogros(userId) {
    const probados = localesPorTipo(userId);
    const ofrecen = localesQueOfrecen();
    // La comida favorita solo se conoce de la cuenta propia
    const favorita = userId && userId !== state.user?.id ? null : getTipo(state.user?.productoFavorito)?.id;
    return TIPOS_PLATO
        .filter(t => (ofrecen[t.id]?.size || 0) >= LOCALES_CON_TIPO || t.id === favorita)
        .map(t => {
            const count = (probados[t.id] || new Set()).size;
            const unlocked = count >= LOCALES_PARA_INSIGNIA;
            return {
                id: t.id, emoji: t.emoji, titulo: t.insignia, categoria: t.nombre,
                descripcion: `Prueba ${t.nombre.toLowerCase()} en ${LOCALES_PARA_INSIGNIA} locales distintos`,
                count, required: LOCALES_PARA_INSIGNIA, unlocked,
                visible: unlocked || t.id === favorita
            };
        });
}

/** Misiones con su progreso */
export function computeMisiones() {
    const reviews = userReviews();
    const visitados = visitedLocalesCount();
    const fotos = reviews.flatMap(r => r.fotos || []);
    const maxLikesFoto = Math.max(0, ...fotos.map(f => f.likes || 0));
    const enPromo = reviews.filter(r => r.enPromocion).length;
    const categorias = Object.keys(localesPorTipo()).length;
    const temprano = reviews.filter(r => new Date(r.fecha).getHours() < 11).length;
    const ahora = new Date();
    const visitasMes = {};
    reviews.filter(r => { const d = new Date(r.fecha); return d.getMonth() === ahora.getMonth() && d.getFullYear() === ahora.getFullYear(); })
        .forEach(r => { visitasMes[r.localId] = (visitasMes[r.localId] || 0) + 1; });
    const maxVisitasMes = Math.max(0, ...Object.values(visitasMes));
    const videos = db.videos.filter(v => v.usuarioId === state.user?.id && v.estado === 'aprobado').length;

    return [
        { icono: '🍽️', titulo: 'Primer bocado', descripcion: 'Escribe tu primera reseña.', progreso: reviews.length, total: 1, recompensa: 'Nivel 1' },
        { icono: '🧭', titulo: 'Explorador gourmet', descripcion: 'Reseña 3 locales distintos de Talca.', progreso: visitados, total: 3, recompensa: 'Medalla de explorador' },
        { icono: '🏷️', titulo: 'Cazador de promociones', descripcion: 'Visita un local mientras tiene una promoción o está destacado.', progreso: enPromo, total: 1, recompensa: 'Insignia cazador' },
        { icono: '📸', titulo: 'Fotógrafo gastronómico', descripcion: 'Sube 5 fotos de platos en tus reseñas.', progreso: fotos.length, total: 5, recompensa: 'Marco dorado en tus fotos' },
        { icono: '⭐', titulo: 'Foto estrella', descripcion: 'Consigue que una de tus fotos llegue a 10 "me gusta".', progreso: maxLikesFoto, total: 10, recompensa: 'Tu foto puede llegar a la carta' },
        { icono: '🌎', titulo: 'Paladar curioso', descripcion: 'Prueba 5 tipos de plato distintos (completo, ceviche, pastel de choclo...).', progreso: categorias, total: 5, recompensa: 'Título "Paladar curioso"' },
        { icono: '🔁', titulo: 'Cliente fiel', descripcion: 'Visita el mismo local 3 veces en un mes.', progreso: maxVisitasMes, total: 3, recompensa: 'Camino a cliente del mes' },
        { icono: '🌅', titulo: 'Madrugador', descripcion: 'Reseña un desayuno antes de las 11:00.', progreso: temprano, total: 1, recompensa: 'Insignia madrugador' },
        { icono: '🎬', titulo: 'Videasta', descripcion: 'Publica un video evaluando un local.', progreso: videos, total: 1, recompensa: 'Aparecer en el feed de videos' },
        { icono: '🏆', titulo: 'Crítico consagrado', descripcion: 'Reseña 10 locales distintos.', progreso: visitados, total: 10, recompensa: 'Nivel 4 + título' }
    ].map(m => ({ ...m, progreso: Math.min(m.total, m.progreso), completada: m.progreso >= m.total }));
}

export function checkLevelUp(previousCount, previousLogros = null) {
    const before = calculateLevel(previousCount);
    const after = calculateLevel(userReviews().length);
    if (after > before) showModal('🏆', '¡Subiste de nivel!', `Nivel ${after}`, levelName(after), 'Tu opinión tiene cada vez más peso en la comunidad gourmet de Talca.');
    if (previousLogros) {
        const nueva = computeLogros().find(l => l.unlocked && !previousLogros.find(p => p.id === l.id)?.unlocked);
        if (nueva) setTimeout(() => showModal(nueva.emoji, '¡Insignia desbloqueada!', nueva.titulo, nueva.categoria, `Probaste ${nueva.categoria.toLowerCase()} en ${LOCALES_PARA_INSIGNIA} locales distintos.`), after > before ? 600 : 0);
    }
}

function showModal(icon, title, big, name, desc) {
    document.getElementById('levelUpModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'levelUpModal';
    modal.className = 'level-up-modal';
    modal.innerHTML = `
        <div class="level-up-content" role="dialog" aria-modal="true">
            <div class="level-up-particles">✨🎊✨🎊✨</div>
            <div class="level-up-trophy">${icon}</div>
            <h2>${esc(title)}</h2>
            <div class="level-up-number">${esc(big)}</div>
            <p class="level-up-name">${esc(name)}</p>
            <p class="level-up-desc">${esc(desc)}</p>
            <button class="level-up-btn" data-action="close-levelup">¡Genial! 🚀</button>
        </div>`;
    document.body.appendChild(modal);
}

export function favoritoLabel() {
    const t = getTipo(state.user?.productoFavorito);
    return t ? `${t.emoji} ${t.nombre}` : null;
}

registerActions({
    'close-levelup': () => document.getElementById('levelUpModal')?.remove()
});
