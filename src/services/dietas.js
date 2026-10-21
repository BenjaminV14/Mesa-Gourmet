// Detecta en la carta qué platos son vegetarianos, veganos, sin gluten o sin lactosa.
// Con el servidor conectado (en línea) lo hace la IA (función "analizar-carta"); sin servidor, usa reglas por
// ingredientes comunes. En ambos casos son sugerencias que el administrador revisa antes de guardar.
import { normalize } from '../utils/text.js';
import { supabase, remoto } from './supabase.js';

const ANALIZAR_URL = import.meta.env?.VITE_MENU_DIET_URL;

const CARNE = ['carne', 'vacuno', 'res', 'lomo', 'lomito', 'pollo', 'ave', 'gallina', 'pavo', 'cerdo', 'chancho', 'costilla', 'jamon', 'tocino', 'pino', 'chorizo',
    'longaniza', 'salchicha', 'vienesa', 'saltado', 'completo', 'hot dog', 'italiano', 'dinamico', 'cordero', 'churrasco', 'barros', 'mechada', 'anticucho', 'asado',
    'parrillada', 'tartaro', 'hamburguesa', 'burger', 'pescado', 'atun', 'salmon', 'reineta', 'merluza', 'camaron', 'mariscos', 'marisco', 'ceviche',
    'jaiba', 'pulpo', 'calamar', 'chicharron', 'jalea', 'sushi', 'roll', 'nigiri', 'sashimi', 'ebi', 'ramen', 'aji de gallina', 'chorrillana', 'pastel de choclo'];
const LACTEO = ['queso', 'leche', 'crema', 'mantequilla', 'manjar', 'yogur', 'yogurt', 'latte', 'cappuccino', 'capuchino', 'mocha', 'helado', 'tres leches',
    'suspiro', 'huancaina', 'aji de gallina', 'risotto', 'parmesano', 'pastelera', 'cheesecake', 'milkshake', 'batido', 'pastel de choclo', 'crema volteada', 'leche asada'];
const HUEVO = ['huevo', 'mayo', 'mayonesa', 'completo', 'italiano', 'dinamico', 'pisco sour', 'sour', 'torta', 'kuchen', 'pie', 'brownie', 'crema volteada',
    'suspiro', 'leche asada', 'tres leches', 'churro'];
const GLUTEN = ['pan', 'sandwich', 'sanguche', 'empanada', 'pizza', 'pasta', 'tallarin', 'fideo', 'fettuccine', 'spaghetti', 'ravioli', 'lasana', 'noquis',
    'masa', 'completo', 'hot dog', 'hamburguesa', 'burger', 'churrasco', 'barros', 'lomito', 'chacarero', 'as', 'churro', 'torta', 'kuchen', 'pie', 'galleta',
    'queque', 'brownie', 'cerveza', 'schop', 'sopaipilla', 'apanado', 'tempura', 'panko', 'ramen', 'chaufa', 'soya', 'gyoza', 'tequeno', 'arepa de trigo',
    'chicharron', 'jalea', 'ebi furai', 'furai', 'saltado', 'huancaina', 'croissant', 'medialuna', 'tostada', 'waffle', 'panqueque'];
// Platos que por receta habitual no llevan gluten (se sugieren solo estos, para no arriesgar a los celíacos)
const SIN_GLUTEN_SEGURO = ['ceviche', 'papas fritas', 'papa frita', 'ensalada', 'risotto', 'causa', 'arroz', 'cafe', 'espresso', 'americano', 'cortado', 'te',
    'infusion', 'jugo', 'vino', 'pisco', 'pisco sour', 'mojito', 'agua', 'bebida', 'suspiro', 'leche asada', 'crema volteada', 'helado', 'tartaro', 'asado',
    'pastel de choclo', 'humita', 'porotos', 'cazuela', 'anticucho', 'arepa'];

const tiene = (n, lista) => lista.some(k => new RegExp(`(^| )${normalize(k)}(es|s)?( |$)`).test(n));

/** Sugerencia por reglas para un plato: ['vegetariano', 'vegano', 'sinGluten', 'sinLactosa'] */
export function sugerirDietas({ nombre = '', descripcion = '' }) {
    const n = normalize(`${nombre} ${descripcion}`).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const explicito = d => new RegExp(`(^| )(${d})( |$)`).test(n);
    const out = new Set();
    const vegetariano = explicito('vegetariano|vegetariana|veggie|vegano|vegana|plant based') || !tiene(n, CARNE);
    const sinLacteos = explicito('sin lactosa|vegano|vegana') || !tiene(n, LACTEO);
    if (vegetariano) out.add('vegetariano');
    if (explicito('vegano|vegana|plant based') || (vegetariano && sinLacteos && !tiene(n, HUEVO) && !/miel/.test(n))) out.add('vegano');
    if (sinLacteos) out.add('sinLactosa');
    if (explicito('sin gluten|gluten free|apto celiacos|celiaco') || (tiene(n, SIN_GLUTEN_SEGURO) && !tiene(n, GLUTEN))) out.add('sinGluten');
    return [...out];
}

/**
 * Analiza varios platos. Devuelve [{ dietas, dudoso, nota, origen }] en el mismo orden.
 * Usa la IA si está conectada; si falla o no hay servidor, usa las reglas.
 */
export async function analizarDietasCarta(platos) {
    if (remoto || ANALIZAR_URL) {
        try {
            const body = { platos: platos.map(p => ({ nombre: p.nombre, categoria: p.categoria, descripcion: p.descripcion })) };
            let resultado;
            if (remoto) {
                // En línea se llama a la función de Supabase con la sesión del administrador
                const { data, error } = await supabase.functions.invoke('analizar-carta', { body });
                if (error) throw error;
                resultado = data.platos;
            } else {
                const response = await fetch(ANALIZAR_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                ({ platos: resultado } = await response.json());
            }
            return platos.map((p, i) => {
                const r = resultado.find(x => x.indice === i);
                return r ? { dietas: r.dietas, dudoso: r.dudoso, nota: r.nota, origen: 'ia' } : { dietas: sugerirDietas(p), dudoso: true, nota: '', origen: 'reglas' };
            });
        } catch (err) {
            console.warn('No se pudo analizar la carta con IA; se usan las reglas:', err);
        }
    }
    return platos.map(p => ({ dietas: sugerirDietas(p), dudoso: false, nota: '', origen: 'reglas' }));
}
