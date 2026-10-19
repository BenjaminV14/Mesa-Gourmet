export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// Minutos antes de abrir o cerrar en que se muestra "Abre pronto" / "Cierra pronto"
const AVISO_MINUTOS = 60;

function parseRango(rango) {
    const match = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/.exec(rango || '');
    if (!match) return null;
    const start = Number(match[1]) * 60 + Number(match[2]);
    let end = Number(match[3]) * 60 + Number(match[4]);
    if (end <= start) end += 24 * 60; // cierra después de medianoche
    return { start, end };
}

function formatMinutes(total) {
    const m = ((total % 1440) + 1440) % 1440;
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/**
 * Estado del local según su horario:
 * { codigo: 'abierto' | 'cierra-pronto' | 'abre-pronto' | 'cerrado', etiqueta, detalle }
 */
export function estadoHorario(local, date = new Date()) {
    const horarios = local.horariosSemana || {};
    const now = date.getHours() * 60 + date.getMinutes();
    const hoy = parseRango(horarios[DIAS_SEMANA[date.getDay()]]);
    const ayer = parseRango(horarios[DIAS_SEMANA[(date.getDay() + 6) % 7]]);

    // Turno de ayer que sigue abierto después de medianoche
    if (ayer && now + 1440 < ayer.end) {
        const restante = ayer.end - (now + 1440);
        return restante <= AVISO_MINUTOS
            ? { codigo: 'cierra-pronto', etiqueta: 'Cierra pronto', detalle: `Cierra a las ${formatMinutes(ayer.end)}` }
            : { codigo: 'abierto', etiqueta: 'Abierto', detalle: `Cierra a las ${formatMinutes(ayer.end)}` };
    }

    if (hoy && now >= hoy.start && now < hoy.end) {
        const restante = hoy.end - now;
        return restante <= AVISO_MINUTOS
            ? { codigo: 'cierra-pronto', etiqueta: 'Cierra pronto', detalle: `Cierra a las ${formatMinutes(hoy.end)}` }
            : { codigo: 'abierto', etiqueta: 'Abierto', detalle: `Cierra a las ${formatMinutes(hoy.end)}` };
    }

    if (hoy && now < hoy.start) {
        const faltan = hoy.start - now;
        return faltan <= AVISO_MINUTOS
            ? { codigo: 'abre-pronto', etiqueta: 'Abre pronto', detalle: `Abre a las ${formatMinutes(hoy.start)}` }
            : { codigo: 'cerrado', etiqueta: 'Cerrado', detalle: `Abre hoy a las ${formatMinutes(hoy.start)}` };
    }

    // Busca la próxima apertura en los siguientes 7 días
    for (let i = 1; i <= 7; i++) {
        const dia = DIAS_SEMANA[(date.getDay() + i) % 7];
        const rango = parseRango(horarios[dia]);
        if (rango) {
            const cuando = i === 1 ? 'mañana' : `el ${dia.toLowerCase()}`;
            const faltan = 1440 - now + rango.start + (i - 1) * 1440;
            if (faltan <= AVISO_MINUTOS) {
                return { codigo: 'abre-pronto', etiqueta: 'Abre pronto', detalle: `Abre a las ${formatMinutes(rango.start)}` };
            }
            return { codigo: 'cerrado', etiqueta: 'Cerrado', detalle: `Abre ${cuando} a las ${formatMinutes(rango.start)}` };
        }
    }
    return { codigo: 'cerrado', etiqueta: 'Cerrado', detalle: 'Sin horario informado' };
}

export function estaAbierto(local, date = new Date()) {
    const { codigo } = estadoHorario(local, date);
    return codigo === 'abierto' || codigo === 'cierra-pronto';
}

export function horarioHoy(local, date = new Date()) {
    const dia = DIAS_SEMANA[date.getDay()];
    return { dia, rango: (local.horariosSemana || {})[dia] || 'Cerrado' };
}

export function timeAgo(fecha) {
    if (!fecha) return '';
    const date = new Date(fecha.length === 10 ? `${fecha}T12:00:00` : fecha);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Recién';
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24 && date.toDateString() === new Date().toDateString()) return `hace ${hours} h`;
    const days = Math.max(1, Math.round(minutes / 1440));
    if (days === 1) return 'hace 1 día';
    if (days < 30) return `hace ${days} días`;
    const months = Math.floor(days / 30);
    if (months < 12) return months === 1 ? 'hace 1 mes' : `hace ${months} meses`;
    const years = Math.floor(days / 365);
    return years === 1 ? 'hace 1 año' : `hace ${years} años`;
}

export function todayIso(date = new Date()) {
    const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return d.toISOString().split('T')[0];
}

export function formatFechaEvento(iso) {
    const d = new Date(iso);
    const dia = DIAS_SEMANA[d.getDay()];
    const fecha = d.toLocaleDateString('es-CL', { day: 'numeric', month: 'long' });
    const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    return `${dia} ${fecha} · ${hora} h`;
}
