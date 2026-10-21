// Conexión con Supabase (base de datos, cuentas y archivos).
// Si la app se compila con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (como en GitHub Pages), funciona "en línea":
// todos ven los mismos locales, reseñas y fotos. Sin esas variables (versión de doble clic, vista previa en Claude)
// sigue siendo la demo que guarda todo en el navegador.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL || '';
const CLAVE_PUBLICA = import.meta.env?.VITE_SUPABASE_ANON_KEY || '';

// La app solo se conecta cuando se abre desde internet (no al abrir el archivo con doble clic)
export const remoto = !!(SUPABASE_URL && CLAVE_PUBLICA) && typeof location !== 'undefined' && location.protocol.startsWith('http');

export const supabase = remoto
    ? createClient(SUPABASE_URL, CLAVE_PUBLICA, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'mg-sesion' }
    })
    : null;

/** Dirección a la que vuelven los correos de confirmación y el ingreso con Google (esta misma página) */
export function urlDeRetorno() {
    return `${location.origin}${location.pathname}`;
}

// Mensajes de error de Supabase en español
const ERRORES = [
    [/invalid login credentials/i, 'Correo o contraseña incorrectos.'],
    [/email not confirmed/i, 'Aún no confirmas tu correo. Revisa tu bandeja de entrada (y la carpeta de spam).'],
    [/user already registered/i, 'Ya existe una cuenta con ese correo. Ingresa con tu contraseña.'],
    [/password should be at least/i, 'La contraseña debe tener al menos 8 caracteres.'],
    [/rate limit|too many requests|security purposes/i, 'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.'],
    [/provider is not enabled|unsupported provider/i, 'El ingreso con Google aún no está activado.'],
    [/duplicate key.*username|perfiles_username_key/i, 'Ese nombre de usuario ya está en uso.'],
    [/failed to fetch|network/i, 'No hay conexión con el servidor. Revisa tu internet.']
];

export function mensajeError(error) {
    const texto = String(error?.message || error || '');
    return ERRORES.find(([re]) => re.test(texto))?.[1] || `No se pudo completar: ${texto.slice(0, 120)}`;
}

/** ¿Está activado el ingreso con Google en Supabase? (si no, se avisa en vez de mostrar una página de error) */
export async function googleActivo() {
    try {
        const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: CLAVE_PUBLICA } });
        return !!(await r.json()).external?.google;
    } catch {
        return false;
    }
}
