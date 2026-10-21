// Importación de la encuesta a los dueños de locales (Excel o CSV).
// Reconoce qué pregunta corresponde a cada dato de la app y traduce las respuestas
// ("Sí", "No", "Solo en terraza", "Lunes a viernes 12 a 23"...) a etiquetas y horarios.
import { normalize, formatTelefono } from '../utils/text.js';

export { formatTelefono };

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
    'Delivery': ['delivery', 'despacho', 'reparto', 'envio a domicilio'],
    'Apto para menores de edad': ['menores de 18', 'menores de edad', 'ninos'],
    'Acepta reservas': ['reservar alguna mesa', 'reservar mesa', 'reserva de mesa', 'reservas'],
    'Arriendo para eventos': ['reservar el local', 'arriendo del local', 'arrendar el local'],
    'Segundo piso': ['segundo piso'],
    'Barra': ['barra', 'meson'],
    'Pedidos para llevar': ['realizar pedidos', 'para llevar', 'retiro en local', 'pedidos'],
    'Consumo en el local': ['ingresar al local', 'consumo en el local', 'comer en el local']
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
    { id: 'slogan', label: 'Slogan o frase del local', keywords: ['slogan', 'eslogan', 'refran', 'frase del local', 'lema'] },
    { id: 'facebook', label: 'Facebook', keywords: ['facebook'] },
    { id: 'cartaUrl', label: 'Link de la carta oficial', keywords: ['link de la carta', 'carta digital', 'menu digital'] },
    { id: 'referencia', label: 'Punto de referencia', keywords: ['punto de referencia', 'referencia'] },
    { id: 'horarioFeriados', label: 'Horario en feriados', keywords: ['feriados', 'festividades'] },
    { id: 'mediosPago', label: 'Medios de pago', keywords: ['medios de pago', 'formas de pago', 'metodos de pago'] },
    { id: 'capacidad', label: 'Capacidad (personas o mesas)', keywords: ['capacidad'] },
    { id: 'ambiente', label: 'Ambiente / tipo de público', keywords: ['tipo de publico', 'publico que se concentra'] },
    { id: 'tematica', label: 'Temática o decoración', keywords: ['tematica', 'decoracion'] },
    { id: 'horasPeak', label: 'Horas con más público', keywords: ['horas pick', 'horas peak', 'hora peak', 'afluencia'] },
    { id: 'diasPeak', label: 'Días con más público', keywords: ['dias son los que reciben', 'mayor cantidad de publico'] },
    { id: 'notaAcceso', label: 'Restricciones para llegar o ingresar', keywords: ['restriccion para ingresar', 'restriccion para llegar', 'restriccion'] },
    { id: 'etiquetas', label: 'Palabras clave (buscador)', keywords: ['especialidad', 'especialidades', 'palabras clave', 'plato estrella', 'platos estrella', 'plato principal'] },
    { id: 'horario', label: 'Horario (toda la semana o por días)', keywords: ['horario', 'horarios', 'hora de atencion', 'atencion al publico'] },
    ...DIAS.map((d, i) => ({ id: `horario:${i}`, label: `Horario del ${d.toLowerCase()}`, keywords: [`horario ${normalize(d)}`, `${normalize(d)}`] })),
    ...Object.entries(CARACTERISTICAS_KEYWORDS).map(([c, keywords]) => ({ id: `car:${c}`, label: `Característica: ${c}`, keywords })),
    { id: 'car:Ingreso de Mascotas', label: 'Característica: Ingreso de Mascotas (en todo el local)', keywords: [] },
    // Característica con detalle: "Sí, clave: carlota123" -> WiFi + muestra la clave al tocarla
    { id: 'det:WiFi Disponible', label: 'WiFi + clave (detalle)', keywords: ['clave del wifi', 'contrasena del wifi', 'clave wifi'] },
    { id: 'det:Delivery', label: 'Delivery + con qué empresas (detalle)', keywords: ['empresa de delivery'] },
    { id: 'det:Acepta Edenred / BAES', label: 'JUNAEB / Edenred + cómo (detalle)', keywords: ['junaeb'] },
    { id: 'det:Estacionamiento', label: 'Estacionamiento + dónde (detalle)', keywords: [] },
    { id: 'det:Acepta reservas', label: 'Reservas + teléfono (detalle)', keywords: [] },
    { id: 'interno', label: '🔒 Solo para mí (no se muestra en la app)', keywords: [] },
    ...Object.entries(DIETA_KEYWORDS).map(([k, keywords]) => ({ id: `dietaN:${k}`, label: `Platos ${{ vegano: 'veganos', vegetariano: 'vegetarianos', sinGluten: 'sin gluten (celíacos)', sinLactosa: 'sin lactosa' }[k]} (cantidad o sí/no)`, keywords })),
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

