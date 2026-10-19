// =================== STATE ===================
let currentView = 'inicio';
let filteredLocales = typeof locales !== 'undefined' ? [...locales] : [];
let talcaMap = null;
let mapMarkers = [];
let selectedMapLocal = null;

let isGuest = false;
let guestClicks = 0;

let activeGlobalFilters = [];
let dietaryPreferences = { vegano: false, celiaco: false, sinLactosa: false };
let currentLocalDetail = null;

// Ubicación del usuario simulada en el centro de Talca
let userLocation = { lat: -35.4264, lng: -71.6554 };

// Cola administrativa
window.adminQueue = JSON.parse(localStorage.getItem('mesaAdminQueue')) || [];

// Photo feed state (horizontal swipe)
let currentPhotoIndex = 0;
let photoSlidesData = [];

// Baúl de los Antojos state
let baulCandidates = [];
let baulCurrentIndex = 0;
let baulCurrentType = 'food';

// =================== LEVEL SYSTEM (REVIEW-BASED) ===================

function getUserReviewCount() {
    if (isGuest) return 0;
    return window.reviewsData.filter(r => r.usuario.nombre === window.currentUser.name).length;
}

function calculateLevel(reviewCount) {
    // Nv1=1, Nv2=3, Nv3=7, Nv4=10, luego +10 por cada nivel
    if (reviewCount < 1)  return 0;
    if (reviewCount < 3)  return 1;
    if (reviewCount < 7)  return 2;
    if (reviewCount < 10) return 3;
    return Math.floor(reviewCount / 10) + 3;
}

function getRequiredForLevel(level) {
    if (level <= 0) return 0;
    if (level === 1) return 1;
    if (level === 2) return 3;
    if (level === 3) return 7;
    return 10 * (level - 3);
}

function getLevelName(level) {
    const names = {
        0: 'Sin nivel',
        1: 'Novicio Gourmet',
        2: 'Explorador Gastronómico',
        3: 'Crítico Consagrado',
        4: 'Sommelier Talquino',
        5: 'Embajador Gourmet',
        6: 'Maestro Culinario',
    };
    return names[level] || `Leyenda Gourmet Nv.${level}`;
}

function checkLevelUp(previousCount) {
    const newCount = getUserReviewCount();
    const oldLvl   = calculateLevel(previousCount);
    const newLvl   = calculateLevel(newCount);
    if (newLvl > oldLvl) {
        showLevelUpModal(newLvl);
        if (window.currentUser) {
            window.currentUser.level = newLvl;
            window.saveData();
        }
    }
}

function showLevelUpModal(level) {
    const existing = document.getElementById('levelUpModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'levelUpModal';
    modal.className = 'level-up-modal';
    modal.innerHTML = `
        <div class="level-up-content">
            <div class="level-up-particles">✨🎊✨🎊✨</div>
            <div class="level-up-trophy">🏆</div>
            <h2>¡Subiste de Nivel!</h2>
            <div class="level-up-number">Nivel ${level}</div>
            <p class="level-up-name">${getLevelName(level)}</p>
            <p class="level-up-desc">Tu opinión tiene cada vez más peso en la comunidad gourmet de Talca.</p>
            <button class="level-up-btn" onclick="document.getElementById('levelUpModal').remove()">¡Genial! 🚀</button>
        </div>
    `;
    document.body.appendChild(modal);

    // Auto-dismiss tras 5s
    setTimeout(() => {
        const m = document.getElementById('levelUpModal');
        if (m) {
            m.style.opacity = '0';
            setTimeout(() => { if (m.parentNode) m.remove(); }, 500);
        }
    }, 5000);
}

// =================== LOGROS GASTRONÓMICOS ===================

function computeUserLogros() {
    if (isGuest || !window.logrosDefinitions) return [];
    const userReviews = window.reviewsData.filter(r => r.usuario.nombre === window.currentUser.name);
    const dishCounts = {};

    userReviews.forEach(review => {
        (review.productos || []).forEach(prod => {
            const prodLower = prod.toLowerCase();
            window.logrosDefinitions.forEach(logro => {
                logro.keywords.forEach(kw => {
                    if (prodLower.includes(kw.toLowerCase())) {
                        dishCounts[logro.id] = (dishCounts[logro.id] || 0) + 1;
                    }
                });
            });
        });
    });

    return window.logrosDefinitions.map(logro => ({
        ...logro,
        count: dishCounts[logro.id] || 0,
        unlocked: (dishCounts[logro.id] || 0) >= logro.required
    }));
}

// =================== FAVORITE PRODUCT MODAL ===================

function showFavoriteProductModal() {
    if (document.getElementById('favProductModal')) return;
    const products = [
        { name: 'Coca-Cola',    emoji: '🥤' },
        { name: 'Pisco Sour',   emoji: '🍸' },
        { name: 'Café Latte',   emoji: '☕' },
        { name: 'Ceviche',      emoji: '🦐' },
        { name: 'Sushi Roll',   emoji: '🍣' },
        { name: 'Empanada',     emoji: '🥟' },
        { name: 'Pizza',        emoji: '🍕' },
        { name: 'Hamburguesa',  emoji: '🍔' },
        { name: 'Pasta',        emoji: '🍝' },
        { name: 'Lomo Saltado', emoji: '🥩' },
    ];

    const modal = document.createElement('div');
    modal.id = 'favProductModal';
    modal.className = 'fav-product-modal';
    modal.innerHTML = `
        <div class="glass-card fav-product-card">
            <div style="font-size:2.5rem;margin-bottom:12px;">⭐</div>
            <h2 style="font-family:'Playfair Display',serif;color:var(--mesa-gold);margin-bottom:8px;font-size:1.5rem;">¡Bienvenido/a a Mesa Gourmet!</h2>
            <p style="color:#cbd5e1;font-size:0.88rem;margin-bottom:22px;line-height:1.5;">
                ¿Cuál es tu producto gastronómico favorito?<br>
                Recibirás tu primera <b style="color:var(--mesa-gold);">insignia destacada</b>.
            </p>
            <div class="fav-products-grid">
                ${products.map(p => `
                    <button class="fav-product-btn" onclick="selectFavoriteProduct('${p.name}')">
                        <span style="font-size:1.5rem;">${p.emoji}</span>
                        <span>${p.name}</span>
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

window.selectFavoriteProduct = function(product) {
    window.currentUser.favoriteProduct  = product;
    window.currentUser.firstLoginDone   = true;
    window.saveData();

    const modal = document.getElementById('favProductModal');
    if (modal) modal.remove();

    showToast(`🏅 Insignia desbloqueada: "Experto en ${product}"`);
};

// =================== TOAST ===================

function showToast(message, duration = 3500) {
    const toast = document.createElement('div');
    toast.className = 'toast-notification';
    toast.innerHTML = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
    }, duration);
}

// =================== SETUP ===================

document.addEventListener('DOMContentLoaded', () => {
    setupDarkMode();
    setupGeolocation();
    setupAuthListeners();
    startFlashTimer();
});

function setupGeolocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            position => {
                userLocation.lat = position.coords.latitude;
                userLocation.lng  = position.coords.longitude;
                if (currentView === 'inicio') renderInicio(false);
            },
            () => { console.log("Geolocalización rechazada, usando Talca Centro."); }
        );
    }
}

function setupDarkMode() {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.setAttribute('data-theme', 'dark');
    }
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    });
}

// =================== AUTH ===================

function setupAuthListeners() {
    const submitBtn = document.getElementById('submitBtn');
    const guestBtn  = document.getElementById('guestBtn');

    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            const emailInput    = document.getElementById('loginEmail');
            const passwordInput = document.getElementById('loginPassword');

            if (!emailInput.value.includes('@') || passwordInput.value.length < 3) {
                alert("⚠️ Por favor ingresa un correo válido y una contraseña de al menos 3 caracteres.");
                return;
            }

            window.currentUser = {
                type: 'registered',
                name: emailInput.value.split('@')[0].toUpperCase(),
                email: emailInput.value,
                password: passwordInput.value,
                favorites:        window.currentUser ? (window.currentUser.favorites || [])       : [],
                visitedLocales:   window.currentUser ? (window.currentUser.visitedLocales || [])  : [],
                canReview: true,
                canLike: true,
                favoriteProduct:  null,
                firstLoginDone:   false,
                level: 0
            };
            window.saveData();
            completeRegistration(false);
        });
    }

    if (guestBtn) {
        guestBtn.addEventListener('click', () => { completeRegistration(true); });
    }

    // Google Sign-In
    const googleBtn = document.getElementById('googleBtn');
    if (googleBtn) {
        googleBtn.addEventListener('click', () => {
            // Simular autenticación con Google
            const googleNames = ['Benjamín', 'Catalina', 'Matías', 'Valentina', 'Sebastián', 'Camila', 'Diego', 'Francisca'];
            const randomName = googleNames[Math.floor(Math.random() * googleNames.length)];
            const googleEmail = randomName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + '@gmail.com';

            window.currentUser = {
                type: 'google',
                name: randomName.toUpperCase(),
                email: googleEmail,
                password: '',
                favorites:        window.currentUser ? (window.currentUser.favorites || [])       : [],
                visitedLocales:   window.currentUser ? (window.currentUser.visitedLocales || [])  : [],
                canReview: true,
                canLike: true,
                favoriteProduct:  null,
                firstLoginDone:   false,
                level: 0
            };
            window.saveData();
            completeRegistration(false);
        });
    }
}

function completeRegistration(guestMode = false) {
    isGuest = guestMode;
    document.getElementById('registerScreen').classList.add('hidden');

    const splash = document.getElementById('splashScreen');
    splash.classList.remove('hidden');
    splash.style.opacity = '1';

    updateHeaderProfile();

    setTimeout(() => {
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.classList.add('hidden');
            enterApp();
            // Mostrar modal de producto favorito solo la primera vez (usuario registrado)
            if (!isGuest && window.currentUser && !window.currentUser.firstLoginDone) {
                setTimeout(showFavoriteProductModal, 900);
            }
        }, 500);
    }, 2000);
}

function checkGuestAccess() {
    if (isGuest) {
        guestClicks++;
        if (guestClicks >= 3) {
            guestClicks = 0;
            document.getElementById('registerScreen').classList.remove('hidden');
        } else {
            alert("🔒 Función exclusiva para gourmeteros registrados. ¡Inicia sesión para interactuar!");
        }
        return true;
    }
    return false;
}

function updateHeaderProfile() {
    const avatar   = document.getElementById('userAvatar');
    const nameSpan = document.getElementById('userName');

    if (isGuest) {
        if (avatar)   avatar.innerText   = "G";
        if (nameSpan) nameSpan.innerText = "Invitado";
    } else {
        const name     = window.currentUser.name || "JUAN";
        const initials = name.slice(0, 2).toUpperCase();
        if (avatar)   avatar.innerText   = initials;
        if (nameSpan) nameSpan.innerText = name.split(' ')[0];
    }
}

function enterApp() {
    document.getElementById('mainHeader').classList.remove('hidden');
    document.getElementById('mainContent').classList.remove('hidden');
    document.getElementById('bottomNav').classList.remove('hidden');

    setupNavigation();
    filteredLocales = [...window.locales];
    renderInicio();
}

// =================== NAVEGACIÓN ===================

function setupNavigation() {
    document.querySelectorAll('.nav-tab').forEach(tab => {
        const newTab = tab.cloneNode(true);
        tab.parentNode.replaceChild(newTab, tab);
        newTab.addEventListener('click', function() {
            const tabName = this.dataset.tab;
            if (isGuest && (tabName === 'misiones' || tabName === 'reseñas')) {
                if (checkGuestAccess()) return;
            }
            if (tabName) switchTab(tabName);
        });
    });

    const searchInput = document.getElementById('searchInput');
    const searchPanel = document.getElementById('searchOptionsPanel');

    searchInput.addEventListener('focus', () => searchPanel.classList.remove('hidden'));

    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase();
        if (query) {
            searchPanel.classList.add('hidden');
            filterLocales(query);
        } else {
            searchPanel.classList.remove('hidden');
            filteredLocales = [...window.locales];
            if (currentView === 'inicio') renderInicio(false);
        }
    });

    document.addEventListener('click', e => {
        if (!searchInput.contains(e.target) && !searchPanel.contains(e.target)) {
            searchPanel.classList.add('hidden');
        }
    });

    document.querySelectorAll('.search-option, .search-option-pill').forEach(option => {
        option.addEventListener('click', function(e) {
            e.preventDefault();
            const term = this.dataset.search;
            searchInput.value = term === 'todo' ? '' : term;
            searchPanel.classList.add('hidden');
            filterLocales(term === 'todo' ? '' : term.toLowerCase());
        });
    });
}

