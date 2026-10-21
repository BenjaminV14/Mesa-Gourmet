// Mapa simplificado que viene dentro de la app: se usa cuando no carga el mapa de calles.
// Muestra el mundo, las regiones de Chile y las comunas del Maule, con Talca destacada.
// Fuentes: Natural Earth (dominio público) y Biblioteca del Congreso Nacional (BCN). Es referencial.
import L from 'leaflet';
import datos from '../data/mapa-sin-conexion.json';

const CIUDADES = [
    ['Talca', -35.4264, -71.6554, 'principal'],
    ['Santiago', -33.4489, -70.6693], ['Valparaíso', -33.0472, -71.6127], ['Concepción', -36.8270, -73.0498],
    ['Curicó', -34.9828, -71.2394], ['Linares', -35.8467, -71.5931], ['Constitución', -35.3333, -72.4167],
    ['San Clemente', -35.5333, -71.4833], ['Maule', -35.5333, -71.7000], ['Pencahue', -35.4000, -71.8167]
];

// [lng, lat] -> [lat, lng] para Leaflet
const anillos = poligonos => poligonos.map(poly => poly.map(r => r.map(([lng, lat]) => [lat, lng])));

function capa(features, estilo, renderer) {
    return L.layerGroup(features.map(f => L.polygon(anillos(f.p), { ...estilo(f), renderer, interactive: false })));
}

export function agregarMapaSinConexion(map, mensaje = 'Mapa simplificado: no se pudo cargar el mapa de calles. Los locales se muestran igual.', motivos = [], reintentar = null) {
    if (!map || !map._mapPane || map._sinConexion) return;  // el mapa pudo cerrarse mientras se cargaba
    map._sinConexion = true;
    const capas = [];
    map.getContainer().classList.add('mapa-sin-conexion');
    const renderer = L.canvas({ padding: 0.5 });
    const tierra = { color: '#b9ad9a', weight: 0.8, fillColor: '#efe7da', fillOpacity: 1 };

    capas.push(capa(datos.paises, () => tierra, renderer).addTo(map));
    capas.push(capa(datos.regiones, () => ({ ...tierra, color: '#a99a84', weight: 1 }), renderer).addTo(map));
    capas.push(capa(datos.comunas, f => f.n === 'Talca'
        ? { color: '#8b2635', weight: 2, fillColor: '#f6dfe2', fillOpacity: 1 }
        : { color: '#c4b7a3', weight: 0.8, dashArray: '3 3', fillOpacity: 0 }, renderer).addTo(map));

    const etiquetas = L.layerGroup(CIUDADES.map(([nombre, lat, lng, tipo]) => L.marker([lat, lng], {
        interactive: false,
        keyboard: false,
        icon: L.divIcon({ className: `mapa-ciudad ${tipo || ''}`, html: `<span>${nombre}</span>`, iconSize: null })
    }))).addTo(map);
    const plaza = L.marker([-35.4268, -71.6553], {
        interactive: false,
        icon: L.divIcon({ className: 'mapa-ciudad plaza', html: '<span>Plaza de Armas</span>', iconSize: null })
    });
    // La Plaza de Armas solo se muestra de cerca; los nombres de ciudades, de lejos
    const ajustar = () => {
        const z = map.getZoom();
        if (z >= 13) { plaza.addTo(map); etiquetas.remove(); } else { plaza.remove(); etiquetas.addTo(map); }
    };
    map.on('zoomend', ajustar);
    ajustar();

    const aviso = L.control({ position: 'bottomleft' });
    aviso.onAdd = () => {
        const el = L.DomUtil.create('div', 'mapa-aviso');
        el.innerHTML = `<span>${mensaje}</span>${motivos.length ? `<small>${motivos.join(' · ')}</small>` : ''}`;
        if (reintentar) {
            const btn = L.DomUtil.create('button', 'mapa-reintentar', el);
            btn.type = 'button';
            btn.textContent = '↻ Reintentar';
            L.DomEvent.on(btn, 'click', e => {
                L.DomEvent.stop(e);
                // Quita el mapa simplificado y vuelve a probar el de calles
                capas.forEach(c => c.remove());
                plaza.remove();
                etiquetas.remove();
                map.off('zoomend', ajustar);
                aviso.remove();
                map.getContainer().classList.remove('mapa-sin-conexion');
                map._sinConexion = false;
                reintentar();
            });
        }
        return el;
    };
    aviso.addTo(map);
    map.attributionControl?.addAttribution('Mapa base: Natural Earth · BCN');
}
