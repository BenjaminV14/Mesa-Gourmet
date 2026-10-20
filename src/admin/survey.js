// Importación de la encuesta a los dueños de locales (Excel o CSV).
// Reconoce qué pregunta corresponde a cada dato de la app y traduce las respuestas
// ("Sí", "No", "Solo en terraza", "Lunes a viernes 12 a 23"...) a etiquetas y horarios.
import { normalize } from '../utils/text.js';

export const CARACTERISTICAS_KEYWORDS = {
    'Baño / WC': ['bano', 'banos', 'wc', 'servicio higienico', 'servicios higienicos'],
    'WiFi Disponible': ['wifi', 'wi fi', 'internet'],
    'Terraza': ['terraza', 'aire libre', 'patio'],
    'Mascotas (Solo en Terraza)': ['mascota', 'mascotas', 'pet friendly', 'perro'],
    'Seguridad Completa': ['seguridad', 'guardia', 'camaras'],
    'Calefacción': ['calefaccion', 'estufa', 'calefactor'],
    'Aire Acondicionado / Ventilación': ['aire acondicionado', 'ventilacion', 'climatizado', 'climatizacion'],
    'Acceso Discapacitados': ['discapacidad', 'discapacitados', 'silla de ruedas', 'accesibilidad', 'accesible', 'rampa', 'movilidad reducida'],
    'Estacionamiento': ['estacionamiento', 'estacionamientos', 'parking'],
    'Bicicletero': ['bicicleta', 'bicicletas', 'bicicletero'],
    'Venta de Alcohol': ['alcohol', 'alcoholicas', 'patente de alcohol', 'cerveza', 'vino', 'tragos'],
    'Apto para Fumadores (Solo en Terraza)': ['fumador', 'fumadores', 'fumar', 'cigarro'],
    'Acepta Edenred / BAES': ['edenred', 'baes', 'junaeb', 'cheque restaurant', 'ticket restaurant', 'sodexo', 'pluxee'],
    'Delivery': ['delivery', 'despacho', 'reparto', 'envio a domicilio']
};

const DIETA_KEYWORDS = {
    vegano: ['vegano', 'vegana', 'veganos', 'veganas'],
    vegetariano: ['vegetariano', 'vegetariana', 'vegetarianos', 'vegetarianas'],
    sinGluten: ['gluten', 'celiaco', 'celiacos', 'celiaca'],
    sinLactosa: ['lactosa']
};

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const DIA_PREFIJOS = [['dom', 0], ['lun', 1], ['mar', 2], ['mie', 3], ['jue', 4], ['vie', 5], ['sab', 6]];

// Campos de la app a los que se puede asignar una pregunta
export const TARGETS = [
    { id: 'ignorar', label: '— No importar —' },
    { id: 'nombre', label: 'Nombre del local', keywords: ['nombre del local', 'nombre local', 'nombre de su local', 'nombre del restaurante', 'nombre del negocio', 'nombre'] },
    { id: 'tipo', label: 'Tipo de local', keywords: ['tipo de local', 'tipo de comida', 'categoria', 'rubro', 'tipo'] },
    { id: 'direccion', label: 'Dirección', keywords: ['direccion', 'domicilio'] },
    { id: 'coords', label: 'Ubicación (coordenadas o link de Google Maps)', keywords: ['coordenadas', 'google maps', 'link de ubicacion', 'ubicacion en el mapa'] },
    { id: 'telefono', label: 'Teléfono', keywords: ['telefono', 'fono', 'celular', 'numero de contacto'] },
    { id: 'whatsapp', label: 'WhatsApp', keywords: ['whatsapp', 'wsp', 'wasap'] },
    { id: 'instagram', label: 'Instagram', keywords: ['instagram'] },
    { id: 'tiktok', label: 'TikTok', keywords: ['tiktok', 'tik tok'] },
    { id: 'website', label: 'Sitio web', keywords: ['sitio web', 'pagina web', 'web'] },
    { id: 'descripcion', label: 'Descripción', keywords: ['descripcion', 'describa', 'describe', 'cuentenos', 'cuentanos'] },
    { id: 'etiquetas', label: 'Palabras clave (buscador)', keywords: ['especialidad', 'especialidades', 'palabras clave', 'plato estrella', 'platos estrella', 'plato principal'] },
    { id: 'horario', label: 'Horario (toda la semana o por días)', keywords: ['horario', 'horarios', 'hora de atencion', 'atencion al publico'] },
    ...DIAS.map((d, i) => ({ id: `horario:${i}`, label: `Horario del ${d.toLowerCase()}`, keywords: [`horario ${normalize(d)}`, `${normalize(d)}`] })),
    ...Object.entries(CARACTERISTICAS_KEYWORDS).map(([c, keywords]) => ({ id: `car:${c}`, label: `Característica: ${c}`, keywords })),
    { id: 'car:Ingreso de Mascotas', label: 'Característica: Ingreso de Mascotas (en todo el local)', keywords: [] },
    ...Object.entries(DIETA_KEYWORDS).map(([k, keywords]) => ({ id: `dieta:${k}`, label: `Opción dietética: ${{ vegano: 'Vegano', vegetariano: 'Vegetariano', sinGluten: 'Sin gluten', sinLactosa: 'Sin lactosa' }[k]}`, keywords }))
];

