// Fecha y lugar en que se tomó una foto (datos EXIF que guarda la cámara del celular).
// Sirven para comprobar que la reseña es de una visita real y reciente al local:
// - la foto debe ser de los últimos DIAS_VALIDOS días
// - si la foto trae ubicación, debe estar cerca del local
// Hay que leerlos ANTES de achicar la foto, porque al achicarla se pierden.
import exifr from 'exifr/dist/lite.esm.mjs';
import { distanceKm } from '../utils/geo.js';

export const DIAS_VALIDOS = 3;
export const RADIO_METROS = 400;

/** { fecha: Date|null, lat, lng } — vacío si la foto no trae datos (captura, WhatsApp, foto editada) */
export async function leerDatosFoto(file) {
    let fecha = null;
    let lat = null;
    let lng = null;
    try {
        const exif = await exifr.parse(file, { tiff: true, exif: true, gps: true });
        const f = exif?.DateTimeOriginal || exif?.CreateDate || exif?.DateTimeDigitized;
        if (f instanceof Date && !isNaN(f)) fecha = f;
        if (Number.isFinite(exif?.latitude) && Number.isFinite(exif?.longitude) && (exif.latitude || exif.longitude)) {
            lat = exif.latitude;
            lng = exif.longitude;
        }
    } catch { /* la foto no trae datos */ }
    return { fecha, lat, lng };
}

const fechaCorta = d => d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });

/**
 * Decide si la foto sirve para la reseña.
 * @returns {{ ok: boolean, sinFecha: boolean, motivo: string }}
 */
export function revisarDatosFoto({ fecha, lat, lng }, local, ahora = new Date()) {
    if (lat !== null && local && Number.isFinite(local.lat)) {
        const metros = distanceKm({ lat, lng }, { lat: local.lat, lng: local.lng }) * 1000;
        if (metros > RADIO_METROS) {
            const lejos = metros >= 1000 ? `${(metros / 1000).toFixed(1).replace('.', ',')} km` : `${Math.round(metros)} m`;
            return { ok: false, sinFecha: false, motivo: `Esta foto se tomó a ${lejos} de ${local.nombre}. Sube fotos tomadas en el local.` };
        }
    }
    // Sin fecha, o con la hora del celular mal puesta (en el futuro): se acepta, pero la reseña la revisa un moderador
    if (!fecha || fecha.getTime() > ahora.getTime() + 6 * 3600000) return { ok: true, sinFecha: true, motivo: '' };
    const dias = (ahora.getTime() - fecha.getTime()) / 86400000;
    if (dias > DIAS_VALIDOS) {
        return { ok: false, sinFecha: false, motivo: `Esta foto es del ${fechaCorta(fecha)}. Para reseñar, usa fotos de tu visita (tomadas en los últimos ${DIAS_VALIDOS} días).` };
    }
    return { ok: true, sinFecha: false, motivo: '' };
}
