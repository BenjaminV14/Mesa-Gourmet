// Ficha de un local: Info, Carta, Reseñas y Eventos y promociones (esta última solo para cuentas registradas)
import { state, isLoggedIn } from '../state.js';
import { getLocal, addReport, saveSession } from '../data/store.js';
import { notas30, notasHistoricas, cartaLocal, DIETAS, dietaLocal, distincionesActuales, distincionesHistoricas, reviewsPublicadasDe } from '../data/metrics.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';
import { estadoBadge, sponsoredBadge, emptyState, ratingStars } from '../ui/cards.js';
import { esc, safeUrl, formatPrice } from '../utils/html.js';
import { estadoHorario, DIAS_SEMANA, formatFechaEvento } from '../utils/time.js';
import { requireAccount } from './auth.js';
import { reviewCard } from './review-card.js';
import { openReviewForm } from './review-form.js';
import { isSponsored } from './sponsors.js';
import { track } from '../services/analytics.js';

const FEATURE_ICONS = {
    'Seguridad Completa': '🛡️', 'Calefacción': '🔥', 'Aire Acondicionado / Ventilación': '❄️',
    'Venta de Alcohol': '🍺', 'Mascotas (Solo en Terraza)': '🐾', 'Ingreso de Mascotas': '🐾',
    'Apto para Fumadores (Solo en Terraza)': '🚬', 'Apto para Fumadores': '🚬', 'Acepta Edenred / BAES': '💳', 'Acceso Discapacitados': '♿',
    'Estacionamiento': '🚗', 'Bicicletero': '🚲', 'Baño / WC': '🚻', 'WiFi Disponible': '📶', 'Terraza': '🪑', 'Delivery': '🛵',
    'Apto para menores de edad': '👨‍👩‍👧', 'Acepta reservas': '📅', 'Arriendo para eventos': '🎉', 'Segundo piso': '🪜',
    'Barra': '🍸', 'Pedidos para llevar': '🥡', 'Consumo en el local': '🍽️'
};

// Lo que conviene saber antes de ir (sale de la encuesta; solo se muestra lo que existe)
const ANTES_DE_IR = [
    ['referencia', '📍', 'Referencia'],
    ['notaAcceso', '🚶', 'Para llegar'],
    ['mediosPago', '💳', 'Medios de pago'],
    ['horasPeak', '⏰', 'Más gente'],
    ['diasPeak', '📆', 'Días con más gente'],
    ['ambiente', '👥', 'Ambiente'],
    ['tematica', '🎨', 'Decoración'],
    ['capacidad', '🪑', 'Capacidad']
];

let currentTab = 'info';

export function showLocalDetail(localId, tab = 'info') {
    const local = getLocal(Number(localId));
    if (!local) return;
    state.currentLocalId = local.id;
    track('ver_local', { localId: local.id, destacado: isSponsored(local) });

    const tabs = [
        ['info', 'Info'],
        ['menu', 'Carta'],
        ['resenas', 'Reseñas'],
        ...(isLoggedIn() ? [['eventos', 'Eventos y promos']] : [])
    ];
    const fav = isLoggedIn() && state.user.favoritos.includes(local.id);
    const quiero = isLoggedIn() && state.user.quieroIr.includes(local.id);

    document.getElementById('detailContent').innerHTML = `
        <header class="detail-header detail-hero">
            <button class="back-btn" data-action="close-local">← Volver</button>
            <div class="hero-actions">
                <button class="hero-icon fav-btn ${fav ? 'is-fav' : ''}" data-action="toggle-fav" data-id="${local.id}" aria-pressed="${fav}" aria-label="Favorito" title="Favorito">❤️</button>
                <button class="hero-icon quiero-btn ${quiero ? 'is-on' : ''}" data-action="toggle-quiero" data-id="${local.id}" aria-pressed="${quiero}" aria-label="Quiero ir" title="Quiero ir">🔖</button>
                <button class="hero-icon" data-action="share-local" data-id="${local.id}" aria-label="Compartir" title="Compartir">↗</button>
            </div>
            <img class="detail-avatar" src="${esc(safeUrl(local.imagen))}" alt="Logo de ${esc(local.nombre)}">
            <h1 class="detail-name">${esc(local.nombre)}</h1>
            <p class="detail-type">${esc(local.tipo)} ${sponsoredBadge(local)}</p>
            <p class="detail-status">${estadoBadge(local)} <span>${esc(estadoHorario(local).detalle)}</span></p>
            <nav class="detail-tabs-nav" role="tablist">
                ${tabs.map(([key, label]) => `<button class="detail-tab-btn" role="tab" data-action="local-tab" data-tab="${key}">${label}</button>`).join('')}
            </nav>
        </header>
        <div id="localTabContent" class="detail-body"></div>
    `;
    const view = document.getElementById('detailView');
    view.classList.remove('hidden');
    view.scrollTop = 0;
    switchLocalTab(tab === 'eventos' && !isLoggedIn() ? 'info' : tab);
}

