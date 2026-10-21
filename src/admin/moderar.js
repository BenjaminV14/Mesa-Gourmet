// Casos de moderación pendientes y cómo se resuelven. Lo usan Moderación, el asistente del Resumen
// y las reglas automáticas del manual, para que todos resuelvan igual y quede anotado.
import { db, persist, getLocal } from '../data/store.js';
import { tipoCaso, registrarDecision, sugerencia } from './manual.js';

const findReview = id => db.reviews.find(r => String(r.id) === String(id));

/** Lista de casos pendientes: { tipo, id, detalle, descripcion } */
export function casosPendientes() {
    const casos = [];
    db.reviews.filter(r => r.estado === 'pendiente').forEach(r => casos.push({
        base: 'resena-revision', tipo: tipoCaso('resena-revision'), id: r.id, detalle: '',
        descripcion: `Reseña de ${r.usuario.nombre} en ${getLocal(r.localId)?.nombre || '¿?'}`
    }));
    db.moderation.filter(m => m.tipo === 'foto').forEach(m => {
        const r = findReview(m.reviewId);
        if (!r || r.estado !== 'publicada') return;
        const motivo = m.motivo || 'Sin verificar';
        casos.push({ base: 'foto', tipo: tipoCaso('foto', motivo), id: m.id, detalle: motivo, descripcion: `Foto de ${r.usuario.nombre} en ${getLocal(r.localId)?.nombre || '¿?'}` });
    });
    db.reports.filter(rep => rep.tipo === 'resena' && rep.estado === 'abierto').forEach(rep => {
        const r = findReview(rep.reviewId);
        if (!r) return;
        casos.push({ base: 'resena-reportada', tipo: tipoCaso('resena-reportada'), id: rep.id, detalle: '', descripcion: `Reseña de ${r.usuario.nombre} reportada${rep.detalle ? `: "${rep.detalle}"` : ''}` });
    });
    db.videos.filter(v => v.estado === 'pendiente').forEach(v => {
        const origen = v.archivoId ? 'subido desde la app' : v.plataforma;
        casos.push({ base: 'video', tipo: tipoCaso('video', origen), id: v.id, detalle: origen, descripcion: `Video de ${v.autor} en ${getLocal(v.localId)?.nombre || '¿?'}` });
    });
    return casos;
}

/** Aplica una decisión a un caso y la anota en el manual. Devuelve el mensaje para el aviso. */
export function resolver(base, id, decision, { anotar = true, guardar = true } = {}) {
    let msg = '';
    let tipo = tipoCaso(base);
    let caso = '';
    if (base === 'resena-revision') {
        const r = findReview(id);
        if (!r) return '';
        r.estado = decision === 'aprobar' ? 'publicada' : 'rechazada';
        if (decision === 'aprobar') (r.fotos || []).forEach(f => { f.verificada = true; });
        db.moderation = db.moderation.filter(m => m.reviewId !== r.id);
        caso = `Reseña de ${r.usuario.nombre}`;
        msg = decision === 'aprobar' ? 'Reseña publicada' : 'Reseña rechazada';
    } else if (base === 'foto') {
        const m = db.moderation.find(x => x.id === id);
        if (!m) return '';
        const r = findReview(m.reviewId);
        tipo = tipoCaso('foto', m.motivo || 'Sin verificar');
        if (r && decision === 'ok') (r.fotos || []).forEach(f => { f.verificada = true; });
        // Se quitan solo las fotos que la IA no pudo confirmar
        if (r && decision === 'quitar') r.fotos = (r.fotos || []).filter(f => f.verificada !== false);
        db.moderation = db.moderation.filter(x => x.id !== m.id);
        caso = m.motivo || 'Sin verificar';
        msg = decision === 'ok' ? 'Foto verificada' : 'Fotos dudosas quitadas de la reseña';
    } else if (base === 'resena-reportada') {
        const rep = db.reports.find(r => r.id === id);
        if (!rep) return '';
        if (decision === 'ocultar') { const r = findReview(rep.reviewId); if (r) r.estado = 'rechazada'; }
        rep.estado = 'resuelto';
        caso = rep.detalle || '';
        msg = decision === 'ocultar' ? 'Reseña ocultada' : 'Reporte descartado';
    } else if (base === 'video') {
        const v = db.videos.find(x => x.id === id);
        if (!v) return '';
        tipo = tipoCaso('video', v.archivoId ? 'subido desde la app' : v.plataforma);
        v.estado = decision === 'publicar' ? 'aprobado' : 'rechazado';
        caso = v.descripcion || '';
        msg = decision === 'publicar' ? 'Video publicado' : 'Video rechazado';
    }
    if (anotar) registrarDecision(tipo, decision, caso.slice(0, 200));
    if (guardar) persist();
    return msg;
}

/** Resuelve solos los casos que tienen una regla automática. Devuelve cuántos resolvió. */
export function aplicarReglasAutomaticas() {
    let n = 0;
    for (const c of casosPendientes()) {
        const s = sugerencia(c.tipo);
        if (s?.automatico) { resolver(c.base, c.id, s.decision, { anotar: false, guardar: false }); n++; }
    }
    if (n) persist();
    return n;
}
