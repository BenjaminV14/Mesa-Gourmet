// Tipos de plato para las insignias y la comida favorita.
// Son más específicos que las categorías del Top 50: un "Completo italiano" y un "Completo dinámico" son
// "Completo", pero un hot dog no; un "Pastel de choclo" es pastel de choclo, no un pastel (torta).
// Cada plato pertenece a un solo tipo: se revisan en orden y gana el primero que coincide,
// por eso los nombres compuestos ("pastel de choclo", "lomo saltado") van antes que los generales.
// La insignia de un tipo aparece cuando al menos LOCALES_CON_TIPO locales lo ofrecen en su carta,
// y se desbloquea al probarlo en LOCALES_PARA_INSIGNIA locales distintos.
import { normalize } from '../utils/text.js';

export const LOCALES_CON_TIPO = 5;

// [id, nombre, emoji, insignia, categoría del Top 50 (o null), patrones]
const T = [
    ['pastel-choclo', 'Pastel de choclo', '🌽', 'Guardián del Pastel de Choclo', null, ['pastel de choclo']],
    ['pastel-jaiba', 'Pastel de jaiba', '🦀', 'Cangrejero de Ley', null, ['pastel de jaiba']],
    ['lomo-saltado', 'Lomo saltado', '🥘', 'Saltador Profesional', 'carnes', ['lomo saltado']],
    ['aji-gallina', 'Ají de gallina', '🍛', 'Corazón de Gallina', null, ['aji de gallina']],
    ['papa-huancaina', 'Papa a la huancaína', '🥔', 'Fan de la Huancaína', null, ['huancaina']],
    ['pisco-sour', 'Pisco sour', '🍸', 'Catador de Sour', 'tragos', ['pisco sour', 'sour']],
    ['piscola', 'Piscola', '🥃', 'Piscolero Oficial', 'tragos', ['piscola', 'pisco con']],
    ['terremoto', 'Terremoto', '🍹', 'Sobreviviente del Terremoto', 'tragos', ['terremoto']],
    ['barros-luco', 'Barros Luco', '🥪', 'Presidente Barros Luco', 'sandwiches', ['barros luco']],
    ['barros-jarpa', 'Barros Jarpa', '🥪', 'Senador Barros Jarpa', 'sandwiches', ['barros jarpa']],
    ['chacarero', 'Chacarero', '🥪', 'Chacarero de Tomo y Lomo', 'sandwiches', ['chacarero']],
    ['lomito', 'Lomito', '🥪', 'Lomitero Experto', 'sandwiches', ['lomito']],
    ['churrasco', 'Churrasco', '🥪', 'Churrasquero de Corazón', 'sandwiches', ['churrasco']],
    ['as', 'As', '🥪', 'As de Ases', 'sandwiches', ['as']],
    ['hot-dog', 'Hot dog', '🌭', 'Hot Dog Lover', null, ['hot dog', 'hotdog', 'perro caliente']],
    ['completo', 'Completo', '🌭', 'Rey del Completo', 'completos', ['completo', 'italiano', 'dinamico']],
    ['hamburguesa', 'Hamburguesa', '🍔', 'Burger Master', 'hamburguesas', ['hamburguesa', 'burger']],
    ['pizza', 'Pizza', '🍕', 'Pizzero de Corazón', 'pizzas', ['pizza']],
    ['empanada', 'Empanada', '🥟', 'Rey de las Empanadas', 'empanadas', ['empanada']],
    ['ceviche', 'Ceviche', '🦐', 'Maestro Cevichero', 'ceviches', ['ceviche', 'cebiche', 'seviche']],
    ['tartaro', 'Tártaro', '🥩', 'Señor del Tártaro', null, ['tartaro', 'tartar']],
    ['sushi', 'Sushi', '🍣', 'Samurái del Sushi', 'sushi', ['sushi', 'roll', 'maki', 'nigiri', 'handroll', 'sashimi']],
    ['gyoza', 'Gyozas', '🥟', 'Maestro de las Gyozas', null, ['gyoza']],
    ['ramen', 'Ramen', '🍜', 'Maestro Ramenero', 'sopas', ['ramen']],
    ['cazuela', 'Cazuela', '🍲', 'Cazuelero de Domingo', 'sopas', ['cazuela']],
    ['chorrillana', 'Chorrillana', '🍟', 'Chorrillanero de Ley', null, ['chorrillana']],
    ['papas-fritas', 'Papas fritas', '🍟', 'Papa Frita Lover', null, ['papas fritas', 'papa frita']],
    ['chaufa', 'Chaufa', '🍚', 'Wokero Experto', null, ['chaufa']],
    ['risotto', 'Risotto', '🍚', 'Risottero Fino', null, ['risotto']],
    ['asado', 'Asado', '🍖', 'Parrillero Mayor', 'carnes', ['asado', 'parrillada']],
    ['anticucho', 'Anticucho', '🍢', 'Anticuchero Mayor', 'carnes', ['anticucho']],
    ['causa', 'Causa', '🥔', 'Causa Justa', null, ['causa']],
    ['jalea', 'Jalea', '🍤', 'Jalea Lover', null, ['jalea']],
    ['chicharron', 'Chicharrón', '🍤', 'Chicharronero', null, ['chicharron']],
    ['arepa', 'Arepa', '🫓', 'Arepero de Corazón', null, ['arepa']],
    ['tequeno', 'Tequeños', '🧀', 'Tequeñero', null, ['tequeno']],
    ['pasta', 'Pasta', '🍝', 'Nonna Honoraria', 'pastas', ['tallarin', 'fettuccine', 'spaghetti', 'ravioli', 'lasana', 'noquis', 'pasta']],
    ['sopaipilla', 'Sopaipillas', '🟠', 'Sopaipillero de Lluvia', null, ['sopaipilla']],
    ['churros', 'Churros', '🥖', 'Churrero Feliz', null, ['churro']],
    ['helado', 'Helado', '🍦', 'Heladero Todo el Año', 'postres', ['helado', 'gelato']],
    ['suspiro', 'Suspiro limeño', '🍮', 'Suspiro Eterno', 'postres', ['suspiro']],
    ['tres-leches', 'Tres leches', '🍰', 'Tres Veces Goloso', 'postres', ['tres leches']],
    ['torta', 'Torta o pastel', '🍰', 'Goloso Profesional', 'postres', ['torta', 'pastel', 'kuchen', 'cheesecake', 'pie']],
    ['brownie', 'Brownie', '🍫', 'Chocolatero Serial', 'postres', ['brownie']],
    ['cafe', 'Café', '☕', 'Barista Aficionado', 'cafes', ['cafe', 'latte', 'espresso', 'cappuccino', 'capuchino', 'cortado', 'americano', 'mocha']],
    ['te', 'Té', '🍵', 'Tetero Zen', null, ['te', 'infusion', 'mate']],
    ['jugo', 'Jugo natural', '🧃', 'Jugoso', null, ['jugo', 'smoothie', 'batido']],
    ['cerveza', 'Cerveza', '🍺', 'Cervecero Artesanal', null, ['cerveza', 'schop', 'chela']],
    ['vino', 'Vino', '🍷', 'Sommelier del Maule', null, ['vino', 'cabernet', 'carmenere', 'merlot']],
    ['mojito', 'Mojito', '🍹', 'Mojitero', 'tragos', ['mojito']],
    ['sandwich', 'Sándwich', '🥪', 'Sanguchero Experto', 'sandwiches', ['sandwich', 'sanguche']]
];

