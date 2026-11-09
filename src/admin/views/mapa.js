// Mapa de ubicaciones (los mismos puntos que ve el usuario): arrastra el punto de cada local hasta su lugar exacto, elige un local
// y toca el mapa para ponerlo ahí, o pega sus coordenadas / link de Google Maps. Cada cambio se guarda al instante y se puede deshacer.
// Vista satelital opcional para ubicar el local con precisión.
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
let satelite = null;      // capa satelital (se agrega encima de las calles cuando se activa)
let arrastrando = null;   // id del local cuyo punto se está arrastrando

// Imágenes satelitales de Esri (gratis, sin clave; requieren atribución)
const SATELITE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const SATELITE_ATRIB = 'Imágenes © Esri, Maxar, Earthstar Geographics';

const EN_CENTRO = l => Math.abs(l.lat - TALCA[0]) < 0.0005 && Math.abs(l.lng - TALCA[1]) < 0.0005;

export function renderMapaAdmin() {
    // El mapa se arma después de pintar la página
    setTimeout(initMap, 0);
    return `
        <div class="adm-head">
            <h1 class="adm-title">Ubicaciones en el mapa</h1>
            <div class="adm-map-tools">
                <button class="adm-btn ghost" data-action="adm-map-satelite" id="admMapSat">🛰️ Vista satelital</button>
                <button class="adm-btn ghost" data-action="adm-map-talca">🏙️ Volver a Talca</button>
            </div>
        </div>
        <p class="adm-help">Arrastra el punto de un local hasta su lugar exacto y suéltalo: queda guardado al instante.
        También puedes elegir un local en la lista y tocar el mapa donde corresponde, o pegar sus coordenadas o el link de Google Maps.
        Usa la <b>vista satelital</b> y acerca el mapa al máximo para dejar el punto justo en la entrada del local.</p>
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
    if (satelite) satelite = L.tileLayer(SATELITE_URL, { maxZoom: 20, maxNativeZoom: 19, attribution: SATELITE_ATRIB }).addTo(map);
    db.locales.forEach(local => {
        const m = L.marker([local.lat, local.lng], { draggable: true, icon: icon(local), title: local.nombre, autoPan: true });
        m.bindTooltip(local.nombre, { direction: 'top', offset: [0, -14] });
        // Ojo: no se puede cambiar el ícono del punto mientras se arrastra (Leaflet corta el arrastre y no se guarda).
        // Por eso el ícono del punto arrastrado se actualiza recién al soltarlo.
        m.on('dragstart', () => {
            arrastrando = local.id;
            select(local.id, false);
        });
        m.on('dragend', () => {
            arrastrando = null;
            const { lat, lng } = m.getLatLng();
            guardar(local.id, lat, lng);
            m.setIcon(icon(local));
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

function refrescarIconos() {
    markers.forEach((m, mid) => { if (mid !== arrastrando) m.setIcon(icon(getLocal(mid))); });
}

function select(id, fly = true) {
    seleccionado = id;
    refrescarIconos();
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
    if (local) hint.innerHTML = `
        <span>Moviendo <b>${esc(local.nombre)}</b>: arrastra su punto, toca el mapa donde está el local o pega sus coordenadas.</span>
        <form class="adm-map-coords" id="admMapCoords">
            <input type="text" id="admMapCoordsInput" placeholder="-35.4264, -71.6554 o link de Google Maps" aria-label="Coordenadas o link de Google Maps">
            <button type="submit" class="adm-btn small">Ubicar</button>
            <button type="button" class="adm-btn small ghost" data-action="adm-map-done">Listo</button>
        </form>`;
    document.getElementById('admMapCoords')?.addEventListener('submit', e => {
        e.preventDefault();
        ubicarDesdeTexto(document.getElementById('admMapCoordsInput').value);
    });
}

/**
 * Lee coordenadas escritas a mano o desde un link de Google Maps.
 * Acepta: "-35.4264, -71.6554", "-35.4264 -71.6554", ".../@-35.4264,-71.6554,17z", "...?q=-35.4264,-71.6554",
 * y el formato de los links largos "!3d-35.4264!4d-71.6554" (que es la ubicación exacta del lugar).
 */
export function leerCoordenadas(texto) {
    const t = String(texto || '').trim();
    const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
    const patrones = [
        new RegExp(`!3d${num}!4d${num}`),
        new RegExp(`[?&](?:q|query|ll|destination)=${num},\\s*${num}`),
        new RegExp(`@${num},${num}`),
        new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`)
    ];
    for (const re of patrones) {
        const m = t.match(re);
        if (m) {
            const lat = Number(m[1]), lng = Number(m[2]);
            if (lat < -17 && lat > -56 && lng < -66 && lng > -76) return { lat, lng };
            return { error: 'Esas coordenadas no están en Chile. Revisa que la primera sea la latitud (-35…) y la segunda la longitud (-71…).' };
        }
    }
    if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(t)) {
        return { error: 'Los links cortos (maps.app.goo.gl) no traen las coordenadas. Ábrelo, mantén presionado el local y copia los números que aparecen.' };
    }
    return { error: 'No encontré coordenadas. Pega algo como -35.4264, -71.6554 o el link largo de Google Maps.' };
}

function ubicarDesdeTexto(texto) {
    if (!seleccionado) return;
    const r = leerCoordenadas(texto);
    if (r.error) return toast(r.error, 'error');
    markers.get(seleccionado)?.setLatLng([r.lat, r.lng]);
    map?.setView([r.lat, r.lng], Math.max(map.getZoom(), 18));
    guardar(seleccionado, r.lat, r.lng);
}

registerActions({
    'adm-map-select': el => select(Number(el.dataset.id)),
    'adm-map-done': () => {
        seleccionado = null;
        refrescarIconos();
        document.getElementById('admMapList').innerHTML = listHtml();
        updateHint();
    },
    'adm-map-talca': () => map && map.setView(TALCA, 14),
    'adm-map-satelite': () => {
        if (!map) return;
        if (satelite) {
            satelite.remove();
            satelite = null;
        } else {
            satelite = L.tileLayer(SATELITE_URL, { maxZoom: 20, maxNativeZoom: 19, attribution: SATELITE_ATRIB }).addTo(map);
            // Los puntos quedan encima de las imágenes
            markers.forEach(m => m.setZIndexOffset(1000));
        }
        const btn = document.getElementById('admMapSat');
        if (btn) btn.textContent = satelite ? '🗺️ Vista de calles' : '🛰️ Vista satelital';
    },
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