function switchTab(tabName) {
    if (currentView === 'mapa' && tabName !== 'mapa' && talcaMap) {
        try { talcaMap.remove(); } catch(e) {}
        talcaMap    = null;
        mapMarkers  = [];
    }

    currentView = tabName;

    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active-tab'));
    const activeTab = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
    if (activeTab) activeTab.classList.add('active-tab');

    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = '';

    switch(tabName) {
        case 'inicio':   renderInicio();   break;
        case 'mapa':     renderMapa();     break;
        case 'top50':    renderTop50();    break;
        case 'misiones': renderMisiones(); break;
        case 'reseñas':  renderResenas();  break;
        case 'perfil':   renderPerfil();   break;
    }
}

// =================== FILTRO MODAL ===================

window.toggleFilterModal = function(show) {
    const filterModal = document.getElementById('filterModal');
    if (show) {
        updateFilterButtonStyles();
        filterModal.classList.remove('hidden');
    } else {
        filterModal.classList.add('hidden');
    }
};

function updateFilterButtonStyles() {
    ['vegano', 'celiaco', 'sinLactosa'].forEach(type => {
        const btn = document.getElementById(`dietBtn_${type}`);
        if (btn) {
            if (dietaryPreferences[type]) {
                btn.style.background   = 'var(--mesa-red)';
                btn.style.color        = '#fff';
                btn.style.borderColor  = 'var(--mesa-red)';
            } else {
                btn.style.background   = 'var(--bg-panel)';
                btn.style.color        = 'var(--text-primary)';
                btn.style.borderColor  = 'var(--glass-border)';
            }
        }
    });
}

window.toggleDietary = function(type) {
    dietaryPreferences[type] = !dietaryPreferences[type];
    updateFilterButtonStyles();
    filterLocales(document.getElementById('searchInput').value.toLowerCase());
};

function filterLocales(query) {
    filteredLocales = window.locales.filter(local => {
        let matchesQuery = true;
        if (query) {
            const queryLower = query.toLowerCase();
            matchesQuery = local.nombre.toLowerCase().includes(queryLower) ||
                local.tipo.toLowerCase().includes(queryLower) ||
                local.caracteristicas.some(c => c.toLowerCase().includes(queryLower)) ||
                (local.menu && local.menu.some(m => m.nombre.toLowerCase().includes(queryLower)));
        }

        let matchesDietary = true;
        if (dietaryPreferences.vegano     && (local.vegano    || 0) < 3) matchesDietary = false;
        if (dietaryPreferences.celiaco    && (local.sinGluten || 0) < 3) matchesDietary = false;
        if (dietaryPreferences.sinLactosa && (local.sinLactosa|| 0) < 3) matchesDietary = false;

        return matchesQuery && matchesDietary;
    });

    if (currentView === 'inicio') {
        renderInicio(false);
    } else if (currentView === 'mapa' && talcaMap) {
        filterMapMarkers('todos');
    }
}

// =================== HAVERSINE ===================

function getDistanceKm(lat1, lon1, lat2, lon2) {
    const R    = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a    = Math.sin(dLat/2) * Math.sin(dLat/2) +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLon/2) * Math.sin(dLon/2);
    return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
}

// =================== FLASH TIMER ===================

function startFlashTimer() {
    setInterval(() => {
        const now     = Date.now();
        let changed   = false;
        window.locales.forEach(l => {
            if (l.sorteoFlash && now > l.sorteoFlash.expiraTimestamp) {
                delete l.sorteoFlash;
                changed = true;
            }
        });
        if (changed) {
            window.saveData();
            if (currentView === 'inicio') renderInicio(false);
        }

        const timerEl = document.getElementById('detailSorteoTimer');
        if (timerEl && currentLocalDetail) {
            if (currentLocalDetail.sorteoFlash) {
                const timeLeft = Math.max(0, Math.ceil((currentLocalDetail.sorteoFlash.expiraTimestamp - now) / 1000));
                if (timeLeft > 0) {
                    timerEl.textContent = `Tiempo restante: ${timeLeft}s`;
                } else {
                    switchLocalTab('info');
                }
            } else {
                switchLocalTab('info');
            }
        }
    }, 1000);
}

// =================== INICIO ===================

