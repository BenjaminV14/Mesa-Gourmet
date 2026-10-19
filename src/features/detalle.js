// Ficha de un local: Info, Menú, Reseñas y Eventos y promociones (esta última solo para cuentas registradas)
import { state, isLoggedIn } from '../state.js';
import { getLocal, reviewsOfLocal, addReport, saveSession } from '../data/store.js';
import { registerActions } from '../ui/actions.js';
import { openSheet, closeSheet, showToast } from '../ui/feedback.js';
import { estadoBadge, sponsoredBadge, emptyState } from '../ui/cards.js';
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
    'Apto para Fumadores (Solo en Terraza)': '🚬', 'Acepta Edenred / BAES': '💳', 'Acceso Discapacitados': '♿',
    'Estacionamiento': '🚗', 'Bicicletero': '🚲', 'Baño / WC': '🚽', 'WiFi Disponible': '📶', 'Terraza': '🪑'
};

let currentTab = 'info';

export function showLocalDetail(localId, tab = 'info') {
    const local = getLocal(Number(localId));
    if (!local) return;
    state.currentLocalId = local.id;
    track('ver_local', { localId: local.id, destacado: isSponsored(local) });

    const tabs = [
        ['info', 'Info'],
        ['menu', 'Menú'],
        ['resenas', 'Reseñas'],
        ...(isLoggedIn() ? [['eventos', 'Eventos y promos']] : [])
    ];

    document.getElementById('detailContent').innerHTML = `
        <header class="detail-header detail-hero">
            <button class="back-btn" data-action="close-local">← Volver</button>
            <span class="mg-score">Nota MG ${(local.notaMG || 0).toFixed(1)} ★</span>
            <img class="detail-avatar" src="${esc(safeUrl(local.imagen))}" alt="">
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
    const content = document.getElementById('localTabContent');
    const renderers = { info: renderInfo, menu: renderMenu, resenas: renderResenas, eventos: renderEventos };
    content.innerHTML = (renderers[tab] || renderInfo)(local);
}

// =================== INFO ===================

function dietRow(label, value) {
    if (!value) return '';
    return `<div class="diet-row"><span>${label}</span><span class="diet-stars">${'★'.repeat(value)}${'☆'.repeat(5 - value)}</span></div>`;
}

function renderInfo(local) {
    const reviews = reviewsOfLocal(local.id);
    const avgC = reviews.length ? reviews.reduce((s, r) => s + r.notaComida, 0) / reviews.length : (local.notaComida || 0);
    const avgS = reviews.length ? reviews.reduce((s, r) => s + r.notaServicio, 0) / reviews.length : (local.notaServicio || 0);
    const hoy = DIAS_SEMANA[new Date().getDay()];
    const tel = (local.telefono || '').replace(/[^\d+]/g, '');
    const diet = dietRow('🌱 Vegano', local.vegano) + dietRow('🥬 Vegetariano', local.vegetariano) +
        dietRow('🌾 Celíaco (sin gluten)', local.sinGluten) + dietRow('🥛 Sin lactosa', local.sinLactosa);

    return `
        <div class="score-box">
            <div><b>🍽️ ${avgC.toFixed(1)}</b><span>Comida</span></div>
            <div><b>🤵 ${avgS.toFixed(1)}</b><span>Servicio</span></div>
            <div><b>💬 ${reviews.length}</b><span>Reseñas</span></div>
        </div>

        ${local.descripcion ? `<p class="detail-desc">${esc(local.descripcion)}</p>` : ''}

        <h3 class="section-title">Información</h3>
        <button class="info-row" data-action="focus-map" data-id="${local.id}">📍 <span><u>${esc(local.direccion)}</u><small>Ver en el mapa</small></span></button>
        ${tel ? `
        <div class="info-row">📞 <span><b>${esc(local.telefono)}</b>
            <span class="info-row-actions">
                <a class="mini-btn" href="tel:${esc(tel)}">Llamar</a>
                <button class="mini-btn" data-action="copy-text" data-text="${esc(local.telefono)}">Copiar</button>
            </span></span>
        </div>` : ''}

        <div class="hours-box">
            <h4>📅 Horarios</h4>
            ${Object.entries(local.horariosSemana || {}).map(([dia, hora]) => `
                <div class="hours-row ${dia === hoy ? 'is-today' : ''}"><span>${esc(dia)}</span><span>${esc(hora)}</span></div>
            `).join('')}
        </div>

        ${(local.website || local.instagram || local.tiktok) ? `
        <div class="social-links-container">
            ${local.website ? `<a href="${esc(safeUrl(local.website))}" target="_blank" rel="noopener" class="social-link-btn website">🌐 Sitio web</a>` : ''}
            ${local.instagram ? `<a href="https://instagram.com/${encodeURIComponent(local.instagram)}" target="_blank" rel="noopener" class="social-link-btn instagram">📸 Instagram</a>` : ''}
            ${local.tiktok ? `<a href="https://tiktok.com/@${encodeURIComponent(local.tiktok)}" target="_blank" rel="noopener" class="social-link-btn tiktok">🎬 TikTok</a>` : ''}
        </div>` : ''}

        <h3 class="section-title">Características</h3>
        <div class="feature-pills">
            ${(local.caracteristicas || []).map(c => `<span class="feature-pill">${FEATURE_ICONS[c] || '✨'} ${esc(c)}</span>`).join('')}
        </div>

        ${diet ? `<h3 class="section-title">Opciones dietéticas</h3><div class="diet-box">${diet}</div>` : ''}

        <button class="btn whatsapp-btn" data-action="whatsapp" data-id="${local.id}">💬 Reservar por WhatsApp</button>

        ${(local.distinciones || []).length ? `
        <div class="distinciones-container">
            <h3>Distinciones MG 🏅</h3>
            ${local.distinciones.map(d => `<div class="distincion-medal">${esc(d)}</div>`).join('')}
        </div>` : ''}

        <button class="report-link" data-action="report-local" data-id="${local.id}">⚠️ ¿Algo está mal? Reportar información incorrecta</button>
    `;
}

// =================== MENÚ ===================

function renderMenu(local) {
    const items = (local.menu || []).filter(m => m.nombre);
    if (!items.length) return emptyState('📋', 'Este local aún no tiene su carta cargada.');
    const sorted = [...items].sort((a, b) => (b.likes || 0) - (a.likes || 0));
    const categorias = [...new Set(items.map(m => m.categoria || 'Otros'))];

    return `
        <h3 class="section-title">Carta · ordenada por popularidad 🔥</h3>
        <div class="menu-cats">${categorias.map(c => `<span class="match-pill">${esc(c)}</span>`).join('')}</div>
        <div class="menu-list">
            ${sorted.map((item, i) => `
                <div class="menu-item ${i === 0 ? 'golden-frame' : ''}">
                    <span class="menu-rank">${i === 0 ? '👑' : `#${i + 1}`}</span>
                    <img src="${esc(safeUrl(item.imagen))}" alt="" loading="lazy">
                    <div class="menu-item-info">
                        <h4>${esc(item.nombre)}</h4>
                        <span class="menu-cat">${esc(item.categoria || 'Otros')}</span>
                        <div class="menu-item-foot">
                            <span class="menu-price">${esc(formatPrice(item.precio))}</span>
                            <span class="menu-likes">❤️ ${item.likes || 0}</span>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
        <button class="report-link" data-action="report-local" data-id="${local.id}" data-tipo="menu">⚠️ ¿Precios o platos desactualizados? Avísanos</button>
    `;
}

// =================== RESEÑAS ===================

function renderResenas(local) {
    const reviews = reviewsOfLocal(local.id).filter(r => r.estado === 'publicada');
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

function promoActiva(promo, date = new Date()) {
    if (!(promo.dias || []).includes(date.getDay())) return false;
    const hhmm = date.toTimeString().slice(0, 5);
    return (!promo.horaInicio || hhmm >= promo.horaInicio) && (!promo.horaFin || hhmm <= promo.horaFin);
}

function renderEventos(local) {
    const ahora = Date.now();
    const eventos = (local.eventos || [])
        .filter(e => new Date(e.inicio).getTime() > ahora - 3 * 3600000)
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    const promos = local.promociones || [];

    return `
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
        const favs = state.user.favoritos || (state.user.favoritos = []);
        const idx = favs.indexOf(id);
        if (idx > -1) favs.splice(idx, 1); else favs.push(id);
        const isFav = idx === -1;
        document.querySelectorAll(`.fav-btn[data-id="${id}"]`).forEach(b => {
            b.classList.toggle('is-fav', isFav);
            b.setAttribute('aria-pressed', isFav);
        });
        saveSession(state.user);
        showToast(isFav ? 'Guardado en favoritos' : 'Quitado de favoritos', 1800);
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