export const TIPOS_PLATO = T.map(([id, nombre, emoji, insignia, categoria, patrones]) => ({ id, nombre, emoji, insignia, categoria, patrones }));

const PATRONES = TIPOS_PLATO.map(t => ({ id: t.id, re: new RegExp(`(^| )(${t.patrones.map(p => normalize(p)).join('|')})(es|s)?( |$)`) }));

/** Tipo de un plato ("Completo Italiano (x2)" -> "completo"); null si no coincide con ninguno */
export function tipoDePlato(nombre) {
    const n = normalize(String(nombre).replace(/\s*\(x\d+\)\s*$/, '')).replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    return PATRONES.find(p => p.re.test(n))?.id || null;
}

export function getTipo(id) {
    return TIPOS_PLATO.find(t => t.id === id)
        // Compatibilidad: antes la comida favorita era una categoría ("completos")
        || TIPOS_PLATO.find(t => t.categoria === id)
        || null;
}

/** Buscador de tipos para elegir la comida favorita */
export function buscarTipos(texto) {
    const q = normalize(texto).trim();
    if (!q) return TIPOS_PLATO;
    return TIPOS_PLATO.filter(t => normalize(t.nombre).includes(q) || t.patrones.some(p => normalize(p).startsWith(q) || (p.length >= 4 && q.includes(normalize(p)))));
}
