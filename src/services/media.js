// Videos subidos por los usuarios.
// DEMO: se guardan en el navegador (IndexedDB), que soporta archivos grandes.
// Con Supabase se suben al almacenamiento "videos" y la revisión con IA se hace en el servidor.
const DB_NAME = 'mesa-gourmet-media';
const STORE = 'videos';
export const MAX_VIDEO_MB = 60;
export const MAX_VIDEO_SEGUNDOS = 90;

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveVideoBlob(id, blob) {
    const idb = await openDb();
    await new Promise((resolve, reject) => {
        const tx = idb.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(blob, id);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

const urlCache = new Map();

export async function getVideoUrl(id) {
    if (urlCache.has(id)) return urlCache.get(id);
    const idb = await openDb();
    const blob = await new Promise((resolve, reject) => {
        const req = idb.transaction(STORE).objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
    if (!blob) return null;
    const url = URL.createObjectURL(blob);
    urlCache.set(id, url);
    return url;
}

export async function deleteVideoBlob(id) {
    const idb = await openDb();
    idb.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    urlCache.delete(id);
}

/**
 * Lee la duración del video y saca 3 cuadros (inicio, mitad, final) como imágenes.
 * Esos cuadros son los que revisa la IA para detectar contenido inapropiado,
 * y el primero sirve de portada.
 */
export function inspectVideo(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const video = document.createElement('video');
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;
        video.src = url;
        const frames = [];
        let tiempos = [];
        video.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer el video. Prueba con un MP4 o MOV.')); };
        video.onloadedmetadata = () => {
            const d = video.duration || 0;
            tiempos = [Math.min(0.5, d / 4), d / 2, Math.max(0, d - 0.5)];
            video.currentTime = tiempos[0];
        };
        video.onseeked = () => {
            const canvas = document.createElement('canvas');
            const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
            canvas.width = Math.round(video.videoWidth * scale);
            canvas.height = Math.round(video.videoHeight * scale);
            canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
            frames.push(canvas.toDataURL('image/jpeg', 0.7));
            if (frames.length < tiempos.length) {
                video.currentTime = tiempos[frames.length];
            } else {
                URL.revokeObjectURL(url);
                resolve({ duracion: video.duration, frames });
            }
        };
    });
}
