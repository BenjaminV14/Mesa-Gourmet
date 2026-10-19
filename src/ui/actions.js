// Delegación de eventos: los botones declaran data-action="nombre" y aquí se ejecuta la función registrada.
// Evita los onclick="..." dentro del HTML (más ordenado y compatible con una política de seguridad estricta).
const handlers = {};

export function registerActions(map) {
    Object.assign(handlers, map);
}

function dispatch(event) {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const handler = handlers[el.dataset.action];
    if (!handler) return;
    if (el.tagName === 'A' && el.getAttribute('href') === '#') event.preventDefault();
    handler(el, event);
}

document.addEventListener('click', dispatch);

// Para inputs que reaccionan al escribir o cambiar (data-input="nombre")
document.addEventListener('input', event => {
    const el = event.target.closest('[data-input]');
    if (el && handlers[el.dataset.input]) handlers[el.dataset.input](el, event);
});

document.addEventListener('change', event => {
    const el = event.target.closest('[data-change]');
    if (el && handlers[el.dataset.change]) handlers[el.dataset.change](el, event);
});
