// Tipos de comida. Se usan para las pestañas del Top 50, las insignias (logros) y "Descubrir platos".
// Un plato pertenece a una categoría si su nombre contiene alguna palabra clave:
// "Ceviche mixto peruano" -> ceviches, "Completo italiano XL" -> completos.
import { normalize } from '../utils/text.js';

export const CATEGORIAS = [
    { id: 'completos', nombre: 'Completos', emoji: '🌭', keywords: ['completo', 'hot dog', 'italiano', 'dinamico'], insignia: 'Rey del Completo' },
    { id: 'ceviches', nombre: 'Ceviches', emoji: '🦐', keywords: ['ceviche', 'cebiche', 'seviche'], insignia: 'Maestro Cevichero' },
    { id: 'pizzas', nombre: 'Pizzas', emoji: '🍕', keywords: ['pizza'], insignia: 'Pizzero de Corazón' },
    { id: 'sushi', nombre: 'Sushi', emoji: '🍣', keywords: ['sushi', 'roll', 'maki', 'nigiri', 'gyoza', 'handroll'], insignia: 'Samurái del Sushi' },
    { id: 'empanadas', nombre: 'Empanadas', emoji: '🥟', keywords: ['empanada'], insignia: 'Rey de las Empanadas' },
    { id: 'hamburguesas', nombre: 'Hamburguesas', emoji: '🍔', keywords: ['hamburguesa', 'burger'], insignia: 'Burger Master' },
    { id: 'sandwiches', nombre: 'Sándwiches', emoji: '🥪', keywords: ['sandwich', 'sanguche', 'churrasco', 'barros', 'chacarero', 'lomito', 'chemilico'], insignia: 'Sanguchero Experto' },
    { id: 'cafes', nombre: 'Cafés', emoji: '☕', keywords: ['cafe', 'latte', 'espresso', 'cappuccino', 'capuchino', 'americano', 'mocha', 'cortado'], insignia: 'Barista Aficionado' },
    { id: 'postres', nombre: 'Postres', emoji: '🍰', keywords: ['postre', 'torta', 'pie', 'kuchen', 'helado', 'suspiro', 'tres leches', 'crema volteada', 'brownie', 'cheesecake'], insignia: 'Goloso Profesional' },
    { id: 'tragos', nombre: 'Tragos', emoji: '🍸', keywords: ['pisco', 'sour', 'mojito', 'coctel', 'spritz', 'terremoto', 'piscola', 'margarita'], insignia: 'Maestro Coctelero' },
    { id: 'carnes', nombre: 'Carnes', emoji: '🥩', keywords: ['lomo', 'carne', 'asado', 'cordero', 'filete', 'costilla', 'saltado'], insignia: 'Carnívoro Consagrado' },
    { id: 'pastas', nombre: 'Pastas', emoji: '🍝', keywords: ['pasta', 'tallarin', 'fettuccine', 'ravioli', 'lasana', 'noquis', 'spaghetti'], insignia: 'Nonna Honoraria' },
    { id: 'sopas', nombre: 'Sopas y ramen', emoji: '🍜', keywords: ['ramen', 'sopa', 'cazuela', 'caldo', 'consome', 'chupe'], insignia: 'Maestro Ramenero' }
];

// Las 10 primeras categorías tienen pestaña propia en el Top 50
export const CATEGORIAS_TOP = CATEGORIAS.slice(0, 10);

export function categoriasDePlato(nombre) {
    const n = ` ${normalize(nombre)} `;
    return CATEGORIAS.filter(c => c.keywords.some(k => n.includes(` ${normalize(k)}`))).map(c => c.id);
}

export function getCategoria(id) {
    return CATEGORIAS.find(c => c.id === id);
}

// "Ceviche Clásico (x2)" -> "Ceviche Clásico"
export function nombreProducto(producto) {
    return String(producto).replace(/\s*\(x\d+\)\s*$/, '').trim();
}