function containsWord(text, keyword) {
    return new RegExp(`(^| )${keyword}( |$)`).test(text);
}

// Sugiere a qué campo corresponde una pregunta (la persona puede cambiarlo)
export function guessTarget(question) {
    const q = normalize(question);
    let best = { id: 'ignorar', score: 0 };
    for (const t of TARGETS) {
        for (const kw of t.keywords || []) {
            if (containsWord(q, normalize(kw))) {
                const score = kw.length + (t.id.startsWith('horario:') ? -2 : 0);
                if (score > best.score) best = { id: t.id, score };
            }
        }
    }
    // "¿Atienden el lunes?" o "Horario lunes" -> horario de ese día solo si la pregunta habla de horario o atención
    if (best.id.startsWith('horario:') && !/(horario|hora|atien|abre|abren|atencion)/.test(q)) return 'ignorar';
    return best.id;
}

/** Respuesta sí/no. Devuelve true, false o null (sin respuesta o no se entiende). */
export function parseYesNo(value) {
    if (value === true || value === false) return value;
    const v = normalize(value);
    if (!v) return null;
    if (/^(no|n|0|false|falso|nop|negativo|ninguno|ninguna|no tenemos|no contamos|no hay)( |$)/.test(v)) return false;
    if (/^(si|s|x|1|true|verdadero|yes|y|ok|claro|tenemos|contamos|hay|disponible|habilitado|habilitada|con)( |$)/.test(v)) return true;
    return null;
}

