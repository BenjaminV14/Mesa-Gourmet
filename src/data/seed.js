// Datos iniciales de la demo: los locales base con sus logos, detalles, eventos, fotos de la comunidad y videos de ejemplo.
// Los datos de Ramsés, Carlota y ¡Que Empanadas! vienen de la encuesta a sus dueños (solo lo público:
// los datos internos, como el nombre del dueño o su celular, no se guardan aquí porque este código es público).
import { baseLocales, baseReviews } from './seed-base.js';
import logoRamses from '../assets/local-ramses.jpg';
import logoCarlota from '../assets/local-carlota.jpg';
import logoQueEmpanadas from '../assets/local-queempanadas.jpg';
import { nombreProducto } from './categorias.js';
import { sugerirDietas } from '../services/dietas.js';
import { normalizarCaracteristicas } from './caracteristicas.js';

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
        cartaUrl: 'https://uqr.to/LaCocinadeRamsesCartaDigital',
        mediosPago: 'Tarjeta, efectivo y transferencia',
        horasPeak: '13:00 a 16:00 y 20:00 a 23:00',
        diasPeak: 'Jueves a domingo',
        ambiente: 'Adultos y adultos mayores',
        tematica: 'Cultura peruana',
        capacidad: '30 mesas',
        referencia: 'Cerca de la Iglesia Pompeya, la Escuela de Profesores y la Plaza de Armas',
        horarioFeriados: 'Abre el 18 de septiembre, Navidad, Año Nuevo y Día del Trabajador, con el horario normal',
        etiquetas: ['peruano', 'ceviche', 'mariscos', 'pisco'],
        caracteristicasDetalle: {
            'Venta de Alcohol': 'Tragos preparados, cerveza y vino',
            'Acepta reservas': 'Al +56 71 222 3612',
            'Arriendo para eventos': 'Sector privado para 10 a 12 personas, o el local completo',
            'Estacionamiento': '6 espacios en estacionamiento y en la vereda',
            'Bicicletero': 'No hay bicicletero, pero se puede dejar en la terraza',
            'Baño / WC': 'No adaptado para silla de ruedas'
        },
        eventos: [
            { id: 'ev-1', titulo: 'Noche acústica en vivo', inicio: proximoDia(5, '21:00'), descripcion: 'Música acústica peruana mientras cenas. (Evento de ejemplo)' }
        ]
    },
    2: {
        imagen: logoCarlota,
        descripcion: 'Pastelería y panadería con ambiente vintage cerca de la Plaza de Armas. Tiene opciones veganas, sin gluten y sin lactosa.',
        mediosPago: 'Tarjeta, efectivo y transferencia',
        horasPeak: '11:00 a 12:00, 13:30 a 15:00 y 16:30 a 17:30',
        diasPeak: 'Martes, jueves y viernes',
        ambiente: 'Familiar y diverso, adultos jóvenes',
        tematica: 'Vintage',
        capacidad: '2 mesas',
        referencia: 'Plaza de Armas',
        horarioFeriados: 'Navidad y Año Nuevo de 10:00 a 15:00',
        etiquetas: ['cafeteria', 'desayuno', 'once', 'pasteleria', 'panaderia', 'vegano', 'sin gluten'],
        caracteristicasDetalle: {
            'Estacionamiento': 'Parquímetro en la Plaza de Armas',
            'Bicicletero': 'Se pueden dejar cerca',
            'Barra': 'Mesón',
            'Pedidos para llevar': 'Con reserva'
        },
        eventos: []
    },
    3: {
        imagen: logoQueEmpanadas,
        descripcion: 'Empanadas y comida rápida venezolana al paso, junto a la Plaza Cienfuegos. Pet friendly.',
        cartaUrl: 'https://que-empanadas.pedix.app/',
        mediosPago: 'Tarjeta, efectivo y transferencia',
        horasPeak: '9:00 a 13:00',
        diasPeak: 'Lunes, viernes, sábado y domingo',
        ambiente: 'Adultos y jóvenes de 25 a 40 años',
        tematica: 'Cultura venezolana',
        capacidad: '15 sillas y 2 mesas, en la terraza',
        referencia: 'Plaza Cienfuegos, bajo el Hotel Cienfuegos',
        horarioFeriados: 'Feriados y festivos de 8:30 a 14:00',
        etiquetas: ['empanadas', 'comida rapida', 'venezolana', 'completos', 'sandwich'],
        caracteristicasDetalle: {
            'Delivery': 'Uber Eats, PedidosYa y delivery propio',
            'WiFi Disponible': 'Clave: quempanadas',
            'Ingreso de Mascotas': 'Pet friendly',
            'Calefacción': 'A gas, en invierno',
            'Acceso Discapacitados': 'Por la entrada principal',
            'Estacionamiento': 'En la vereda de enfrente',
            'Barra': 'Mesón',
            'Bicicletero': 'Se puede amarrar cerca o entrar con ella',
            'Pedidos para llevar': 'Pedidos anticipados o agendados (abonando la mitad) y mix para compartir',
            'Terraza': 'Las mesas están en la terraza'
        },
        // Patrocinio vigente: aparece primero en listas y búsquedas, con estrella en el mapa (ejemplo)
        patrocinio: { plan: 'Destacado mensual', precio: 29990, desde: fechaRelativa(-10), hasta: fechaRelativa(20) },
        menuExtra: [
            { nombre: 'Completo Italiano', categoria: 'Completos', precio: 3500, imagen: 'https://images.unsplash.com/photo-1612392062631-94b33c7e6f6c?w=400&h=400&fit=crop', isDrink: false },
            { nombre: 'Completo Dinámico', categoria: 'Completos', precio: 3900, imagen: 'https://images.unsplash.com/photo-1612392062631-94b33c7e6f6c?w=400&h=400&fit=crop', isDrink: false },
            { nombre: 'Papas Fritas Grandes', categoria: 'Acompañamientos', precio: 2900, imagen: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=400&fit=crop', isDrink: false }
        ],
        eventos: []
    }
};

