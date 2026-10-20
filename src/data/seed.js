// Datos iniciales de la demo: los locales base con sus logos, detalles, eventos, fotos de la comunidad y videos de ejemplo.
// Los datos marcados como "ejemplo" se reemplazan con la encuesta real de cada local.
import { baseLocales, baseReviews } from './seed-base.js';
import logoRamses from '../assets/local-ramses.jpg';
import logoCarlota from '../assets/local-carlota.jpg';
import logoQueEmpanadas from '../assets/local-queempanadas.jpg';
import { nombreProducto } from './categorias.js';

function fechaRelativa(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
}

function haceDias(dias, hora = 13) {
    const d = new Date();
    d.setDate(d.getDate() - dias);
    d.setHours(hora, 0, 0, 0);
    return d.toISOString();
}

// Próximo día de la semana (0 = domingo) a la hora indicada
function proximoDia(diaSemana, hora) {
    const d = new Date();
    const diff = (diaSemana - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    const [h, m] = hora.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
}

// Platos que sirven para cada opción dietética (la escala de estrellas se calcula contando estos platos)
const DIETAS_PLATOS = {
    'Papa a la Huancaína': ['vegetariano'],
    'Risotto Vegetariano': ['vegetariano', 'sinGluten'],
    'Chaufa de Verduras': ['vegetariano', 'vegano', 'sinLactosa'],
    'Ceviche Clásico': ['sinGluten', 'sinLactosa'],
    'Suspiro Limeño': ['vegetariano', 'sinGluten'],
    'Tres Leches': ['vegetariano'],
    'Crema Volteada': ['vegetariano', 'sinGluten'],
    'Pisco Sour Peruano': ['vegetariano', 'sinGluten', 'sinLactosa'],
    'Cerveza Cusqueña': ['vegetariano', 'vegano', 'sinLactosa'],
    'Café Latte especial': ['vegetariano', 'sinGluten'],
    'Empanada Queso Frita': ['vegetariano'],
    'Papas Fritas Grandes': ['vegetariano', 'vegano', 'sinGluten', 'sinLactosa']
};

const extras = {
    1: {
        imagen: logoRamses,
        slogan: 'Sabor peruano con corazón talquino',
        mediosPago: 'Efectivo, débito, crédito y transferencia (ejemplo)',
        horasPeak: '13:00 a 15:00 y 20:30 a 22:30 (ejemplo)',
        diasPeak: 'Viernes y sábado (ejemplo)',
        ambiente: 'Familiar y parejas (ejemplo)',
        etiquetas: ['peruano', 'ceviche', 'mariscos', 'pisco'],
        website: '', tiktok: '',
        caracteristicasDetalle: {
            'WiFi Disponible': 'Clave: ramses2026 (ejemplo)',
            'Mascotas (Solo en Terraza)': 'Solo en la terraza',
            'Apto para Fumadores (Solo en Terraza)': 'Solo en la terraza',
            'Estacionamiento': 'En la calle, frente al local'
        },
        eventos: [
            { id: 'ev-1', titulo: 'Noche acústica en vivo', inicio: proximoDia(5, '21:00'), descripcion: 'Música acústica peruana mientras cenas.' }
        ]
    },
    2: {
        imagen: logoCarlota,
        slogan: 'Horneado con cariño todos los días',
        mediosPago: 'Efectivo, débito y crédito (ejemplo)',
        horasPeak: '17:00 a 19:30, hora de once (ejemplo)',
        ambiente: 'Estudiantes y amigas (ejemplo)',
        instagram: 'carlotabakedfood_talca',
        website: '', tiktok: '',
        etiquetas: ['cafeteria', 'brunch', 'desayuno', 'once', 'pasteleria', 'panaderia'],
        caracteristicasDetalle: {
            'WiFi Disponible': 'Clave: carlota123 (ejemplo)',
            'Mascotas (Solo en Terraza)': 'Solo en la terraza'
        },
        eventos: []
    },
    3: {
        imagen: logoQueEmpanadas,
        slogan: '¡Las más crujientes del Maule!',
        website: '', tiktok: '',
        etiquetas: ['empanadas', 'comida rapida', 'completos', 'sandwich'],
        // Patrocinio vigente: aparece primero en listas y búsquedas, con estrella en el mapa
        patrocinio: { plan: 'Destacado mensual', precio: 29990, desde: fechaRelativa(-10), hasta: fechaRelativa(20) },
        menuExtra: [
            { nombre: 'Completo Italiano', categoria: 'Completos', precio: 3500, imagen: 'https://images.unsplash.com/photo-1612392062631-94b33c7e6f6c?w=400&h=400&fit=crop', isDrink: false },
            { nombre: 'Completo Dinámico', categoria: 'Completos', precio: 3900, imagen: 'https://images.unsplash.com/photo-1612392062631-94b33c7e6f6c?w=400&h=400&fit=crop', isDrink: false },
            { nombre: 'Papas Fritas Grandes', categoria: 'Acompañamientos', precio: 2900, imagen: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop', isDrink: false }
        ],
        eventos: []
    },
    4: {
        ejemplo: true,
        slogan: 'Cocina japonesa de autor',
        etiquetas: ['japones', 'sushi', 'rolls', 'ramen'],
        // Patrocinio vencido: ya no tiene prioridad
        patrocinio: { plan: 'Destacado mensual', precio: 29990, desde: fechaRelativa(-45), hasta: fechaRelativa(-15) },
        eventos: [
            { id: 'ev-2', titulo: 'DJ set y cócteles', inicio: proximoDia(6, '22:00'), descripcion: 'Música en vivo y promociones en la barra.' }
        ]
    }
};

export function buildSeedLocales() {
    return baseLocales.map(local => {
        const extra = extras[local.id] || {};
        const { menuExtra = [], ...rest } = extra;
        return {
            ...local,
            ...rest,
            // Las distinciones se calculan con el ranking mensual; se registran al cerrar cada mes
            distinciones: [],
            menu: [...local.menu, ...menuExtra].map(m => ({ ...m, likes: undefined, dietas: DIETAS_PLATOS[m.nombre] || [] })),
            eventos: rest.eventos || [],
            etiquetas: rest.etiquetas || [],
            caracteristicasDetalle: rest.caracteristicasDetalle || {}
        };
    });
}

// Likes de cada foto de ejemplo (la foto con más likes de un plato es la que aparece en la carta)
const LIKES_FOTOS = {
    'Ceviche Clásico': 122, 'Pisco Sour Peruano': 64, 'Café Latte especial': 45,
    'Empanada de Pino Horno': 58, 'Sushi Roll Ebi Furai': 31
};

const EXTRA_REVIEWS = [
    { id: 6, usuario: { nombre: 'Juan Pérez', avatar: 'JP' }, dias: 3, localId: 3, productos: ['Completo Italiano (x2)', 'Papas Fritas Grandes'],
      fotos: [{ item: 'Completo Italiano', url: 'https://images.unsplash.com/photo-1612392062631-94b33c7e6f6c?w=500&h=500&fit=crop', likes: 37 }],
      notaComida: 8.7, notaServicio: 8.1, comentario: 'Completo bien armado, pan crujiente y la palta fresca. Las papas llegaron calientes.', likes: 9 },
    { id: 7, usuario: { nombre: 'Camila Rojas', avatar: 'CR' }, dias: 9, localId: 1, productos: ['Lomo Saltado Premium', 'Chaufa de Verduras'],
      fotos: [], notaComida: 9.1, notaServicio: 8.6, comentario: 'El lomo saltado tiene el punto justo de soya y las papas no quedan blandas. Atención rápida.', likes: 5 },
    { id: 8, usuario: { nombre: 'Diego Muñoz', avatar: 'DM' }, dias: 40, localId: 2, productos: ['Café Latte especial'],
      fotos: [{ item: 'Café Latte especial', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&h=500&fit=crop', likes: 12 }],
      notaComida: 8.2, notaServicio: 8.9, comentario: 'Buen café para trabajar un rato, el wifi anda bien y es tranquilo en la mañana.', likes: 3 }
];

function slug(nombre) {
    return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function buildSeedReviews() {
    const base = baseReviews.map(r => ({
        ...r,
        fecha: new Date(`${r.fecha}T13:00:00`).toISOString(),
        fotos: r.fotoComida ? [{ item: nombreProducto(r.productos[0]), url: r.fotoComida, likes: LIKES_FOTOS[nombreProducto(r.productos[0])] || 10 }] : []
    }));
    const extra = EXTRA_REVIEWS.map(({ dias, ...r }) => ({ ...r, fecha: haceDias(dias), isDrink: false }));
    return [...base, ...extra].map(r => {
        const { fotoComida, likedBy, ...rest } = r;
        void fotoComida;
        return {
            ...rest,
            usuario: { ...r.usuario, id: `seed-${slug(r.usuario.nombre)}`, username: slug(r.usuario.nombre) },
            fotos: (r.fotos || []).map((f, i) => ({ id: `f-${r.id}-${i}`, likedBy: [], ...f })),
            likedBy: likedBy || [],
            estado: 'publicada'
        };
    });
}

// Videos de ejemplo. Los reales los suben los usuarios y pasan por revisión.
export function buildSeedVideos() {
    return [
        { id: 'vid-1', plataforma: 'tiktok', url: '', autor: '@comiendoentalca', localId: 1, descripcion: 'Probamos el ceviche más pedido del centro', estado: 'aprobado', demo: true, fecha: fechaRelativa(-3), likes: 58, likedBy: [] },
        { id: 'vid-2', plataforma: 'instagram', url: '', autor: '@talcagourmet', localId: 4, descripcion: 'Ramen miso un día de lluvia', estado: 'aprobado', demo: true, fecha: fechaRelativa(-8), likes: 34, likedBy: [] },
        { id: 'vid-3', plataforma: 'tiktok', url: '', autor: '@empanadaslovers', localId: 3, descripcion: 'Ranking de empanadas de pino en Talca', estado: 'aprobado', demo: true, fecha: fechaRelativa(-12), likes: 91, likedBy: [] }
    ];
}