export function hideLocalDetail() {
    document.getElementById('detailView').classList.add('hidden');
    state.currentLocalId = null;
}

export function refreshLocalDetail() {
    if (state.currentLocalId && !document.getElementById('detailView').classList.contains('hidden')) {
        switchLocalTab(currentTab);
    }
}

function switchLocalTab(tab) {
    const local = getLocal(state.currentLocalId);
    if (!local) return;
    currentTab = tab;
    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        const active = btn.dataset.tab === tab;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active);
    });
    const renderers = { info: renderInfo, menu: renderMenu, resenas: renderResenas, eventos: renderEventos };
    document.getElementById('localTabContent').innerHTML = (renderers[tab] || renderInfo)(local);
}

// =================== INFO ===================

function scoreBlock(titulo, notas, vacio) {
    if (!notas) return `<div class="score-panel is-empty"><span class="score-panel-title">${titulo}</span><p>${vacio}</p></div>`;
    return `
        <div class="score-panel">
            <span class="score-panel-title">${titulo}</span>
            <div class="score-main">
                <b>${notas.total.toFixed(1)}</b>
                ${ratingStars(notas.total, 18)}
            </div>
            <div class="score-split">
                <span>🍽️ Comida <b>${notas.comida.toFixed(1)}</b></span>
                <span>🤵 Servicio <b>${notas.servicio.toFixed(1)}</b></span>
                <span>💬 <b>${notas.n}</b> reseña${notas.n === 1 ? '' : 's'}</span>
            </div>
        </div>`;
}

// "Apto para Fumadores (Solo en Terraza)" -> etiqueta "Apto para fumadores" + detalle "Solo en terraza"
function featureParts(local, c) {
    const match = c.match(/^(.*?)\s*\((.+)\)$/);
    const label = match ? match[1] : c;
    const detalle = (local.caracteristicasDetalle || {})[c] || (match ? match[2] : '');
    return { label, detalle };
}

