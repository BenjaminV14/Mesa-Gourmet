// Service worker de Mesa Gourmet: permite instalar la app y abrirla con mala señal.
// - Páginas: primero la red; si no hay conexión, la última versión guardada.
// - Archivos de la app (/assets/, /icons/): primero lo guardado, porque su nombre cambia en cada versión.
// No guarda nada de la base de datos ni de otros sitios.
const CACHE = 'mg-v3';
// Rutas relativas a la carpeta del service worker (funciona en la raíz del dominio o en una subcarpeta)
const BASE = new URL('./', self.location).pathname;
const SHELL = ['', 'index.html', 'manifest.webmanifest', 'icons/icon-192.png'].map(p => BASE + p);

self.addEventListener('install', event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    const { request } = event;
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.origin !== self.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    const copy = response.clone();
                    caches.open(CACHE).then(cache => cache.put(request, copy));
                    return response;
                })
                .catch(() => caches.match(request).then(r => r || caches.match(BASE + 'index.html')))
        );
        return;
    }

    if (url.pathname.startsWith(BASE + 'assets/') || url.pathname.startsWith(BASE + 'icons/')) {
        event.respondWith(
            caches.match(request).then(cached => cached || fetch(request).then(response => {
                const copy = response.clone();
                caches.open(CACHE).then(cache => cache.put(request, copy));
                return response;
            }))
        );
    }
});
