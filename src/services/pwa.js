// App instalable (PWA): registra el service worker y muestra el botón "Instalar la app"
import { registerActions } from '../ui/actions.js';
import { showToast } from '../ui/feedback.js';
import { track } from './analytics.js';

let deferredPrompt = null;

export function canInstall() {
    return !!deferredPrompt;
}

function updateInstallButtons() {
    document.querySelectorAll('[data-action="install-app"]').forEach(btn => { btn.hidden = !deferredPrompt; });
}

export function setupPwa() {
    // Solo en la versión publicada (https o localhost compilado); no en "npm run dev" ni abriendo el archivo
    if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol.startsWith('http')) {
        navigator.serviceWorker.register('/sw.js').catch(err => console.warn('No se pudo activar el modo sin conexión:', err));
    }
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredPrompt = event;
        updateInstallButtons();
    });
    window.addEventListener('appinstalled', () => {
        deferredPrompt = null;
        updateInstallButtons();
        track('app_instalada');
        showToast('¡Mesa Gourmet quedó instalada!');
    });
}

registerActions({
    'install-app': async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        track('instalar_app', { resultado: outcome });
        deferredPrompt = null;
        updateInstallButtons();
    }
});
