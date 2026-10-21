// Punto de un local en el mapa: color según el horario y estrella si es destacado.
// Lo usan el mapa de la app y el de ubicaciones del panel, para que se vean iguales.
import L from 'leaflet';
import { estadoHorario } from '../utils/time.js';
import { isSponsored } from '../features/sponsors.js';

export const ESTADO_COLOR = { abierto: '#10b981', 'cierra-pronto': '#f59e0b', 'abre-pronto': '#3b82f6', cerrado: '#ef4444' };

export function markerIcon(local, { activo = false } = {}) {
    const color = ESTADO_COLOR[estadoHorario(local).codigo];
    const sponsored = isSponsored(local);
    const extra = activo ? ' is-active' : '';
    return L.divIcon({
        className: 'mg-marker-wrap',
        html: sponsored
            ? `<span class="mg-marker mg-marker-star${extra}" style="--c:${color}">★</span>`
            : `<span class="mg-marker${extra}" style="--c:${color}"></span>`,
        iconSize: sponsored ? [34, 34] : [22, 22],
        iconAnchor: sponsored ? [17, 17] : [11, 11]
    });
}
