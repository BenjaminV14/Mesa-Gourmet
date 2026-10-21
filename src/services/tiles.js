// Capa de calles del mapa.
// Prueba los proveedores en orden (OpenStreetMap y OSM Francia, que no piden clave; CARTO se quitó porque
// desde 2026 pide clave y muestra "API KEY REQUIRED" sobre el mapa). Si ninguno carga, por ejemplo sin internet
// o dentro de un visor que bloquea imágenes externas, muestra un mapa simplificado que viene dentro de la app
// (países, regiones y comunas del Maule) para que los locales se vean igual.
// Para el lanzamiento con mucho tráfico conviene una clave propia de MapTiler (plan gratis): se pone en
// VITE_MAPTILER_KEY y pasa a ser el primer proveedor. Ver docs/HOSTING.md.
import L from 'leaflet';

export const TALCA = [-35.4264, -71.6554];

const MAPTILER_KEY = import.meta.env?.VITE_MAPTILER_KEY;

const PROVEEDORES = [
    // Con clave propia de MapTiler (plan gratis) se usa primero; sin clave se salta
    ...(MAPTILER_KEY ? [{
        nombre: 'MapTiler',
        url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`,
        opciones: { attribution: '© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener">MapTiler</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }
    }] : []),
    {
        nombre: 'OpenStreetMap',
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        opciones: { maxNativeZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }
    },
    {
        nombre: 'OSM Francia',
        url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
        opciones: { subdomains: 'abc', maxNativeZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> · OSM France' }
    }
];

// Errores seguidos sin ninguna imagen cargada antes de pasar al siguiente proveedor
const ERRORES_PARA_CAMBIAR = 4;
// Con señal lenta las primeras calles pueden tardar: se espera bastante antes de cambiar de proveedor
const ESPERA_MAXIMA_MS = 15000;

export function addBaseLayer(map, { avisoSinConexion } = {}) {
    let indice = 0;
    let capa = null;
    let cargadas = 0;
    let errores = 0;
    let temporizador = null;
    const motivos = [];   // qué falló en cada proveedor, para mostrarlo en el aviso

    const sinConexion = () => {
        capa?.remove();
        capa = null;
        console.warn('Mapa de calles no disponible:', motivos.join(' · '));
        import('./mapa-sin-conexion.js').then(m => m.agregarMapaSinConexion(map, avisoSinConexion, motivos, () => {
            // "Reintentar": vuelve a probar desde el primer proveedor
            indice = 0;
            motivos.length = 0;
            usar();
        }));
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
            if (!cargadas && errores === ERRORES_PARA_CAMBIAR) {
                motivos.push(`${p.nombre}: no respondió (${errores} errores)`);
                siguiente();
            }
        });
        // Algunos bloqueos no avisan con error: si no llega ninguna imagen a tiempo, se prueba el siguiente
        temporizador = setTimeout(() => {
            if (!cargadas && map._loaded) {
                motivos.push(`${p.nombre}: sin respuesta en ${ESPERA_MAXIMA_MS / 1000} s`);
                siguiente();
            }
        }, ESPERA_MAXIMA_MS);
    }
    map.on('unload', () => clearTimeout(temporizador));
    usar();
}