function renderInfo(local) {
    const n30 = notas30(local.id);
    const hist = notasHistoricas(local.id);
    const hoy = DIAS_SEMANA[new Date().getDay()];
    const tel = (local.telefono || '').replace(/[^\d+]/g, '');
    const redes = [
        local.website && `<a href="${esc(safeUrl(local.website))}" target="_blank" rel="noopener" class="social-link-btn website">🌐 Sitio web</a>`,
        local.instagram && `<a href="https://instagram.com/${encodeURIComponent(local.instagram)}" target="_blank" rel="noopener" class="social-link-btn instagram">📸 Instagram</a>`,
        local.tiktok && `<a href="https://tiktok.com/@${encodeURIComponent(local.tiktok)}" target="_blank" rel="noopener" class="social-link-btn tiktok">🎵 TikTok</a>`,
        local.facebook && `<a href="https://facebook.com/${encodeURIComponent(local.facebook)}" target="_blank" rel="noopener" class="social-link-btn facebook">👍 Facebook</a>`
    ].filter(Boolean);
    const dietas = DIETAS.map(d => ({ ...d, ...dietaLocal(local, d.key) })).filter(d => d.estrellas > 0);
    const distinciones = [...distincionesActuales(local.id).map(d => d.texto), ...distincionesHistoricas(local.id).map(d => d.texto)];

    return `
        <div class="scores">
            ${scoreBlock('Últimos 30 días', n30, 'Sin reseñas en los últimos 30 días. ¡Sé el primero!')}
            ${hist && hist.n !== (n30 ? n30.n : -1) ? `
            <div class="score-history">
                <span>Nota histórica</span>
                <span>🍽️ ${hist.comida.toFixed(1)} · 🤵 ${hist.servicio.toFixed(1)}</span>
                <span>${hist.n ? `${hist.n} reseñas` : 'nota inicial'}</span>
            </div>` : ''}
        </div>

        ${local.slogan ? `<p class="detail-slogan">“${esc(local.slogan)}”</p>` : ''}
        ${local.descripcion ? `<p class="detail-desc">${esc(local.descripcion)}</p>` : ''}

        <h3 class="section-title">Contacto y ubicación</h3>
        <button class="info-row" data-action="focus-map" data-id="${local.id}">📍 <span><u>${esc(local.direccion || 'Dirección por confirmar')}</u><small>${local.referencia ? `${esc(local.referencia)} · ` : ''}Ver en el mapa</small></span></button>
        ${tel ? `
        <div class="info-row">📞 <span><b>${esc(local.telefono)}</b>
            <span class="info-row-actions">
                <a class="mini-btn" href="tel:${esc(tel)}">Llamar</a>
                <button class="mini-btn" data-action="copy-text" data-text="${esc(local.telefono)}">Copiar</button>
            </span></span>
        </div>` : ''}
        ${local.whatsapp ? `<button class="btn whatsapp-btn" data-action="whatsapp" data-id="${local.id}">💬 Reservar por WhatsApp</button>` : ''}

        ${redes.length ? `<div class="social-links-container">${redes.join('')}</div>` : ''}

        <div class="hours-box">
            <h4>🕒 Horarios</h4>
            ${Object.entries(local.horariosSemana || {}).map(([dia, hora]) => `
                <div class="hours-row ${dia === hoy ? 'is-today' : ''}"><span>${esc(dia)}${dia === hoy ? ' (hoy)' : ''}</span><span>${esc(hora)}</span></div>
            `).join('')}
            ${local.horarioFeriados ? `<div class="hours-row"><span>Feriados</span><span>${esc(local.horarioFeriados)}</span></div>` : ''}
        </div>

        ${(local.caracteristicas || []).length ? `
        <h3 class="section-title">Características</h3>
        <p class="feature-hint">Toca una característica para ver el detalle</p>
        <div class="feature-pills">
            ${local.caracteristicas.map(c => {
                const { label, detalle } = featureParts(local, c);
                return detalle
                    ? `<button class="feature-pill has-detail" data-action="feature-detail" data-detail="${esc(detalle)}" aria-label="${esc(label)}: ${esc(detalle)}">${FEATURE_ICONS[c] || '✨'} ${esc(label)}<span class="feature-tip" role="tooltip">${esc(detalle)}</span></button>`
                    : `<span class="feature-pill">${FEATURE_ICONS[c] || '✨'} ${esc(label)}</span>`;
            }).join('')}
        </div>` : ''}

        ${ANTES_DE_IR.some(([k]) => local[k]) ? `
        <h3 class="section-title">Antes de ir</h3>
        <dl class="before-list">
            ${ANTES_DE_IR.filter(([k]) => local[k]).map(([k, icon, label]) => `<div class="before-row"><dt>${icon} ${label}</dt><dd>${esc(local[k])}</dd></div>`).join('')}
        </dl>` : ''}

        ${dietas.length ? `
        <h3 class="section-title">Opciones alimentarias</h3>
        <div class="diet-box">
            ${dietas.map(d => `<div class="diet-row"><span>${d.emoji} ${esc(d.label)}</span><span class="diet-stars" title="${d.cantidad} producto(s)">${'★'.repeat(d.estrellas)}<span class="diet-off">${'★'.repeat(5 - d.estrellas)}</span> <small>${d.cantidad} prod.</small></span></div>`).join('')}
        </div>` : ''}

        ${distinciones.length ? `
        <div class="distinciones-container">
            <h3>Distinciones Mesa Gourmet 🏅</h3>
            ${distinciones.map(d => `<div class="distincion-medal">🏅 ${esc(d)}</div>`).join('')}
        </div>` : ''}

        <button class="report-link" data-action="report-local" data-id="${local.id}">⚠️ ¿Algo está mal? Reportar información incorrecta</button>
    `;
}

// =================== CARTA ===================
// Cada plato muestra la foto de la comunidad con más "me gusta"; esos likes ordenan la carta.

