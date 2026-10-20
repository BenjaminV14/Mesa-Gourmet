import { defineConfig } from 'vite';
import { resolve } from 'path';

// Dos páginas: la app (index.html) y el panel de administración (admin.html)
export default defineConfig({
    // Rutas relativas: la app funciona en la raíz de un dominio (Netlify) y en una subcarpeta (GitHub Pages)
    base: './',
    build: {
        rollupOptions: {
            input: {
                app: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html')
            }
        }
    }
});
