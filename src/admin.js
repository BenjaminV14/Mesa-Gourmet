document.addEventListener('DOMContentLoaded', () => {
    renderAdmin();
});

function renderAdmin() {
    const container = document.getElementById('adminContent');
    container.innerHTML = '';
    
    window.locales.forEach((local, localIndex) => {
        let menuHtml = local.menu.map((item, itemIndex) => `
            <div class="menu-item-row">
                <input type="text" placeholder="Nombre del Plato" value="${item.nombre}" id="name-${localIndex}-${itemIndex}">
                <input type="number" placeholder="Precio ($)" value="${item.precio}" id="price-${localIndex}-${itemIndex}">
                <button class="btn btn-primary" onclick="saveMenuItem(${localIndex}, ${itemIndex})">Guardar</button>
            </div>
        `).join('');

        container.innerHTML += `
            <div class="admin-card">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                    <h3 style="margin: 0; color: var(--mesa-red); font-weight: 700;">${local.nombre}</h3>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 0.9rem; font-weight: bold; color: var(--text-secondary);">Nota MG:</span>
                        <input type="number" step="0.1" min="1" max="10" value="${local.notaMG || 9.0}" id="notaMG-${localIndex}" style="width: 65px; padding: 6px; border-radius: 8px; border: 1px solid rgba(0,0,0,0.15); background: var(--bg-color); color: var(--text-primary); text-align: center; font-weight: bold;">
                        <button class="btn" style="padding: 6px 12px; font-size: 0.8rem; background: var(--mesa-gold); color: var(--mesa-dark-red); font-weight: bold; border-radius: 8px;" onclick="saveNotaMG(${localIndex})">Guardar Nota</button>
                    </div>
                </div>
                <div style="background: rgba(0,0,0,0.02); padding: 15px; border-radius: 12px;">
                    ${menuHtml}
                    <button class="btn" style="background: var(--mesa-gold); color: var(--mesa-dark-red); margin-top: 10px; width: 100%; font-weight: bold;" onclick="addMenuItem(${localIndex})">
                        + Añadir Nuevo Plato
                    </button>
                </div>
            </div>
        `;
    });
}

window.saveNotaMG = function(localIndex) {
    const notaInput = parseFloat(document.getElementById(`notaMG-${localIndex}`).value);
    
    if(isNaN(notaInput) || notaInput < 1 || notaInput > 10) {
        alert("Por favor ingrese una Nota MG válida entre 1.0 y 10.0.");
        return;
    }

    window.locales[localIndex].notaMG = notaInput;
    window.saveData();
    showToast();
};

window.saveMenuItem = function(localIndex, itemIndex) {
    const nameInput = document.getElementById(`name-${localIndex}-${itemIndex}`).value;
    const priceInput = parseInt(document.getElementById(`price-${localIndex}-${itemIndex}`).value);
    
    if(!nameInput || isNaN(priceInput)) {
        alert("Por favor ingrese un nombre y precio válido.");
        return;
    }

    window.locales[localIndex].menu[itemIndex].nombre = nameInput;
    window.locales[localIndex].menu[itemIndex].precio = priceInput;
    
    // Save to LocalStorage
    window.saveData();
    showToast();
};

window.addMenuItem = function(localIndex) {
    window.locales[localIndex].menu.push({
        nombre: "",
        precio: 0,
        imagen: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=400&fit=crop",
        likes: 0
    });
    window.saveData();
    renderAdmin();
};

function showToast() {
    const toast = document.getElementById('toastMsg');
    toast.style.opacity = '1';
    setTimeout(() => {
        toast.style.opacity = '0';
    }, 2000);
}
