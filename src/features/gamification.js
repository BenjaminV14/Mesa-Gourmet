// Niveles y logros del comensal, calculados a partir de sus reseñas
import { state, isLoggedIn } from '../state.js';
import { db } from '../data/store.js';
import { logrosDefinitions } from '../data/seed.js';
import { normalize } from '../utils/text.js';
import { esc } from '../utils/html.js';
import { registerActions } from '../ui/actions.js';

const LEVEL_NAMES = ['Sin nivel', 'Novicio Gourmet', 'Explorador Gastronómico', 'Crítico Consagrado', 'Sommelier Talquino', 'Embajador Gourmet', 'Maestro Culinario'];

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

export function computeLogros() {
    const counts = {};
    userReviews().forEach(review => {
        (review.productos || []).forEach(prod => {
            const text = normalize(prod);
            logrosDefinitions.forEach(logro => {
                if (logro.keywords.some(kw => text.includes(normalize(kw)))) counts[logro.id] = (counts[logro.id] || 0) + 1;
            });
        });
    });
    return logrosDefinitions.map(l => ({ ...l, count: counts[l.id] || 0, unlocked: (counts[l.id] || 0) >= l.required }));
}

export function checkLevelUp(previousCount) {
    const before = calculateLevel(previousCount);
    const after = calculateLevel(userReviews().length);
    if (after > before) showLevelUpModal(after);
}

function showLevelUpModal(level) {
    document.getElementById('levelUpModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'levelUpModal';
    modal.className = 'level-up-modal';
    modal.innerHTML = `
        <div class="level-up-content" role="dialog" aria-modal="true">
            <div class="level-up-particles">✨🎊✨🎊✨</div>
            <div class="level-up-trophy">🏆</div>
            <h2>¡Subiste de nivel!</h2>
            <div class="level-up-number">Nivel ${level}</div>
            <p class="level-up-name">${esc(levelName(level))}</p>
            <p class="level-up-desc">Tu opinión tiene cada vez más peso en la comunidad gourmet de Talca.</p>
            <button class="level-up-btn" data-action="close-levelup">¡Genial! 🚀</button>
        </div>`;
    document.body.appendChild(modal);
}

registerActions({
    'close-levelup': () => document.getElementById('levelUpModal')?.remove()
});
