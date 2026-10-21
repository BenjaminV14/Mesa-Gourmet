// Mapa de ubicaciones (los mismos puntos que ve el usuario): arrastra el punto de cada local hasta su lugar exacto, o elige un local
// y toca el mapa para ponerlo ahí. Cada cambio se guarda al soltar y se puede deshacer.
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, persist, getLocal } from '../../data/store.js';
import { registerActions } from '../../ui/actions.js';
import { esc } from '../../utils/html.js';
import { addBaseLayer, TALCA } from '../../services/tiles.js';
import { toast } from '../ui.js';
import { markerIcon, ESTADO_COLOR } from '../../ui/marcador.js';
import { estadoHorario } from '../../utils/time.js';

let map = null;
let markers = new Map();
let seleccionado = null;
let deshacer = null;

const EN_CENTRO = l => Math.abs(l.lat - TALCA[0]) < 0.0005 && Math.abs(l.lng - TALCA[1]) < 0.0005;

export function renderMapaAdmin() {
    // El mapa se arma después de pintar la página
    setTimeout(initMap, 0);
    return `
        <div class="adm-head">
            <h1 class="adm-title">Ubicaciones en el mapa</h1>
            <button class="adm-btn ghost" data-action="adm-map-talca">🏙️ Volver a Talca</button>
        </div>
        <p class="adm-help">Arrastra el punto de un local hasta su lugar exacto y suéltalo: queda guardado al instante.
        También puedes elegir un local en la lista y tocar el mapa donde corresponde. Acerca el mapa con la rueda del mouse o con dos dedos.</p>
        <div class="map-legend adm-map-legend">
            <span><i style="background:${ESTADO_COLOR.abierto}"></i>Abierto</span>
            <span><i style="background:${ESTADO_COLOR['cierra-pronto']}"></i>Cierra pronto</span>
            <span><i style="background:${ESTADO_COLOR['abre-pronto']}"></i>Abre pronto</span>
            <span><i style="background:${ESTADO_COLOR.cerrado}"></i>Cerrado</span>
            <span>★ Destacado</span>
        </div>
        <div class="adm-map-layout">
            <aside class="adm-map-list" id="admMapList">${listHtml()}</aside>
            <div class="adm-map-wrap">
                <div id="admMap" class="adm-map"></div>
                <div class="adm-map-hint" id="admMapHint" ${seleccionado ? '' : 'hidden'}></div>
            </div>
        </div>`;
}

function listHtml() {
    return db.locales.map(l => `
        <button class="adm-map-item ${seleccionado === l.id ? 'is-on' : ''}" data-action="adm-map-select" data-id="${l.id}">
            <i class="adm-map-dot" style="background:${ESTADO_COLOR[estadoHorario(l).codigo]}"></i>
            <span><b>${esc(l.nombre)}</b><small>${EN_CENTRO(l) ? '⚠️ Sin ubicación real' : `${l.lat.toFixed(5)}, ${l.lng.toFixed(5)}`}</small></span>
        </button>`).join('');
}

const icon = local => markerIcon(local, { activo: seleccionado === local.id });

function initMap() {
    const el = document.getElementById('admMap');
    if (!el) return;
    if (map) { map.remove(); map = null; }
    markers = new Map();
    map = L.map(el).setView(TALCA, 14);
    addBaseLayer(map, { avisoSinConexion: 'Mapa simplificado, sin calles: no sirve para ubicar locales con precisión. Abre el panel con internet o pega las coordenadas de Google Maps en "Locales".' });
    db.locales.forEach(local => {
        const m = L.marker([local.lat, local.lng], { draggable: true, icon: icon(local), title: local.nombre, autoPan: true });
        m.bindTooltip(local.nombre, { direction: 'top', offset: [0, -14] });
        m.on('dragstart', () => select(local.id, false));
        m.on('dragend', () => {
            const { lat, lng } = m.getLatLng();
            guardar(local.id, lat, lng);
        });
        m.addTo(map);
        markers.set(local.id, m);
    });
    // Con un local elegido, tocar el mapa lo mueve ahí
    map.on('click', e => {
        if (!seleccionado) return;
        markers.get(seleccionado).setLatLng(e.latlng);
        guardar(seleccionado, e.latlng.lat, e.latlng.lng);
    });
    setTimeout(() => map && map.invalidateSize(), 100);
    updateHint();
}

function guardar(id, lat, lng) {
    const local = getLocal(id);
    deshacer = { id, lat: local.lat, lng: local.lng };
    local.lat = Number(lat.toFixed(6));
    local.lng = Number(lng.toFixed(6));
    persist();
    document.getElementById('admMapList').innerHTML = listHtml();
    toastConDeshacer(`Ubicación de ${local.nombre} guardada`);
}

function toastConDeshacer(msg) {
    document.getElementById('admUndo')?.remove();
    const el = document.createElement('div');
    el.id = 'admUndo';
    el.className = 'adm-toast';
    el.innerHTML = `${esc(msg)} <button class="adm-undo" data-action="adm-map-undo">Deshacer</button>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 6000);
}

function select(id, fly = true) {
    seleccionado = id;
    markers.forEach((m, mid) => m.setIcon(icon(getLocal(mid))));
    document.getElementById('admMapList').innerHTML = listHtml();
    const local = getLocal(id);
    if (fly && map) map.setView([local.lat, local.lng], Math.max(map.getZoom(), 17));
    updateHint();
}

function updateHint() {
    const hint = document.getElementById('admMapHint');
    if (!hint) return;
    const local = seleccionado ? getLocal(seleccionado) : null;
    hint.hidden = !local;
    if (local) hint.innerHTML = `Moviendo <b>${esc(local.nombre)}</b>: arrastra su punto o toca el mapa donde está el local. <button class="adm-btn small" data-action="adm-map-done">Listo</button>`;
}

registerActions({
    'adm-map-select': el => select(Number(el.dataset.id)),
    'adm-map-done': () => {
        seleccionado = null;
        markers.forEach((m, mid) => m.setIcon(icon(getLocal(mid))));
        document.getElementById('admMapList').innerHTML = listHtml();
        updateHint();
    },
    'adm-map-talca': () => map && map.setView(TALCA, 14),
    'adm-map-undo': () => {
        if (!deshacer) return;
        const local = getLocal(deshacer.id);
        local.lat = deshacer.lat;
        local.lng = deshacer.lng;
        persist();
        markers.get(local.id)?.setLatLng([local.lat, local.lng]);
        document.getElementById('admMapList').innerHTML = listHtml();
        document.getElementById('admUndo')?.remove();
        deshacer = null;
        toast('Cambio deshecho');
    }
});
