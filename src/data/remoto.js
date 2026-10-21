// Sincronización con Supabase.
// La app sigue trabajando sobre el objeto `db` (igual que en la demo). Al abrir se llena desde Supabase,
// y cada vez que algo se guarda (persist) se compara con la última versión sincronizada y se envían
// solo los cambios: reseñas nuevas con sus fotos, "me gusta", reportes, videos y, para el administrador,
// locales, cartas, eventos, promociones, destacados, moderación y la encuesta.
// Lo propio de cada persona (perfil, favoritos, "quiero ir", seguidos, guardados) se envía al guardar la sesión.
import { supabase, remoto } from '../services/supabase.js';
import { db, registrarSincronizacion } from './store.js';
import { state, normalizeUser } from '../state.js';

const FOTOS = 'fotos-resenas';
const VIDEOS = 'videos';
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let avisar = msg => console.warn(msg);
let foto = null;        // última versión sincronizada de los datos (para saber qué cambió)
let fotoUsuario = null; // ídem para lo propio de la persona
let esAdmin = false;
let cola = Promise.resolve();

/** Mensaje para errores al guardar (la app y el panel muestran sus propios avisos) */
export function configurarAvisos(fn) { avisar = fn; }

export function urlPublica(bucket, path) {
    if (!path) return null;
    if (/^(https?:|data:|blob:)/.test(path)) return path;
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

const lista = async consulta => {
    const { data, error } = await consulta;
    if (error) throw error;
    return data || [];
};

// =================== DE LA BASE DE DATOS A LA APP ===================

function localDesdeFila(l, extra) {
    const patros = extra.patrocinios.filter(p => p.local_id === l.id);
    const [ultimo, ...anteriores] = patros;
    return {
        id: l.id, nombre: l.nombre, tipo: l.tipo, slogan: l.slogan || '', direccion: l.direccion || '',
        referencia: l.referencia || '', notaAcceso: l.nota_acceso || '', telefono: l.telefono || '',
        whatsapp: l.whatsapp || '', whatsappReservas: l.whatsapp_reservas || '', instagram: l.instagram || '',
        tiktok: l.tiktok || '', facebook: l.facebook || '', website: l.website || '', cartaUrl: l.carta_url || '',
        descripcion: l.descripcion || '', imagen: l.imagen_url || '', lat: l.lat, lng: l.lng,
        horariosSemana: l.horarios || {}, horarioFeriados: l.horario_feriados || '', mediosPago: l.medios_pago || '',
        capacidad: l.capacidad || '', ambiente: l.ambiente || '', tematica: l.tematica || '',
        horasPeak: l.horas_peak || '', diasPeak: l.dias_peak || '',
        caracteristicas: l.caracteristicas || [], caracteristicasDetalle: l.caracteristicas_detalle || {},
        etiquetas: l.etiquetas || [], notaComida: Number(l.nota_comida) || 0, notaServicio: Number(l.nota_servicio) || 0,
        distinciones: [], activo: l.activo,
        menu: extra.platos.filter(p => p.local_id === l.id).map(p => ({
            nombre: p.nombre, categoria: p.categoria, precio: p.precio, imagen: p.imagen_url || '',
            isDrink: p.es_bebida, dietas: p.dietas || []
        })),
        eventos: extra.eventos.filter(e => e.local_id === l.id).map(e => ({ id: String(e.id), titulo: e.titulo, inicio: e.inicio, descripcion: e.descripcion || '' })),
        promociones: extra.promociones.filter(p => p.local_id === l.id).map(p => ({
            descripcion: p.descripcion, icono: p.icono || '🏷️', metodo: p.metodo || '', dias: p.dias || [],
            horaInicio: (p.hora_inicio || '').slice(0, 5), horaFin: (p.hora_fin || '').slice(0, 5)
        })),
        patrocinio: ultimo ? {
            plan: ultimo.plan, precio: ultimo.precio, desde: ultimo.desde, hasta: ultimo.hasta, pagado: ultimo.pagado,
            historial: anteriores.map(p => ({ desde: p.desde, hasta: p.hasta }))
        } : undefined,
        ...(extra.encuestas[l.id] ? { encuesta: extra.encuestas[l.id] } : {})
    };
}

function usuarioDesdePerfil(p) {
    return p ? { id: p.id, nombre: p.nombre, username: p.username, avatarUrl: p.avatar_url || null } : { id: '?', nombre: 'Usuario', username: '' };
}

function resenaDesdeFila(r, misLikes, misFotoLikes, uid) {
    return {
        id: r.id, localId: r.local_id, usuario: usuarioDesdePerfil(r.autor), fecha: r.creado_at,
        productos: r.productos || [], notaComida: Number(r.nota_comida), notaServicio: Number(r.nota_servicio),
        comentario: r.comentario, precioPersona: r.precio_persona, enPromocion: r.en_promocion, estado: r.estado,
        likes: r.likes || 0, likedBy: misLikes.has(r.id) ? [uid] : [],
        fotos: (r.resena_fotos || []).sort((a, b) => new Date(a.creado_at) - new Date(b.creado_at)).map(f => ({
            id: f.id, item: f.plato, url: urlPublica(FOTOS, f.path), path: f.path, verificada: f.verificada,
            likes: f.likes || 0, likedBy: misFotoLikes.has(f.id) ? [uid] : [], fecha: f.creado_at
        }))
    };
}

function videoDesdeFila(v, misLikes, uid) {
    return {
        id: v.id, plataforma: v.plataforma, url: v.url || '', archivoUrl: urlPublica(VIDEOS, v.archivo_path),
        portada: urlPublica(VIDEOS, v.portada_path), autor: v.autor?.username ? `@${v.autor.username}` : '',
        usuarioId: v.usuario_id, localId: v.local_id, descripcion: v.descripcion || '', estado: v.estado,
        motivoRevision: v.motivo_revision || '', fecha: v.creado_at, likes: v.likes || 0, likedBy: misLikes.has(v.id) ? [uid] : []
    };
}

/** Trae todo desde Supabase y reemplaza los datos de la app */
export async function cargarTodo({ admin = false } = {}) {
    const uid = (await supabase.auth.getSession()).data.session?.user.id || null;
    const conCuenta = consulta => (uid ? lista(consulta) : Promise.resolve([]));
    const [locales, platos, eventos, promociones, patrocinios, resenas, rLikes, fLikes, videos, vLikes, cierres] = await Promise.all([
        lista(supabase.from('locales').select('*').order('id')),
        lista(supabase.from('platos').select('*').order('orden')),
        conCuenta(supabase.from('eventos').select('*')),
        conCuenta(supabase.from('promociones').select('*')),
        lista(supabase.from('patrocinios').select('*').order('hasta', { ascending: false })),
        lista(supabase.from('resenas').select('*, autor:perfiles!resenas_usuario_id_fkey(id, nombre, username, avatar_url), resena_fotos(*)').order('creado_at', { ascending: false }).limit(1000)),
        conCuenta(supabase.from('resena_likes').select('resena_id').eq('usuario_id', uid)),
        conCuenta(supabase.from('foto_likes').select('foto_id').eq('usuario_id', uid)),
        lista(supabase.from('videos').select('*, autor:perfiles!videos_usuario_id_fkey(username)').order('creado_at', { ascending: false }).limit(300)),
        conCuenta(supabase.from('video_likes').select('video_id').eq('usuario_id', uid)),
        lista(supabase.from('cierres_mes').select('*'))
    ]);
    let reportes = [], moderacion = [], encuestas = [], preguntas = [];
    if (admin) {
        [reportes, moderacion, encuestas, preguntas] = await Promise.all([
            lista(supabase.from('reportes').select('*, autor:perfiles!reportes_usuario_id_fkey(id, nombre)').order('creado_at', { ascending: false })),
            lista(supabase.from('moderacion').select('*').eq('resuelto', false)),
            lista(supabase.from('encuestas_locales').select('*')),
            lista(supabase.from('encuesta_preguntas').select('*').order('orden'))
        ]);
    }
    esAdmin = admin;
    const encuestasPorLocal = Object.fromEntries(encuestas.map(e => [e.local_id, { respuestas: e.respuestas || {}, actualizada: e.actualizada_at }]));
    const misLikes = new Set(rLikes.map(x => x.resena_id));
    const misFotoLikes = new Set(fLikes.map(x => x.foto_id));
    const misVideoLikes = new Set(vLikes.map(x => x.video_id));

    db.locales = locales.map(l => localDesdeFila(l, { platos, eventos, promociones, patrocinios, encuestas: encuestasPorLocal }));
    db.reviews = resenas.map(r => resenaDesdeFila(r, misLikes, misFotoLikes, uid));
    db.videos = videos.map(v => videoDesdeFila(v, misVideoLikes, uid));
    db.cierres = cierres.map(c => ({ mes: c.mes, fecha: c.creado_at, distinciones: c.distinciones || {} }));
    db.reports = reportes.map(r => ({
        id: r.id, tipo: r.tipo, localId: r.local_id, reviewId: r.resena_id, detalle: r.detalle || '', estado: r.estado,
        fecha: r.creado_at, usuario: { id: r.usuario_id, nombre: r.autor?.nombre || 'Usuario' }
    }));
    // Moderación: lo que marcó la IA + fotos de reseñas publicadas que aún nadie verificó
    const marcadas = moderacion.map(m => ({ id: `mod-${m.id}`, dbId: m.id, tipo: 'foto', reviewId: m.resena_id, fotoId: m.foto_id, motivo: m.motivo, fecha: m.creado_at }));
    const sinVerificar = admin ? db.reviews
        .filter(r => r.estado === 'publicada' && r.fotos.some(f => !f.verificada) && !marcadas.some(m => m.reviewId === r.id))
        .map(r => ({ id: `sinv-${r.id}`, tipo: 'foto', reviewId: r.id, motivo: 'Foto sin verificar', fecha: r.fecha })) : [];
    db.moderation = [...marcadas, ...sinVerificar];
    db.encuesta = admin && preguntas.length
        ? { preguntas: preguntas.map(p => ({ id: p.id, seccion: p.seccion, texto: p.texto, uso: p.uso, sugerencia: p.sugerencia || '' })) }
        : (admin ? null : db.encuesta);
    foto = tomarFoto();
}

// =================== PERFIL Y SESIÓN ===================

/** Carga la cuenta de la persona (perfil, favoritos, seguidos, guardados) y la deja en state.user */
export async function cargarUsuario(session) {
    const uid = session.user.id;
    const [perfiles, favoritos, quiero, siguiendo, guardados] = await Promise.all([
        lista(supabase.from('perfiles').select('*').eq('id', uid)),
        lista(supabase.from('favoritos').select('local_id').eq('usuario_id', uid)),
        lista(supabase.from('quiero_ir').select('local_id').eq('usuario_id', uid)),
        lista(supabase.from('seguidores').select('seguido_id').eq('seguidor_id', uid)),
        lista(supabase.from('guardados').select('tipo, item_id').eq('usuario_id', uid))
    ]);
    const p = perfiles[0] || {};
    const meta = session.user.user_metadata || {};
    const preferencias = p.preferencias || {};
    state.user = normalizeUser({
        id: uid,
        email: session.user.email,
        nombre: p.nombre || meta.full_name || meta.name || session.user.email.split('@')[0],
        username: p.username,
        avatarUrl: p.avatar_url || meta.avatar_url || null,
        rol: p.rol || 'usuario',
        bloqueado: !!p.bloqueado,
        productoFavorito: p.producto_favorito || null,
        bienvenidaVista: preferencias.bienvenidaVista ?? !!p.producto_favorito,
        preferencias: { notificaciones: true, mostrarEnRanking: true, perfilPublico: true, ...preferencias },
        favoritos: favoritos.map(f => f.local_id),
        quieroIr: quiero.map(f => f.local_id),
        siguiendo: siguiendo.map(s => s.seguido_id),
        guardados: {
            resenas: guardados.filter(g => g.tipo === 'resena').map(g => g.item_id),
            videos: guardados.filter(g => g.tipo === 'video').map(g => g.item_id)
        },
        creado: p.creado_at
    });
    state.isGuest = false;
    fotoUsuario = fotoDeUsuario(state.user);
    return state.user;
}

function fotoDeUsuario(u) {
    return {
        perfil: JSON.stringify(filaDePerfil(u)),
        favoritos: new Set(u.favoritos),
        quieroIr: new Set(u.quieroIr),
        siguiendo: new Set(u.siguiendo),
        guardados: new Set([...u.guardados.resenas.map(id => `resena:${id}`), ...u.guardados.videos.map(id => `video:${id}`)])
    };
}

function filaDePerfil(u) {
    return {
        nombre: u.nombre, username: u.username, avatar_url: u.avatarUrl || null, producto_favorito: u.productoFavorito || null,
        preferencias: { ...(u.preferencias || {}), bienvenidaVista: !!u.bienvenidaVista }
    };
}

async function subirImagen(bucket, path, dataUrl) {
    const blob = await (await fetch(dataUrl)).blob();
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
    if (error) throw error;
    return path;
}

// Diferencias entre dos conjuntos: [agregados, quitados]
const cambios = (antes, ahora) => [[...ahora].filter(x => !antes.has(x)), [...antes].filter(x => !ahora.has(x))];

async function sincronizarUsuario(u) {
    if (!u || !fotoUsuario || !state.user || u.id !== state.user.id) return;
    const uid = u.id;
    if (u.avatarUrl?.startsWith('data:')) {
        const path = await subirImagen(FOTOS, `${uid}/avatar-${Date.now()}.jpg`, u.avatarUrl);
        u.avatarUrl = urlPublica(FOTOS, path);
        db.reviews.filter(r => r.usuario.id === uid).forEach(r => { r.usuario.avatarUrl = u.avatarUrl; });
    }
    const ahora = fotoDeUsuario(u);
    if (ahora.perfil !== fotoUsuario.perfil) {
        const { error } = await supabase.from('perfiles').update(filaDePerfil(u)).eq('id', uid);
        if (error) throw error;
    }
    const tablas = [
        ['favoritos', 'favoritos', id => ({ usuario_id: uid, local_id: id }), q => q],
        ['quieroIr', 'quiero_ir', id => ({ usuario_id: uid, local_id: id }), q => q]
    ];
    for (const [campo, tabla, fila] of tablas) {
        const [mas, menos] = cambios(fotoUsuario[campo], ahora[campo]);
        if (mas.length) { const { error } = await supabase.from(tabla).insert(mas.map(fila)); if (error) throw error; }
        for (const id of menos) await supabase.from(tabla).delete().eq('usuario_id', uid).eq('local_id', id);
    }
    const [seguir, dejar] = cambios(fotoUsuario.siguiendo, ahora.siguiendo);
    const seguirValidos = seguir.filter(id => ES_UUID.test(id) && id !== uid);
    if (seguirValidos.length) { const { error } = await supabase.from('seguidores').insert(seguirValidos.map(id => ({ seguidor_id: uid, seguido_id: id }))); if (error) throw error; }
    for (const id of dejar) await supabase.from('seguidores').delete().eq('seguidor_id', uid).eq('seguido_id', id);
    const [guardar, quitar] = cambios(fotoUsuario.guardados, ahora.guardados);
    const filasGuardar = guardar.map(k => k.split(':')).filter(([, id]) => ES_UUID.test(id)).map(([tipo, item_id]) => ({ usuario_id: uid, tipo, item_id }));
    if (filasGuardar.length) { const { error } = await supabase.from('guardados').insert(filasGuardar); if (error) throw error; }
    for (const k of quitar) {
        const [tipo, id] = k.split(':');
        await supabase.from('guardados').delete().eq('usuario_id', uid).eq('tipo', tipo).eq('item_id', id);
    }
    fotoUsuario = ahora;
}

// =================== DE LA APP A LA BASE DE DATOS ===================

function filaDeLocal(l) {
    return {
        id: l.id, nombre: l.nombre, tipo: l.tipo || 'Restaurante', slogan: l.slogan || null, direccion: l.direccion || null,
        referencia: l.referencia || null, nota_acceso: l.notaAcceso || null, telefono: l.telefono || null,
        whatsapp: l.whatsapp || null, whatsapp_reservas: l.whatsappReservas || null, instagram: l.instagram || null,
        tiktok: l.tiktok || null, facebook: l.facebook || null, website: l.website || null, carta_url: l.cartaUrl || null,
        descripcion: l.descripcion || null, imagen_url: l.imagen || null, lat: Number(l.lat), lng: Number(l.lng),
        horarios: l.horariosSemana || {}, horario_feriados: l.horarioFeriados || null, medios_pago: l.mediosPago || null,
        capacidad: l.capacidad || null, ambiente: l.ambiente || null, tematica: l.tematica || null,
        horas_peak: l.horasPeak || null, dias_peak: l.diasPeak || null, caracteristicas: l.caracteristicas || [],
        caracteristicas_detalle: l.caracteristicasDetalle || {}, etiquetas: l.etiquetas || []
    };
}
const platosDe = l => (l.menu || []).filter(m => m.nombre).map((m, i) => ({
    local_id: l.id, nombre: m.nombre, categoria: m.categoria || 'Otros', precio: Math.max(0, Number(m.precio) || 0),
    imagen_url: m.imagen || null, es_bebida: !!m.isDrink, dietas: m.dietas || [], orden: i
}));
const eventosDe = l => (l.eventos || []).map(e => ({ local_id: l.id, titulo: e.titulo, inicio: e.inicio, descripcion: e.descripcion || null }));
const promosDe = l => (l.promociones || []).map(p => ({
    local_id: l.id, descripcion: p.descripcion, icono: p.icono || '🏷️', metodo: p.metodo || null, dias: p.dias || [],
    hora_inicio: p.horaInicio || null, hora_fin: p.horaFin || null
}));
const patrociniosDe = l => !l.patrocinio ? [] : [
    { local_id: l.id, plan: l.patrocinio.plan, precio: l.patrocinio.precio, desde: l.patrocinio.desde, hasta: l.patrocinio.hasta, pagado: !!l.patrocinio.pagado },
    ...(l.patrocinio.historial || []).map(h => ({ local_id: l.id, plan: l.patrocinio.plan, precio: l.patrocinio.precio, desde: h.desde, hasta: h.hasta, pagado: true }))
];

function tomarFoto() {
    const uid = state.user?.id;
    const mapa = (items, clave, valor) => new Map(items.map(x => [clave(x), JSON.stringify(valor(x))]));
    return {
        locales: mapa(db.locales, l => l.id, filaDeLocal),
        menus: mapa(db.locales, l => l.id, platosDe),
        eventos: mapa(db.locales, l => l.id, eventosDe),
        promos: mapa(db.locales, l => l.id, promosDe),
        patrocinios: mapa(db.locales, l => l.id, patrociniosDe),
        encuestas: mapa(db.locales, l => l.id, l => l.encuesta?.respuestas || null),
        resenas: mapa(db.reviews, r => r.id, r => ({ estado: r.estado, fotos: (r.fotos || []).map(f => [f.id, !!f.verificada]) })),
        resenaLikes: new Set(db.reviews.filter(r => (r.likedBy || []).includes(uid)).map(r => r.id)),
        fotoLikes: new Set(db.reviews.flatMap(r => r.fotos || []).filter(f => (f.likedBy || []).includes(uid)).map(f => f.id)),
        videos: new Map(db.videos.map(v => [v.id, v.estado])),
        videoLikes: new Set(db.videos.filter(v => (v.likedBy || []).includes(uid)).map(v => v.id)),
        reportes: new Map(db.reports.map(r => [r.id, r.estado])),
        moderacion: new Map(db.moderation.map(m => [m.id, m])),
        preguntas: JSON.stringify(db.encuesta?.preguntas || null),
        cierres: new Set((db.cierres || []).map(c => c.mes))
    };
}

async function subirResena(r, uid) {
    const { error } = await supabase.from('resenas').insert({
        id: r.id, local_id: r.localId, usuario_id: uid, productos: r.productos, nota_comida: r.notaComida,
        nota_servicio: r.notaServicio, comentario: r.comentario, precio_persona: r.precioPersona || null,
        en_promocion: !!r.enPromocion, estado: r.estado === 'pendiente' ? 'pendiente' : 'publicada'
    });
    if (error) throw error;
    for (const f of r.fotos || []) {
        if (!ES_UUID.test(f.id)) continue;
        const path = f.url?.startsWith('data:') ? await subirImagen(FOTOS, `${uid}/${r.id}/${f.id}.jpg`, f.url) : f.path;
        if (!path) continue;
        const { error: e2 } = await supabase.from('resena_fotos').insert({ id: f.id, resena_id: r.id, usuario_id: uid, plato: f.item, path });
        if (e2) throw e2;
        f.path = path;
        f.url = urlPublica(FOTOS, path);
        f.verificada = false;
    }
    // La IA revisa las fotos en el servidor (si la función está publicada; si no, quedan para el panel)
    if ((r.fotos || []).length) supabase.functions.invoke('verificar-foto', { body: { resena_id: r.id } }).catch(() => {});
}

async function subirVideo(v, uid) {
    let archivo = null;
    let portada = null;
    if (v.archivoId) {
        const { getVideoBlob } = await import('../services/media.js');
        const blob = await getVideoBlob(v.archivoId);
        if (blob) {
            archivo = `${uid}/${v.id}.${(blob.type.split('/')[1] || 'mp4').replace('quicktime', 'mov')}`;
            const { error } = await supabase.storage.from(VIDEOS).upload(archivo, blob, { contentType: blob.type || 'video/mp4' });
            if (error) throw error;
        }
    }
    if (v.portada?.startsWith('data:')) portada = await subirImagen(VIDEOS, `${uid}/${v.id}-portada.jpg`, v.portada);
    const { error } = await supabase.from('videos').insert({
        id: v.id, usuario_id: uid, local_id: v.localId, plataforma: archivo ? 'archivo' : v.plataforma,
        url: archivo ? null : v.url || null, archivo_path: archivo, portada_path: portada,
        descripcion: v.descripcion || null, estado: 'pendiente', motivo_revision: v.motivoRevision || null
    });
    if (error) throw error;
    if (archivo) v.archivoUrl = urlPublica(VIDEOS, archivo);
}

async function reemplazar(tabla, localId, filas) {
    const { error } = await supabase.from(tabla).delete().eq('local_id', localId);
    if (error) throw error;
    if (filas.length) {
        const { error: e2 } = await supabase.from(tabla).insert(filas);
        if (e2) throw e2;
    }
}

async function sincronizarDatos() {
    if (!foto) return;
    const uid = state.user?.id;
    const conCuenta = !!uid && ES_UUID.test(uid);
    const ahora = tomarFoto();

    if (conCuenta) {
        // Reseñas nuevas de la persona (con sus fotos)
        for (const r of db.reviews) {
            if (!foto.resenas.has(r.id) && r.usuario.id === uid && ES_UUID.test(r.id)) await subirResena(r, uid);
        }
        // "Me gusta" en reseñas, fotos y videos
        for (const [tabla, campo, antes, ahoraSet] of [
            ['resena_likes', 'resena_id', foto.resenaLikes, ahora.resenaLikes],
            ['foto_likes', 'foto_id', foto.fotoLikes, ahora.fotoLikes],
            ['video_likes', 'video_id', foto.videoLikes, ahora.videoLikes]
        ]) {
            const [mas, menos] = cambios(antes, ahoraSet);
            if (mas.length) { const { error } = await supabase.from(tabla).insert(mas.map(id => ({ [campo]: id, usuario_id: uid }))); if (error) throw error; }
            for (const id of menos) await supabase.from(tabla).delete().eq(campo, id).eq('usuario_id', uid);
        }
        // Videos y reportes nuevos
        for (const v of db.videos) if (!foto.videos.has(v.id) && v.usuarioId === uid && ES_UUID.test(v.id)) await subirVideo(v, uid);
        for (const rep of db.reports) {
            if (foto.reportes.has(rep.id) || !ES_UUID.test(rep.id)) continue;
            const { error } = await supabase.from('reportes').insert({
                id: rep.id, usuario_id: uid, local_id: rep.localId || null,
                resena_id: ES_UUID.test(String(rep.reviewId || '')) ? rep.reviewId : null,
                tipo: rep.tipo, detalle: rep.detalle || null, estado: 'abierto'
            });
            if (error) throw error;
        }
    }

    if (esAdmin) {
        // Locales y todo lo que cuelga de ellos
        for (const l of db.locales) {
            const id = l.id;
            if (ahora.locales.get(id) !== foto.locales.get(id)) {
                const { error } = await supabase.from('locales').upsert(filaDeLocal(l));
                if (error) throw error;
            }
            if (ahora.menus.get(id) !== foto.menus.get(id)) await reemplazar('platos', id, platosDe(l));
            if (ahora.eventos.get(id) !== foto.eventos.get(id)) await reemplazar('eventos', id, eventosDe(l));
            if (ahora.promos.get(id) !== foto.promos.get(id)) await reemplazar('promociones', id, promosDe(l));
            if (ahora.patrocinios.get(id) !== foto.patrocinios.get(id)) await reemplazar('patrocinios', id, patrociniosDe(l));
            if (ahora.encuestas.get(id) !== foto.encuestas.get(id) && l.encuesta?.respuestas) {
                const { error } = await supabase.from('encuestas_locales').upsert({ local_id: id, respuestas: l.encuesta.respuestas, actualizada_at: new Date().toISOString() });
                if (error) throw error;
            }
        }
        for (const id of foto.locales.keys()) {
            if (!ahora.locales.has(id)) await supabase.from('locales').delete().eq('id', id);
        }
        // Moderación de reseñas y fotos
        for (const r of db.reviews) {
            const antes = foto.resenas.get(r.id);
            if (!antes || antes === ahora.resenas.get(r.id)) continue;
            const previo = JSON.parse(antes);
            if (previo.estado !== r.estado) await supabase.from('resenas').update({ estado: r.estado }).eq('id', r.id);
            const fotosAntes = new Map(previo.fotos);
            for (const f of r.fotos || []) {
                if (fotosAntes.has(f.id) && fotosAntes.get(f.id) !== !!f.verificada) await supabase.from('resena_fotos').update({ verificada: !!f.verificada }).eq('id', f.id);
            }
            for (const [fid] of previo.fotos) {
                if (!(r.fotos || []).some(f => f.id === fid)) await supabase.from('resena_fotos').delete().eq('id', fid);
            }
        }
        for (const id of foto.resenas.keys()) {
            if (!ahora.resenas.has(id)) await supabase.from('resenas').delete().eq('id', id);
        }
        for (const [id, m] of foto.moderacion) {
            if (!ahora.moderacion.has(id) && m.dbId) await supabase.from('moderacion').update({ resuelto: true }).eq('id', m.dbId);
        }
        for (const v of db.videos) {
            if (foto.videos.has(v.id) && foto.videos.get(v.id) !== v.estado) await supabase.from('videos').update({ estado: v.estado }).eq('id', v.id);
        }
        for (const rep of db.reports) {
            if (foto.reportes.has(rep.id) && foto.reportes.get(rep.id) !== rep.estado) await supabase.from('reportes').update({ estado: rep.estado }).eq('id', rep.id);
        }
        // Banco de preguntas de la encuesta y cierres de mes
        if (ahora.preguntas !== foto.preguntas && db.encuesta?.preguntas) {
            await supabase.from('encuesta_preguntas').delete().neq('id', '');
            const { error } = await supabase.from('encuesta_preguntas').insert(db.encuesta.preguntas.map((p, i) => ({ id: p.id, seccion: p.seccion, texto: p.texto, uso: p.uso, sugerencia: p.sugerencia || null, orden: i })));
            if (error) throw error;
        }
        for (const c of db.cierres || []) {
            if (!foto.cierres.has(c.mes)) {
                const { error } = await supabase.from('cierres_mes').upsert({ mes: c.mes, distinciones: c.distinciones });
                if (error) throw error;
            }
        }
    }
    // Lo que se acaba de enviar queda como la nueva versión sincronizada
    foto = ahora;
}

/** Encola un trabajo para que los guardados no se pisen entre sí */
function encolar(trabajo) {
    cola = cola.then(trabajo).catch(err => {
        console.error('Error al guardar en Supabase:', err);
        import('../services/supabase.js').then(m => avisar(m.mensajeError(err)));
        // Se vuelve a la versión del servidor para no quedar con datos que no se guardaron
        foto = tomarFoto();
    });
    return cola;
}

/** Espera a que terminen los guardados pendientes */
export function esperarGuardado() {
    return cola;
}

let tiempoReal = null;

/** Escucha reseñas, fotos y videos nuevos de otras personas y recarga los datos */
export function escucharCambios(alCambiar) {
    if (tiempoReal) return;
    let espera = null;
    const recargar = () => {
        clearTimeout(espera);
        espera = setTimeout(() => encolar(async () => {
            await cargarTodo({ admin: esAdmin });
            alCambiar?.();
            window.dispatchEvent(new CustomEvent('mg:data-changed'));
        }), 1500);
    };
    tiempoReal = supabase.channel('cambios-app')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resenas' }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'resena_fotos' }, recargar)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'videos' }, recargar)
        .subscribe();
}

if (remoto) {
    registrarSincronizacion({
        datos: () => encolar(sincronizarDatos),
        usuario: u => encolar(() => sincronizarUsuario(u))
    });
}
