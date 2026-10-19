// Datos iniciales de la demo: los locales base más patrocinios, eventos y videos de ejemplo.
import { baseLocales, baseReviews } from './seed-base.js';

export { logrosDefinitions } from './seed-base.js';

function fechaRelativa(dias) {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
}

// Próximo día de la semana (0 = domingo) a la hora indicada, en formato ISO local
function proximoDia(diaSemana, hora) {
    const d = new Date();
    const diff = (diaSemana - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    const [h, m] = hora.split(':').map(Number);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
}

const extras = {
    1: {
        etiquetas: ['peruano', 'ceviche', 'mariscos', 'pisco'],
        eventos: [
            { id: 'ev-1', titulo: 'Noche acústica en vivo', inicio: proximoDia(5, '21:00'), descripcion: 'Música acústica peruana mientras cenas.' }
        ]
    },
    2: {
        etiquetas: ['cafeteria', 'brunch', 'desayuno', 'once'],
        eventos: []
    },
    3: {
        etiquetas: ['empanadas', 'comida rapida', 'completos', 'sandwich'],
        // Patrocinio vigente: aparece primero en listas y búsquedas, con estrella en el mapa
        patrocinio: { plan: 'Destacado mensual', precio: 29990, desde: fechaRelativa(-10), hasta: fechaRelativa(20) },
        menuExtra: [
            { nombre: 'Completo Italiano', categoria: 'Completos', precio: 3500, imagen: 'https://images.unsplash.com/photo-1612392062631-94b33c7e6f6c?w=400&h=400&fit=crop', likes: 70, isDrink: false },
            { nombre: 'Completo Dinámico', categoria: 'Completos', precio: 3900, imagen: 'https://images.unsplash.com/photo-1612392062631-94b33c7e6f6c?w=400&h=400&fit=crop', likes: 41, isDrink: false },
            { nombre: 'Papas Fritas Grandes', categoria: 'Acompañamientos', precio: 2900, imagen: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop', likes: 33, isDrink: false }
        ],
        eventos: []
    },
    4: {
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
            menu: [...local.menu, ...menuExtra],
            eventos: rest.eventos || [],
            etiquetas: rest.etiquetas || []
        };
    });
}

export function buildSeedReviews() {
    return baseReviews.map(r => ({
        ...r,
        usuario: { ...r.usuario, id: `seed-${r.usuario.avatar.toLowerCase()}` },
        estado: 'publicada'
    }));
}

// Videos de ejemplo. Los reales son links de TikTok o Instagram que comparten los usuarios.
export function buildSeedVideos() {
    return [
        { id: 'vid-1', plataforma: 'tiktok', url: '', autor: '@comiendoentalca', localId: 1, descripcion: 'Probamos el ceviche más pedido del centro', estado: 'aprobado', demo: true, fecha: fechaRelativa(-3), likes: 58, likedBy: [] },
        { id: 'vid-2', plataforma: 'instagram', url: '', autor: '@talcagourmet', localId: 4, descripcion: 'Ramen miso un día de lluvia', estado: 'aprobado', demo: true, fecha: fechaRelativa(-8), likes: 34, likedBy: [] },
        { id: 'vid-3', plataforma: 'tiktok', url: '', autor: '@empanadaslovers', localId: 3, descripcion: 'Ranking de empanadas de pino en Talca', estado: 'aprobado', demo: true, fecha: fechaRelativa(-12), likes: 91, likedBy: [] }
    ];
}