export function buildSeedLocales() {
    return baseLocales.map(local => {
        const extra = extras[local.id] || {};
        const { menuExtra = [], ...rest } = extra;
        return normalizarCaracteristicas({
            ...local,
            ...rest,
            // Las distinciones se calculan con el ranking mensual; se registran al cerrar cada mes
            distinciones: [],
            menu: [...local.menu, ...menuExtra].map(m => ({ ...m, likes: undefined, dietas: DIETAS_PLATOS[m.nombre] || sugerirDietas(m) })),
            eventos: rest.eventos || [],
            etiquetas: rest.etiquetas || [],
            caracteristicasDetalle: rest.caracteristicasDetalle || {}
        });
    });
}

// Likes de cada foto de ejemplo (la foto con más likes de un plato es la que aparece en la carta)
const LIKES_FOTOS = {
    'Ceviche Clásico': 122, 'Pisco Sour Peruano': 64, 'Café Latte especial': 45,
    'Empanada de Pino Horno': 58
};

const EXTRA_REVIEWS = [
    { id: 6, usuario: { nombre: 'Juan Pérez', avatar: 'JP' }, dias: 3, localId: 3, productos: ['Completo Italiano (x2)', 'Empanada Queso Frita', 'Papas Fritas Grandes'],
      fotos: [
          { item: 'Completo Italiano', url: 'https://images.unsplash.com/photo-1612392062631-94b33c7e6f6c?w=500&h=500&fit=crop', likes: 37 },
          { item: 'Empanada Queso Frita', url: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?w=500&h=500&fit=crop', likes: 12 },
          { item: 'Papas Fritas Grandes', url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500&h=500&fit=crop', likes: 5 }
      ],
      notaComida: 8.7, notaServicio: 8.1, comentario: 'Completo bien armado, pan crujiente y la palta fresca. La empanada de queso bien rellena y las papas llegaron calientes.', likes: 9 },
    { id: 7, usuario: { nombre: 'Camila Rojas', avatar: 'CR' }, dias: 9, localId: 1, productos: ['Lomo Saltado Premium', 'Chaufa de Verduras'],
      fotos: [], notaComida: 9.1, notaServicio: 8.6, comentario: 'El lomo saltado tiene el punto justo de soya y las papas no quedan blandas. Atención rápida.', likes: 5 },
    { id: 8, usuario: { nombre: 'Diego Muñoz', avatar: 'DM' }, dias: 40, localId: 2, productos: ['Café Latte especial'],
      fotos: [{ item: 'Café Latte especial', url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&h=500&fit=crop', likes: 12 }],
      notaComida: 8.2, notaServicio: 8.9, comentario: 'Buen café para trabajar un rato, el wifi anda bien y es tranquilo en la mañana.', likes: 3 }
];

// Ejemplo de cliente VIP: Sofía visitó Ramsés 5 veces el mes pasado, así que es VIP durante este mes
function visitasMesPasado() {
    const hoy = new Date().getDate();
    const platos = [['Lomo Saltado Premium'], ['Ceviche Clásico'], ['Ají de Gallina'], ['Pisco Sour Peruano'], ['Causa Rellena de Ave']];
    return platos.map((productos, k) => ({
        id: 20 + k, usuario: { nombre: 'Sofía Ibáñez', avatar: 'SI' }, dias: hoy + 1 + k * 2, localId: 1, productos, fotos: [],
        notaComida: 9 + (k % 3) * 0.2, notaServicio: 8.8 + (k % 2) * 0.3,
        comentario: ['Volví por el lomo saltado, siempre parejo.', 'El ceviche estaba fresquísimo, como siempre.', 'Probé el ají de gallina, cremoso y con buen picor.', 'Pasé solo por un pisco sour después del trabajo.', 'La causa rellena, muy bien presentada.'][k],
        likes: 1 + k
    }));
}

// Ejemplo de aviso en el panel: Diego ya va en 5 visitas a Carlota este mes
function visitasEsteMes() {
    const hoy = new Date().getDate();
    const platos = [['Café Latte especial'], ['Sándwich de Rúcula & Jamón Serrano'], ['Café Latte especial'], ['Café Latte especial'], ['Sándwich de Rúcula & Jamón Serrano']];
    return platos.map((productos, k) => ({
        id: 30 + k, usuario: { nombre: 'Diego Muñoz', avatar: 'DM' }, dias: Math.min(k * 3, hoy - 1), localId: 2, productos, fotos: [],
        notaComida: 8.4 + (k % 3) * 0.2, notaServicio: 8.9 + (k % 2) * 0.2,
        comentario: ['Mi café de todas las mañanas, siempre bien preparado.', 'El sándwich de rúcula sigue igual de bueno.', 'Pasé por un latte antes de clases.', 'Atención rápida aunque estaba lleno.', 'Ya soy cliente fijo, nunca falla.'][k],
        likes: k
    }));
}

function slug(nombre) {
    return nombre.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export function buildSeedReviews() {
    const base = baseReviews.map(r => ({
        ...r,
        fecha: new Date(`${r.fecha}T13:00:00`).toISOString(),
        fotos: r.fotoComida ? [{ item: nombreProducto(r.productos[0]), url: r.fotoComida, likes: LIKES_FOTOS[nombreProducto(r.productos[0])] || 10 }] : []
    }));
    const extra = [...EXTRA_REVIEWS, ...visitasMesPasado(), ...visitasEsteMes()].map(({ dias, ...r }) => ({ ...r, fecha: haceDias(dias), isDrink: false }));
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
        { id: 'vid-3', plataforma: 'tiktok', url: '', autor: '@empanadaslovers', localId: 3, descripcion: 'Ranking de empanadas de pino en Talca', estado: 'aprobado', demo: true, fecha: fechaRelativa(-12), likes: 91, likedBy: [] }
    ];
}
