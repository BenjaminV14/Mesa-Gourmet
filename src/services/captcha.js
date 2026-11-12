// Verificación anti-robots (Cloudflare Turnstile) para crear cuentas, ingresar y recuperar la contraseña.
// Supabase la exige cuando se activa en Authentication > Attack Protection. La clave de sitio es pública
// (VITE_TURNSTILE_SITE_KEY); la secreta va solo en Supabase. Normalmente no pide nada a la persona:
// solo muestra un desafío si sospecha que es un programa.
import { remoto } from './supabase.js';

const SITE_KEY = import.meta.env?.VITE_TURNSTILE_SITE_KEY || '';
export const captchaActivo = remoto && !!SITE_KEY;

let script = null;
function cargarScript() {
    if (window.turnstile) return Promise.resolve();
    script ??= new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => { script = null; reject(new Error('No se pudo cargar la verificación anti-robots. Revisa tu conexión.')); };
        document.head.appendChild(s);
    });
    return script;
}

const widgets = new WeakMap();   // contenedor -> id del widget

/** Prepara la verificación dentro del contenedor (un div vacío del formulario) */
export async function montarCaptcha(contenedor) {
    if (!captchaActivo || !contenedor || widgets.has(contenedor)) return;
    widgets.set(contenedor, null);
    try {
        await cargarScript();
        const id = window.turnstile.render(contenedor, {
            sitekey: SITE_KEY,
            language: 'es',
            theme: 'auto',
            size: 'flexible',
            appearance: 'interaction-only'
        });
        widgets.set(contenedor, id);
    } catch (err) {
        widgets.delete(contenedor);
        console.warn(err);
    }
}

/**
 * Token para enviar a Supabase (captchaToken). Sin verificación activa devuelve undefined.
 * Espera unos segundos a que Turnstile termine; si no termina, avisa con un error en español.
 */
export async function tokenCaptcha(contenedor) {
    if (!captchaActivo) return undefined;
    if (!widgets.has(contenedor)) await montarCaptcha(contenedor);
    for (let i = 0; i < 40; i++) {
        const id = widgets.get(contenedor);
        const token = id != null && window.turnstile?.getResponse(id);
        if (token) return token;
        await new Promise(r => setTimeout(r, 250));
    }
    throw new Error('Completa la verificación anti-robots que aparece en el formulario y vuelve a intentarlo.');
}

/** Cada token sirve una sola vez: se pide uno nuevo después de cada intento */
export function reiniciarCaptcha(contenedor) {
    const id = widgets.get(contenedor);
    if (id != null && window.turnstile) window.turnstile.reset(id);
}
