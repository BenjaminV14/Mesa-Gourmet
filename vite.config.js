import { defineConfig } from 'vite';
import { resolve } from 'path';

// Dos páginas: la app (index.html) y el panel de administración (admin.html)
export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                app: resolve(__dirname, 'index.html'),
                admin: resolve(__dirname, 'admin.html')
            }
        }
    }
});
