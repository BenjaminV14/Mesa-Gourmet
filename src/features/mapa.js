// Mapa de Talca con los locales y la cartelera de eventos.
// Arreglos respecto a la versión anterior:
// - arrastrar el mapa ya no cambia de pestaña (el gesto de deslizar chocaba con mover el mapa)
// - "Ver en el mapa" desde la ficha ahora muestra el local en el mapa, en vez de volver a abrir la ficha
// - los colores y el filtro "Abiertos" usan el horario real; los destacados llevan estrella
// - se muestra la ubicación del usuario y una ficha rápida al tocar un local
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { state, isLoggedIn, TALCA_CENTER } from '../state.js';
import { db, getLocal } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { estadoBadge, emptyState } from '../ui/cards.js';
import { showToast } from '../ui/feedback.js';
import { esc, safeUrl } from '../utils/html.js';
import { estadoHorario, estaAbierto, formatFechaEvento } from '../utils/time.js';
import { formatDistance } from '../utils/geo.js';
import { isSponsored, distanceTo } from './sponsors.js';
import { search } from './search.js';
import { requireAccount } from './auth.js';
import { track } from '../services/analytics.js';
import { addBaseLayer } from '../services/tiles.js';
import { notaActual, dietaLocal } from '../data/metrics.js';

let map = null;
let markersLayer = null;
let userMarker = null;
let currentFilter = 'todos';

const ESTADO_COLOR = { abierto: '#10b981', 'cierra-pronto': '#f59e0b', 'abre-pronto': '#3b82f6', cerrado: '#ef4444' };

export function renderMapa() {
    const main = document.getElementById('mainContent');
    main.innerHTML = `
        <div class="section-head">
            <h2 class="section-title">Explora Talca</h2>
            <div class="map-switch-container" role="tablist">
                <button class="map-switch-btn active" data-action="map-pane" data-pane="map" role="tab">🗺️ Mapa</button>
                <button class="map-switch-btn" data-action="map-pane" data-pane="events" role="tab">📅 Cartelera</button>
            </div>
        </div>
        <div id="mapPane">
            ${state.query ? `<button class="filter-chip-active" data-action="clear-search">Buscando "${esc(state.query)}" ✕</button>` : ''}
            <div class="map-filters">
                ${[['todos', 'Todos'], ['abiertos', 'Abiertos ahora'], ['destacados', '★ Destacados'], ['vegano', '🌱 Vegano'], ['vegetariano', '🥬 Vegetariano']]
                    .map(([key, label]) => `<button class="map-filter-btn ${key === currentFilter ? 'active' : ''}" data-action="map-filter" data-filter="${key}">${label}</button>`).join('')}
            </div>
            <div class="map-wrap">
                <div id="talcaMap" class="talca-map" aria-label="Mapa de locales"></div>
                <button class="map-locate-btn" data-action="map-locate" aria-label="Centrar en mi ubicación" title="Mi ubicación">📍</button>
                <button class="map-locate-btn map-talca-btn" data-action="map-talca" aria-label="Volver a Talca" title="Volver a Talca">🏙️</button>
                <div id="mapPreview" class="map-preview" hidden></div>
            </div>
            <div class="map-legend">
                <span><i style="background:${ESTADO_COLOR.abierto}"></i>Abierto</span>
                <span><i style="background:${ESTADO_COLOR['cierra-pronto']}"></i>Cierra pronto</span>
                <span><i style="background:${ESTADO_COLOR['abre-pronto']}"></i>Abre pronto</span>
                <span><i style="background:${ESTADO_COLOR.cerrado}"></i>Cerrado</span>
                <span>★ Destacado</span>
            </div>
        </div>
        <div id="eventsPane" hidden></div>
    `;
    requestAnimationFrame(initMap);
}

export function destroyMap() {
    if (map) {
        map.remove();
        map = null;
        markersLayer = null;
        userMarker = null;
    }
}

