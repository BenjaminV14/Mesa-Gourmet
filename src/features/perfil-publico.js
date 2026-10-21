// Perfil público de un comensal: se abre al tocar su nombre o su foto en una reseña.
// Muestra su nivel, estadísticas, insignias desbloqueadas, si es cliente VIP de algún local y sus reseñas.
import { state, isLoggedIn } from '../state.js';
import { publishedReviews } from '../data/store.js';
import { vipDeUsuario } from '../data/metrics.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet } from '../ui/feedback.js';
import { esc, avatarContent } from '../utils/html.js';
import { calculateLevel, levelName, computeLogros } from './gamification.js';
import { reviewCard } from './review-card.js';

export function openPublicProfile(userId) {
    if (isLoggedIn() && userId === state.user.id) {
        // El propio perfil se abre en su pestaña, con la configuración
        closeSheet('publicProfile');
        import('./navigation.js').then(m => m.switchTab('perfil'));
        return;
    }
    const resenas = publishedReviews().filter(r => r.usuario.id === userId)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    const u = resenas[0]?.usuario;
    if (!u) return;
    const nivel = calculateLevel(resenas.length);
    const locales = new Set(resenas.map(r => r.localId)).size;
    const fotos = resenas.reduce((n, r) => n + (r.fotos || []).length, 0);
    const likes = resenas.reduce((n, r) => n + (r.likes || 0) + (r.fotos || []).reduce((m, f) => m + (f.likes || 0), 0), 0);
    const insignias = computeLogros(userId).filter(l => l.unlocked);
    const vip = vipDeUsuario(userId);
    const sigo = isLoggedIn() && state.user.siguiendo.includes(userId);

    openSheet({
        id: 'publicProfile',
        title: '',
        body: `
        <div class="public-profile">
            <div class="public-head">
                <span class="profile-avatar-large">${avatarContent(u)}</span>
                <div class="public-names">
                    <h2>${esc(u.nombre)}</h2>
                    <p>@${esc(u.username || '')}</p>
                    <span class="profile-level-pill">⭐ Nivel ${nivel} · ${esc(levelName(nivel))}</span>
                </div>
            </div>
            <button class="follow-btn public-follow ${sigo ? 'is-on' : ''}" data-action="follow-user" data-user="${esc(userId)}">${sigo ? 'Siguiendo' : 'Seguir'}</button>
            <div class="profile-stats">
                <div><b>${resenas.length}</b><span>Reseñas</span></div>
                <div><b>${locales}</b><span>Locales</span></div>
                <div><b>${fotos}</b><span>Fotos</span></div>
                <div><b>${likes}</b><span>Me gusta</span></div>
            </div>
            ${vip.length || insignias.length ? `<div class="profile-badges">
                ${vip.map(l => `<button class="badge-chip is-vip" data-action="open-local" data-id="${l.id}">👑 Cliente VIP de ${esc(l.nombre)}</button>`).join('')}
                ${insignias.map(l => `<span class="badge-chip">${l.emoji} ${esc(l.titulo)}</span>`).join('')}
            </div>` : ''}
            <h3 class="section-title">Reseñas de ${esc(u.nombre.split(' ')[0])}</h3>
            <div class="review-list">${resenas.map(r => reviewCard(r)).join('')}</div>
        </div>`,
        actions: [{ label: 'Cerrar', action: 'close-sheet', variant: 'ghost' }]
    });
}

registerActions({
    'open-user': el => openPublicProfile(el.dataset.user)
});