function renderMenu(local) {
    const carta = cartaLocal(local);
    if (!carta.length) return emptyState('📋', 'Este local aún no tiene su carta cargada.');
    const dietaIcon = { vegetariano: '🥬', vegano: '🌱', sinGluten: '🌾', sinLactosa: '🥛' };

    return `
        <p class="menu-intro">La carta se ordena por las fotos de la comunidad: el plato cuya foto tiene más "me gusta" va primero. ¡Sube la tuya al reseñar!</p>
        <div class="menu-list">
            ${carta.map(({ item, foto, likes, totalFotos }, i) => `
                <div class="menu-item ${i === 0 && foto ? 'golden-frame' : ''}">
                    <span class="menu-rank">${i === 0 && foto ? '👑' : `#${i + 1}`}</span>
                    <img src="${esc(safeUrl(foto ? foto.url : item.imagen))}" alt="${esc(item.nombre)}" loading="lazy" class="${foto ? '' : 'is-fallback'}">
                    <div class="menu-item-info">
                        <h4>${esc(item.nombre)} ${(item.dietas || []).map(d => `<span title="${esc(d)}">${dietaIcon[d] || ''}</span>`).join('')}</h4>
                        <span class="menu-cat">${esc(item.categoria || 'Otros')}</span>
                        <div class="menu-item-foot">
                            <span class="menu-price">${esc(formatPrice(item.precio))}</span>
                            ${foto ? `<span class="menu-likes" title="Foto de @${esc(foto.autor.username || '')}">❤️ ${likes} · 📸 @${esc(foto.autor.username || foto.autor.nombre)}</span>`
                                   : '<span class="menu-nophoto">Sin fotos aún</span>'}
                        </div>
                        ${totalFotos > 1 ? `<small class="menu-more">${totalFotos} fotos de la comunidad</small>` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="report-link" data-action="report-local" data-id="${local.id}" data-tipo="menu">⚠️ ¿Precios o platos desactualizados? Avísanos</button>
    `;
}

// =================== RESEÑAS ===================
// Las reseñas con fotos se muestran antes que las sin fotos.

function renderResenas(local) {
    const reviews = reviewsPublicadasDe(local.id)
        .sort((a, b) => ((b.fotos || []).length > 0) - ((a.fotos || []).length > 0) || new Date(b.fecha) - new Date(a.fecha));
    return `
        <div class="section-head">
            <h3 class="section-title">Opiniones (${reviews.length})</h3>
            <button class="chip-btn chip-gold" data-action="write-review" data-id="${local.id}">＋ Reseñar</button>
        </div>
        ${reviews.length
            ? `<div class="review-list">${reviews.map(r => reviewCard(r, { showLocal: false })).join('')}</div>`
            : emptyState('✍️', 'Nadie ha opinado aún. ¡Sé el primero!')}
    `;
}

// =================== EVENTOS Y PROMOCIONES ===================
// Primero la cartelera (los eventos pasados desaparecen solos) y debajo las promociones.

function promoActiva(promo, date = new Date()) {
    if (!(promo.dias || []).includes(date.getDay())) return false;
    const hhmm = date.toTimeString().slice(0, 5);
    return (!promo.horaInicio || hhmm >= promo.horaInicio) && (!promo.horaFin || hhmm <= promo.horaFin);
}

export function eventosVigentes(local, now = Date.now()) {
    // Un evento se considera terminado 4 horas después de su inicio
    return (local.eventos || [])
        .filter(e => new Date(e.inicio).getTime() + 4 * 3600000 > now)
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
}

function renderEventos(local) {
    const eventos = eventosVigentes(local);
    const promos = local.promociones || [];

    return `
        <h3 class="section-title">Cartelera</h3>
        ${eventos.length ? `<div class="promo-list">
            ${eventos.map(e => `
                <div class="event-card-v2">
                    <span class="event-date">${esc(formatFechaEvento(e.inicio))}</span>
                    <h4>${esc(e.titulo)}</h4>
                    ${e.descripcion ? `<p>${esc(e.descripcion)}</p>` : ''}
                </div>
            `).join('')}
        </div>` : emptyState('📅', 'No hay eventos próximos en la cartelera de este local.')}

        <h3 class="section-title">Promociones</h3>
        ${promos.length ? `<div class="promo-list">
            ${promos.map(p => `
                <div class="promo-card ${promoActiva(p) ? 'is-active' : ''}">
                    <span class="promo-icon">${esc(p.icono || '🏷️')}</span>
                    <div>
                        <h4>${esc(p.descripcion)}</h4>
                        <p>${(p.dias || []).map(d => DIAS_SEMANA[d]).join(', ')} · ${esc(p.horaInicio || '')}–${esc(p.horaFin || '')} h</p>
                        ${p.metodo ? `<p>Pago: ${esc(p.metodo)}</p>` : ''}
                    </div>
                    ${promoActiva(p) ? '<span class="badge estado-abierto">Activa ahora</span>' : ''}
                </div>
            `).join('')}
        </div>` : emptyState('🏷️', 'Este local no tiene promociones vigentes.')}
    `;
}

// =================== REPORTES DE USUARIOS ===================

const TIPOS_REPORTE = {
    menu: 'Platos o precios desactualizados',
    horario: 'Horario incorrecto',
    cerrado: 'El local cerró',
    datos: 'Dirección o teléfono incorrectos',
    otro: 'Otro'
};

function openReportSheet(localId, tipoInicial = 'menu') {
    if (!requireAccount('reportar información')) return;
    const local = getLocal(localId);
    openSheet({
        id: 'reportSheet',
        title: `Reportar: ${local.nombre}`,
        body: `
            <form id="reportForm" class="sheet-form">
                <label for="reportTipo">¿Qué está mal?</label>
                <select id="reportTipo">${Object.entries(TIPOS_REPORTE).map(([k, v]) => `<option value="${k}" ${k === tipoInicial ? 'selected' : ''}>${v}</option>`).join('')}</select>
                <label for="reportDetalle">Detalle (opcional)</label>
                <textarea id="reportDetalle" maxlength="500" rows="3" placeholder="Ej: el completo italiano ahora cuesta $3.990"></textarea>
            </form>`,
        actions: [
            { label: 'Enviar reporte', action: 'send-report', data: { id: localId }, variant: 'primary' },
            { label: 'Cancelar', action: 'close-sheet', variant: 'ghost' }
        ]
    });
}

function toggleInList(listName, id, onMsg, offMsg) {
    const list = state.user[listName];
    const idx = list.indexOf(id);
    if (idx > -1) list.splice(idx, 1); else list.push(id);
    saveSession(state.user);
    showToast(idx === -1 ? onMsg : offMsg, 1800);
    return idx === -1;
}

registerActions({
    'open-local': el => showLocalDetail(el.dataset.id, el.dataset.tab || 'info'),
    'close-local': () => hideLocalDetail(),
    'local-tab': el => switchLocalTab(el.dataset.tab),
    'write-review': el => openReviewForm(Number(el.dataset.id)),
    'report-local': el => openReportSheet(Number(el.dataset.id), el.dataset.tipo === 'menu' ? 'menu' : 'datos'),
    'send-report': el => {
        const tipo = document.getElementById('reportTipo').value;
        const detalle = document.getElementById('reportDetalle').value.trim().slice(0, 500);
        addReport({ localId: Number(el.dataset.id), tipo, detalle, usuario: { id: state.user.id, nombre: state.user.nombre } });
        track('reporte_local', { localId: Number(el.dataset.id), tipo });
        closeSheet('reportSheet');
        showToast('Gracias. Revisaremos tu reporte.');
    },
    'toggle-fav': el => {
        if (!requireAccount('guardar favoritos')) return;
        const id = Number(el.dataset.id);
        const on = toggleInList('favoritos', id, 'Guardado en favoritos', 'Quitado de favoritos');
        document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(b => {
            b.classList.toggle('is-fav', on);
            b.setAttribute('aria-pressed', on);
        });
    },
    'toggle-quiero': el => {
        if (!requireAccount('armar tu lista "Quiero ir"')) return;
        const id = Number(el.dataset.id);
        const on = toggleInList('quieroIr', id, 'Agregado a "Quiero ir"', 'Quitado de "Quiero ir"');
        track(on ? 'quiero_ir' : 'quitar_quiero_ir', { localId: id });
        document.querySelectorAll(`.quiero-btn[data-id="${id}"]`).forEach(b => {
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', on);
        });
    },
    'share-local': async el => {
        const local = getLocal(Number(el.dataset.id));
        const text = `${local.nombre} en Mesa Gourmet — ${local.tipo}, ${local.direccion || 'Talca'}`;
        try {
            if (navigator.share) await navigator.share({ title: local.nombre, text, url: location.href.split('#')[0] });
            else {
                await navigator.clipboard.writeText(`${text} ${location.href.split('#')[0]}`);
                showToast('Enlace copiado para compartir');
            }
            track('compartir_local', { localId: local.id });
        } catch { /* el usuario canceló */ }
    },
    // En celular un toque muestra el detalle (clave del WiFi, "solo en terraza"...); en computador basta con pasar el mouse
    'feature-detail': el => {
        const open = el.classList.contains('show-tip');
        document.querySelectorAll('.feature-pill.show-tip').forEach(p => p.classList.remove('show-tip'));
        if (!open) el.classList.add('show-tip');
    },
    'whatsapp': el => {
        const local = getLocal(Number(el.dataset.id));
        const phone = (local.whatsapp || '').replace(/[^0-9]/g, '');
        if (!phone) return showToast('Este local no tiene WhatsApp registrado.');
        track('click_whatsapp', { localId: local.id });
        const msg = encodeURIComponent(`Hola, vengo de Mesa Gourmet y me gustaría hacer una reserva en ${local.nombre}.`);
        window.open(`https://wa.me/${phone}?text=${msg}`, '_blank', 'noopener');
    },
    'copy-text': el => {
        navigator.clipboard?.writeText(el.dataset.text)
            .then(() => showToast(`Copiado: ${el.dataset.text}`, 1800))
            .catch(() => showToast('No se pudo copiar.'));
    }
});
