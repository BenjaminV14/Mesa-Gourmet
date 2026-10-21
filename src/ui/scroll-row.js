// Fila de botones que se desliza hacia los lados, con flechas ‹ › para desplazarla
// (filtros del mapa, pestañas del Top 50). Las flechas se ocultan cuando no hay más hacia ese lado.
import { registerActions } from './actions.js';

export function scrollRow(contenido, { className = '', label = '' } = {}) {
    return `
    <div class="scroll-row">
        <button type="button" class="scroll-arrow left" data-action="row-scroll" data-dir="-1" aria-label="Ver anteriores" hidden>‹</button>
        <div class="scroll-row-track ${className}" ${label ? `role="tablist" aria-label="${label}"` : ''}>${contenido}</div>
        <button type="button" class="scroll-arrow right" data-action="row-scroll" data-dir="1" aria-label="Ver más" hidden>›</button>
    </div>`;
}

function actualizar(row) {
    const track = row.querySelector('.scroll-row-track');
    if (!track) return;
    const max = track.scrollWidth - track.clientWidth;
    row.querySelector('.scroll-arrow.left').hidden = track.scrollLeft <= 4;
    row.querySelector('.scroll-arrow.right').hidden = track.scrollLeft >= max - 4;
}

/** Muestra u oculta las flechas según cuánto se puede desplazar cada fila */
export function actualizarFlechas(root = document) {
    root.querySelectorAll('.scroll-row').forEach(actualizar);
}

document.addEventListener('scroll', e => {
    const track = e.target instanceof Element && e.target.closest?.('.scroll-row-track');
    if (track) actualizar(track.parentElement);
}, true);
window.addEventListener('resize', () => actualizarFlechas());

registerActions({
    'row-scroll': el => {
        const track = el.parentElement.querySelector('.scroll-row-track');
        track.scrollBy({ left: Number(el.dataset.dir) * track.clientWidth * 0.7, behavior: 'smooth' });
    }
});
