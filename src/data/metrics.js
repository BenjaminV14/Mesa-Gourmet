// Cálculos a partir de las reseñas: notas, carta por popularidad, escala dietética, rankings y clientes frecuentes.
import { db, publishedReviews, getLocal } from './store.js';
import { CATEGORIAS, categoriasDePlato, nombreProducto } from './categorias.js';
import { normalize } from '../utils/text.js';

const DIA = 86400000;
const round1 = n => Math.round(n * 10) / 10;

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function promedio(reviews) {
    if (!reviews.length) return null;
    const comida = reviews.reduce((s, r) => s + r.notaComida, 0) / reviews.length;
    const servicio = reviews.reduce((s, r) => s + r.notaServicio, 0) / reviews.length;
    return { comida: round1(comida), servicio: round1(servicio), total: round1((comida + servicio) / 2), n: reviews.length };
}

export function reviewsPublicadasDe(localId) {
    return publishedReviews().filter(r => r.localId === localId);
}

/** Nota de los últimos 30 días (la oficial) */
export function notas30(localId, now = Date.now()) {
    return promedio(reviewsPublicadasDe(localId).filter(r => now - new Date(r.fecha).getTime() <= 30 * DIA));
}

/** Nota histórica (todas las reseñas). Si no hay reseñas usa la nota inicial cargada en el panel. */
export function notasHistoricas(localId) {
    const p = promedio(reviewsPublicadasDe(localId));
    if (p) return p;
    const l = getLocal(localId);
    if (!l || !l.notaComida) return null;
    return { comida: l.notaComida, servicio: l.notaServicio, total: round1((l.notaComida + l.notaServicio) / 2), n: 0 };
}

/** La nota que se muestra en tarjetas y ranking: últimos 30 días, o histórica si no hubo reseñas recientes */
export function notaActual(localId) {
    const n30 = notas30(localId);
    if (n30) return { ...n30, periodo: '30d' };
    const h = notasHistoricas(localId);
    return h ? { ...h, periodo: 'historica' } : { comida: 0, servicio: 0, total: 0, n: 0, periodo: 'sin' };
}

// =================== CARTA ===================

/** Todas las fotos de la comunidad de un plato de un local */
export function fotosDePlato(localId, itemNombre) {
    const key = normalize(itemNombre);
    return reviewsPublicadasDe(localId).flatMap(r => (r.fotos || [])
        .filter(f => normalize(f.item) === key)
        .map(f => ({ ...f, reviewId: r.id, autor: r.usuario, fecha: f.fecha || r.fecha })));
}

/**
 * Carta del local ordenada por popularidad: cada plato muestra la foto de la comunidad con más "me gusta",
 * y esos likes definen su posición. Si dos fotos empatan, se queda la más antigua. Los platos sin fotos van al final.
 */
export function cartaLocal(local) {
    return (local.menu || []).filter(m => m.nombre).map(item => {
        // Más likes primero; si empatan, sigue la foto más antigua
        const fotos = fotosDePlato(local.id, item.nombre)
            .sort((a, b) => ((b.likes || 0) - (a.likes || 0)) || (new Date(a.fecha) - new Date(b.fecha)));
        const top = fotos[0] || null;
        return { item, foto: top, likes: top ? top.likes || 0 : 0, totalFotos: fotos.length };
    }).sort((a, b) => (b.likes - a.likes) || ((b.foto ? 1 : 0) - (a.foto ? 1 : 0)));
}

// =================== DIETAS ===================

export const DIETAS = [
    { key: 'vegetariano', label: 'Vegetariano', emoji: '🥬' },
    { key: 'vegano', label: 'Vegano', emoji: '🌱' },
    { key: 'sinGluten', label: 'Celíaco (sin gluten)', emoji: '🌾' },
    { key: 'sinLactosa', label: 'Sin lactosa', emoji: '🥛' }
];

