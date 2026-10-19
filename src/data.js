// =================== LOGROS GASTRONÓMICOS DEFINITIONS ===================
window.logrosDefinitions = [
    { id: 'cevichero',  titulo: 'Maestro Cevichero',      emoji: '🦐', descripcion: 'Prueba 5 ceviches en la comunidad',       keywords: ['ceviche'],                              required: 5 },
    { id: 'barista',    titulo: 'Barista Aficionado',      emoji: '☕', descripcion: 'Consume 5 cafés especiales',              keywords: ['café', 'latte', 'espresso', 'cappuccino', 'americano'], required: 5 },
    { id: 'sushero',    titulo: 'Samurái del Sushi',       emoji: '🍣', descripcion: 'Degusta 5 rolls o nigiris',              keywords: ['sushi', 'roll', 'maki', 'nigiri', 'ebi'],required: 5 },
    { id: 'empanero',   titulo: 'Rey de las Empanadas',    emoji: '🥟', descripcion: 'Come 5 empanadas artesanales',           keywords: ['empanada'],                             required: 5 },
    { id: 'piscotero',  titulo: 'Maestro Piscotero',       emoji: '🍸', descripcion: 'Toma 5 piscos sour',                     keywords: ['pisco'],                                required: 5 },
    { id: 'carnivoro',  titulo: 'Carnívoro Consagrado',    emoji: '🥩', descripcion: 'Prueba 5 platos de carne',               keywords: ['lomo', 'carne', 'asado', 'cordero', 'saltado'], required: 5 },
    { id: 'ramenero',   titulo: 'Maestro Ramenero',        emoji: '🍜', descripcion: 'Degusta 5 ramenes o sopas',              keywords: ['ramén', 'ramen', 'sopa', 'miso'],       required: 5 },
];

const defaultUser = {
    type: 'registered',
    name: 'Juan Gourmet',
    email: 'juan@mesagourmet.cl',
    password: '123',
    favorites: [2, 3],
    visitedLocales: [],
    canReview: true,
    canLike: true,
    favoriteProduct: null,   // Producto favorito elegido al inicio
    firstLoginDone: false,   // Para mostrar el modal de producto favorito solo una vez
    level: 0                 // Nivel guardado (para detectar subidas)
};