function initMap() {
    const el = document.getElementById('talcaMap');
    if (!el) return;
    destroyMap();
    // Talca primero, pero se puede alejar para ver todo Chile y el mundo
    map = L.map(el, { zoomControl: true, attributionControl: true, worldCopyJump: true }).setView([TALCA_CENTER.lat, TALCA_CENTER.lng], 14);
    addBaseLayer(map);
    markersLayer = L.layerGroup().addTo(map);
    map.on('click', () => hidePreview());
    drawMarkers(false);
    drawUserMarker();
    // Leaflet necesita recalcular el tamaño cuando el contenedor termina de mostrarse
    setTimeout(() => map && map.invalidateSize(), 150);
}

function visibleLocales() {
    const base = state.query ? search(state.query).locales.map(r => r.local) : db.locales;
    return base.filter(local => {
        if (currentFilter === 'abiertos') return estaAbierto(local);
        if (currentFilter === 'destacados') return isSponsored(local);
        if (currentFilter === 'vegano' || currentFilter === 'vegetariano') return dietaLocal(local, currentFilter).cantidad > 0;
        return true;
    });
}

function markerIcon(local) {
    const estado = estadoHorario(local).codigo;
    const color = ESTADO_COLOR[estado];
    const sponsored = isSponsored(local);
    return L.divIcon({
        className: 'mg-marker-wrap',
        html: sponsored
            ? `<span class="mg-marker mg-marker-star" style="--c:${color}">★</span>`
            : `<span class="mg-marker" style="--c:${color}"></span>`,
        iconSize: sponsored ? [34, 34] : [22, 22],
        iconAnchor: sponsored ? [17, 17] : [11, 11]
    });
}

