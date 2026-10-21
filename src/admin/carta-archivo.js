// Lee una carta desde un archivo para importarla en "Cartas":
// - texto (.txt) y planillas (.xlsx, .csv): se leen aquí mismo
// - PDF con texto: se extrae el texto con pdf.js
// - fotos y PDF escaneados: los lee la IA en el servidor (función "leer-carta")
import { supabase, remoto } from '../services/supabase.js';

const PRECIO = /(\d{1,3}(?:[.,]\d{3})+|\d{3,7})/;

/**
 * Devuelve { texto } (para pasarlo por el lector de texto) o { platos } (ya separados por la IA o la planilla).
 * Lanza un Error con un mensaje en español si no se puede leer.
 */
export async function leerArchivoCarta(file) {
    const nombre = file.name.toLowerCase();
    if (file.type.startsWith('image/')) return { platos: await leerConIa([await imagenBase64(file)]) };
    if (file.type === 'application/pdf' || nombre.endsWith('.pdf')) return leerPdf(file);
    if (nombre.endsWith('.xlsx')) return { platos: platosDePlanilla(await leerXlsx(file)) };
    if (nombre.endsWith('.csv')) return { platos: platosDePlanilla(filasCsv(await file.text())) };
    if (file.type.startsWith('text/') || nombre.endsWith('.txt') || nombre.endsWith('.md')) return { texto: await file.text() };
    throw new Error('Ese tipo de archivo no se puede leer. Usa una foto, un PDF, un Excel (.xlsx), un .csv o un .txt. Los Word (.docx) se pueden guardar como PDF.');
}

async function leerXlsx(file) {
    const { default: readExcelFile } = await import('read-excel-file/browser');
    return readExcelFile(file);
}

function filasCsv(texto) {
    const sep = (texto.split('\n')[0].match(/;/g) || []).length > (texto.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    return texto.split(/\r?\n/).filter(Boolean).map(l => l.split(sep).map(c => c.replace(/^"|"$/g, '').trim()));
}

/** Planilla con columnas tipo "Plato | Categoría | Precio" (o solo nombre y precio) */
function platosDePlanilla(filas) {
    const limpio = v => String(v ?? '').trim();
    const cab = (filas[0] || []).map(c => limpio(c).toLowerCase());
    const col = (...claves) => cab.findIndex(c => claves.some(k => c.includes(k)));
    let iNombre = col('plato', 'nombre', 'producto', 'item');
    let iCat = col('categor', 'seccion', 'sección', 'tipo');
    let iPrecio = col('precio', 'valor', '$');
    let iDesc = col('descrip', 'ingred', 'detalle');
    const conCabecera = iNombre > -1 || iPrecio > -1;
    const datos = conCabecera ? filas.slice(1) : filas;
    let categoria = 'Otros';
    const platos = [];
    for (const fila of datos) {
        const celdas = fila.map(limpio);
        if (!celdas.some(Boolean)) continue;
        // Sin cabecera: el precio es la última celda con número y el nombre la primera con texto
        const precioTxt = iPrecio > -1 ? celdas[iPrecio] : [...celdas].reverse().find(c => PRECIO.test(c) && !/[a-z]{3}/i.test(c));
        const nombre = iNombre > -1 ? celdas[iNombre] : celdas.find(c => c && c !== precioTxt);
        const precio = Number(String(precioTxt || '').match(PRECIO)?.[1]?.replace(/[.,]/g, '') || 0);
        if (!precio) {
            // Fila con solo texto: es el título de una sección
            if (nombre && celdas.filter(Boolean).length === 1 && nombre.length <= 40) categoria = capitalizar(nombre);
            continue;
        }
        if (!nombre) continue;
        platos.push({
            nombre,
            categoria: (iCat > -1 && celdas[iCat]) ? capitalizar(celdas[iCat]) : categoria,
            precio,
            descripcion: iDesc > -1 ? celdas[iDesc] : ''
        });
    }
    if (!platos.length) throw new Error('No encontré platos con precio en la planilla. Usa columnas "Plato", "Categoría" y "Precio".');
    return platos;
}

const capitalizar = t => t.toLowerCase().replace(/^\p{L}/u, c => c.toUpperCase());

async function leerPdf(file) {
    let pdfjs;
    try {
        pdfjs = await import('pdfjs-dist');
        const { default: worker } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
        pdfjs.GlobalWorkerOptions.workerSrc = worker;
    } catch {
        throw new Error('No se pudo cargar el lector de PDF. Abre el panel desde internet e inténtalo de nuevo.');
    }
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const lineas = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 30); n++) {
        const pagina = await pdf.getPage(n);
        const { items } = await pagina.getTextContent();
        // Agrupa los trozos de texto por altura para rearmar cada línea de la carta
        const filas = new Map();
        for (const it of items) {
            if (!it.str?.trim()) continue;
            const y = Math.round(it.transform[5] / 3) * 3;
            if (!filas.has(y)) filas.set(y, []);
            filas.get(y).push({ x: it.transform[4], t: it.str.trim() });
        }
        [...filas.entries()].sort((a, b) => b[0] - a[0])
            .forEach(([, partes]) => lineas.push(partes.sort((a, b) => a.x - b.x).map(p => p.t).join(' ')));
    }
    const texto = lineas.join('\n');
    if (texto.replace(/\s/g, '').length > 30) return { texto };
    // PDF escaneado (solo imágenes): se convierten las primeras páginas en fotos y las lee la IA
    const fotos = [];
    for (let n = 1; n <= Math.min(pdf.numPages, 6); n++) {
        const pagina = await pdf.getPage(n);
        const vista = pagina.getViewport({ scale: 1.6 });
        const canvas = document.createElement('canvas');
        canvas.width = vista.width;
        canvas.height = vista.height;
        await pagina.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
        fotos.push({ tipo: 'image/jpeg', datos: canvas.toDataURL('image/jpeg', 0.82).split(',')[1] });
    }
    return { platos: await leerConIa(fotos) };
}

/** Achica la foto (máx. 1600 px) para que viaje rápido */
function imagenBase64(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const escala = Math.min(1, 1600 / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * escala);
            canvas.height = Math.round(img.height * escala);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(img.src);
            resolve({ tipo: 'image/jpeg', datos: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] });
        };
        img.onerror = () => reject(new Error('No se pudo abrir la imagen.'));
        img.src = URL.createObjectURL(file);
    });
}

async function leerConIa(archivos) {
    if (!remoto) throw new Error('Leer fotos de cartas usa la IA del servidor: abre el panel desde internet (GitHub Pages). Mientras, copia el texto de la carta y pégalo aquí.');
    const { data, error } = await supabase.functions.invoke('leer-carta', { body: { archivos } });
    if (error) {
        const detalle = await error.context?.json?.().catch(() => null);
        if (error.context?.status === 404) throw new Error('La lectura de fotos con IA aún no está activada en Supabase (falta publicar la función "leer-carta").');
        throw new Error(detalle?.error || 'La IA no pudo leer la carta. Prueba con una foto más nítida.');
    }
    if (!data?.platos?.length) throw new Error('La IA no encontró platos con precio en el archivo.');
    return data.platos.map(p => ({ nombre: p.nombre, categoria: p.categoria || 'Otros', precio: p.precio, descripcion: p.descripcion || '', isDrink: !!p.bebida }));
}
