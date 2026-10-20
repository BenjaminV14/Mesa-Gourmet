// Niveles, misiones e insignias del comensal, calculados a partir de sus reseñas.
// Las insignias están ocultas: se desbloquean al probar 5 platos del mismo tipo en locales distintos
// (por ejemplo 5 completos en 5 lugares). Solo la del producto favorito elegido al inicio se ve desde el principio.
import { state, isLoggedIn } from '../state.js';
import { db } from '../data/store.js';
import { CATEGORIAS, categoriasDePlato, nombreProducto, getCategoria } from '../data/categorias.js';
import { esc } from '../utils/html.js';
import { registerActions } from '../ui/actions.js';

const LEVEL_NAMES = ['Sin nivel', 'Novicio Gourmet', 'Explorador Gastronómico', 'Crítico Consagrado', 'Sommelier Talquino', 'Embajador Gourmet', 'Maestro Culinario'];
export const LOCALES_PARA_INSIGNIA = 5;

export function userReviews() {
    if (!isLoggedIn()) return [];
    return db.reviews.filter(r => r.usuario.id === state.user.id && r.estado !== 'rechazada');
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

/** Locales distintos donde el usuario probó cada tipo de comida */
function localesPorCategoria() {
    const mapa = {};
    userReviews().forEach(r => (r.productos || []).forEach(p => {
        categoriasDePlato(nombreProducto(p)).forEach(cat => {
            (mapa[cat] = mapa[cat] || new Set()).add(r.localId);
        });
    }));
    return mapa;
}

/**
 * Insignias: visibles = desbloqueadas + la del producto favorito; el resto quedan ocultas.
 */
export function computeLogros() {
    const mapa = localesPorCategoria();
    const favorita = state.user?.productoFavorito;
    return CATEGORIAS.map(c => {
        const count = (mapa[c.id] || new Set()).size;
        const unlocked = count >= LOCALES_PARA_INSIGNIA;
        return {
            id: c.id, emoji: c.emoji, titulo: c.insignia, categoria: c.nombre,
            descripcion: `Prueba ${c.nombre.toLowerCase()} en ${LOCALES_PARA_INSIGNIA} locales distintos`,
            count, required: LOCALES_PARA_INSIGNIA, unlocked,
            visible: unlocked || c.id === favorita
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
    const categorias = Object.keys(localesPorCategoria()).length;
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
        { icono: '🌎', titulo: 'Paladar curioso', descripcion: 'Prueba 5 tipos de comida distintos.', progreso: categorias, total: 5, recompensa: 'Título "Paladar curioso"' },
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
    const c = getCategoria(state.user?.productoFavorito);
    return c ? `${c.emoji} ${c.nombre}` : null;
}

registerActions({
    'close-levelup': () => document.getElementById('levelUpModal')?.remove()
});