/** Escala: 0 productos = no se muestra; 1-2 = 1★; 3-5 = 2★; 6-8 = 3★; 9-11 = 4★; 12 o más = 5★ */
export function estrellasPorCantidad(n) {
    if (n <= 0) return 0;
    if (n <= 2) return 1;
    if (n <= 5) return 2;
    if (n <= 8) return 3;
    if (n <= 11) return 4;
    return 5;
}

export function dietaLocal(local, key) {
    // Se cuenta desde la carta: cada plato marcado (por la IA al subir la carta, o a mano en el panel)
    const cantidad = (local.menu || []).filter(m => (m.dietas || []).includes(key)).length;
    return { cantidad, estrellas: estrellasPorCantidad(cantidad) };
}

// =================== RANKINGS ===================

/** Top general: locales ordenados por la nota de los últimos 30 días */
export function rankingGeneral() {
    return db.locales
        .map(local => ({ local, nota: notaActual(local.id) }))
        .filter(r => r.nota.total > 0)
        .sort((a, b) => b.nota.total - a.nota.total || b.nota.n - a.nota.n)
        .slice(0, 50)
        .map((r, i) => ({ ...r, puesto: i + 1 }));
}

/** Top por tipo de comida: promedio de la nota de comida en las reseñas que incluyen platos de esa categoría */
export function rankingCategoria(catId, now = Date.now()) {
    const filas = db.locales.map(local => {
        const tienePlato = (local.menu || []).some(m => categoriasDePlato(m.nombre).includes(catId));
        const reviews = reviewsPublicadasDe(local.id)
            .filter(r => r.productos.some(p => categoriasDePlato(nombreProducto(p)).includes(catId)));
        const recientes = reviews.filter(r => now - new Date(r.fecha).getTime() <= 30 * DIA);
        const base = recientes.length ? recientes : reviews;
        if (!tienePlato && !base.length) return null;
        const nota = base.length ? round1(base.reduce((s, r) => s + r.notaComida, 0) / base.length) : 0;
        return { local, nota: { total: nota, n: base.length } };
    }).filter(Boolean).filter(r => r.nota.total > 0);
    return filas.sort((a, b) => b.nota.total - a.nota.total || b.nota.n - a.nota.n).slice(0, 50).map((r, i) => ({ ...r, puesto: i + 1 }));
}

/** Distinciones vigentes de un local: puesto en el Top 50 general y Top 10 de cada categoría del mes */
export function distincionesActuales(localId, date = new Date()) {
    const mes = `${MESES[date.getMonth()]} ${date.getFullYear()}`;
    const out = [];
    const g = rankingGeneral().find(r => r.local.id === localId);
    if (g) out.push({ tipo: 'general', texto: `Top ${g.puesto} de Talca · ${mes}`, puesto: g.puesto });
    CATEGORIAS.slice(0, 10).forEach(c => {
        const r = rankingCategoria(c.id).find(x => x.local.id === localId);
        if (r && r.puesto <= 10) out.push({ tipo: c.id, texto: `${c.emoji} Top ${r.puesto} ${c.nombre} · ${mes}`, puesto: r.puesto });
    });
    return out;
}

/** Distinciones registradas en cierres de meses anteriores */
export function distincionesHistoricas(localId) {
    return (db.cierres || []).flatMap(c => (c.distinciones[localId] || []).map(texto => ({ texto, mes: c.mes })));
}

/** Registra las distinciones del mes (se ejecuta desde el panel al cerrar el mes) */
export function cerrarMes(date = new Date()) {
    const mes = `${MESES[date.getMonth()]} ${date.getFullYear()}`;
    const distinciones = {};
    db.locales.forEach(l => {
        const d = distincionesActuales(l.id, date).map(x => x.texto);
        if (d.length) distinciones[l.id] = d;
    });
    // Clientes de cada local en el mes: con 5 visitas o más quedan como VIP para el mes siguiente
    const clientes = {};
    db.locales.forEach(l => {
        const lista = topClientes(l.id, date).map(c => ({ id: c.usuario.id, nombre: c.usuario.nombre, username: c.usuario.username, visitas: c.visitas, vip: c.esClienteDelMes }));
        if (lista.length) clientes[l.id] = lista;
    });
    db.cierres = (db.cierres || []).filter(c => c.mes !== mes);
    db.cierres.push({ mes, fecha: date.toISOString(), distinciones, clientes });
    return { mes, total: Object.values(distinciones).flat().length };
}