function hhmm(h, m) {
    const hour = Number(h);
    const min = Number(m || 0);
    if (hour > 24 || min > 59) return null;
    return `${String(hour % 24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// "12:00 - 23:30", "12 a 23 hrs", "12.30 a 0:00" -> "12:00 - 23:30"
function parseRange(text) {
    const times = [...text.matchAll(/(\d{1,2})(?:[:.h](\d{2}))?\s*(?:hrs?|h)?/g)]
        .map(m => hhmm(m[1], m[2])).filter(Boolean);
    return times.length >= 2 ? `${times[0]} - ${times[1]}` : null;
}

function daysIn(segment) {
    const s = normalize(segment);
    // Días en el orden en que aparecen en el texto
    const found = DIA_PREFIJOS
        .map(([p, i]) => ({ i, pos: s.search(new RegExp(`(^| )${p}`)) }))
        .filter(d => d.pos >= 0)
        .sort((a, b) => a.pos - b.pos)
        .map(d => d.i);
    if (!found.length) {
        if (/fin de semana|fines de semana/.test(s)) return [6, 0];
        if (/todos los dias|toda la semana|diario/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
        return null;
    }
    // "lunes a viernes", "Lun-Jue", "de martes a domingo" -> rango de días
    const raw = String(segment).toLowerCase();
    if (found.length === 2 && (/( a | al )/.test(s) || /[a-záéíóú]\s*[-–]\s*[a-záéíóú]/.test(raw))) {
        const order = [1, 2, 3, 4, 5, 6, 0];
        const [a, b] = [order.indexOf(found[0]), order.indexOf(found[1])];
        if (a <= b) return order.slice(a, b + 1);
    }
    return found;
}

/**
 * Interpreta un horario escrito libremente.
 * Devuelve { dias: { Lunes: '12:00 - 23:00', ... }, entendido: boolean }
 */
export function parseSchedule(value) {
    const text = String(value ?? '').trim();
    const dias = {};
    if (!text) return { dias, entendido: false };
    const segments = text.split(/[;\n|]|,(?!\d)/).map(s => s.trim()).filter(Boolean);
    let entendido = false;
    for (const seg of segments) {
        const which = daysIn(seg) || [0, 1, 2, 3, 4, 5, 6];
        const closed = /cerrado|no abre|no atiende|no abrimos|libre/.test(normalize(seg));
        const range = closed ? 'Cerrado' : parseRange(seg.replace(/^[^\d]*?(?=\d)/, ''));
        if (!range) continue;
        which.forEach(i => { dias[DIAS[i]] = range; });
        entendido = true;
    }
    return { dias, entendido };
}

export function parseCoords(value) {
    const text = String(value ?? '');
    const match = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || text.match(/(-?\d{1,2}\.\d{2,})\s*,\s*(-?\d{1,3}\.\d{2,})/);
    if (!match) return null;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    return lat < -17 && lat > -56 && lng < -66 && lng > -76 ? { lat, lng } : null;
}

function dietValue(value) {
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isNaN(n) && String(value).trim() !== '' && n >= 0 && n <= 5) return Math.round(n);
    const yn = parseYesNo(value);
    return yn === null ? null : (yn ? 3 : 0);
}

const ETIQUETAS_CAMPOS = {
    tipo: 'Tipo', direccion: 'Dirección', telefono: 'Teléfono', whatsapp: 'WhatsApp', instagram: 'Instagram',
    tiktok: 'TikTok', website: 'Sitio web', descripcion: 'Descripción', etiquetas: 'Palabras clave', lat: 'Latitud', lng: 'Longitud',
    vegano: 'Vegano', vegetariano: 'Vegetariano', sinGluten: 'Sin gluten', sinLactosa: 'Sin lactosa'
};

const cellText = v => (v instanceof Date ? v.toLocaleDateString('es-CL') : String(v ?? '').trim());

/**
 * Convierte las hojas del archivo en una lista de respuestas por local: [{ fila, respuestas: { pregunta: valor } }].
 * Acepta dos formatos:
 *  - Una fila por local y una columna por pregunta (lo que exporta Google Forms).
 *  - Una hoja por local con dos columnas: Pregunta | Respuesta.
 */
export function sheetsToResponses(sheets) {
    const verticales = sheets.filter(s => s.data.length > 1 && s.data.every(r => r.filter(c => cellText(c)).length <= 2) && s.data.length >= 4);
    if (verticales.length && verticales.length === sheets.filter(s => s.data.length).length) {
        return {
            formato: 'Una hoja por local (Pregunta | Respuesta)',
            preguntas: [...new Set(verticales.flatMap(s => s.data.map(r => cellText(r[0])).filter(Boolean)))],
            respuestas: verticales.map(s => ({
                fila: `Hoja "${s.sheet}"`,
                respuestas: Object.fromEntries(s.data.filter(r => cellText(r[0])).map(r => [cellText(r[0]), r[1]]))
            }))
        };
    }
    const sheet = sheets.find(s => s.data.length > 1) || sheets[0];
    const [header = [], ...rows] = sheet.data;
    const preguntas = header.map(cellText);
    return {
        formato: 'Una fila por local',
        preguntas: preguntas.filter(Boolean),
        respuestas: rows
            .filter(r => r.some(c => cellText(c)))
            .map((r, i) => ({ fila: `Fila ${i + 2}`, respuestas: Object.fromEntries(preguntas.map((p, j) => [p, r[j]]).filter(([p]) => p)) }))
    };
}

export function parseCsv(text) {
    const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') quoted = false;
            else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === sep) { row.push(cell); cell = ''; }
        else if (ch === '\n' || ch === '\r') {
            if (ch === '\r' && text[i + 1] === '\n') i++;
            row.push(cell); rows.push(row); row = []; cell = '';
        } else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return [{ sheet: 'CSV', data: rows }];
}

/**
 * Calcula qué cambiaría en cada local, sin aplicar nada todavía.
 * mapping: { pregunta: targetId }
 */
export function planImport(responses, mapping, locales) {
    return responses.map(({ fila, respuestas }) => {
        const nombreQ = Object.keys(mapping).find(q => mapping[q] === 'nombre');
        const nombre = nombreQ ? cellText(respuestas[nombreQ]) : '';
        const existente = nombre ? locales.find(l => normalize(l.nombre) === normalize(nombre)) : null;
        const cambios = [];
        const avisos = [];
        const datos = {};
        const agregar = new Set();
        const quitar = new Set();
        const dietas = {};
        let horario = {};

        for (const [pregunta, target] of Object.entries(mapping)) {
            const valor = respuestas[pregunta];
            const texto = cellText(valor);
            if (target === 'ignorar' || target === 'nombre' || texto === '') continue;

            if (['tipo', 'direccion', 'telefono', 'descripcion', 'website'].includes(target)) datos[target] = texto;
            else if (target === 'whatsapp') datos.whatsapp = texto.replace(/[^0-9]/g, '');
            else if (target === 'instagram' || target === 'tiktok') datos[target] = texto.replace(/^@/, '').replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\/@?/, '').replace(/\/.*$/, '');
            else if (target === 'etiquetas') datos.etiquetas = texto.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
            else if (target === 'coords') {
                const c = parseCoords(texto);
                if (c) Object.assign(datos, c); else avisos.push(`No se entendió la ubicación "${texto.slice(0, 60)}"`);
            } else if (target === 'horario') {
                const { dias, entendido } = parseSchedule(texto);
                if (entendido) horario = { ...horario, ...dias }; else avisos.push(`No se entendió el horario "${texto.slice(0, 60)}"`);
            } else if (target.startsWith('horario:')) {
                const dia = DIAS[Number(target.split(':')[1])];
                const { dias, entendido } = parseSchedule(texto);
                const valorDia = dias[dia] || Object.values(dias)[0];
                if (entendido && valorDia) horario[dia] = valorDia; else avisos.push(`No se entendió el horario del ${dia.toLowerCase()}: "${texto.slice(0, 40)}"`);
            } else if (target.startsWith('car:')) {
                let car = target.slice(4);
                const yn = parseYesNo(valor);
                const n = normalize(texto);
                // "Sí, pero solo en terraza" / "Sí, en todo el local"
                if (car.startsWith('Mascotas') && yn && !/terraza|afuera|exterior/.test(n) && /todo|interior|adentro/.test(n)) car = 'Ingreso de Mascotas';
                if (yn === true) agregar.add(car);
                else if (yn === false) quitar.add(car);
                else if (/terraza|afuera|exterior/.test(n) && (car.startsWith('Mascotas') || car.startsWith('Apto para Fumadores'))) agregar.add(car);
                else avisos.push(`Respuesta poco clara para "${car}": "${texto.slice(0, 40)}"`);
            } else if (target.startsWith('dieta:')) {
                const v = dietValue(valor);
                if (v === null) avisos.push(`Respuesta poco clara para ${target.slice(6)}: "${texto.slice(0, 40)}"`);
                else dietas[target.slice(6)] = v;
            }
        }

        const base = existente || { caracteristicas: [], horariosSemana: {} };
        const caracteristicas = [...new Set([...(base.caracteristicas || []).filter(c => !quitar.has(c)), ...agregar])];
        const horariosSemana = Object.keys(horario).length
            ? Object.fromEntries(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(d => [d, horario[d] || (base.horariosSemana || {})[d] || 'Cerrado']))
            : null;

        agregar.forEach(c => { if (!(base.caracteristicas || []).includes(c)) cambios.push(`+ ${c}`); });
        quitar.forEach(c => { if ((base.caracteristicas || []).includes(c)) cambios.push(`− ${c}`); });
        Object.entries(datos).forEach(([k, v]) => { if (JSON.stringify(base[k]) !== JSON.stringify(v)) cambios.push(`${ETIQUETAS_CAMPOS[k] || k}: ${Array.isArray(v) ? v.join(', ') : v}`); });
        Object.entries(dietas).forEach(([k, v]) => { if (base[k] !== v) cambios.push(`${ETIQUETAS_CAMPOS[k]}: ${v}/5`); });
        if (horariosSemana) {
            Object.entries(horariosSemana).forEach(([d, v]) => { if ((base.horariosSemana || {})[d] !== v) cambios.push(`${d}: ${v}`); });
        }
        if (!nombre) avisos.push('Falta el nombre del local: esta respuesta no se importará.');
        if (nombre && !existente && datos.lat === undefined) avisos.push('Local nuevo sin ubicación: quedará en el centro de Talca hasta que la completes en "Locales".');

        return {
            fila, nombre, existente, cambios, avisos,
            aplicable: !!nombre,
            resultado: { ...datos, ...dietas, caracteristicas, ...(horariosSemana ? { horariosSemana } : {}) },
            respuestas
        };
    });
}
