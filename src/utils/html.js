// Escapa texto antes de insertarlo en HTML. Usarlo con todo dato que venga de usuarios o de la base de datos.
export function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Solo permite enlaces http(s); evita "javascript:" y similares en href/src
export function safeUrl(url) {
    try {
        const parsed = new URL(url, window.location.href);
        return ['http:', 'https:', 'data:', 'blob:'].includes(parsed.protocol) ? parsed.href : '';
    } catch {
        return '';
    }
}

export function formatPrice(value) {
    return `$${Number(value || 0).toLocaleString('es-CL')}`;
}

export function initials(name) {
    return String(name || '?').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase();
}

/** Contenido del círculo de avatar: la foto de perfil si existe, si no las iniciales */
export function avatarContent(usuario) {
    const url = usuario?.avatarUrl;
    return url && /^(data:image\/|https:)/.test(url)
        ? `<img src="${esc(url)}" alt="">`
        : esc(usuario?.avatar || initials(usuario?.nombre || '?'));
}