function renderInicio(full = true) {
    const mainContent = document.getElementById('mainContent');

    if (full) {
        mainContent.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h2 class="section-title" style="margin:0;">Recomendados</h2>
                <div style="display:flex; gap:8px; align-items:center;">
                    <button onclick="toggleFilterModal(true)" class="badge" style="background:var(--bg-panel); color:var(--text-primary); border:1px solid var(--glass-border); padding:8px 12px; border-radius:12px; cursor:pointer; font-size:1.1rem;">🎛️ Filtros</button>
                </div>
            </div>
            <button class="random-btn" onclick="showRandomLocal()">
                ¡Recomendación Aleatoria! 🎲
            </button>
            <div id="localesContainer"></div>
        `;
    }

    const container = document.getElementById('localesContainer');
    if (!container) return;

    if (filteredLocales.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary); margin-top:20px;">No se encontraron locales con las preferencias activas.</p>';
        return;
    }

    const diasSemana = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const hoyNombre  = diasSemana[new Date().getDay()];

    container.innerHTML = filteredLocales.map(local => {
        const rating     = local.notaMG || 8.0;
        const fillPercent = (rating / 10) * 100;
        const isOpen     = local.abierto;
        const horarioHoy = local.horariosSemana[hoyNombre] || "Cerrado";
        const dist       = getDistanceKm(userLocation.lat, userLocation.lng, local.lat, local.lng);
        const isFav      = !isGuest && window.currentUser.favorites && window.currentUser.favorites.includes(local.id);
        const heartColor = isFav ? 'var(--mesa-red)' : 'var(--text-secondary)';

        let sorteoHtml = '';
        if (local.sorteoFlash) {
            const timeLeft = Math.max(0, Math.ceil((local.sorteoFlash.expiraTimestamp - Date.now()) / 1000));
            if (timeLeft > 0) {
                sorteoHtml = `
                    <div class="blink-gift" style="background: linear-gradient(135deg, #fbbf24, #f59e0b); color: #000; padding: 4px 8px; border-radius: 8px; font-size: 0.65rem; font-weight: bold; margin-top: 4px; display: inline-flex; align-items: center; gap: 4px;">
                        🎁 ¡Sorteo Flash! Expiración: ${timeLeft}s
                    </div>
                `;
            }
        }

        return `
        <div class="card" onclick='showLocalDetailById(${local.id})'>
            <div class="card-img-wrapper">
                <img src="${local.imagen}" alt="${local.nombre}">
            </div>
            <div class="card-body">
                <div class="card-header">
                    <h3 class="card-title">${local.nombre}</h3>
                    <div style="display:flex; flex-direction:column; align-items:flex-end;">
                        <span class="badge ${isOpen ? 'open' : 'closed'}">${isOpen ? 'Abierto' : 'Cerrado'}</span>
                        ${sorteoHtml}
                    </div>
                </div>
                <p class="card-meta" style="margin-bottom: 2px;">${local.tipo}</p>
                <p class="card-meta" style="font-size: 0.75rem; font-weight: 500; color: var(--text-primary);">
                    🕒 ${hoyNombre} ${horarioHoy} &nbsp;&nbsp; A ${dist} km de ti
                </p>
                <div class="card-rating" style="margin-top: 4px;">
                    <div class="star-rating-outer">
                        <div class="star-rating-inner" style="width: ${fillPercent}%;"></div>
                    </div>
                    <span class="rating-score">${rating.toFixed(1)}</span>
                    <span class="rating-breakdowns">🍽️ ${local.notaComida.toFixed(1)} &nbsp; 🤵 ${local.notaServicio.toFixed(1)}</span>
                </div>
                <div class="card-actions" style="margin-top: 8px;">
                    <button class="btn btn-primary" onclick="event.stopPropagation(); showMenu(${local.id})">📋 Ver Menú</button>
                    <button class="btn btn-icon" style="color: ${heartColor};" onclick="event.stopPropagation(); toggleFavorite(${local.id}, this)">❤️</button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

function showRandomLocal() {
    if (!window.locales.length) return;
    const randomLocal = window.locales[Math.floor(Math.random() * window.locales.length)];
    showLocalDetailById(randomLocal.id);
}

window.toggleFavorite = function(localId, btnElement) {
    if (checkGuestAccess()) return;
    const favs = window.currentUser.favorites || [];
    const idx  = favs.indexOf(localId);
    if (idx > -1) {
        favs.splice(idx, 1);
        btnElement.style.color = 'var(--text-secondary)';
    } else {
        favs.push(localId);
        btnElement.style.color = 'var(--mesa-red)';
    }
    window.currentUser.favorites = favs;
    window.saveData();
};

// =================== DETALLE LOCAL ===================

window.showLocalDetailById = function(localId) {
    const local = window.locales.find(l => l.id === localId);
    if (local) showLocalDetail(local);
};

function showLocalDetail(local, activeTab = 'info') {
    currentLocalDetail = local;
    const detailView    = document.getElementById('detailView');
    const detailContent = document.getElementById('detailContent');

    detailContent.innerHTML = `
        <div class="detail-header" style="position:relative; text-align:center; padding-top:40px; border-bottom-left-radius:0; border-bottom-right-radius:0;">
            <button class="back-btn" onclick="hideLocalDetail()" style="position:absolute; top:15px; left:15px; margin:0;">← Volver</button>
            <div style="position:absolute; top:15px; right:15px;" class="mg-badge">
                <span style="background:var(--mesa-gold); color:#000; padding:4px 8px; border-radius:8px; font-weight:bold; font-size:0.8rem; box-shadow:0 0 10px rgba(255,215,0,0.5);">Nota MG: ${local.notaMG.toFixed(1)} ★</span>
            </div>
            <img src="${local.imagen}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:4px solid var(--mesa-gold); margin:0 auto 10px; box-shadow:0 0 15px rgba(255,215,0,0.4);">
            <h1 style="font-size:1.8rem; margin-bottom:5px; color: white;">${local.nombre}</h1>
            <p style="color:var(--mesa-gold); font-size:1.1rem; margin-bottom:15px;">${local.tipo}</p>

            <div class="detail-tabs-nav" style="display:flex; overflow-x:auto; background:rgba(0,0,0,0.2); padding:10px 5px 0 5px; margin:0 -20px -20px -20px;">
                <button class="detail-tab-btn" onclick="switchLocalTab('info')"    style="flex:1; background:transparent; border:none; color:rgba(255,255,255,0.7); font-weight:500; padding:10px; cursor:pointer;">Info</button>
                <button class="detail-tab-btn" onclick="switchLocalTab('menu')"   style="flex:1; background:transparent; border:none; color:rgba(255,255,255,0.7); font-weight:500; padding:10px; cursor:pointer;">Menú</button>
                <button class="detail-tab-btn" onclick="switchLocalTab('reseñas')" style="flex:1; background:transparent; border:none; color:rgba(255,255,255,0.7); font-weight:500; padding:10px; cursor:pointer;">Reseñas</button>
            </div>
        </div>

        <div id="localTabContent" style="padding:20px; animation: fadeIn 0.3s ease;">
            <!-- Contenido del Tab -->
        </div>
    `;

    detailView.classList.remove('hidden');
    switchLocalTab(activeTab);
}

window.switchLocalTab = function(tabName) {
    if (!currentLocalDetail) return;

    document.querySelectorAll('.detail-tab-btn').forEach(btn => {
        btn.style.color        = 'rgba(255,255,255,0.7)';
        btn.style.borderBottom = 'none';
        if (btn.getAttribute('onclick').includes(tabName)) {
            btn.style.color        = 'var(--mesa-gold)';
            btn.style.borderBottom = '3px solid var(--mesa-gold)';
        }
    });

    const content = document.getElementById('localTabContent');
    if (tabName === 'info')    content.innerHTML = renderTabInfo(currentLocalDetail);
    else if (tabName === 'menu')    content.innerHTML = renderTabMenu(currentLocalDetail);
    else if (tabName === 'reseñas') content.innerHTML = renderTabResenas(currentLocalDetail);
};

window.hideLocalDetail = function() {
    document.getElementById('detailView').classList.add('hidden');
};

// =================== TAB INFO ===================

function renderTabInfo(local) {
    const featureIcons = {
        'Seguridad Completa': '🛡️',
        'Calefacción': '🔥',
        'Aire Acondicionado / Ventilación': '❄️',
        'Venta de Alcohol': '🍺',
        'Mascotas (Solo en Terraza)': '🐾',
        'Ingreso de Mascotas': '🐾',
        'Apto para Fumadores (Solo en Terraza)': '🚬',
        'Acepta Edenred / BAES': '💳',
        'Acceso Discapacitados': '♿',
        'Estacionamiento': '🚗',
        'Bicicletero': '🚲',
        'Baño / WC': '🚽',
        'WiFi Disponible': '📶',
        'Terraza': '🪑'
    };

    const localReviews = (window.reviewsData || []).filter(r => r.localId === local.id);
    let avgComida   = local.notaComida;
    let avgServicio = local.notaServicio;
    if (localReviews.length > 0) {
        avgComida   = localReviews.reduce((s, r) => s + r.notaComida, 0)   / localReviews.length;
        avgServicio = localReviews.reduce((s, r) => s + r.notaServicio, 0) / localReviews.length;
    }

    let dietHtml = '';
    if ((local.vegano       || 0) > 0) dietHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;"><span style="color:var(--text-primary); font-weight:500;">🌱 Vegano</span><span style="font-size:1.1rem; color:var(--mesa-gold);">${'★'.repeat(local.vegano)}${'☆'.repeat(5-local.vegano)}</span></div>`;
    if ((local.vegetariano  || 0) > 0) dietHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;"><span style="color:var(--text-primary); font-weight:500;">🥬 Vegetariano</span><span style="font-size:1.1rem; color:var(--mesa-gold);">${'★'.repeat(local.vegetariano)}${'☆'.repeat(5-local.vegetariano)}</span></div>`;
    if ((local.sinGluten    || 0) > 0) dietHtml += `<div style="display:flex; justify-content:space-between; margin-bottom:8px; align-items:center;"><span style="color:var(--text-primary); font-weight:500;">🌾 Celíaco (Sin Gluten)</span><span style="font-size:1.1rem; color:var(--mesa-gold);">${'★'.repeat(local.sinGluten)}${'☆'.repeat(5-local.sinGluten)}</span></div>`;
    if ((local.sinLactosa   || 0) > 0) dietHtml += `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--text-primary); font-weight:500;">🥛 Sin Lactosa</span><span style="font-size:1.1rem; color:var(--mesa-gold);">${'★'.repeat(local.sinLactosa)}${'☆'.repeat(5-local.sinLactosa)}</span></div>`;

    const dietSection = dietHtml ? `
        <h3 class="section-title" style="margin-top: 20px;">Opciones Dietéticas</h3>
        <div style="background:rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding:15px; border-radius:16px; margin-bottom:20px;">${dietHtml}</div>
    ` : '';

    let distincionesHtml = '';
    if (local.distinciones && local.distinciones.length > 0) {
        distincionesHtml = `
            <div class="distinciones-container">
                <h3 style="color:var(--mesa-gold); font-size:1.1rem; margin-bottom:12px; font-family:'Playfair Display', serif;">Distinciones MG 🏅</h3>
                ${local.distinciones.map(d => `<div class="distincion-medal">${d}</div>`).join('')}
            </div>
        `;
    }

    let eventosHtml = '';
    if (local.sorteoFlash) {
        const timeLeft = Math.max(0, Math.ceil((local.sorteoFlash.expiraTimestamp - Date.now()) / 1000));
        if (timeLeft > 0) {
            eventosHtml = `
                <h3 class="section-title" style="margin-top:20px;">Eventos y Sorteos</h3>
                <div class="card event-card blink-gift" style="background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.15)); border: 1px solid var(--mesa-gold); padding: 15px; border-radius: 12px; display: flex; align-items: center; gap: 12px; margin-bottom: 20px; cursor: default;">
                    <span style="font-size: 2rem;">🎁</span>
                    <div style="flex: 1;">
                        <h4 style="color: var(--mesa-gold); margin: 0 0 5px 0; font-weight: bold; font-size: 0.95rem;">¡Sorteo Flash Activo!</h4>
                        <p style="color: white; margin: 0 0 5px 0; font-size: 0.85rem;">Premio: ${local.sorteoFlash.premio}</p>
                        <span id="detailSorteoTimer" style="font-size: 0.75rem; color: #cbd5e1; font-weight: 500;">Tiempo restante: ${timeLeft}s</span>
                    </div>
                </div>
            `;
        }
    }

    let socialHtml = '';
    if (local.website || local.instagram || local.tiktok) {
        socialHtml = `
            <div class="social-links-container" style="margin-top: 15px;">
                ${local.website   ? `<a href="${local.website}" target="_blank" class="social-link-btn website">🌐 Sitio Web</a>` : ''}
                ${local.instagram ? `<a href="https://instagram.com/${local.instagram}" target="_blank" class="social-link-btn instagram">📸 Instagram</a>` : ''}
                ${local.tiktok    ? `<a href="https://tiktok.com/@${local.tiktok}" target="_blank" class="social-link-btn tiktok">🎬 TikTok</a>` : ''}
            </div>
        `;
    }

    return `
        <div class="premium-score-box" style="background:var(--bg-panel); margin-bottom: 20px; padding:15px; border-radius:16px; border:1px solid var(--glass-border); display:flex; justify-content:space-around; align-items:center; box-shadow:var(--shadow-sm);">
            <div style="text-align:center; flex: 1;">
                <div style="font-size:1.4rem; color: var(--text-primary);">🍽️ ${avgComida.toFixed(1)}</div>
                <div style="font-size:0.75rem; color:var(--text-secondary);">Promedio Comida</div>
            </div>
            <div style="width:1px; height:40px; background:var(--glass-border);"></div>
            <div style="text-align:center; flex: 1;">
                <div style="font-size:1.4rem; color: var(--text-primary);">🤵 ${avgServicio.toFixed(1)}</div>
                <div style="font-size:0.75rem; color:var(--text-secondary);">Promedio Servicio</div>
            </div>
        </div>

        <h3 class="section-title">Información</h3>
        <p style="margin-bottom:8px; color:var(--text-primary); cursor:pointer;" onclick="focusOnMap(${local.id})">
            📍 <u>${local.direccion}</u> <span style="font-size:0.75rem; color:var(--text-secondary);">(Toca para ver en el mapa)</span>
        </p>
        <p style="margin-bottom:8px; color:var(--text-primary); cursor:pointer;" onclick="handlePhoneClick('${local.telefono}')" ondblclick="handlePhoneDblClick('${local.telefono}')">
            📞 <b>${local.telefono || 'No disponible'}</b> <span style="font-size:0.75rem; color:var(--text-secondary);">(Clic copia / Doble clic llama)</span>
        </p>

        <div style="margin-top: 15px; background: rgba(255,255,255,0.02); border: 1px solid var(--glass-border); padding: 15px; border-radius: 12px;">
            <h4 style="color: var(--mesa-gold); margin: 0 0 10px 0; font-size: 0.95rem;">📅 Horarios de Atención</h4>
            <div style="display: flex; flex-direction: column; gap: 6px; font-size: 0.85rem; color: var(--text-primary);">
                ${Object.entries(local.horariosSemana || {}).map(([dia, hora]) => `
                    <div style="display: flex; justify-content: space-between;">
                        <span style="font-weight: 500;">${dia}</span>
                        <span style="color: var(--text-secondary);">${hora}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        ${socialHtml}
        ${eventosHtml}

        <h3 class="section-title" style="margin-top:20px;">Características</h3>
        <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:20px;">
            ${local.caracteristicas.map(c => `
                <span class="feature-pill" style="background:var(--bg-panel); color:var(--text-primary); padding:6px 12px; border-radius:12px; font-size:0.85rem; border:1px solid var(--glass-border); box-shadow:var(--shadow-sm); display: inline-flex; align-items: center; gap: 5px;">
                    ${featureIcons[c] || '✨'} ${c}
                </span>
            `).join('')}
        </div>

        ${dietSection}

        <div style="margin-top: 25px;">
            <button class="btn" onclick="whatsappReserve(${local.id})" style="width:100%; background:rgba(37,211,102,0.15); border:1px solid #25D366; color:#25D366; padding:14px; border-radius:12px; font-size:1rem; font-weight:bold;">
                💬 Reservar por WhatsApp
            </button>
        </div>

        ${distincionesHtml}
    `;
}

// =================== TAB MENÚ ===================

function renderTabMenu(local) {
    const sortedMenu = local.menu ? [...local.menu].sort((a,b) => (b.likes || 0) - (a.likes || 0)) : [];

    return `
        <h3 class="section-title">Nuestra Carta (Ordenada por Popularidad 🔥)</h3>
        <div style="display: flex; flex-direction: column; gap: 15px; margin-bottom: 15px;">
            ${sortedMenu.map((item, index) => {
                const isTop1 = index === 0;
                return `
                <div class="card ${isTop1 ? 'golden-frame' : ''}" style="padding: 12px; align-items:center; position:relative; overflow:hidden; margin-bottom:0;">
                    ${isTop1 ? `<div style="position:absolute; top:-5px; right:-5px; font-size:1.5rem; transform:rotate(15deg);">👑</div>` : ''}
                    <div style="font-size:1.2rem; font-weight:bold; color:${isTop1?'var(--mesa-gold)':'var(--text-secondary)'}; width:30px; text-align:center;">#${index+1}</div>
                    <img src="${item.imagen}" style="width: 70px; height: 70px; border-radius: 12px; object-fit: cover; margin-right: 15px; ${isTop1 ? 'border: 2px solid var(--mesa-gold);' : ''}">
                    <div style="flex:1;">
                        <h4 style="font-weight: 600; font-size:1rem; margin-bottom:3px; color:var(--text-primary);">${item.nombre}</h4>
                        <span style="font-size:0.75rem; background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:6px; color:var(--text-secondary);">${item.categoria}</span>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:5px;">
                            <span style="color:var(--mesa-gold); font-weight:bold;">$${item.precio.toLocaleString('es-CL')}</span>
                            <span style="font-size: 0.85rem; background:rgba(139,38,53,0.1); color:var(--mesa-red); padding:2px 8px; border-radius:10px; font-weight:bold;">❤️ ${item.likes || 0}</span>
                        </div>
                    </div>
                </div>
                `;
            }).join('')}
        </div>
    `;
}

window.showMenu = function(localId) {
    const local = window.locales.find(l => l.id === localId);
    if (local) showLocalDetail(local, 'menu');
};

// =================== TAB RESEÑAS LOCAL ===================

function renderTabResenas(local) {
    const localReviews = (window.reviewsData || []).filter(r => r.localId === local.id);
    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 class="section-title" style="margin:0;">Opiniones de la Comunidad (${localReviews.length})</h3>
            <button class="badge" style="background:var(--mesa-gold); color:#000; border:none; padding:8px 16px; border-radius:15px; cursor:pointer; font-weight:bold; font-size:0.8rem;" onclick="openReviewModalForLocal(${local.id})">＋ Reseñar</button>
        </div>
    `;

    if (localReviews.length === 0) {
        html += `<p style="text-align:center; color:var(--text-secondary); margin-top:20px; font-style:italic;">Nadie ha opinado aún. ¡Sé el primero!</p>`;
    } else {
        html += `<div style="display:flex; flex-direction:column; gap:15px;">`;
        html += localReviews.map(r => `
            <div class="card" style="flex-direction:column; gap:8px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <div class="avatar" style="width:30px; height:30px; font-size:0.75rem;">${r.usuario.avatar}</div>
                    <div style="flex: 1;">
                        <div style="font-weight:600; font-size:0.85rem; color:var(--text-primary);">${r.usuario.nombre}</div>
                        <div style="font-size:0.7rem; color:var(--text-secondary);">${r.tiempoTranscurrido}</div>
                    </div>
                </div>
                ${r.fotoComida ? `<img src="${r.fotoComida}" style="width:100%; height:140px; object-fit:cover; border-radius:12px; margin-bottom:5px;">` : ''}
                <div style="display:flex; gap:15px; font-size:0.85rem; font-weight:bold; color:var(--text-primary);">
                    <span>🍽️ Comida: <span style="color:var(--mesa-gold);">${r.notaComida.toFixed(1)}</span></span>
                    <span>🤵 Servicio: <span style="color:var(--mesa-gold);">${r.notaServicio.toFixed(1)}</span></span>
                </div>
                <p style="font-size:0.9rem; color:var(--text-primary); line-height:1.4; margin-top:4px;">"${r.comentario}"</p>
                <div style="font-size:0.75rem; color:var(--text-secondary);">Degustó: ${r.productos.join(', ')}</div>
            </div>
        `).join('');
        html += `</div>`;
    }
    return html;
}

// =================== MODAL RESEÑA LOCAL ===================

window.openReviewModalForLocal = function(localId) {
    if (checkGuestAccess()) return;

    const local = window.locales.find(l => l.id === localId);
    if (!local) return;

    const existing = document.getElementById('reviewModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'reviewModal';
    modal.className = 'detail-view';
    modal.style.zIndex = '3500';

    const menuOptionsHtml = local.menu.map((item, idx) => `
        <div class="dish-selector-card" id="dishCard_${idx}">
            <div style="display:flex; align-items:center; gap:10px;">
                <input type="checkbox" class="dish-checkbox" id="checkDish_${idx}" value="${item.nombre}" onchange="toggleDishSelection(${idx})">
                <span style="font-size:0.9rem; font-weight:500; color:white;">${item.nombre}</span>
            </div>
            <div style="display:flex; align-items:center; gap:8px;">
                <div id="counterArea_${idx}" style="display:none; align-items:center; gap:6px;">
                    <button class="dish-counter-btn" onclick="adjustDishCount(${idx}, -1)">-</button>
                    <span id="dishCount_${idx}" style="font-size:0.85rem; font-weight:bold; color:var(--mesa-gold);">1</span>
                    <button class="dish-counter-btn" onclick="adjustDishCount(${idx}, 1)">+</button>
                </div>
                <div id="photoArea_${idx}" class="dish-photo-uploader" onclick="simulateDishPhotoUpload(${idx})">📸 Foto</div>
            </div>
        </div>
    `).join('');

    modal.innerHTML = `
        <div class="detail-header" style="text-align:center; position:relative;">
            <button class="back-btn" onclick="document.getElementById('reviewModal').remove()" style="position:absolute; top:15px; left:15px; margin:0;">✕ Cerrar</button>
            <h1 style="margin-top:20px; color: white;">Nueva Reseña</h1>
            <p style="color:var(--mesa-gold)">${local.nombre}</p>
        </div>
        <div style="padding:20px; padding-bottom: 60px;">
            <div class="form-group">
                <label>Selecciona lo que consumiste de la Carta</label>
                <div style="max-height: 250px; overflow-y: auto; padding-right: 5px; display: flex; flex-direction: column; gap: 8px;">${menuOptionsHtml}</div>
            </div>

            <div class="form-group" style="margin-top: 15px;">
                <label>Calificación Comida: <span id="valComida" style="color:var(--mesa-gold); font-weight:bold; font-size:1.1rem;">5.0</span></label>
                <input type="range" min="0" max="10" step="0.1" value="5.0" class="custom-slider" oninput="document.getElementById('valComida').innerText = parseFloat(this.value).toFixed(1)">
            </div>

            <div class="form-group">
                <label>Calificación Servicio: <span id="valServicio" style="color:var(--mesa-gold); font-weight:bold; font-size:1.1rem;">5.0</span></label>
                <input type="range" min="0" max="10" step="0.1" value="5.0" class="custom-slider" oninput="document.getElementById('valServicio').innerText = parseFloat(this.value).toFixed(1)">
            </div>

            <div class="form-group">
                <label>Consumo Total Estimado ($)</label>
                <div class="input-wrapper">
                    <input type="number" id="reviewSpend" placeholder="Ej: 15000" style="padding: 12px;">
                </div>
            </div>

            <div class="form-group">
                <label>Comentario de tu experiencia</label>
                <div class="input-wrapper">
                    <textarea id="reviewText" style="width:100%; background:rgba(15,23,42,0.6); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:14px; color:white; min-height:100px; resize:vertical; outline:none;" placeholder="Cuéntanos qué tal estaba la comida, la atención..."></textarea>
                </div>
            </div>

            <button class="btn-submit" onclick="submitCustomReview(${local.id})">Publicar Reseña ⭐</button>
        </div>
    `;

    document.body.appendChild(modal);
};

window.toggleDishSelection = function(idx) {
    const isChecked   = document.getElementById(`checkDish_${idx}`).checked;
    const card        = document.getElementById(`dishCard_${idx}`);
    const counterArea = document.getElementById(`counterArea_${idx}`);
    if (isChecked) {
        card.classList.add('selected');
        counterArea.style.display = 'inline-flex';
    } else {
        card.classList.remove('selected');
        counterArea.style.display = 'none';
    }
};

window.adjustDishCount = function(idx, diff) {
    const valSpan   = document.getElementById(`dishCount_${idx}`);
    let currentVal  = parseInt(valSpan.innerText);
    valSpan.innerText = Math.max(1, currentVal + diff);
};

window.dishPhotos = {};

window.simulateDishPhotoUpload = function(idx) {
    const check = document.getElementById(`checkDish_${idx}`);
    if (!check.checked) { alert("Primero selecciona el plato con la casilla [✓]."); return; }
    const filename = prompt("Escribe el nombre del archivo de imagen para simular la subida:", `plato_${idx}.jpg`);
    if (!filename) return;
    const uploader = document.getElementById(`photoArea_${idx}`);
    uploader.innerText = "✅ " + filename.slice(0, 12) + "...";
    uploader.classList.add('uploaded');
    window.dishPhotos[idx] = filename;
};

window.submitCustomReview = function(localId) {
    const local = window.locales.find(l => l.id === localId);
    if (!local) return;

    const selectedDishes = [];
    let isFakeImageDetected = false;
    let mainUploadedPhoto   = null;

    local.menu.forEach((item, idx) => {
        const check = document.getElementById(`checkDish_${idx}`);
        if (check && check.checked) {
            const count = parseInt(document.getElementById(`dishCount_${idx}`).innerText);
            selectedDishes.push(`${item.nombre} (x${count})`);
            if (window.dishPhotos[idx]) {
                const photoName = window.dishPhotos[idx].toLowerCase();
                if (photoName.includes('fake') || photoName.includes('meme') || photoName.includes('perro') || photoName.includes('gato')) {
                    isFakeImageDetected = true;
                }
                mainUploadedPhoto = item.imagen;
            }
        }
    });

    if (selectedDishes.length === 0) { alert("⚠️ Selecciona al menos un plato de la carta."); return; }

    const notaComida   = parseFloat(document.getElementById('valComida').innerText);
    const notaServicio = parseFloat(document.getElementById('valServicio').innerText);
    const comentario   = document.getElementById('reviewText').value.trim() || "Excelente comida y gran ambiente.";
    const spend        = parseInt(document.getElementById('reviewSpend').value) || 12000;

    const newReview = {
        id: Date.now(),
        usuario: { nombre: window.currentUser.name, avatar: window.currentUser.name.slice(0,2).toUpperCase() },
        fecha: new Date().toISOString().split('T')[0],
        tiempoTranscurrido: "Hace unos instantes",
        localId, productos: selectedDishes,
        fotoComida: mainUploadedPhoto, notaComida, notaServicio, comentario, spend,
        likes: 0, liked: false, isDrink: false
    };

    const previousCount = getUserReviewCount();

    if (isFakeImageDetected) {
        window.adminQueue.push(newReview);
        localStorage.setItem('mesaAdminQueue', JSON.stringify(window.adminQueue));
        alert("🚨 Filtro de Coherencia de Imagen: La fotografía podría no corresponder al plato. La reseña fue enviada a revisión administrativa.");
    } else {
        window.reviewsData.unshift(newReview);
        window.saveData();

        const localReviews  = window.reviewsData.filter(r => r.localId === localId);
        const avgC          = localReviews.reduce((s, r) => s + r.notaComida, 0)   / localReviews.length;
        const avgS          = localReviews.reduce((s, r) => s + r.notaServicio, 0) / localReviews.length;
        local.notaComida    = parseFloat(avgC.toFixed(1));
        local.notaServicio  = parseFloat(avgS.toFixed(1));
        local.notaMG        = parseFloat(((avgC + avgS) / 2).toFixed(1));
        window.saveData();

        // Verificar subida de nivel
        checkLevelUp(previousCount);

        showToast("🎉 ¡Reseña publicada con éxito! Gracias por tu aporte.");
    }

    window.dishPhotos = {};
    document.getElementById('reviewModal').remove();
    showLocalDetail(local, 'reseñas');
};

// =================== MAPA ===================

function renderMapa() {
    const mainContent = document.getElementById('mainContent');

    mainContent.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h2 class="section-title" style="margin:0;">Explora Talca</h2>
            <div class="map-switch-container">
                <button id="mapPaneBtn" class="map-switch-btn active" onclick="switchMapPane('map')">🗺️ Mapa</button>
                <button id="eventsPaneBtn" class="map-switch-btn" onclick="switchMapPane('events')">📅 Cartelera</button>
            </div>
        </div>

        <div class="map-dual-wrapper" id="mapDualWrapper">
            <div class="map-dual-slider" id="mapDualSlider">
                <div class="map-pane">
                    <div style="display:flex; gap:8px; overflow-x:auto; margin-bottom:10px; padding-bottom:5px;">
                        <button class="badge map-filter-btn active" onclick="filterMapMarkers('todos', this)">Todos</button>
                        <button class="badge map-filter-btn" onclick="filterMapMarkers('abiertos', this)">Abiertos</button>
                        <button class="badge map-filter-btn" onclick="filterMapMarkers('vegano', this)">🌱 Vegano</button>
                        <button class="badge map-filter-btn" onclick="filterMapMarkers('vegetariano', this)">🥬 Veg</button>
                    </div>
                    <div id="mapContainer" style="height:420px;">
                        <div id="talcaMap" style="width:100%; height:100%;"></div>
                    </div>
                </div>
                <div class="events-pane">
                    <h3 style="font-size:1.1rem; margin-bottom:10px; color:var(--text-primary); font-family:'Playfair Display', serif;">Cartelera de Eventos y Sorteos</h3>
                    <div style="display:flex; flex-direction:column; gap:12px; max-height:430px; overflow-y:auto; padding-right:5px;" id="eventsContainer"></div>
                </div>
            </div>
        </div>
    `;

    setTimeout(initializeMap, 300);
    renderEventsBoard();
    setupMapSwipeGestures();
}

window.switchMapPane = function(pane) {
    const slider    = document.getElementById('mapDualSlider');
    const mapBtn    = document.getElementById('mapPaneBtn');
    const eventsBtn = document.getElementById('eventsPaneBtn');
    if (!slider) return;
    if (pane === 'map') {
        slider.style.transform = 'translateX(0%)';
        mapBtn.classList.add('active');
        eventsBtn.classList.remove('active');
    } else {
        slider.style.transform = 'translateX(-50%)';
        mapBtn.classList.remove('active');
        eventsBtn.classList.add('active');
    }
};

function setupMapSwipeGestures() {
    const wrapper = document.getElementById('mapDualWrapper');
    if (!wrapper) return;
    let startX = 0, startY = 0;
    wrapper.addEventListener('touchstart', e => { startX = e.changedTouches[0].pageX; startY = e.changedTouches[0].pageY; }, { passive: true });
    wrapper.addEventListener('touchend', e => {
        const diffX = e.changedTouches[0].pageX - startX;
        const diffY = e.changedTouches[0].pageY - startY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 60) {
            switchMapPane(diffX < 0 ? 'events' : 'map');
        }
    }, { passive: true });
}

function initializeMap() {
    const mapEl = document.getElementById('talcaMap');
    if (!mapEl) return;
    const talcaCenter = [-35.4264, -71.6554];
    talcaMap = L.map(mapEl).setView(talcaCenter, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap', maxZoom: 18, minZoom: 11 }).addTo(talcaMap);
    filterMapMarkers('todos');
}

window.filterMapMarkers = function(type, btn) {
    if (btn) {
        document.querySelectorAll('.map-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    if (!talcaMap) return;
    mapMarkers.forEach(m => talcaMap.removeLayer(m));
    mapMarkers = [];
    window.locales.forEach(local => {
        if (type === 'abiertos'    && !local.abierto)                    return;
        if (type === 'vegano'      && (local.vegano || 0) < 3)           return;
        if (type === 'vegetariano' && (local.vegetariano || 0) < 3)      return;
        const color  = local.abierto ? '#10b981' : '#ef4444';
        const marker = L.circleMarker([local.lat, local.lng], { radius: 10, fillColor: color, color: '#fff', weight: 3, fillOpacity: 0.9 }).addTo(talcaMap);
        marker.bindTooltip(local.nombre, { permanent: false, direction: 'top', offset: [0, -10], className: 'leaflet-tooltip-custom' });
        marker.on('click', () => showLocalDetail(local));
        mapMarkers.push(marker);
    });
};

function renderEventsBoard() {
    const container = document.getElementById('eventsContainer');
    if (!container) return;

    const eventosPuntuales = [
        { nombre: '🎤 Noche Acústica en Vivo', fecha: 'Viernes 21:00hrs', localId: 1, localNombre: 'La Cocina de Ramsés', desc: 'Acompaña tu cena con música acústica peruana.' },
        { nombre: '🎧 Dj Set & Cócteles',      fecha: 'Sábado 22:00hrs',  localId: 4, localNombre: 'Sushi Zen',           desc: 'Música en vivo y promociones exclusivas en barra.' }
    ];

    const promocionesContinuas = [];
    window.locales.forEach(l => {
        (l.promociones || []).forEach(p => {
            promocionesContinuas.push({ nombre: `${p.icono} ${p.descripcion}`, fecha: 'Promoción semanal recurrente', localId: l.id, localNombre: l.nombre, desc: `Método: ${p.metodo}. Horario: ${p.horaInicio} a ${p.horaFin} hrs.` });
        });
    });

    let html = `<div style="border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; margin-bottom: 5px;"><span style="font-size:0.75rem; font-weight:bold; color:var(--mesa-gold); text-transform:uppercase; letter-spacing:1px;">📅 Eventos del Fin de Semana</span></div>`;
    html += eventosPuntuales.map(e => `
        <div class="card event-pane-card" style="flex-direction:column; background:linear-gradient(135deg, rgba(139,38,53,0.08) 0%, rgba(30,41,59,0.8) 100%); margin-bottom:0; border-left: 4px solid var(--mesa-red); padding: 14px;" onclick="showLocalDetailById(${e.localId})">
            <span class="badge" style="background:var(--mesa-red); font-size:0.65rem; width:fit-content;">${e.localNombre}</span>
            <h4 style="font-weight:bold; font-size:1rem; margin:5px 0 2px 0; color:white;">${e.nombre}</h4>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:6px;">${e.desc}</p>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--mesa-gold);"><span>📅 ${e.fecha}</span><span style="text-decoration:underline;">Ver Ficha →</span></div>
        </div>
    `).join('');

    html += `<div style="border-bottom: 1px solid var(--glass-border); padding-bottom: 8px; margin-top: 15px; margin-bottom: 5px;"><span style="font-size:0.75rem; font-weight:bold; color:var(--mesa-gold); text-transform:uppercase; letter-spacing:1px;">🏷️ Descuentos & Beneficios Continuos</span></div>`;
    html += promocionesContinuas.map(p => `
        <div class="card event-pane-card" style="flex-direction:column; background:linear-gradient(135deg, rgba(255,215,0,0.03) 0%, rgba(30,41,59,0.8) 100%); margin-bottom:0; border-left: 4px solid var(--mesa-gold); padding: 14px;" onclick="showLocalDetailById(${p.localId})">
            <span class="badge" style="background:var(--bg-panel); color:var(--text-primary); font-size:0.65rem; border:1px solid var(--glass-border); width:fit-content;">${p.localNombre}</span>
            <h4 style="font-weight:bold; font-size:1rem; margin:5px 0 2px 0; color:white;">${p.nombre}</h4>
            <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:6px;">${p.desc}</p>
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--mesa-gold);"><span>📅 ${p.fecha}</span><span style="text-decoration:underline;">Ver Ficha →</span></div>
        </div>
    `).join('');

    container.innerHTML = html;
}

window.focusOnMap = function(localId) {
    hideLocalDetail();
    switchTab('mapa');
    setTimeout(() => {
        const local = window.locales.find(l => l.id === localId);
        if (local && talcaMap) {
            talcaMap.setView([local.lat, local.lng], 16);
            const marker = mapMarkers.find(m => {
                const ll = m.getLatLng();
                return Math.abs(ll.lat - local.lat) < 0.0001 && Math.abs(ll.lng - local.lng) < 0.0001;
            });
            if (marker) marker.fire('click');
        }
    }, 500);
};

let phoneTimer = null;
window.handlePhoneClick = function(phone) {
    if (phoneTimer) return;
    phoneTimer = setTimeout(() => {
        navigator.clipboard.writeText(phone);
        showToast(`📋 Copiado: ${phone}`, 2000);
        phoneTimer = null;
    }, 300);
};

window.handlePhoneDblClick = function(phone) {
    if (phoneTimer) { clearTimeout(phoneTimer); phoneTimer = null; }
    window.location.href = `tel:${phone.replace(/\s+/g, '')}`;
};

window.whatsappReserve = function(localId) {
    const local = window.locales.find(l => l.id === localId);
    if (!local) return;
    const phone = local.whatsapp || "56912345678";
    const msg   = encodeURIComponent(`Hola, vengo de Mesa Gourmet y me gustaría hacer una reserva en ${local.nombre}.`);
    window.open(`https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${msg}`, '_blank');
};

// =================== TOP 50 ===================

function renderTop50() {
    const sorted     = [...window.locales].sort((a,b) => (b.notaMG || 0) - (a.notaMG || 0));
    const firstPlace = sorted[0];
    const secondPlace= sorted[1];
    const thirdPlace = sorted[2];
    const remaining  = sorted.slice(3);

    const mainContent = document.getElementById('mainContent');

    mainContent.innerHTML = `
        <div style="text-align:center; margin-bottom:15px;">
            <h2 class="section-title" style="margin-bottom:2px; font-family:'Playfair Display', serif;">🏆 Top Gourmet de Talca</h2>
            <p style="color:var(--mesa-gold); font-weight:600; font-size:0.9rem;">El ranking de la comunidad</p>
        </div>

        <!-- PODIO VISUAL -->
        <div class="podium-container">
            <!-- 2do Lugar -->
            ${secondPlace ? `
            <div class="podium-column second" onclick="showLocalDetailById(${secondPlace.id})">
                <img src="${secondPlace.imagen}" class="podium-img" alt="${secondPlace.nombre}">
                <div class="place-label">🥈 2° Lugar</div>
                <div class="podium-name">${secondPlace.nombre}</div>
                <div style="font-size:0.78rem; color:var(--mesa-gold); font-weight:bold;">${secondPlace.notaMG.toFixed(1)} ★</div>
            </div>` : ''}

            <!-- 1er Lugar -->
            ${firstPlace ? `
            <div class="podium-column first" onclick="showLocalDetailById(${firstPlace.id})">
                <div class="crown">👑</div>
                <img src="${firstPlace.imagen}" class="podium-img" alt="${firstPlace.nombre}">
                <div class="place-label" style="color:var(--mesa-gold); font-weight:bold;">🏆 Rey Gourmet</div>
                <div class="podium-name">${firstPlace.nombre}</div>
                <div style="font-size:0.88rem; color:var(--mesa-gold); font-weight:bold;">${firstPlace.notaMG.toFixed(1)} ★</div>
            </div>` : ''}

            <!-- 3er Lugar -->
            ${thirdPlace ? `
            <div class="podium-column third" onclick="showLocalDetailById(${thirdPlace.id})">
                <img src="${thirdPlace.imagen}" class="podium-img" alt="${thirdPlace.nombre}">
                <div class="place-label" style="color:#d97706;">🥉 3° Lugar</div>
                <div class="podium-name">${thirdPlace.nombre}</div>
                <div style="font-size:0.78rem; color:var(--mesa-gold); font-weight:bold;">${thirdPlace.notaMG.toFixed(1)} ★</div>
            </div>` : ''}
        </div>

        <div style="border-bottom:1px solid var(--glass-border); padding-bottom:10px; margin-bottom:15px;">
            <h3 style="font-size:1.1rem; color:white; font-family:'Playfair Display', serif;">Tabla de Clasificaciones</h3>
        </div>

        <div style="display:flex; flex-direction:column; gap:12px;">
            ${remaining.map((local, i) => `
                <div class="card" style="align-items:center;" onclick='showLocalDetailById(${local.id})'>
                    <div style="font-size:1.1rem; font-weight:bold; color:var(--mesa-gold); width:30px; text-align:center;">${i+4}</div>
                    <div class="card-img-wrapper" style="width:60px; height:60px;">
                        <img src="${local.imagen}" alt="${local.nombre}">
                    </div>
                    <div class="card-body">
                        <h4 style="font-weight:600; color:var(--text-primary); margin:0;">${local.nombre}</h4>
                        <p style="font-size:0.8rem; color:var(--text-secondary); margin:0;">${local.tipo}</p>
                    </div>
                    <div style="font-weight:bold; color:white; font-size:0.95rem;">
                        ${local.notaMG.toFixed(1)} <span style="color:var(--mesa-gold);">★</span>
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Nota informativa fija al pie -->
        <div class="top50-footer-note">
            <span style="font-size:1.1rem;">ℹ️</span>
            <span>Mínimo <strong>20 reseñas verificadas</strong> del local para ingresar al Top 50.</span>
        </div>
    `;
}

// =================== MISIONES ===================

function renderMisiones() {
    const reviewCount   = getUserReviewCount();
    const currentLevel  = calculateLevel(reviewCount);
    const reqCurrent    = getRequiredForLevel(currentLevel);
    const reqNext       = getRequiredForLevel(currentLevel + 1);
    const progress      = reqNext > reqCurrent
        ? Math.min(100, Math.round(((reviewCount - reqCurrent) / (reqNext - reqCurrent)) * 100))
        : 100;

    const mainContent = document.getElementById('mainContent');

    mainContent.innerHTML = `
        <!-- Nivel header -->
        <div class="misiones-level-header">
            <div class="misiones-level-badge">Nivel ${currentLevel}</div>
            <div class="misiones-level-info">
                <div class="misiones-level-name">${getLevelName(currentLevel)}</div>
                <div class="misiones-level-bar-bg">
                    <div class="misiones-level-bar-fill" style="width:${progress}%;"></div>
                </div>
            </div>
            <div style="font-size:0.75rem; color:var(--text-secondary); white-space:nowrap; flex-shrink:0;">${reviewCount}/${reqNext} reseñas</div>
        </div>

        <!-- Tabs -->
        <div class="misiones-tabs">
            <button id="retosBtn"    class="misiones-tab-btn active" onclick="switchMisionesTab('retos')">Retos</button>
            <button id="descubrirBtn" class="misiones-tab-btn"       onclick="switchMisionesTab('descubrir')">Descubrir Platos 🎬</button>
        </div>
        <div id="misionesContent"></div>
    `;

    switchMisionesTab('retos');
}

window.switchMisionesTab = function(subtab) {
    const retosBtn    = document.getElementById('retosBtn');
    const descubrirBtn= document.getElementById('descubrirBtn');
    const content     = document.getElementById('misionesContent');
    if (!retosBtn || !descubrirBtn || !content) return;

    if (subtab === 'retos') {
        retosBtn.classList.add('active');
        descubrirBtn.classList.remove('active');
        renderRetosList(content);
    } else {
        descubrirBtn.classList.add('active');
        retosBtn.classList.remove('active');
        openPhotoFeed();
    }
};

function renderRetosList(container) {
    const visitedCount = getVisitedLocalesCount();
    const logros = computeUserLogros();

    const misiones = [
        { titulo: "🍕 Primer Bocado",       descripcion: "Visita tu primer local dejando una reseña.", progreso: Math.min(1, visitedCount),  total: 1,  completada: visitedCount >= 1,  recompensa: "Insignia Novicio" },
        { titulo: "🌮 Explorador Gourmet",   descripcion: "Visita 3 locales únicos en Talca.",          progreso: Math.min(3, visitedCount),  total: 3,  completada: visitedCount >= 3,  recompensa: "Nivel 2 + Medalla" },
        { titulo: "🍜 Crítico Consagrado",   descripcion: "Llega a 7 locales únicos visitados.",        progreso: Math.min(7, visitedCount),  total: 7,  completada: visitedCount >= 7,  recompensa: "Nivel 3 + Insignia" },
        { titulo: "📸 Leyenda Culinaria",    descripcion: "Registra visitas a 10 locales en total.",    progreso: Math.min(10, visitedCount), total: 10, completada: visitedCount >= 10, recompensa: "Nivel 4 + Título" },
    ];

    const logrosHtml = logros.map(l => `
        <div class="logro-card ${l.unlocked ? 'unlocked' : 'locked'}">
            ${l.unlocked ? '<div class="logro-unlocked-badge">✅</div>' : ''}
            <div class="logro-emoji">${l.emoji}</div>
            <div class="logro-titulo">${l.titulo}</div>
            <div class="logro-progress">${l.unlocked ? l.descripcion : `${l.count}/${l.required} — ${l.descripcion}`}</div>
        </div>
    `).join('');

    container.innerHTML = `
        <h3 style="font-size:1.1rem; margin-bottom:12px; color:white; font-family:'Playfair Display', serif;">Tus Retos Gastronómicos</h3>
        <div style="display: flex; flex-direction: column; gap: 14px; margin-bottom: 0;">
            ${misiones.map(m => `
                <div class="card" style="flex-direction:column; border-left: 4px solid ${m.completada ? '#10b981' : 'var(--mesa-gold)'}; margin-bottom:0; padding:15px;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px; align-items:center;">
                        <h4 style="font-weight:600; color:white; margin:0;">${m.titulo}</h4>
                        <span style="font-size: 1.1rem;">${m.completada ? '✅ Listo' : '⏳ En marcha'}</span>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:10px;">${m.descripcion}</p>
                    <div style="display:flex; justify-content:space-between; font-size:0.8rem; margin-bottom: 5px; color:white;">
                        <span>Progreso de Locales</span>
                        <span>${m.progreso} / ${m.total}</span>
                    </div>
                    <div style="background:rgba(255,255,255,0.05); height:8px; border-radius:4px; overflow:hidden; margin-bottom: 8px;">
                        <div style="width:${(m.progreso/m.total)*100}%; background:${m.completada ? '#10b981' : 'var(--mesa-red)'}; height:100%;"></div>
                    </div>
                    <div style="font-size:0.75rem; color: var(--mesa-gold); text-align:right; font-weight:600;">
                        🎁 Recompensa: ${m.recompensa}
                    </div>
                </div>
            `).join('')}
        </div>

        <!-- Logros Gastronómicos -->
        <div class="logros-section">
            <h3 style="font-size:1.1rem; margin-bottom:12px; color:white; font-family:'Playfair Display', serif;">🏅 Logros Gastronómicos</h3>
            <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:14px;">Desbloquea insignias probando 5 veces el mismo tipo de platillo.</p>
            <div class="logros-grid">${logrosHtml}</div>
        </div>
    `;
}

// =================== HORIZONTAL PHOTO FEED ===================

function openPhotoFeed() {
    const reviewsWithPhoto = window.reviewsData.filter(r => r.fotoComida);

    if (reviewsWithPhoto.length === 0) {
        const content = document.getElementById('misionesContent');
        if (content) content.innerHTML = `
            <div style="text-align:center; padding:40px 20px; color:var(--text-secondary);">
                <div style="font-size:3rem; margin-bottom:15px;">📷</div>
                <p>Aún no hay fotos de comida subidas por la comunidad.<br>¡Sé el primero en reseñar!</p>
            </div>
        `;
        return;
    }

    photoSlidesData   = [...reviewsWithPhoto].sort(() => Math.random() - 0.5);
    currentPhotoIndex = 0;

    const overlay = document.createElement('div');
    overlay.id    = 'photoFeedOverlay';
    overlay.className = 'photo-feed-overlay';

    renderPhotoFeedSlider(overlay);
    document.body.appendChild(overlay);
    setupPhotoSwipeGestures(overlay);
}

function renderPhotoFeedSlider(container) {
    const slidesHtml = photoSlidesData.map((review, idx) => {
        const local = window.locales.find(l => l.id === review.localId) || { nombre: 'Local', id: 0 };
        return `
        <div class="photo-slide" id="photoSlide_${idx}">
            <img class="photo-slide-bg" src="${review.fotoComida}" alt="${review.productos[0]}">
            <div class="photo-slide-overlay"></div>
            <div class="photo-slide-info">
                <h3>${local.nombre}</h3>
                <p><b>Degustó:</b> ${review.productos.join(', ')}</p>
                <p style="font-style:italic; margin-top:4px;">"${review.comentario.slice(0, 90)}${review.comentario.length > 90 ? '...' : ''}"</p>
            </div>
            <div class="photo-slide-actions">
                <div>
                    <div class="photo-action-btn-circle" onclick="likePhotoSlide(${idx}, ${review.id})">❤️</div>
                    <div class="photo-action-label" id="photoLikes_${idx}" style="color:white;text-align:center;font-size:0.72rem;margin-top:3px;">${review.likes}</div>
                </div>
                <div>
                    <div class="photo-action-btn-circle" onclick="openTikTokReviewModal(${idx})">💬</div>
                    <div class="photo-action-label" style="color:white;text-align:center;font-size:0.72rem;margin-top:3px;">Reseña</div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    container.innerHTML = `
        <div class="photo-feed-header">
            <button class="photo-feed-close" onclick="closePhotoFeed()">✕</button>
            <span class="photo-feed-counter" id="photoFeedCounter">1 / ${photoSlidesData.length}</span>
        </div>
        <div class="photo-feed-track" id="photoFeedTrack">${slidesHtml}</div>
        <button class="photo-nav-btn prev ${currentPhotoIndex === 0 ? 'disabled' : ''}" id="photoPrevBtn" onclick="navigatePhotoFeed(-1)">◀</button>
        <button class="photo-nav-btn next ${currentPhotoIndex === photoSlidesData.length - 1 ? 'disabled' : ''}" id="photoNextBtn" onclick="navigatePhotoFeed(1)">▶</button>
    `;

    updatePhotoFeedPosition();
}

window.navigatePhotoFeed = function(direction) {
    const newIndex = currentPhotoIndex + direction;
    if (newIndex < 0 || newIndex >= photoSlidesData.length) return;
    currentPhotoIndex = newIndex;
    updatePhotoFeedPosition();
};

function updatePhotoFeedPosition() {
    const track   = document.getElementById('photoFeedTrack');
    const counter = document.getElementById('photoFeedCounter');
    const prevBtn = document.getElementById('photoPrevBtn');
    const nextBtn = document.getElementById('photoNextBtn');

    if (track)   track.style.transform = `translateX(-${currentPhotoIndex * 100}%)`;
    if (counter) counter.textContent   = `${currentPhotoIndex + 1} / ${photoSlidesData.length}`;
    if (prevBtn) prevBtn.classList.toggle('disabled', currentPhotoIndex === 0);
    if (nextBtn) nextBtn.classList.toggle('disabled', currentPhotoIndex === photoSlidesData.length - 1);
}

function setupPhotoSwipeGestures(container) {
    let startX = 0;
    container.addEventListener('touchstart', e => { startX = e.changedTouches[0].pageX; }, { passive: true });
    container.addEventListener('touchend',   e => {
        const diff = e.changedTouches[0].pageX - startX;
        if (Math.abs(diff) > 50) navigatePhotoFeed(diff < 0 ? 1 : -1);
    }, { passive: true });
}

window.closePhotoFeed = function() {
    const el = document.getElementById('photoFeedOverlay');
    if (el) el.remove();
    // Volver a la pestaña Retos
    const retosBtn = document.getElementById('retosBtn');
    if (retosBtn) retosBtn.click();
    else switchMisionesTab('retos');
};

window.likePhotoSlide = function(slideIdx, reviewId) {
    const review = window.reviewsData.find(r => r.id === reviewId);
    if (!review) return;
    review.likes++;
    window.saveData();
    const label = document.getElementById(`photoLikes_${slideIdx}`);
    if (label) label.innerText = review.likes;

    const local = window.locales.find(l => l.id === review.localId);
    if (local && local.menu) {
        review.productos.forEach(prodStr => {
            const cleanName = prodStr.split(' (x')[0];
            const menuItem  = local.menu.find(m => m.nombre.toLowerCase().includes(cleanName.toLowerCase()));
            if (menuItem) menuItem.likes = (menuItem.likes || 0) + 1;
        });
        window.saveData();
    }
};

// Usar photoSlidesData (alias para compatibilidad)
window.openTikTokReviewModal = function(slideIdx) {
    const review = photoSlidesData[slideIdx];
    if (!review) return;
    const local = window.locales.find(l => l.id === review.localId) || { nombre: 'Local', id: 0 };

    const modal = document.createElement('div');
    modal.id = 'tiktokReviewDetailModal';
    modal.className = 'detail-view';
    modal.style.zIndex = '1600';
    modal.style.background = 'rgba(15,23,42,0.98)';
    modal.style.backdropFilter = 'blur(10px)';

    modal.innerHTML = `
        <div class="detail-header" style="text-align:center; position:relative;">
            <button class="back-btn" onclick="document.getElementById('tiktokReviewDetailModal').remove()" style="position:absolute; top:15px; left:15px; margin:0;">✕ Cerrar</button>
            <h1 style="margin-top:20px; color: white;">Detalle de Reseña</h1>
            <p style="color:var(--mesa-gold)">${local.nombre}</p>
        </div>
        <div style="padding:25px; color:white;">
            <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
                <div class="avatar" style="width:40px; height:40px; font-size:1.1rem; background:var(--mesa-gold); color:black;">${review.usuario.avatar}</div>
                <div>
                    <h3 style="font-size:1.1rem; color:white;">${review.usuario.nombre}</h3>
                    <p style="font-size:0.8rem; color:var(--text-secondary);">${review.tiempoTranscurrido}</p>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); padding:15px; border-radius:12px; margin-bottom:20px;">
                <p style="margin-bottom:8px;"><b>Platos consumidos:</b> ${review.productos.join(', ')}</p>
                <p style="margin-bottom:12px;"><b>Consumo Estimado:</b> $${(review.spend || 12000).toLocaleString('es-CL')}</p>
                <div style="display:flex; gap:15px; font-size:1rem; font-weight:bold; margin-bottom:10px;">
                    <span>🍽️ Comida: <span style="color:var(--mesa-gold);">${review.notaComida.toFixed(1)}</span></span>
                    <span>🤵 Servicio: <span style="color:var(--mesa-gold);">${review.notaServicio.toFixed(1)}</span></span>
                </div>
                <p style="font-size:1rem; line-height:1.5; color:#cbd5e1; font-style:italic;">"${review.comentario}"</p>
            </div>
            <button class="btn btn-primary" onclick="goToLocalFromTikTok(${local.id})" style="width:100%; padding:14px; font-size:1rem; border-radius:12px;">
                ¡Me tentó! Ver local 🏃‍♂️💨
            </button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.goToLocalFromTikTok = function(localId) {
    const modal = document.getElementById('tiktokReviewDetailModal');
    if (modal) modal.remove();
    const feed = document.getElementById('photoFeedOverlay');
    if (feed) feed.remove();
    showLocalDetailById(localId);
};

// =================== RESEÑAS — DUAL TABS ===================

function renderResenas() {
    const mainContent = document.getElementById('mainContent');

    mainContent.innerHTML = `
        <!-- Dual tabs -->
        <div class="resenas-tabs">
            <button id="feedTabBtn"    class="resenas-tab-btn active" onclick="switchResenasTab('feed')">📰 Feed en Vivo</button>
            <button id="escribirTabBtn" class="resenas-tab-btn"       onclick="switchResenasTab('escribir')">✍️ Escribir Reseña</button>
        </div>
        <div id="resenasTabContent"></div>
    `;

    switchResenasTab('feed');
}

window.switchResenasTab = function(tab) {
    const feedBtn     = document.getElementById('feedTabBtn');
    const escribirBtn = document.getElementById('escribirTabBtn');
    const content     = document.getElementById('resenasTabContent');
    if (!feedBtn || !escribirBtn || !content) return;

    if (tab === 'feed') {
        feedBtn.classList.add('active');
        escribirBtn.classList.remove('active');
        content.innerHTML = renderFeedEnVivo();
    } else {
        escribirBtn.classList.add('active');
        feedBtn.classList.remove('active');
        content.innerHTML = renderEscribirResena();
    }
};

function renderFeedEnVivo() {
    let html = `
        <!-- El Baúl de los Antojos -->
        <div class="card" style="flex-direction:column; padding:15px; background:linear-gradient(135deg, rgba(255,215,0,0.05) 0%, rgba(30,41,59,0.8) 100%); border-color:var(--mesa-gold); margin-bottom:20px;">
            <h3 style="font-size:1rem; color:var(--mesa-gold); font-family:'Playfair Display',serif; margin-bottom:6px;">El Baúl de los Antojos 🧭</h3>
            <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:12px;">¿Indeciso? Deja que el Baúl decida por ti basándose en las mejores reseñas del último año.</p>
            <div style="display:flex; gap:10px;">
                <button class="btn btn-primary" style="background:var(--mesa-red); color:white; border-radius:12px; padding:11px;" onclick="triggerBaulRecommendation('food')">¿Qué comer? 🍽️</button>
                <button class="btn" style="flex:1; background:rgba(255,215,0,0.15); border:1px solid var(--mesa-gold); color:var(--mesa-gold); border-radius:12px; padding:11px;" onclick="triggerBaulRecommendation('drink')">¿Qué beber? 🍹</button>
            </div>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
            <h3 style="font-size:1.05rem; color:white; font-family:'Playfair Display', serif; margin:0;">Reseñas Recientes</h3>
        </div>

        <div style="display:flex; flex-direction:column; gap:15px;">
    `;

    html += window.reviewsData.map(r => {
        const local = window.locales.find(l => l.id === r.localId) || { nombre: 'Local', imagen: '', id: 0 };
        return `
        <div class="card" style="flex-direction:column; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <div class="avatar" style="width:36px; height:36px; background:var(--mesa-gold); color:black;">${r.usuario.avatar}</div>
                <div style="flex: 1;">
                    <div style="font-weight:600; font-size:0.9rem; color:white;">${r.usuario.nombre}</div>
                    <div style="font-size:0.75rem; color:var(--text-secondary);">${r.tiempoTranscurrido}</div>
                </div>
            </div>
            <div style="background:rgba(255,255,255,0.02); border:1px solid var(--glass-border); padding:10px; border-radius:12px;">
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                    <img src="${local.imagen}" style="width:24px; height:24px; border-radius:4px; object-fit:cover; margin-right:8px;">
                    <span style="font-size:0.85rem; font-weight:600; color:var(--mesa-gold); cursor:pointer;" onclick="showLocalDetailById(${local.id})">${local.nombre}</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-secondary); margin-bottom:8px;">🍴 Degustó: ${r.productos.join(', ')}</p>
                ${r.fotoComida ? `<img src="${r.fotoComida}" style="width:100%; height:150px; object-fit:cover; border-radius:12px; margin-bottom:10px;">` : ''}
                <div style="display:flex; gap:15px; font-size:0.9rem; font-weight:bold; color:white;">
                    <span>🍽️ Comida: <span style="color:var(--mesa-gold);">${r.notaComida.toFixed(1)}</span></span>
                    <span>🤵 Servicio: <span style="color:var(--mesa-gold);">${r.notaServicio.toFixed(1)}</span></span>
                </div>
            </div>
            <p style="font-size:0.95rem; color:white; line-height:1.4;">"${r.comentario}"</p>
            <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:10px;">
                <div style="color:${r.liked ? 'var(--mesa-red)' : 'var(--text-secondary)'}; font-size:0.9rem; cursor:pointer;" onclick="likeReview(${r.id}, this)">
                    ${r.liked ? '❤️' : '🤍'} ${r.likes}
                </div>
                <span style="color:var(--mesa-gold); font-size:0.8rem; font-weight:bold; cursor:pointer;" onclick='showLocalDetailById(${local.id})'>Ver Local →</span>
            </div>
        </div>
        `;
    }).join('');

    html += `</div>`;
    return html;
}

function renderEscribirResena() {
    return `
        <div style="margin-bottom:18px;">
            <h3 style="font-size:1.05rem; color:white; font-family:'Playfair Display',serif; margin-bottom:8px;">📝 ¿En qué local quieres reseñar?</h3>
            <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:14px;">Elige un local y escribe tu experiencia. Tu opinión ayuda a toda la comunidad.</p>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">
            ${window.locales.map(local => `
                <div class="card" style="align-items:center;" onclick="openReviewModalForLocal(${local.id})">
                    <div class="card-img-wrapper" style="width:60px; height:60px;">
                        <img src="${local.imagen}" alt="${local.nombre}">
                    </div>
                    <div class="card-body">
                        <h4 style="font-weight:600; color:white; margin:0;">${local.nombre}</h4>
                        <p style="font-size:0.8rem; color:var(--text-secondary); margin:2px 0 0;">${local.tipo}</p>
                    </div>
                    <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
                        <span style="font-weight:bold; color:var(--mesa-gold); font-size:0.9rem;">${local.notaMG.toFixed(1)} ★</span>
                        <span class="badge" style="background:var(--mesa-red); font-size:0.65rem;">Reseñar</span>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

window.likeReview = function(reviewId, element) {
    if (checkGuestAccess()) return;
    const review = window.reviewsData.find(r => r.id === reviewId);
    if (!review) return;
    review.liked = !review.liked;
    if (review.liked) {
        review.likes++;
        element.style.color = 'var(--mesa-red)';
        element.innerHTML   = `❤️ ${review.likes}`;
    } else {
        review.likes--;
        element.style.color = 'var(--text-secondary)';
        element.innerHTML   = `🤍 ${review.likes}`;
    }
    window.saveData();
};

window.openGeneralReviewModal = function() {
    if (checkGuestAccess()) return;
    openReviewModalForLocal(window.locales[0].id);
};

// =================== BAÚL DE LOS ANTOJOS ===================

window.triggerBaulRecommendation = function(type) {
    const today  = new Date("2026-07-09T02:17:35-04:00");

    const candidates = window.reviewsData.filter(r => {
        const revDate  = new Date(r.fecha);
        const diffDays = Math.abs(today - revDate) / (1000 * 60 * 60 * 24);
        const inRange  = diffDays >= 1 && diffDays <= 365;
        const highRate = ((r.notaComida + r.notaServicio) / 2) > 7.0;
        const matchType= (type === 'food' && !r.isDrink) || (type === 'drink' && r.isDrink);
        return inRange && highRate && matchType;
    });

    if (candidates.length === 0) {
        showToast("🔍 El Baúl está vacío para esta categoría. ¡Agrega más reseñas!");
        return;
    }

    baulCandidates    = candidates;
    baulCurrentIndex  = Math.floor(Math.random() * candidates.length);
    baulCurrentType   = type;

    renderBaulModal();
};

function renderBaulModal() {
    const existing = document.getElementById('baulModal');
    if (existing) existing.remove();

    const selectedReview = baulCandidates[baulCurrentIndex];
    const local = window.locales.find(l => l.id === selectedReview.localId) || { nombre: 'Local', menu: [], id: 0 };

    const invitations = [
        "¿Te tinca este platito para hoy? 🤤",
        "¡Mira esta maravilla culinaria! 😍",
        "¡Esto se ve mortal! ¿Te atreves? 😋",
        "¡Tu paladar exige probar esto hoy! 🍽️",
        "¿Te dio sed? Esta opción está ideal 🍹",
    ];
    const invitationText = invitations[Math.floor(Math.random() * invitations.length)];

    let precioEstimadoStr = "$6.500";
    if (local.menu && local.menu.length > 0) {
        const dishObj = local.menu.find(m => selectedReview.productos[0] && selectedReview.productos[0].includes(m.nombre));
        if (dishObj) precioEstimadoStr = `$${dishObj.precio.toLocaleString('es-CL')}`;
    }

    const modal = document.createElement('div');
    modal.id = 'baulModal';
    modal.className = 'detail-view';
    modal.style.cssText = `z-index:3600; background:rgba(15,23,42,0.96); backdrop-filter:blur(10px); display:flex; align-items:center; justify-content:center; padding:20px;`;

    modal.innerHTML = `
        <div class="glass-card" style="width:100%; max-width:400px; padding:25px; border:1px solid var(--mesa-gold); text-align:center; position:relative;">
            <button class="btn-icon" style="position:absolute; top:15px; right:15px; color:white; background:rgba(255,255,255,0.05);" onclick="document.getElementById('baulModal').remove()">✕</button>
            <h2 style="font-family:'Playfair Display', serif; font-size:1.5rem; color:var(--mesa-gold); margin-bottom:5px;">El Baúl de los Antojos 🧭</h2>
            <p style="font-size:0.88rem; color:#cbd5e1; font-style:italic; margin-bottom:18px;">${invitationText}</p>

            ${selectedReview.fotoComida ? `
                <img src="${selectedReview.fotoComida}" style="width:100%; height:170px; object-fit:cover; border-radius:14px; border: 2px solid var(--mesa-gold); margin-bottom:14px;">
            ` : ''}

            <h3 style="font-size:1.1rem; color:white; font-weight:bold; margin-bottom:2px;" id="baulProductoName">${selectedReview.productos[0]}</h3>
            <p style="font-size:1rem; color:var(--mesa-gold); font-weight:bold; margin-bottom:12px;">${precioEstimadoStr}</p>

            <div style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); padding:12px; border-radius:12px; margin-bottom:16px; text-align:left;">
                <p style="font-size:0.82rem; color:var(--text-secondary); margin-bottom:4px;"><b>Comentario del comensal:</b></p>
                <p style="font-size:0.88rem; color:#e2e8f0; font-style:italic;">"${selectedReview.comentario}"</p>
            </div>

            <button class="btn btn-primary" onclick="goToLocalFromBaul(${local.id})" style="width:100%; padding:13px; font-size:1rem; border-radius:12px; font-weight:bold; margin-bottom:10px;">
                ¡Me tentó! Ver local 🏃‍♂️💨
            </button>
            <button class="baul-next-btn" onclick="siguienteAntojo()">
                Siguiente Antojo ➡️ <span style="font-size:0.75rem; color:var(--text-secondary);">(${baulCandidates.length} opciones)</span>
            </button>
        </div>
    `;

    document.body.appendChild(modal);
}

window.siguienteAntojo = function() {
    if (baulCandidates.length === 0) return;
    baulCurrentIndex = (baulCurrentIndex + 1) % baulCandidates.length;
    renderBaulModal();
};

window.goToLocalFromBaul = function(localId) {
    const modal = document.getElementById('baulModal');
    if (modal) modal.remove();
    showLocalDetailById(localId);
};

// =================== PERFIL — 4 SECCIONES ===================

function renderPerfil() {
    const reviewCount     = getUserReviewCount();
    const currentLevel    = calculateLevel(reviewCount);
    const reqCurrent      = getRequiredForLevel(currentLevel);
    const reqNext         = getRequiredForLevel(currentLevel + 1);
    const progress        = reqNext > reqCurrent
        ? Math.min(100, Math.round(((reviewCount - reqCurrent) / (reqNext - reqCurrent)) * 100))
        : 100;

    const favoriteLocales = window.locales.filter(l => window.currentUser.favorites && window.currentUser.favorites.includes(l.id));
    const visitedCount    = getVisitedLocalesCount();
    const logros          = computeUserLogros();
    const unlockedLogros  = logros.filter(l => l.unlocked);
    const initials        = window.currentUser.name ? window.currentUser.name.slice(0, 2).toUpperCase() : 'JG';
    const favProduct      = window.currentUser.favoriteProduct;

    const mainContent = document.getElementById('mainContent');

    mainContent.innerHTML = `

        <!-- SECCIÓN A: Cabecera con Avatar, Nombre, Nivel -->
        <div class="profile-hero">
            <div class="profile-avatar-large">${initials}</div>
            <h2 style="font-size:1.4rem; color:white; font-family:'Playfair Display',serif; margin-bottom:4px;">${window.currentUser.name}</h2>
            <p style="font-size:0.82rem; color:var(--text-secondary);">${window.currentUser.email || ''}</p>
            <div class="profile-level-pill">
                <span>⭐</span>
                <span>Nivel ${currentLevel} — ${getLevelName(currentLevel)}</span>
            </div>
            <div class="profile-progress-bar">
                <div class="profile-progress-fill" style="width:${progress}%;"></div>
            </div>
            <p class="profile-progress-label">${reviewCount} reseña${reviewCount !== 1 ? 's' : ''} · Faltan ${Math.max(0, reqNext - reviewCount)} para Nivel ${currentLevel + 1}</p>
        </div>

        <!-- SECCIÓN B: Vitrina de Insignias y Logros Destacados -->
        <div class="profile-section">
            <div class="profile-section-title">🏅 Vitrina de Insignias</div>
            <div class="badges-vitrina">
                ${favProduct ? `
                    <div class="vitrina-badge vitrina-badge-fav unlocked">
                        <span class="vitrina-badge-emoji">⭐</span>
                        <span>Experto en ${favProduct}</span>
                    </div>
                ` : `
                    <div class="vitrina-badge locked vitrina-badge-fav">
                        <span class="vitrina-badge-emoji">⭐</span>
                        <span style="color:var(--text-secondary);">Elige tu producto favorito para desbloquear</span>
                        <button onclick="showFavoriteProductModal()" style="background:var(--mesa-gold);color:#000;border:none;border-radius:8px;padding:5px 12px;font-weight:700;font-size:0.78rem;cursor:pointer;margin-top:6px;">Elegir ahora</button>
                    </div>
                `}
                ${logros.map(l => `
                    <div class="vitrina-badge ${l.unlocked ? 'unlocked' : 'locked'}">
                        <span class="vitrina-badge-emoji">${l.emoji}</span>
                        <div class="vitrina-badge-title">${l.titulo}</div>
                        ${!l.unlocked ? `<div style="font-size:0.65rem;color:var(--text-secondary);margin-top:3px;">${l.count}/${l.required}</div>` : ''}
                    </div>
                `).join('')}
            </div>
            ${unlockedLogros.length === 0 && !favProduct ? `<p style="font-size:0.78rem;color:var(--text-secondary);text-align:center;margin-top:12px;">Escribe reseñas para desbloquear logros gastronómicos.</p>` : ''}
        </div>

        <!-- SECCIÓN C: Tus Locales Favoritos -->
        <div class="profile-section">
            <div class="profile-section-title">❤️ Tus Locales Favoritos</div>
            ${favoriteLocales.length === 0 ? `
                <p style="font-size:0.85rem; color:var(--text-secondary); font-style:italic;">Toca el ❤️ en las tarjetas para guardar locales favoritos.</p>
            ` : `
                <div style="display:flex; flex-direction:column; gap:10px;">
                    ${favoriteLocales.map(local => `
                        <div class="card" style="align-items:center; margin-bottom:0;" onclick="showLocalDetailById(${local.id})">
                            <div class="card-img-wrapper" style="width:56px; height:56px;">
                                <img src="${local.imagen}" alt="${local.nombre}">
                            </div>
                            <div class="card-body">
                                <h4 style="font-weight:600; color:white; margin:0; font-size:0.95rem;">${local.nombre}</h4>
                                <p style="font-size:0.78rem; color:var(--text-secondary); margin:2px 0 0;">${local.tipo}</p>
                            </div>
                            <div style="font-weight:bold; color:var(--mesa-gold); font-size:0.9rem; flex-shrink:0;">${local.notaMG.toFixed(1)} ★</div>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>

        <!-- SECCIÓN D: Estadísticas del Comensal -->
        <div class="profile-section">
            <div class="profile-section-title">📊 Estadísticas del Comensal</div>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${reviewCount}</div>
                    <div class="stat-label">Reseñas escritas</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${visitedCount}</div>
                    <div class="stat-label">Locales visitados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${favoriteLocales.length}</div>
                    <div class="stat-label">Favoritos guardados</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${unlockedLogros.length}</div>
                    <div class="stat-label">Logros desbloqueados</div>
                </div>
            </div>
        </div>

        <!-- Botones administrativos -->
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:5px;">
            <button class="btn btn-primary" onclick="simulateMonthlyClosing()" style="padding:14px; font-weight:bold; border-radius:12px; background:linear-gradient(135deg, var(--mesa-gold) 0%, #d97706 100%); color:black; border:none; box-shadow:0 4px 10px rgba(217,119,6,0.3);">
                ⚡ Simular Cierre de Mes (Distinciones)
            </button>
            <button class="btn" onclick="openAdminQueueView()" style="padding:12px; font-weight:bold; border-radius:12px; background:rgba(255,255,255,0.05); border:1px solid var(--glass-border); color:white;">
                🛡️ Ver Cola de Moderación (${window.adminQueue.length})
            </button>
            <button class="btn" onclick="logoutUser()" style="padding:12px; border-radius:12px; color:#ef4444; background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); font-weight:bold; margin-top:5px;">
                🚪 Cerrar Sesión
            </button>
        </div>
    `;
}

// =================== LEVEL / VISITED HELPERS ===================

function getVisitedLocalesCount() {
    if (isGuest) return 0;
    const userReviews  = window.reviewsData.filter(r => r.usuario.nombre === window.currentUser.name);
    const uniqueLocales = new Set(userReviews.map(r => r.localId));
    return uniqueLocales.size;
}

// =================== ADMIN ===================

window.simulateMonthlyClosing = function() {
    const sorted  = [...window.locales].sort((a,b) => (b.notaMG || 0) - (a.notaMG || 0));
    const meses   = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const now     = new Date();
    const mesNombre = meses[now.getMonth()];
    const anioNum   = now.getFullYear();

    sorted.forEach((local, idx) => {
        const medalText = `🏅 Top ${idx + 1} ${mesNombre} de ${anioNum}`;
        if (!local.distinciones) local.distinciones = [];
        const alreadyExists = local.distinciones.some(d => d.includes(mesNombre) && d.includes(anioNum.toString()));
        if (!alreadyExists) local.distinciones.unshift(medalText);
    });

    window.saveData();
    showToast(`🎉 Cierre mensual ejecutado: ${mesNombre} ${anioNum}`);
    if (currentView === 'perfil') renderPerfil();
};

window.openAdminQueueView = function() {
    const modal = document.createElement('div');
    modal.id = 'adminQueueModal';
    modal.className = 'detail-view';
    modal.style.zIndex = '3600';
    modal.style.background = 'rgba(15,23,42,0.98)';
    modal.style.backdropFilter = 'blur(10px)';

    let contentHtml = '';
    if (window.adminQueue.length === 0) {
        contentHtml = '<p style="text-align:center; color:var(--text-secondary); margin-top:40px; font-style:italic;">No hay reseñas pendientes en revisión.</p>';
    } else {
        contentHtml = `
            <div style="display:flex; flex-direction:column; gap:15px; margin-top:15px;">
                ${window.adminQueue.map((r, idx) => {
                    const local = window.locales.find(l => l.id === r.localId) || { nombre: 'Local' };
                    return `
                    <div class="card" style="flex-direction:column; gap:10px; background:rgba(239,68,68,0.03); border:1px solid rgba(239,68,68,0.2);">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-weight:bold; color:white;">Reseña de ${r.usuario.nombre}</span>
                            <span class="badge" style="background:#ef4444;">En Revisión</span>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-secondary);"><b>Local:</b> ${local.nombre} | <b>Platos:</b> ${r.productos.join(', ')}</p>
                        ${r.fotoComida ? `<img src="${r.fotoComida}" style="width:100%; height:120px; object-fit:cover; border-radius:8px;">` : ''}
                        <p style="font-size:0.9rem; color:#cbd5e1; font-style:italic;">"${r.comentario}"</p>
                        <div style="display:flex; gap:10px; margin-top:5px;">
                            <button class="btn btn-primary" style="background:#10b981; color:white; padding:8px;" onclick="approveAdminReview(${idx})">Aprobar (Forzar)</button>
                            <button class="btn" style="background:#ef4444; color:white; padding:8px;" onclick="deleteAdminReview(${idx})">Borrar Reseña</button>
                        </div>
                    </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    modal.innerHTML = `
        <div class="detail-header" style="text-align:center; position:relative;">
            <button class="back-btn" onclick="document.getElementById('adminQueueModal').remove()" style="position:absolute; top:15px; left:15px; margin:0;">✕ Cerrar</button>
            <h1 style="margin-top:20px; color: white;">Cola de Moderación</h1>
            <p style="color:var(--mesa-gold)">Filtro de Coherencia de Imagen</p>
        </div>
        <div style="padding:25px; color:white;">
            <p style="font-size:0.85rem; color:var(--text-secondary);">Las siguientes reseñas fueron marcadas automáticamente para revisión.</p>
            ${contentHtml}
        </div>
    `;

    document.body.appendChild(modal);
};

window.approveAdminReview = function(idx) {
    const review = window.adminQueue[idx];
    window.adminQueue.splice(idx, 1);
    localStorage.setItem('mesaAdminQueue', JSON.stringify(window.adminQueue));
    window.reviewsData.unshift(review);
    window.saveData();
    showToast("✅ Reseña aprobada y publicada.");
    document.getElementById('adminQueueModal').remove();
    if (currentView === 'perfil') renderPerfil();
};

window.deleteAdminReview = function(idx) {
    window.adminQueue.splice(idx, 1);
    localStorage.setItem('mesaAdminQueue', JSON.stringify(window.adminQueue));
    showToast("🗑️ Reseña descartada.");
    document.getElementById('adminQueueModal').remove();
    if (currentView === 'perfil') renderPerfil();
};

window.logoutUser = function() {
    isGuest     = false;
    guestClicks = 0;
    localStorage.removeItem('mesaUser');
    window.currentUser = null;

    document.getElementById('mainHeader').classList.add('hidden');
    document.getElementById('mainContent').classList.add('hidden');
    document.getElementById('bottomNav').classList.add('hidden');
    document.getElementById('registerScreen').classList.remove('hidden');
};
