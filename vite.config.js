import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

/**
 * Política de seguridad del navegador (CSP) para la versión publicada: el navegador solo ejecuta el código
 * de la propia app (y la verificación anti-robots de Cloudflare) y solo se conecta a Supabase y a los mapas.
 * Si alguien lograra colar un script en una reseña, no se ejecutaría.
 * Solo se agrega al compilar la versión en línea (con Supabase): la vista previa y la de doble clic llevan el código adentro.
 */
function politicaSeguridad(env) {
    const supabase = env.VITE_SUPABASE_URL;
    return {
        name: 'politica-seguridad',
        apply: 'build',
        transformIndexHtml(html) {
            if (!supabase) return html;
            const politica = [
                "default-src 'self'",
                "script-src 'self' https://challenges.cloudflare.com",
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                "font-src 'self' data: https://fonts.gstatic.com",
                "img-src 'self' data: blob: https:",
                "media-src 'self' blob: https:",
                `connect-src 'self' data: blob: ${supabase} ${supabase.replace(/^https:/, 'wss:')} https://challenges.cloudflare.com https://api.maptiler.com`,
                'frame-src https://challenges.cloudflare.com https://www.tiktok.com https://www.instagram.com https://www.google.com',
                "worker-src 'self' blob:",
                "object-src 'none'",
                "base-uri 'self'",
                "form-action 'self'"
            ].join('; ');
            return html.replace(/<meta charset="UTF-8">/i, m => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${politica}">`);
        }
    };
}

// Tres páginas: la app (index.html), el panel de administración (admin.html) y los textos legales (legal.html)
export default defineConfig(({ mode }) => ({
    // Rutas relativas: la app funciona en la raíz de un dominio (Netlify) y en una subcarpeta (GitHub Pages)
    base: './',
    plugins: [politicaSeguridad(loadEnv(mode, process.cwd(), 'VITE_'))],
    build: {
        rollupOptions: {
            input: {
                app: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html'),
                legal: resolve(__dirname, 'legal.html')
            }
        }
    }
}));
