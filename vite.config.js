import { defineConfig } from 'vite';
import { resolve } from 'path';

// Tres páginas: la app (index.html), el panel de administración (admin.html) y los textos legales (legal.html)
export default defineConfig({
    // Rutas relativas: la app funciona en la raíz de un dominio (Netlify) y en una subcarpeta (GitHub Pages)
    base: './',
    build: {
        rollupOptions: {
            input: {
                app: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html'),
                legal: resolve(__dirname, 'legal.html')
            }
        }
    }
});