/**
 * Respaldo del cierre automático: si el mes pasado quedó sin cerrar (en línea lo cierra el servidor
 * el último día a las 23:59), se cierra al abrir el panel con los datos de ese mes.
 */
export function cerrarMesPendiente(hoy = new Date()) {
    const fin = new Date(hoy.getFullYear(), hoy.getMonth(), 0, 23, 59);
    const mes = `${MESES[fin.getMonth()]} ${fin.getFullYear()}`;
    if ((db.cierres || []).some(c => c.mes === mes) || !db.reviews.length) return null;
    return cerrarMes(fin);
}

// =================== CLIENTES FRECUENTES ===================

/**
 * Visitas por persona a cada local en un mes. Cada reseña cuenta como una visita.
 * "Cliente del mes": 5 o más visitas al mismo local en el mes.
 */
export function clientesFrecuentes(localId, date = new Date(), minimo = 5) {
    const y = date.getFullYear();
    const m = date.getMonth();
    const conteo = new Map();
    db.reviews.filter(r => r.localId === localId && r.estado !== 'rechazada').forEach(r => {
        const d = new Date(r.fecha);
        if (d.getFullYear() !== y || d.getMonth() !== m) return;
        const c = conteo.get(r.usuario.id) || { usuario: r.usuario, visitas: 0, ultima: r.fecha };
        c.visitas++;
        if (r.fecha > c.ultima) c.ultima = r.fecha;
        conteo.set(r.usuario.id, c);
    });
    return [...conteo.values()].sort((a, b) => b.visitas - a.visitas).map(c => ({ ...c, esClienteDelMes: c.visitas >= minimo }));
}

/** Top 50 clientes de un local en un mes (más visitas primero; si empatan, quien vino más recientemente) */
export function topClientes(localId, date = new Date(), limite = 50) {
    return clientesFrecuentes(localId, date)
        .sort((a, b) => (b.visitas - a.visitas) || (new Date(b.ultima) - new Date(a.ultima)))
        .slice(0, limite)
        .map((c, i) => ({ ...c, puesto: i + 1 }));
}

const mesAnterior = date => new Date(date.getFullYear(), date.getMonth() - 1, 15);

/**
 * Clientes VIP vigentes de un local: el título se asigna al cerrar el mes (el último día a las 23:59).
 * Quienes fueron 5 veces o más el mes pasado son VIP durante todo este mes.
 * Mientras no exista el cierre del mes pasado, se calcula igual que lo haría el cierre.
 */
export function vipsDeLocal(localId, date = new Date()) {
    const pasado = mesAnterior(date);
    const etiqueta = `${MESES[pasado.getMonth()]} ${pasado.getFullYear()}`;
    const cierre = (db.cierres || []).find(c => c.mes === etiqueta);
    if (cierre?.clientes) {
        return (cierre.clientes[localId] || []).filter(c => c.vip)
            .map(c => ({ usuario: { id: c.id, nombre: c.nombre, username: c.username }, visitas: c.visitas, mes: MESES[pasado.getMonth()] }));
    }
    return topClientes(localId, pasado).filter(c => c.esClienteDelMes).map(c => ({ ...c, mes: MESES[pasado.getMonth()] }));
}

/** Locales donde una persona es cliente VIP ahora */
export function vipDeUsuario(userId, date = new Date()) {
    return db.locales.filter(l => vipsDeLocal(l.id, date).some(c => c.usuario.id === userId));
}
