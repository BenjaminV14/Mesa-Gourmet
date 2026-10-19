import puppeteer from 'puppeteer';

// Helper to delay execution
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Helper to scroll the page to the bottom (useful for lazy-loaded courses on school pages)
async function autoScroll(page) {
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 200;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight - window.innerHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  });
}

const schoolUrls = [
  'https://platzi.com/escuela/web/',
  'https://platzi.com/escuela/ingles/',
  'https://platzi.com/escuela/marketing/',
  'https://platzi.com/escuela/datos/',
  'https://platzi.com/escuela/ciberseguridad/',
  'https://platzi.com/escuela/liderazgo-management/',
  'https://platzi.com/escuela/producto/',
  'https://platzi.com/escuela/audiovisual/',
  'https://platzi.com/escuela/desarrollo-movil/',
  'https://platzi.com/escuela/ai-academy/',
  'https://platzi.com/escuela/blockchain/',
  'https://platzi.com/escuela/programacion/',
  'https://platzi.com/escuela/recursos-humanos/',
  'https://platzi.com/escuela/startups/',
  'https://platzi.com/escuela/negocios/',
  'https://platzi.com/escuela/finanzas/',
  'https://platzi.com/escuela/devops-cloud/',
  'https://platzi.com/escuela/diseno/'
];

(async () => {
  console.log('Iniciando bot de Platzi (Escaneo de Escuelas)...');
  console.log('Conectando a Chrome en http://127.0.0.1:9222 ...');
  
  let browser;
  try {
    browser = await puppeteer.connect({
      browserURL: 'http://127.0.0.1:9222',
    });
    console.log('¡Conectado exitosamente a Chrome!');
  } catch (err) {
    console.error('Error al conectar con Chrome. Asegúrate de iniciar el bot usando run_bot.bat y realizar el login.');
    console.error(`Detalles del error: ${err.message}`);
    process.exit(1);
  }

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  const allCourseLinks = new Set();

  console.log('\n--- 1. ESCANEANDO ESCUELAS ---');
  for (let s = 0; s < schoolUrls.length; s++) {
    const schoolUrl = schoolUrls[s];
    console.log(`[${s + 1}/${schoolUrls.length}] Escaneando escuela: ${schoolUrl}`);
    
    try {
      await page.goto(schoolUrl, { waitUntil: 'networkidle2' });
      
      console.log('   -> Desplazando página para cargar todos los cursos...');
      await autoScroll(page);
      await delay(1000);

      // Extraer todos los enlaces de cursos en la escuela
      const courseLinks = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="/cursos/"]'));
        return anchors.map(a => a.href).filter(link => {
          const parts = link.split('/');
          // Excluir el catálogo general y rutas de aprendizaje específicas si se cuelan
          return parts.length > 4 && !link.includes('/cursos/learning-path') && !link.endsWith('/cursos/') && !link.endsWith('/cursos');
        });
      });

      for (const link of courseLinks) {
        allCourseLinks.add(link);
      }
      console.log(`   -> Encontrados ${courseLinks.length} cursos. Total acumulado únicos: ${allCourseLinks.size}`);
    } catch (err) {
      console.warn(`   -> Error al escanear la escuela: ${err.message}`);
    }
  }

  const courseList = Array.from(allCourseLinks);
  console.log(`\n--- ESCANEO COMPLETADO ---`);
  console.log(`Se encontraron en total ${courseList.length} cursos únicos para procesar.`);

  console.log('\n--- 2. PROCESANDO E INSCRIBIENDO CURSOS ---');
  for (let i = 0; i < courseList.length; i++) {
    const url = courseList[i];
    console.log(`\n[${i + 1}/${courseList.length}] Procesando curso: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });

      // 1. Agregar a mi ruta / mis cursos
      console.log('   -> Buscando botón "Agregar a mi ruta"...');
      const added = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const targetBtn = buttons.find(btn => {
          const text = btn.textContent.trim();
          return text.includes('Agregar a mi ruta') || text.includes('Añadir a mi ruta');
        });
        if (targetBtn) {
          targetBtn.click();
          return true;
        }
        return false;
      });

      if (added) {
        console.log('   -> ¡Agregado a la ruta!');
        await delay(2000);
      } else {
        console.log('   -> Botón "Agregar a mi ruta" no encontrado (puede que ya esté agregado).');
      }

      // 2. Ir a la primera clase / reproducir
      const firstClassBtn = await page.$('a[href*="/clases/"]');
      if (firstClassBtn) {
        const classUrl = await page.evaluate(el => el.href, firstClassBtn);
        console.log(`   -> Primera clase encontrada. Navegando a: ${classUrl}`);
        await page.goto(classUrl, { waitUntil: 'networkidle2' });

        // Dar click en reproducir si no inicia automáticamente
        const played = await page.evaluate(() => {
          const playBtn = document.querySelector('button[data-qa="play-button"]');
          if (playBtn) {
            playBtn.click();
            return 'play-button';
          }
          const video = document.querySelector('video');
          if (video) {
            video.play().catch(() => {});
            return 'video';
          }
          return null;
        });

        if (played) {
          console.log(`   -> Reproduciendo video (${played})...`);
        } else {
          console.log('   -> No se encontró botón de play o video visible.');
        }

        console.log('   -> Reproduciendo primeros 15 segundos...');
        await delay(15000); // Esperar 15 segundos de reproducción
      } else {
        console.log('   -> No se encontraron clases disponibles para este curso.');
      }
    } catch (err) {
      console.log(`   -> Error procesando ${url}: ${err.message}`);
    }
  }

  console.log('\nProceso de automatización completado con éxito.');
  await browser.disconnect();
})();