function drawMarkers(fit = false) {
    if (!map || !markersLayer) return;
    markersLayer.clearLayers();
    const locales = visibleLocales();
    locales.forEach(local => {
        const marker = L.marker([local.lat, local.lng], {
            icon: markerIcon(local),
            title: local.nombre,
            zIndexOffset: isSponsored(local) ? 1000 : 0,
            keyboard: true
        });
        marker.on('click', e => {
            L.DomEvent.stopPropagation(e);
            showPreview(local.id);
        });
        marker.addTo(markersLayer);
    });
    if (fit && locales.length) {
        const bounds = L.latLngBounds(locales.map(l => [l.lat, l.lng]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
    if (!locales.length) showToast('Ningún local coincide con este filtro.', 2000);
}

function drawUserMarker() {
    if (!map || !state.hasRealLocation) return;
    if (userMarker) userMarker.remove();
    userMarker = L.marker([state.userLocation.lat, state.userLocation.lng], {
        icon: L.divIcon({ className: 'mg-marker-wrap', html: '<span class="mg-user-dot"></span>', iconSize: [18, 18], iconAnchor: [9, 9] }),
        title: 'Tu ubicación',
        interactive: false
    }).addTo(map);
}

function showPreview(localId) {
    const local = getLocal(localId);
    const box = document.getElementById('mapPreview');
    if (!local || !box) return;
    track('mapa_ver_local', { localId, destacado: isSponsored(local) });
    const destino = `${local.lat},${local.lng}`;
    box.innerHTML = `
        <button class="map-preview-close" data-action="map-preview-close" aria-label="Cerrar">✕</button>
        <img src="${esc(safeUrl(local.imagen))}" alt="">
        <div class="map-preview-info">
            <h3>${esc(local.nombre)} ${isSponsored(local) ? '<span class="badge-sponsored">★ Destacado</span>' : ''}</h3>
            <p>${estadoBadge(local)} ${esc(estadoHorario(local).detalle)}</p>
            <p>${notaActual(local.id).total ? notaActual(local.id).total.toFixed(1) + ' ★ · ' : ''}${esc(local.tipo)} · ${esc(formatDistance(distanceTo(local)))}</p>
            <div class="map-preview-actions">
                <button class="btn btn-primary" data-action="open-local" data-id="${local.id}">Ver ficha</button>
                <a class="btn btn-outline" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destino)}" target="_blank" rel="noopener">Cómo llegar</a>
            </div>
        </div>
    `;
    box.hidden = false;
}

function hidePreview() {
    const box = document.getElementById('mapPreview');
    if (box) box.hidden = true;
}

// Llamado desde la ficha del local ("Ver en el mapa")
export function focusLocalOnMap(localId) {
    const local = getLocal(localId);
    if (!local || !map) return;
    currentFilter = 'todos';
    document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.toggle('active', b.dataset.filter === 'todos'));
    drawMarkers();
    map.setView([local.lat, local.lng], 17);
    showPreview(local.id);
}

// =================== CARTELERA ===================

function renderEventsPane() {
    const pane = document.getElementById('eventsPane');
    const ahora = Date.now();
    const hoy = new Date().getDay();
    const eventos = db.locales.flatMap(local => (local.eventos || []).map(e => ({ ...e, local })))
        .filter(e => new Date(e.inicio).getTime() > ahora - 3 * 3600000)
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    const promosHoy = db.locales.flatMap(local => (local.promociones || []).filter(p => (p.dias || []).includes(hoy)).map(p => ({ ...p, local })));

    pane.innerHTML = `
        <h3 class="subsection-title">Próximos eventos</h3>
        ${eventos.length ? eventos.map(e => `
            <button class="event-card-v2 is-clickable" data-action="open-local" data-id="${e.local.id}" data-tab="eventos">
                <span class="event-date">${esc(formatFechaEvento(e.inicio))}</span>
                <h4>${esc(e.titulo)}</h4>
                <p>${esc(e.local.nombre)}${e.descripcion ? ` · ${esc(e.descripcion)}` : ''}</p>
            </button>`).join('') : emptyState('📅', 'No hay eventos próximos.')}
        <h3 class="subsection-title">Promociones de hoy</h3>
        ${promosHoy.length ? promosHoy.map(p => `
            <button class="promo-card is-clickable" data-action="open-local" data-id="${p.local.id}" data-tab="eventos">
                <span class="promo-icon">${esc(p.icono || '🏷️')}</span>
                <div><h4>${esc(p.descripcion)}</h4><p>${esc(p.local.nombre)} · ${esc(p.horaInicio)}–${esc(p.horaFin)} h</p></div>
            </button>`).join('') : emptyState('🏷️', 'Hoy no hay promociones.')}
    `;
}

function setPane(pane) {
    if (pane === 'events' && !isLoggedIn()) {
        requireAccount('ver la cartelera de eventos y promociones');
        return;
    }
    document.querySelectorAll('.map-switch-btn').forEach(b => b.classList.toggle('active', b.dataset.pane === pane));
    document.getElementById('mapPane').hidden = pane !== 'map';
    document.getElementById('eventsPane').hidden = pane !== 'events';
    if (pane === 'events') renderEventsPane();
    else setTimeout(() => map && map.invalidateSize(), 50);
}

registerActions({
    'map-pane': el => setPane(el.dataset.pane),
    'map-filter': el => {
        currentFilter = el.dataset.filter;
        document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.toggle('active', b === el));
        hidePreview();
        drawMarkers(true);
    },
    'map-preview-close': () => hidePreview(),
    'map-talca': () => map && map.setView([TALCA_CENTER.lat, TALCA_CENTER.lng], 14),
    'map-locate': () => {
        if (!navigator.geolocation) return showToast('Tu dispositivo no permite obtener la ubicación.');
        navigator.geolocation.getCurrentPosition(pos => {
            state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            state.hasRealLocation = true;
            drawUserMarker();
            map && map.setView([state.userLocation.lat, state.userLocation.lng], 15);
        }, () => showToast('No pudimos acceder a tu ubicación. Revisa los permisos del navegador.'));
    }
});
