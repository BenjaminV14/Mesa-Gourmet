// Capa de calles del mapa.
// Prueba varios proveedores en orden (CARTO, Esri, OpenStreetMap). Si ninguno carga, por ejemplo sin internet
// o dentro de un visor que bloquea imágenes externas, muestra un mapa simplificado que viene dentro de la app
// (países, regiones y comunas del Maule) para que los locales se vean igual.
// Para el lanzamiento con mucho tráfico conviene una cuenta propia (MapTiler o Stadia, con plan gratis),
// agregándola primera en PROVEEDORES. Ver docs/HOSTING.md.
import L from 'leaflet';

export const TALCA = [-35.4264, -71.6554];

const PROVEEDORES = [
    {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        opciones: { subdomains: 'abcd', attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>' }
    },
    {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        opciones: { maxNativeZoom: 19, attribution: 'Mapa © Esri y colaboradores' }
    },
    {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        opciones: { maxNativeZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }
    }
];

// Errores seguidos sin ninguna imagen cargada antes de pasar al siguiente proveedor
const ERRORES_PARA_CAMBIAR = 4;
const ESPERA_MAXIMA_MS = 7000;

export function addBaseLayer(map, { avisoSinConexion } = {}) {
    let indice = 0;
    let capa = null;
    let cargadas = 0;
    let errores = 0;
    let temporizador = null;

    const sinConexion = () => {
        capa?.remove();
        capa = null;
        import('./mapa-sin-conexion.js').then(m => m.agregarMapaSinConexion(map, avisoSinConexion));
    };
    const siguiente = () => {
        clearTimeout(temporizador);
        indice++;
        if (indice < PROVEEDORES.length) usar();
        else sinConexion();
    };
    function usar() {
        capa?.remove();
        cargadas = 0;
        errores = 0;
        const p = PROVEEDORES[indice];
        capa = L.tileLayer(p.url, { maxZoom: 20, minZoom: 3, ...p.opciones }).addTo(map);
        capa.on('tileload', e => {
            // Una imagen de reemplazo (data:) no cuenta como mapa cargado
            if (String(e.tile?.src || '').startsWith('data:')) return;
            cargadas++;
            clearTimeout(temporizador);
        });
        capa.on('tileerror', () => {
            errores++;
            if (!cargadas && errores >= ERRORES_PARA_CAMBIAR) siguiente();
        });
        // Algunos bloqueos no avisan con error: si no llega ninguna imagen a tiempo, se prueba el siguiente
        temporizador = setTimeout(() => { if (!cargadas && map._loaded) siguiente(); }, ESPERA_MAXIMA_MS);
    }
    map.on('unload', () => clearTimeout(temporizador));
    usar();
}
