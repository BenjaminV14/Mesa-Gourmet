// Estadísticas de uso. Mientras no haya una cuenta de analítica conectada, los eventos solo se
// guardan localmente para pruebas. Con PostHog (ver docs/HOSTING.md) se envían a su panel.
const ANALYTICS_KEY = import.meta.env?.VITE_POSTHOG_KEY;
const buffer = [];

export function track(event, props = {}) {
    const entry = { event, props, at: new Date().toISOString() };
    if (ANALYTICS_KEY && window.posthog) {
        window.posthog.capture(event, props);
        return;
    }
    buffer.push(entry);
    if (buffer.length > 200) buffer.shift();
    if (import.meta.env?.DEV) console.debug('[analytics]', event, props);
}

export function trackedEvents() {
    return [...buffer];
}
