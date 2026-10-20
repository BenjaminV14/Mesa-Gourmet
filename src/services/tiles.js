// Capa de calles del mapa.
// Se usa CARTO (basado en OpenStreetMap) porque funciona también al abrir la app sin servidor;
// los mapas de openstreetmap.org rechazan esas solicitudes.
// Para el lanzamiento con mucho tráfico conviene una cuenta propia (MapTiler o Stadia, con plan gratis),
// cambiando solo esta URL. Ver docs/HOSTING.md.
import L from 'leaflet';

export const TALCA = [-35.4264, -71.6554];

export function addBaseLayer(map) {
    return L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        minZoom: 3
    }).addTo(map);
}
