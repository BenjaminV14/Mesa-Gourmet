// Manual de decisiones: cada vez que resuelves algo en el panel (una foto dudosa, una reseña reportada,
// un video) queda anotado. Cuando repites la misma decisión para el mismo tipo de caso, el asistente
// la sugiere; y si la marcas como "automática", el panel la aplica solo a los casos nuevos.
import { db, persist } from '../data/store.js';
import { normalize } from '../utils/text.js';
import { nuevoId } from '../utils/id.js';

export const CASOS = {
    'resena-revision': { titulo: 'Reseña con foto dudosa (en revisión)', opciones: { aprobar: 'Publicar la reseña', rechazar: 'Rechazar la reseña' } },
    foto: { titulo: 'Foto que la IA no pudo confirmar', opciones: { ok: 'Dejar la foto', quitar: 'Quitar la foto' } },
    'resena-reportada': { titulo: 'Reseña reportada por un usuario', opciones: { mantener: 'Mantener la reseña', ocultar: 'Ocultar la reseña' } },
    video: { titulo: 'Video por aprobar', opciones: { publicar: 'Publicar el video', rechazar: 'Rechazar el video' } }
};

// Reglas fijas de la app (no dependen de tus decisiones)
export const REGLAS_FIJAS = [
    { titulo: 'Clientes VIP', texto: 'Quien tiene 5 visitas o más a un local en el mes queda como VIP de ese local al cerrar el mes (el último día a las 23:59), y lo es durante todo el mes siguiente. Cada local ve su lista de clientes frecuentes al cierre.' },
    { titulo: 'Cierre del mes', texto: 'El último día de cada mes a las 23:59 se guardan solos el Top 50, el Top 10 de cada categoría y los clientes de cada local.' },
    { titulo: 'Fotos de reseñas', texto: 'Las reseñas se publican al instante. La IA revisa cada foto en segundo plano y solo te avisa aquí cuando no corresponde al plato.' },
    { titulo: 'Promociones y eventos', texto: 'Una promoción con fecha de término desaparece sola al día siguiente; un evento deja de mostrarse 4 horas después de empezar.' },
    { titulo: 'Destacados', texto: 'Al vencer el plan, el local deja de salir primero y pierde la estrella sin que tengas que hacer nada.' }
];

const slug = t => normalize(t || '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/** Tipo de caso: el tipo base más un detalle que lo distingue (ej. "foto:no-es-comida", "video:tiktok") */
export const tipoCaso = (base, detalle = '') => detalle ? `${base}:${slug(detalle)}` : base;
const baseDe = tipo => tipo.split(':')[0];

export function nombreCaso(tipo, detalle) {
    const caso = CASOS[baseDe(tipo)];
    return `${caso?.titulo || tipo}${detalle ? ` · ${detalle}` : ''}`;
}
export const nombreDecision = (tipo, decision) => CASOS[baseDe(tipo)]?.opciones[decision] || decision;

export function registrarDecision(tipo, decision, caso = '') {
    db.decisiones = [...(db.decisiones || []), { id: `dec-nuevo-${nuevoId()}`, tipo, caso, decision, fecha: new Date().toISOString() }];
}

/** Lo que has decidido antes para este tipo de caso: { decision, veces, total } si hay un patrón claro */
export function aprendido(tipo) {
    const previas = (db.decisiones || []).filter(d => d.tipo === tipo);
    if (previas.length < 2) return null;
    const conteo = {};
    previas.forEach(d => { conteo[d.decision] = (conteo[d.decision] || 0) + 1; });
    const [decision, veces] = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0];
    return veces / previas.length >= 0.75 ? { decision, veces, total: previas.length } : null;
}

/** Sugerencia para un caso: primero tu regla, si no, tu patrón de decisiones */
export function sugerencia(tipo) {
    const regla = db.reglas?.[tipo];
    if (regla) return { decision: regla.decision, fuente: 'regla', automatico: !!regla.automatico };
    const a = aprendido(tipo);
    return a ? { ...a, fuente: 'patron' } : null;
}

export function guardarRegla(tipo, decision, automatico, nota = '') {
    db.reglas = { ...(db.reglas || {}), [tipo]: { decision, automatico, nota } };
    persist();
}

export function quitarRegla(tipo) {
    const { [tipo]: _, ...resto } = db.reglas || {};
    db.reglas = resto;
    persist();
}

/** Todos los tipos de caso que conoce el manual: los que tienen regla o decisiones anotadas */
export function entradasManual() {
    const tipos = new Set([...Object.keys(db.reglas || {}), ...(db.decisiones || []).map(d => d.tipo)]);
    return [...tipos].map(tipo => {
        const previas = (db.decisiones || []).filter(d => d.tipo === tipo);
        return { tipo, regla: db.reglas?.[tipo] || null, aprendido: aprendido(tipo), total: previas.length, ejemplo: previas.at(-1)?.caso || '' };
    }).sort((a, b) => b.total - a.total);
}
