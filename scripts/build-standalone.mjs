// Genera una versión que se abre con doble clic, sin instalar nada:
// cada página queda en un solo archivo .html con todo el código y los estilos adentro.
// Uso: npm run build:standalone  ->  carpeta "abrir-con-doble-clic/"
import { build } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = path.join(root, 'node_modules', '.standalone-tmp');
const out = path.join(root, 'abrir-con-doble-clic');

const PAGES = [
    { input: 'index.html', output: 'Mesa Gourmet.html' },
    { input: 'admin.html', output: 'Panel de administración.html' }
];

async function buildPage({ input, output }) {
    const outDir = path.join(tmp, path.parse(input).name);
    await build({
        root,
        logLevel: 'warn',
        configFile: false,
        publicDir: false,
        build: {
            outDir,
            emptyOutDir: true,
            assetsInlineLimit: 100_000_000,
            cssCodeSplit: false,
            modulePreload: false,
            rollupOptions: { input: path.join(root, input), output: { inlineDynamicImports: true } }
        }
    });

    let html = fs.readFileSync(path.join(outDir, input), 'utf8');
    const assets = path.join(outDir, 'assets');
    for (const file of fs.readdirSync(assets)) {
        const content = fs.readFileSync(path.join(assets, file), 'utf8');
        if (file.endsWith('.js')) {
            const script = `<script type="module">\n${content.replace(/<\/script/g, '<\\/script')}\n</script>`;
            html = html.replace(new RegExp(`<script[^>]*src="[^"]*${file}"[^>]*></script>`), () => '');
            html = html.replace('</body>', () => `${script}\n</body>`);
        } else if (file.endsWith('.css')) {
            html = html.replace(new RegExp(`<link[^>]*href="[^"]*${file}"[^>]*>`), () => `<style>\n${content}\n</style>`);
        }
    }
    // Sin servidor no hay manifiesto ni íconos de la PWA
    html = html.replace(/<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*/g, '');
    html = html.replace('href="./index.html"', 'href="./Mesa Gourmet.html"');
    fs.writeFileSync(path.join(out, output), html);
    console.log(`✓ ${output}`);
}

fs.mkdirSync(out, { recursive: true });
for (const page of PAGES) await buildPage(page);
fs.rmSync(tmp, { recursive: true, force: true });
fs.writeFileSync(path.join(out, 'LEEME.txt'), `Mesa Gourmet: versión para abrir con doble clic
==============================================

1. Primero DESCOMPRIME el .zip (clic derecho > "Extraer todo"). Si lo abres sin descomprimir, no funciona.
2. Haz doble clic en "Mesa Gourmet.html". Se abre en tu navegador (recomendado: Chrome o Edge).
3. El panel de administración es "Panel de administración.html", en esta misma carpeta.

- Los datos se guardan en tu navegador. Lo que cambies en el panel se ve en la app si usas el mismo navegador.
- Para ver la app como en un celular: en Chrome presiona F12 y luego Ctrl+Shift+M.
- Las fotos, el mapa y los videos necesitan internet.
`);
