// Verificación con IA de las fotos de las reseñas: confirma que la foto muestra el plato o producto elegido.
// La llamada real se hace desde una función del servidor (Supabase Edge Function) para no exponer
// la clave de la IA en la app. Ver docs/SUPABASE.md, sección "Verificación de fotos con IA".
const VERIFY_URL = import.meta.env?.VITE_PHOTO_VERIFY_URL;

/**
 * @returns {Promise<{ estado: 'aprobada' | 'rechazada' | 'revision' | 'sin_verificar', motivo?: string }>}
 */
export async function verifyDishPhoto(imageDataUrl, dishName) {
    if (!VERIFY_URL) {
        // Demo sin servidor: la foto queda marcada para revisión manual en el panel de administración
        return { estado: 'sin_verificar', motivo: 'La verificación con IA se activa al conectar el servidor.' };
    }
    try {
        const response = await fetch(VERIFY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ image: imageDataUrl, dish: dishName })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
    } catch (err) {
        console.warn('No se pudo verificar la foto:', err);
        return { estado: 'revision', motivo: 'No se pudo verificar automáticamente; la revisará un moderador.' };
    }
}

// Reduce la foto antes de subirla (máx. 1024 px, JPEG) para ahorrar datos y almacenamiento
export function compressImage(file, maxSize = 1024, quality = 0.75) {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) return reject(new Error('El archivo no es una imagen.'));
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('La imagen está dañada o no es compatible.'));
            img.onload = () => {
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}