function hhmm(h, m, ampm = '') {
    let hour = Number(h);
    if (/p/i.test(ampm) && hour < 12) hour += 12;
    if (/a/i.test(ampm) && hour === 12) hour = 0;
    const min = Number(m || 0);
    if (hour > 24 || min > 59) return null;
    return `${String(hour % 24).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

// "12:00 - 23:30", "12 a 23 hrs", "12.30 a 0:00" -> "12:00 - 23:30"
function parseRange(text) {
    const times = [...text.matchAll(/(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm|a\.\s?m\.?|p\.\s?m\.?)?\s*(?:hrs?|h)?/gi)]
        .map(m => hhmm(m[1], m[2], m[3])).filter(Boolean);
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

export function horasLegibles(texto) {
    return String(texto).replace(/(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b/gi, (_, h, m, ap) => hhmm(h, m, ap) || _);
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
    vegano: 'Vegano', vegetariano: 'Vegetariano', sinGluten: 'Sin gluten', sinLactosa: 'Sin lactosa',
    veganoProductos: 'Platos veganos', vegetarianoProductos: 'Platos vegetarianos', sinGlutenProductos: 'Platos sin gluten', sinLactosaProductos: 'Platos sin lactosa',
    slogan: 'Slogan', facebook: 'Facebook', referencia: 'Punto de referencia', horarioFeriados: 'Horario feriados', mediosPago: 'Medios de pago',
    capacidad: 'Capacidad', cartaUrl: 'Carta oficial', ambiente: 'Ambiente', tematica: 'Temática', horasPeak: 'Horas con más público', diasPeak: 'Días con más público', notaAcceso: 'Para llegar'
};

const cellText = v => (v instanceof Date ? v.toLocaleDateString('es-CL') : String(v ?? '').trim());

/**
 * Convierte las hojas del archivo en una lista de respuestas por local: [{ fila, respuestas: { pregunta: valor } }].
 * Acepta tres formatos:
 *  - Una fila por local y una columna por pregunta (lo que exporta Google Forms).
 *  - Una hoja por local con dos columnas: Pregunta | Respuesta.
 *  - Una sola hoja con las preguntas en la columna A y una columna por local (nombre en la fila 1).
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
    // Una columna por local: preguntas hacia abajo en la columna A y el nombre de cada local en la fila 1
    const enColumnas = sheet.data.slice(1).filter(r => cellText(r[0]).includes('?')).length >= 5
        && sheet.data[0].slice(1).filter(c => cellText(c)).length >= 1;
    if (enColumnas) {
        const filas = sheet.data.slice(1).filter(r => cellText(r[0]));
        const preguntas = ['Nombre del local', ...new Set(filas.map(r => cellText(r[0])))];
        const respuestas = sheet.data[0].map((nombre, j) => ({ nombre: cellText(nombre), j }))
            .filter(({ nombre, j }) => j > 0 && nombre && filas.some(r => cellText(r[j])))
            .map(({ nombre, j }) => ({
                fila: `Columna "${nombre}"`,
                respuestas: { 'Nombre del local': nombre, ...Object.fromEntries(filas.map(r => [cellText(r[0]), r[j]])) }
            }));
        const vacios = sheet.data[0].slice(1).filter(c => cellText(c)).length - respuestas.length;
        return { formato: `Una columna por local${vacios ? ` (${vacios} locales sin respuestas se omiten)` : ''}`, preguntas, respuestas };
    }
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

// Compara nombres sin signos ni artículo inicial
const nombreBase = n => normalize(n).replace(/[^a-z0-9 ]/g, '').replace(/^(la|el|los|las) /, '').trim();
const mismoLocal = (a, b) => !!nombreBase(a) && nombreBase(a) === nombreBase(b);

// Un detalle que solo repite "sí", "no" o "terraza" no aporta nada
const detalleUtil = t => t && !/^(si|no|yes|terraza|en la terraza)$/.test(normalize(t));
const capitalizar = t => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * Calcula qué cambiaría en cada local, sin aplicar nada todavía.
 * mapping: { pregunta: targetId }
 */
export function planImport(responses, mapping, locales) {
    return responses.map(({ fila, respuestas }) => {
        const nombreQ = Object.keys(mapping).find(q => mapping[q] === 'nombre');
        const nombre = nombreQ ? cellText(respuestas[nombreQ]) : '';
        const existente = nombre ? (locales.find(l => normalize(l.nombre) === normalize(nombre)) || locales.find(l => mismoLocal(l.nombre, nombre))) : null;
        const cambios = [];
        const avisos = [];
        const datos = {};
        const agregar = new Set();
        const quitar = new Set();
        const dietas = {};
        const detalles = {};
        let horario = {};

        for (const [pregunta, target] of Object.entries(mapping)) {
            const valor = respuestas[pregunta];
            const texto = cellText(valor);
            if (target === 'ignorar' || target === 'nombre' || texto === '') continue;

            if (target === 'interno') continue;
            const textoLibre = ['tipo', 'direccion', 'telefono', 'descripcion', 'website', 'slogan', 'referencia', 'horarioFeriados', 'mediosPago', 'capacidad', 'ambiente', 'tematica', 'horasPeak', 'diasPeak', 'notaAcceso', 'facebook', 'instagram', 'tiktok', 'whatsapp'];
            // "No" en una pregunta de texto (sin TikTok, sin sitio web) significa que no hay dato
            if (textoLibre.includes(target) && /^(no|no tiene|no tenemos|ninguno|ninguna|-)$/.test(normalize(texto))) continue;
            if (target === 'telefono') datos.telefono = formatTelefono(texto);
            else if (['horasPeak', 'horarioFeriados'].includes(target)) datos[target] = capitalizar(horasLegibles(texto));
            else if (['tipo', 'descripcion', 'website', 'slogan', 'referencia', 'mediosPago', 'capacidad', 'ambiente', 'tematica', 'diasPeak', 'notaAcceso', 'direccion'].includes(target)) datos[target] = target === 'website' ? texto : capitalizar(texto);
            else if (target === 'cartaUrl') {
                // Solo si la respuesta es un link ("2 menús, verano e invierno" no lo es)
                const link = texto.match(/(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?/i);
                if (link && !/\s/.test(link[0])) datos.cartaUrl = link[0].startsWith('http') ? link[0] : `https://${link[0]}`;
            }
            else if (target === 'facebook') datos.facebook = texto.replace(/^@/, '').replace(/^https?:\/\/(www\.)?facebook\.com\//, '').replace(/\/.*$/, '').trim();
            else if (target.startsWith('det:')) {
                const car = target.slice(4);
                const yn = parseYesNo(valor);
                // El detalle es la respuesta sin el "sí," inicial
                const detalle = texto.replace(/^(s[ií]|yes|x)\s*[,.:;-]?\s*/i, '').trim();
                if (yn === false) quitar.add(car);
                else if (yn === true || detalle) {
                    agregar.add(car);
                    if (detalleUtil(detalle)) detalles[car] = /^[\d\s+]{8,}$/.test(detalle) ? `Al ${formatTelefono(detalle)}` : capitalizar(detalle);
                }
            } else if (target.startsWith('dietaN:')) {
                const key = target.slice(7);
                const num = texto.match(/\d+/);
                const yn = parseYesNo(valor);
                const n = num ? Number(num[0]) : yn === true ? 1 : yn === false ? 0 : null;
                if (n === null) avisos.push(`No se entendió cuántos platos ${key}: "${texto.slice(0, 40)}"`);
                else dietas[`${key}Productos`] = n;
            }
            else if (target === 'whatsapp') {
                const d = texto.replace(/[^0-9]/g, '');
                datos.whatsapp = d.length === 9 ? `56${d}` : d;
            }
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
                if (car.startsWith('Mascotas') && yn && !/terraza|afuera|exterior/.test(n) && /todo|interior|adentro|pet friendly/.test(n)) car = 'Ingreso de Mascotas';
                // Otra característica mencionada en la respuesta ("calefacción por gas" en la pregunta del aire acondicionado)
                const otra = Object.keys(CARACTERISTICAS_KEYWORDS).find(c => c !== car && CARACTERISTICAS_KEYWORDS[c].some(k => containsWord(n, normalize(k))));
                if (yn === true) {
                    agregar.add(car);
                    const extra = texto.replace(/^(s[ií]|yes|x)\s*[,.:;-]?\s*/i, '').trim();
                    if (detalleUtil(extra)) detalles[car] = capitalizar(extra);
                }
                // "No, pero en la terraza se puede": sí, con esa aclaración
                else if (/^no,? pero .*(se puede|puede|terraza)/.test(n)) {
                    agregar.add(car);
                    detalles[car] = capitalizar(texto);
                }
                else if (yn === false) {
                    quitar.add(car);
                    // "No (solo en caso de urgencia)" se guarda como aviso para que decidas
                    if (/\(|solo|pero/.test(n)) avisos.push(`"${car}": respondieron "${texto.slice(0, 50)}". Se marcó como que no tiene.`);
                }
                else if (/terraza|afuera|exterior/.test(n) && (car.startsWith('Mascotas') || car.startsWith('Apto para Fumadores'))) agregar.add(car);
                else if ((CARACTERISTICAS_KEYWORDS[car] || []).some(k => containsWord(n, normalize(k)))) {
                    agregar.add(car);
                    detalles[car] = capitalizar(texto);
                }
                else if (otra) {
                    agregar.add(otra);
                    detalles[otra] = capitalizar(texto);
                    cambios.push(`"${texto.slice(0, 40)}" → se marcó ${otra}`);
                }
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
        Object.entries(dietas).forEach(([k, v]) => { if (base[k] !== v) cambios.push(`${ETIQUETAS_CAMPOS[k] || k}: ${k.endsWith('Productos') ? `${v} platos` : `${v}/5`}`); });
        Object.entries(detalles).forEach(([k, v]) => { if ((base.caracteristicasDetalle || {})[k] !== v) cambios.push(`${k} → ${v}`); });
        if (horariosSemana) {
            Object.entries(horariosSemana).forEach(([d, v]) => { if ((base.horariosSemana || {})[d] !== v) cambios.push(`${d}: ${v}`); });
        }
        if (!nombre) avisos.push('Falta el nombre del local: esta respuesta no se importará.');
        const soloInterno = !existente && !cambios.length;
        if (soloInterno) avisos.push('Solo tiene respuestas internas: no se crea el local.');
        if (nombre && !existente && cambios.length && datos.lat === undefined) avisos.push('Local nuevo sin ubicación: quedará en el centro de Talca hasta que la completes en "Locales".');

        return {
            fila, nombre, existente, cambios, avisos,
            aplicable: !!nombre && !soloInterno,
            resultado: {
                ...datos, ...dietas, caracteristicas,
                caracteristicasDetalle: { ...(base.caracteristicasDetalle || {}), ...detalles },
                ...(horariosSemana ? { horariosSemana } : {})
            },
            respuestas
        };
    });
}