const defaultLocales = [
    {
        id: 1,
        nombre: "La Cocina de Ramsés",
        tipo: "Restaurante Peruano",
        horariosSemana: {
            "Lunes": "13:00 - 22:45",
            "Martes": "13:00 - 22:45",
            "Miércoles": "13:00 - 22:45",
            "Jueves": "13:00 - 23:45",
            "Viernes": "13:00 - 23:45",
            "Sábado": "13:00 - 23:45",
            "Domingo": "13:00 - 17:30"
        },
        notaComida: 9.3,
        notaServicio: 8.9,
        notaMG: 9.1,
        direccion: "1 Sur, 3 Poniente, Talca",
        telefono: "+56 9 1234 5678",
        caracteristicas: [
            "Baño / WC", 
            "WiFi Disponible", 
            "Terraza", 
            "Mascotas (Solo en Terraza)", 
            "Seguridad Completa", 
            "Calefacción", 
            "Aire Acondicionado / Ventilación",
            "Acceso Discapacitados",
            "Estacionamiento",
            "Venta de Alcohol",
            "Apto para Fumadores (Solo en Terraza)"
        ],
        abierto: true,
        vegano: 0,
        vegetariano: 1,
        sinGluten: 0,
        sinLactosa: 0,
        imagen: "https://pfst.cf2.poecdn.net/base/image/ad48a2c8b09509a91815033cddaf46ab1ee509b787d085b8dbae5645bde29aac?w=1080&h=1080",
        descripcion: "Auténtica gastronomía peruana en el corazón de Talca. Sabores tradicionales preparados por expertos chefs.",
        instagram: "lacocinaderamses",
        whatsapp: "+56912345678",
        menu: [
            { nombre: "Ceviche Clásico", categoria: "Entradas", precio: 9500, imagen: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=400&h=400&fit=crop", likes: 85, isDrink: false },
            { nombre: "Papa a la Huancaína", categoria: "Entradas", precio: 5800, imagen: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=400&fit=crop", likes: 50, isDrink: false },
            { nombre: "Causa Rellena de Ave", categoria: "Entradas", precio: 7200, imagen: "https://images.unsplash.com/photo-1626777552726-4a6b54c97e46?w=400&h=400&fit=crop", likes: 64, isDrink: false },
            { nombre: "Anticucho Peruano", categoria: "Entradas", precio: 8500, imagen: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop", likes: 72, isDrink: false },
            { nombre: "Tallarines Verdes con Lomo", categoria: "Pastas", precio: 10500, imagen: "https://images.unsplash.com/photo-1599321955726-ffb29659dc69?w=400&h=400&fit=crop", likes: 92, isDrink: false },
            { nombre: "Fettuccine a la Huancaína con Camarones", categoria: "Pastas", precio: 11200, imagen: "https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=400&h=400&fit=crop", likes: 78, isDrink: false },
            { nombre: "Tallarín Saltado Criollo", categoria: "Pastas", precio: 9800, imagen: "https://images.unsplash.com/photo-1585032226651-759b368d7246?w=400&h=400&fit=crop", likes: 59, isDrink: false },
            { nombre: "Chaufa de Mariscos", categoria: "Enjoy Peru", precio: 9800, imagen: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=400&fit=crop", likes: 88, isDrink: false },
            { nombre: "Risotto de Camarones", categoria: "Enjoy Peru", precio: 12500, imagen: "https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=400&h=400&fit=crop", likes: 70, isDrink: false },
            { nombre: "Risotto Vegetariano", categoria: "Enjoy Peru", precio: 9500, imagen: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&h=400&fit=crop", likes: 35, isDrink: false },
            { nombre: "Chaufa de Verduras", categoria: "Enjoy Peru", precio: 7800, imagen: "https://images.unsplash.com/photo-1512058564366-18510be2db19?w=400&h=400&fit=crop", likes: 40, isDrink: false },
            { nombre: "Arroz con Mariscos a la Limeña", categoria: "Enjoy Peru", precio: 11500, imagen: "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=400&h=400&fit=crop", likes: 67, isDrink: false },
            { nombre: "Lomo Saltado Premium", categoria: "Carnes y Aves", precio: 11900, imagen: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop", likes: 95, isDrink: false },
            { nombre: "Ají de Gallina", categoria: "Carnes y Aves", precio: 8900, imagen: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&h=400&fit=crop", likes: 81, isDrink: false },
            { nombre: "Seco de Cordero con Frijoles", categoria: "Carnes y Aves", precio: 12900, imagen: "https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=400&fit=crop", likes: 62, isDrink: false },
            { nombre: "Pescado a lo Macho", categoria: "Pescados y Mariscos", precio: 12900, imagen: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&h=400&fit=crop", likes: 83, isDrink: false },
            { nombre: "Jalea Mixta", categoria: "Pescados y Mariscos", precio: 13500, imagen: "https://images.unsplash.com/photo-1534604973900-c43ab4c2e0ab?w=400&h=400&fit=crop", likes: 75, isDrink: false },
            { nombre: "Chicharrón de Pescado", categoria: "Pescados y Mariscos", precio: 10900, imagen: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=400&h=400&fit=crop", likes: 66, isDrink: false },
            { nombre: "Suspiro Limeño", categoria: "Postres", precio: 3800, imagen: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&h=400&fit=crop", likes: 89, isDrink: false },
            { nombre: "Tres Leches", categoria: "Postres", precio: 3500, imagen: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400&h=400&fit=crop", likes: 72, isDrink: false },
            { nombre: "Crema Volteada", categoria: "Postres", precio: 3200, imagen: "https://images.unsplash.com/photo-1587314168485-3236d6710814?w=400&h=400&fit=crop", likes: 45, isDrink: false },
            { nombre: "Pisco Sour Peruano", categoria: "Tragos Elaborados", precio: 4800, imagen: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=400&h=400&fit=crop", likes: 110, isDrink: true },
            { nombre: "Cerveza Cusqueña", categoria: "Venta de Cerveza", precio: 3200, imagen: "https://images.unsplash.com/photo-1600788886242-5c96aabe3757?w=400&h=400&fit=crop", likes: 65, isDrink: true }
        ],
        distinciones: ["🏆 Local del Mes - Agosto 2026"],
        promociones: [
            { descuento: 20, descripcion: "20% en Lomo Saltado", metodo: "Efectivo o Débito", dias: [1, 2], horaInicio: "12:00", horaFin: "16:00", icono: "🥩" }
        ],
        lat: -35.4150,
        lng: -71.6600,
        sorteoFlash: {
            premio: "Cena para 2 en La Cocina de Ramsés",
            duracionMs: 3 * 60 * 1000,   // cada ronda dura 3 minutos
            pausaMs: 10 * 60 * 1000,     // y vuelve 10 minutos después de terminar
            expiraTimestamp: Date.now() + 180000
        }
    },
    {
        id: 2,
        nombre: "La Carlota",
        tipo: "Café & Restaurant",
        horariosSemana: {
            "Lunes": "08:00 - 22:00",
            "Martes": "08:00 - 22:00",
            "Miércoles": "08:00 - 22:00",
            "Jueves": "08:00 - 22:00",
            "Viernes": "08:00 - 23:00",
            "Sábado": "09:00 - 23:00",
            "Domingo": "Cerrado"
        },
        notaComida: 8.5,
        notaServicio: 9.1,
        notaMG: 8.8,
        direccion: "1 Sur, entre 1 Oriente y 1 Poniente, Talca",
        telefono: "+56 9 8765 4321",
        caracteristicas: ["WiFi Disponible", "Terraza", "Mascotas (Solo en Terraza)", "Baño / WC", "Calefacción", "Bicicletero"],
        abierto: true,
        vegano: 4,
        vegetariano: 5,
        sinGluten: 3,
        sinLactosa: 2,
        imagen: "https://pfst.cf2.poecdn.net/base/image/ae3a7d327acc774921e9090011a68e79fb0571bdd270186fbc4a62cc47ec0ada?w=886&h=886",
        descripcion: "Ambiente acogedor en el centro de Talca. Ideal para trabajar o compartir un rico café de especialidad.",
        website: "https://lacarlotacafe.cl",
        instagram: "lacarlota_talca",
        tiktok: "lacarlota_cafe",
        whatsapp: "+56987654321",
        menu: [
            { nombre: "Café Latte especial", categoria: "Bebidas", precio: 3200, imagen: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400&h=400&fit=crop", likes: 82, isDrink: true },
            { nombre: "Sándwich de Rúcula & Jamón Serrano", categoria: "Sándwiches", precio: 6500, imagen: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=400&h=400&fit=crop", likes: 48, isDrink: false }
        ],
        distinciones: ["🏅 Top 5 Septiembre de 2025"],
        promociones: [
            { descuento: 15, descripcion: "15% en cafetería de especialidad", metodo: "Banco Estado", dias: [1, 2, 3], horaInicio: "08:00", horaFin: "12:00", icono: "☕" }
        ],
        lat: -35.4320,
        lng: -71.6480
    },
    {
        id: 3,
        nombre: "¡Que Empanadas!",
        tipo: "Empanadas & Comida Rápida",
        horariosSemana: {
            "Lunes": "10:00 - 21:00",
            "Martes": "10:00 - 21:00",
            "Miércoles": "10:00 - 21:00",
            "Jueves": "10:00 - 21:00",
            "Viernes": "10:00 - 22:00",
            "Sábado": "10:00 - 22:00",
            "Domingo": "Cerrado"
        },
        notaComida: 8.6,
        notaServicio: 8.2,
        notaMG: 8.4,
        direccion: "1 Sur, 3 Oriente, Talca",
        telefono: "+56 9 5555 6666",
        caracteristicas: ["Baño / WC", "Terraza", "Acepta Edenred / BAES"],
        abierto: true,
        vegano: 2,
        vegetariano: 3,
        sinGluten: 1,
        sinLactosa: 1,
        imagen: "https://pfst.cf2.poecdn.net/base/image/fec7eb499280efdd4a0b5170c1d1a9dc5f9253b24553a593244244ed4c65660f?w=1016&h=1016",
        descripcion: "Las empanadas más crujientes y sabrosas de la región del Maule. Relleno abundante garantizado.",
        website: "https://queempanadas.cl",
        instagram: "queempanadas_talca",
        tiktok: "que_empanadas",
        whatsapp: "+56955556666",
        menu: [
            { nombre: "Empanada de Pino Horno", categoria: "Empanadas", precio: 2200, imagen: "https://images.unsplash.com/photo-1604467715878-83e57e8bc129?w=400&h=400&fit=crop", likes: 95, isDrink: false },
            { nombre: "Empanada Queso Frita", categoria: "Empanadas", precio: 1800, imagen: "https://images.unsplash.com/photo-1509722747041-616f39b57569?w=400&h=400&fit=crop", likes: 80, isDrink: false }
        ],
        distinciones: ["🏅 Top 12 Diciembre de 2025"],
        promociones: [
            { descuento: 10, descripcion: "10% llevando más de 6 unidades", metodo: "Efectivo", dias: [5, 6], horaInicio: "10:00", horaFin: "14:00", icono: "🥟" }
        ],
        lat: -35.4380,
        lng: -71.6550
    },
    {
        id: 4,
        nombre: "Sushi Zen",
        tipo: "Comida Japonesa",
        horariosSemana: {
            "Lunes": "Cerrado",
            "Martes": "18:00 - 01:00",
            "Miércoles": "18:00 - 01:00",
            "Jueves": "18:00 - 01:00",
            "Viernes": "18:00 - 02:00",
            "Sábado": "18:00 - 02:00",
            "Domingo": "18:00 - 00:00"
        },
        notaComida: 9.4,
        notaServicio: 9.0,
        notaMG: 9.2,
        direccion: "2 Sur 567, Talca",
        telefono: "+56 9 8765 0000",
        caracteristicas: ["Baño / WC", "WiFi Disponible", "Venta de Alcohol", "Acceso Discapacitados", "Aire Acondicionado / Ventilación"],
        abierto: false,
        vegano: 3,
        vegetariano: 4,
        sinGluten: 2,
        sinLactosa: 1,
        imagen: "https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?w=500&h=500&fit=crop",
        descripcion: "Sabor oriental refinado en Talca. Rolls de autor con materias primas premium seleccionadas.",
        website: "https://sushizentalca.cl",
        instagram: "sushizen_talca",
        tiktok: "sushizen_talca",
        whatsapp: "+56987650000",
        menu: [
            { nombre: "Sushi Roll Ebi Furai", categoria: "Rolls", precio: 8900, imagen: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=400&h=400&fit=crop", likes: 120, isDrink: false },
            { nombre: "Ramén Miso de Cerdo", categoria: "Sopas", precio: 9500, imagen: "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&h=400&fit=crop", likes: 104, isDrink: false }
        ],
        distinciones: ["🏅 Top 2 Octubre de 2025"],
        promociones: [
            { descuento: 25, descripcion: "25% en rolls seleccionados", metodo: "Tarjeta Banco de Chile", dias: [2, 3], horaInicio: "18:00", horaFin: "21:00", icono: "🍣" }
        ],
        lat: -35.4200,
        lng: -71.6700
    }
];

const getPastDateStr = (daysAgo) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
};

const defaultReviews = [
    {
        id: 1,
        usuario: { nombre: "María Fernández", avatar: "MF" },
        fecha: getPastDateStr(25),
        localId: 1,
        productos: ["Ceviche Clásico", "Pisco Sour Peruano"],
        fotoComida: "https://images.unsplash.com/photo-1535399831218-d5bd36d1a6b3?w=500&h=500&fit=crop",
        notaComida: 9.5,
        notaServicio: 9.0,
        comentario: "¡Increíble la frescura del Ceviche Clásico! El Pisco Sour estaba en su punto exacto, bien cítrico y espumoso. Excelente servicio y muy limpio.",
        likes: 23,
        likedBy: [],
        isDrink: false
    },
    {
        id: 2,
        usuario: { nombre: "Carlos Rodriguez", avatar: "CR" },
        fecha: getPastDateStr(60),
        localId: 2,
        productos: ["Café Latte especial", "Sándwich de Rúcula & Jamón Serrano"],
        fotoComida: "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500&h=500&fit=crop",
        notaComida: 8.8,
        notaServicio: 9.2,
        comentario: "El Café Latte es espectacular, con un arte latte hermoso. El sándwich crujiente y fresco. Un lugar ideal para pasar la tarde.",
        likes: 15,
        likedBy: ["juan@mesagourmet.cl"],
        isDrink: true
    },
    {
        id: 3,
        usuario: { nombre: "Ana Silva", avatar: "AS" },
        fecha: getPastDateStr(5),
        localId: 3,
        productos: ["Empanada de Pino Horno"],
        fotoComida: "https://images.unsplash.com/photo-1604467715878-83e57e8bc129?w=500&h=500&fit=crop",
        notaComida: 8.9,
        notaServicio: 8.0,
        comentario: "Las empanadas de pino al horno son gigantes y la carne muy bien aliñada sin repetirse. Un clásico talquino indispensable.",
        likes: 12,
        likedBy: [],
        isDrink: false
    },
    {
        id: 4,
        usuario: { nombre: "Pedro Morales", avatar: "PM" },
        fecha: getPastDateStr(120),
        localId: 4,
        productos: ["Sushi Roll Ebi Furai", "Ramén Miso de Cerdo"],
        fotoComida: "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=500&h=500&fit=crop",
        notaComida: 9.6,
        notaServicio: 9.2,
        comentario: "El roll Ebi Furai es gigante y el panko súper crujiente. El ramen tiene un caldo denso y sabroso. 100% recomendado.",
        likes: 31,
        likedBy: [],
        isDrink: false
    },
    {
        id: 5,
        usuario: { nombre: "Sofía Ibáñez", avatar: "SI" },
        fecha: getPastDateStr(1),
        localId: 1,
        productos: ["Pisco Sour Peruano"],
        fotoComida: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=500&h=500&fit=crop",
        notaComida: 9.8,
        notaServicio: 9.4,
        comentario: "Fui por unos tragos con amigos y el Pisco Sour Peruano es sin duda el mejor de Talca. Seco, equilibrado y helado.",
        likes: 42,
        likedBy: ["juan@mesagourmet.cl"],
        isDrink: true
    }
];

// =================== INICIALIZACIÓN ===================
window.locales     = JSON.parse(localStorage.getItem('mesaLocales'))  || defaultLocales;
window.reviewsData = JSON.parse(localStorage.getItem('mesaReviews'))  || defaultReviews;
window.currentUser = JSON.parse(localStorage.getItem('mesaUser'))     || defaultUser;

// Version check — restablecer si faltan campos clave
const checkVersion = window.locales.some(l =>
    !l.hasOwnProperty('horariosSemana') ||
    (l.nombre === "La Cocina de Ramsés" && !l.caracteristicas.includes("Apto para Fumadores (Solo en Terraza)"))
);
if (checkVersion) {
    window.locales     = defaultLocales;
    window.reviewsData = defaultReviews;
    window.currentUser = defaultUser;
    localStorage.removeItem('mesaLocales');
    localStorage.removeItem('mesaReviews');
    localStorage.removeItem('mesaUser');
}

// Migración suave de campos nuevos en el usuario existente
if (window.currentUser) {
    if (!window.currentUser.hasOwnProperty('favoriteProduct'))  window.currentUser.favoriteProduct  = null;
    if (!window.currentUser.hasOwnProperty('firstLoginDone'))   window.currentUser.firstLoginDone   = false;
    if (!window.currentUser.hasOwnProperty('level'))            window.currentUser.level             = 0;
}

// Los "me gusta" ahora se guardan por usuario
window.reviewsData.forEach(r => {
    if (!Array.isArray(r.likedBy)) r.likedBy = r.liked ? [defaultUser.email] : [];
    delete r.liked;
    delete r.tiempoTranscurrido;
});

// Restaurar sorteos flash que versiones anteriores borraban al expirar
window.locales.forEach(l => {
    const original = defaultLocales.find(d => d.id === l.id);
    if (original && original.sorteoFlash && !l.sorteoFlash) {
        l.sorteoFlash = { ...original.sorteoFlash };
    }
});

window.saveData = function() {
    localStorage.setItem('mesaLocales',  JSON.stringify(window.locales));
    localStorage.setItem('mesaReviews',  JSON.stringify(window.reviewsData));
    localStorage.setItem('mesaUser',     JSON.stringify(window.currentUser));
};

if (!localStorage.getItem('mesaLocales')) {
    window.saveData();
}
