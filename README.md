# Mesa Gourmet

Guía gastronómica de Talca: locales, cartas, reseñas con fotos verificadas, videos de la comunidad, mapa, Top 50, misiones y un panel de administración.

## Cómo correrla

Necesitas Node.js 18 o superior.

```bash
npm install
npm run dev
```

- App: <http://localhost:5173>
- Panel de administración: <http://localhost:5173/admin.html>

`npm run build` genera la versión para publicar en `dist/` (ver `docs/HOSTING.md`).

> **Modo demo:** mientras no esté conectado Supabase, los datos viven en el navegador de cada persona (localStorage). Lo que cambias en el panel se ve en la app **en el mismo navegador**.

## Estructura

```
index.html              App (pantallas base)
admin.html              Panel de administración
src/
  main.js               Arranque de la app
  state.js              Estado compartido (usuario, búsqueda, ubicación)
  data/
    seed.js             Datos de ejemplo (se reemplazan por la base de datos)
    store.js            Capa de datos: hoy localStorage, mañana Supabase
  features/             Una pantalla o función por archivo
    auth.js             Ingreso, registro, invitado
    search.js           Buscador (plurales, tildes, errores de tipeo, sinónimos, platos)
    sponsors.js         Destacados pagados ($29.990/mes)
    inicio.js           Inicio y resultados
    detalle.js          Ficha del local (Info, Menú, Reseñas, Eventos y promos)
    mapa.js             Mapa y cartelera
    resenas.js          Reseñas + Videos
    videos.js           Feed de TikTok/Instagram
    review-form.js      Escribir reseña con fotos
    misiones.js         Retos, logros y fotos de la comunidad
    perfil.js           Perfil, privacidad y cuenta
    top.js              Top 50
  admin/                Panel de administración
  services/             Estadísticas e IA
  utils/                Texto, horarios, distancias, HTML seguro
supabase/
  schema.sql            Base de datos completa con reglas de seguridad
  functions/            Verificación de fotos con IA
  tests/                Pruebas de las reglas de seguridad
docs/                   Guías: Supabase, seguridad, legal, hosting
```

## Encuesta a los locales

Panel de administración → **Encuesta a locales**, con tres pestañas:

- **Responder por local**: eliges el local y escribes las respuestas del dueño mientras conversas con él.
  Se guarda solo, y las preguntas conectadas a la app (baño, WiFi y su clave, fumadores, horario, Instagram, slogan...)
  actualizan la ficha del local al instante. Las marcadas 🔒 quedan solo para ti.
- **Preguntas**: tu banco de preguntas. Edita el texto, usa la redacción sugerida, cambia la sección o a qué dato va cada una.
- **Importar Excel**: sube el .xlsx o CSV (una fila por local, como lo descarga Google Forms, o una hoja por local con Pregunta | Respuesta).
  Si los encabezados coinciden con tu banco de preguntas se usa el dato que elegiste ahí; siempre ves los cambios antes de guardarlos.

## Otras secciones del panel

- **Mapa de ubicaciones**: arrastra el punto de cada local hasta su lugar exacto (se guarda al soltar y se puede deshacer).
- **Cartas**: platos, precios y para quién son aptos (vegano, vegetariano, sin gluten, sin lactosa).
- **Top y clientes**: Top 10 actual, "Cerrar el mes" (guarda las distinciones del mes) y clientes frecuentes (5 visitas en el mes = cliente del mes).

## Guías

- [Supabase paso a paso](docs/SUPABASE.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Aspectos legales en Chile](docs/LEGAL.md)
- [Hosting, estadísticas y tiendas de apps](docs/HOSTING.md)
