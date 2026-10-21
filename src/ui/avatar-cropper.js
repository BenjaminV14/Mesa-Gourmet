// Ajustar la foto de perfil: se arrastra para moverla y se acerca o aleja con − / + (o la barra).
// Lo que queda dentro del círculo se guarda como una foto cuadrada de 320 px.
import { registerActions } from './actions.js';

const TAMANO = 220;   // círculo en pantalla
const SALIDA = 320;   // foto guardada
const ZOOM_MAX = 4;

let estado = null;    // { img, base, zoom, x, y }

export function cropperHtml() {
    return `
    <div class="cropper-box" id="cropperBox" hidden>
        <div class="cropper" id="cropper" style="width:${TAMANO}px;height:${TAMANO}px">
            <img id="cropImg" alt="Tu foto" draggable="false">
        </div>
        <div class="crop-controls">
            <button type="button" class="crop-btn" data-action="crop-zoom" data-dir="-1" aria-label="Alejar">−</button>
            <input type="range" id="cropZoom" min="1" max="${ZOOM_MAX}" step="0.01" value="1" data-input="crop-zoom-range" aria-label="Acercar o alejar">
            <button type="button" class="crop-btn" data-action="crop-zoom" data-dir="1" aria-label="Acercar">+</button>
        </div>
        <p class="sheet-text small">Arrastra la foto para centrar tu cara y usa − / + para ajustar.</p>
    </div>`;
}

function limitar() {
    // La foto siempre cubre todo el círculo
    const w = estado.img.naturalWidth * estado.base * estado.zoom;
    const h = estado.img.naturalHeight * estado.base * estado.zoom;
    const mx = Math.max(0, (w - TAMANO) / 2);
    const my = Math.max(0, (h - TAMANO) / 2);
    estado.x = Math.max(-mx, Math.min(mx, estado.x));
    estado.y = Math.max(-my, Math.min(my, estado.y));
    return { w, h };
}

function pintar() {
    const { w, h } = limitar();
    const el = document.getElementById('cropImg');
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.transform = `translate(${(TAMANO - w) / 2 + estado.x}px, ${(TAMANO - h) / 2 + estado.y}px)`;
    document.getElementById('cropZoom').value = estado.zoom;
}

/** Abre el ajuste con una imagen (dataURL) */
export function abrirRecorte(dataUrl) {
    const img = new Image();
    img.onload = () => {
        estado = { img, base: TAMANO / Math.min(img.naturalWidth, img.naturalHeight), zoom: 1, x: 0, y: 0 };
        document.getElementById('cropImg').src = dataUrl;
        document.getElementById('cropperBox').hidden = false;
        pintar();
        const area = document.getElementById('cropper');
        let inicio = null;
        area.onpointerdown = e => { inicio = { px: e.clientX, py: e.clientY, x: estado.x, y: estado.y }; area.setPointerCapture(e.pointerId); };
        area.onpointermove = e => {
            if (!inicio) return;
            estado.x = inicio.x + (e.clientX - inicio.px);
            estado.y = inicio.y + (e.clientY - inicio.py);
            pintar();
        };
        area.onpointerup = area.onpointercancel = () => { inicio = null; };
        // Rueda del mouse en el computador
        area.onwheel = e => { e.preventDefault(); zoomA(estado.zoom * (e.deltaY < 0 ? 1.08 : 0.92)); };
    };
    img.src = dataUrl;
}

function zoomA(valor) {
    if (!estado) return;
    estado.zoom = Math.max(1, Math.min(ZOOM_MAX, valor));
    pintar();
}

/** Foto final recortada (dataURL JPEG) o null si no se eligió ninguna */
export function fotoRecortada() {
    if (!estado || document.getElementById('cropperBox')?.hidden !== false) return null;
    const { w, h } = limitar();
    const k = SALIDA / TAMANO;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SALIDA;
    canvas.getContext('2d').drawImage(estado.img, ((TAMANO - w) / 2 + estado.x) * k, ((TAMANO - h) / 2 + estado.y) * k, w * k, h * k);
    return canvas.toDataURL('image/jpeg', 0.85);
}

export function cerrarRecorte() {
    estado = null;
}

registerActions({
    'crop-zoom': el => zoomA(estado ? estado.zoom + Number(el.dataset.dir) * 0.25 : 1),
    'crop-zoom-range': el => zoomA(Number(el.value))
});
