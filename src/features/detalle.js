// Ficha de un local: Info, Carta, Reseñas y Eventos y promociones (esta última solo para cuentas registradas)
import { state, isLoggedIn } from '../state.js';
import { getLocal, addReport, saveSession } from '../data/store.js';
import { vipsDeLocal, notas30, notasHistoricas, cartaLocal, DIETAS, dietaLocal, distincionesActuales, distincionesHistoricas, reviewsPublicadasDe } from '../data/metrics.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';
import { estadoBadge, sponsoredBadge, emptyState, ratingStars } from '../ui/cards.js';
import { esc, safeUrl, formatPrice } from '../utils/html.js';
import { formatTelefono } from '../utils/text.js';
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

let currentTab = 'info';

export function showLocalDetail(localId, tab = 'info') {
    const local = getLocal(Number(localId));
    if (!local) return;
    state.currentLocalId = local.id;
    document.getElementById('publicProfile')?.remove(); // si se abrió desde el perfil de alguien
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

// Nota principal: promedio de los últimos 30 días (grande), comida y servicio por separado,
// y al lado la nota histórica destacada en dorado.
function scoreBlock(n30, hist) {
    const historica = hist ? `
        <div class="score-hist" title="Promedio de todas las reseñas">
            <span>Histórica</span>
            <b>${hist.total.toFixed(1)}</b>
            <small>🍽️ ${hist.comida.toFixed(1)} · 🤵 ${hist.servicio.toFixed(1)}</small>
        </div>` : '';
    return `
        <div class="score-panel ${n30 ? '' : 'is-empty'}">
            <div class="score-now">
                <div class="score-main">
                    <b>${n30 ? n30.total.toFixed(1) : '–'}</b>
                    ${ratingStars(n30 ? n30.total : 0, 18)}
                </div>
                ${n30 ? `
                <div class="score-split">
                    <span>🍽️ Comida <b>${n30.comida.toFixed(1)}</b></span>
                    <span>🤵 Servicio <b>${n30.servicio.toFixed(1)}</b></span>
                </div>
                <small class="score-count">${n30.n} reseña${n30.n === 1 ? '' : 's'} este mes</small>`
                : '<p class="score-empty">Aún sin reseñas este mes. ¡Sé el primero!</p>'}
            </div>
            ${historica}
        </div>`;
}

// Íconos de cada red social
const REDES_ICONO = {
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21h3z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.5 3c.3 2.1 1.6 3.6 3.7 3.8v3c-1.4 0-2.6-.4-3.7-1.1v6.1c0 3.1-2.5 5.6-5.6 5.6S5.3 17.9 5.3 14.8s2.5-5.6 5.6-5.6c.3 0 .6 0 .9.1v3.1a2.6 2.6 0 1 0 1.7 2.4V3h3z"/></svg>',
    website: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
};

// Enlace de WhatsApp con un mensaje de reserva listo para enviar
function whatsappUrl(local) {
    const numero = String(local.whatsappReservas || local.whatsapp || '').replace(/[^0-9]/g, '');
    if (!numero) return '';
    const texto = `Hola, vengo de Mesa Gourmet y me gustaría reservar una mesa en ${local.nombre}. ¿Tienen disponibilidad?`;
    return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
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
    const fb = local.facebook && (/\s/.test(local.facebook)
        ? `https://www.facebook.com/search/top?q=${encodeURIComponent(local.facebook)}`
        : `https://facebook.com/${encodeURIComponent(local.facebook)}`);
    const redes = [
        local.instagram && ['instagram', 'Instagram', `https://instagram.com/${encodeURIComponent(local.instagram)}`, `@${local.instagram}`],
        local.facebook && ['facebook', 'Facebook', fb, local.facebook],
        local.tiktok && ['tiktok', 'TikTok', `https://tiktok.com/@${encodeURIComponent(local.tiktok)}`, `@${local.tiktok}`],
        local.website && ['website', 'Sitio web', safeUrl(local.website), local.website.replace(/^https?:\/\//, '')]
    ].filter(Boolean).map(([red, nombre, url, usuario]) => `
        <a href="${esc(url)}" target="_blank" rel="noopener" class="social-link-btn ${red}" aria-label="${nombre}: ${esc(usuario)}">
            <span class="social-icon">${REDES_ICONO[red]}</span><span class="social-name">${nombre}</span>
        </a>`);
    const dietas = DIETAS.map(d => ({ ...d, ...dietaLocal(local, d.key) })).filter(d => d.estrellas > 0);
    const distinciones = [...distincionesActuales(local.id).map(d => d.texto), ...distincionesHistoricas(local.id).map(d => d.texto)];

    return `
        <div class="scores">
            ${scoreBlock(n30, hist)}
        </div>

        ${local.slogan ? `<p class="detail-slogan">“${esc(local.slogan)}”</p>` : ''}
        ${local.descripcion ? `<p class="detail-desc">${esc(local.descripcion)}</p>` : ''}

        <h3 class="section-title">Contacto y ubicación</h3>
        <button class="info-row" data-action="focus-map" data-id="${local.id}">📍 <span><u>${esc(local.direccion || 'Dirección por confirmar')}</u><small>Ver en el mapa</small></span></button>
        ${tel ? `
        <div class="info-row">📞 <span><b>${esc(local.telefono)}</b>
            <span class="info-row-actions">
                <a class="mini-btn" href="tel:${esc(tel)}">Llamar</a>
                <button class="mini-btn" data-action="copy-text" data-text="${esc(local.telefono)}">Copiar</button>
            </span></span>
        </div>` : ''}
        ${whatsappUrl(local) ? `<a class="btn whatsapp-btn" href="${esc(whatsappUrl(local))}" target="_blank" rel="noopener" data-action="whatsapp-track" data-id="${local.id}">
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3z"/></svg>
            Reservar por WhatsApp</a>
        <p class="whatsapp-num">Se abre WhatsApp al ${esc(formatTelefono(local.whatsappReservas || local.whatsapp))} con tu mensaje de reserva listo.</p>` : ''}

        ${redes.length ? `<div class="social-links-container">${redes.join('')}</div>` : ''}

        <div class="hours-box">
            <h4>🕒 Horarios</h4>
            ${Object.entries(local.horariosSemana || {}).map(([dia, hora]) => `
                <div class="hours-row ${dia === hoy ? 'is-today' : ''}"><span>${esc(dia)}${dia === hoy ? ' (hoy)' : ''}</span><span>${esc(hora)}</span></div>
            `).join('')}
            ${local.horarioFeriados ? `<div class="hours-row"><span>Feriados</span><span>${esc(local.horarioFeriados)}</span></div>` : ''}
        </div>

        ${(local.caracteristicas || []).length || local.mediosPago ? `
        <h3 class="section-title">Características</h3>
        <p class="feature-hint">Toca una característica para ver el detalle</p>
        <div class="feature-pills">
            ${local.mediosPago ? `<button class="feature-pill has-detail" data-action="feature-detail" aria-label="Medios de pago: ${esc(local.mediosPago)}">💳 Medios de pago<span class="feature-tip" role="tooltip">${esc(local.mediosPago)}</span></button>` : ''}
            ${(local.caracteristicas || []).map(c => {
                const { label, detalle } = featureParts(local, c);
                return detalle
                    ? `<button class="feature-pill has-detail" data-action="feature-detail" data-detail="${esc(detalle)}" aria-label="${esc(label)}: ${esc(detalle)}">${FEATURE_ICONS[c] || '✨'} ${esc(label)}<span class="feature-tip" role="tooltip">${esc(detalle)}</span></button>`
                    : `<span class="feature-pill">${FEATURE_ICONS[c] || '✨'} ${esc(label)}</span>`;
            }).join('')}
        </div>` : ''}

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
        ${local.cartaUrl ? `<a class="btn btn-outline carta-oficial" href="${esc(safeUrl(local.cartaUrl))}" target="_blank" rel="noopener">📄 Ver la carta oficial del local ↗</a>` : ''}
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
        ${vipsDeLocal(local.id).length ? `
        <div class="vip-box">
            <b>👑 Clientes VIP</b>
            <span>${vipsDeLocal(local.id).slice(0, 5).map(c => `@${esc(c.usuario.username || c.usuario.nombre)}`).join(' · ')}</span>
            <small>Vinieron 5 veces o más en ${esc(vipsDeLocal(local.id)[0].mes)}. Se les reconoce todo el mes siguiente.</small>
        </div>` : ''}
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
    // El enlace abre WhatsApp por sí solo; aquí solo se registra el clic
    'whatsapp-track': el => track('click_whatsapp', { localId: Number(el.dataset.id) }),
    'copy-text': el => {
        navigator.clipboard?.writeText(el.dataset.text)
            .then(() => showToast(`Copiado: ${el.dataset.text}`, 1800))
            .catch(() => showToast('No se pudo copiar.'));
    }
});
