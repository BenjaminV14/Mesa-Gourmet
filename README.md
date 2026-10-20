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

## Importar la encuesta a los locales

Panel de administración → **Importar encuesta**. Sube el Excel (.xlsx) o CSV con las respuestas:
una fila por local y una columna por pregunta (lo que descarga Google Forms), o una hoja por local con Pregunta | Respuesta.
El panel sugiere a qué dato corresponde cada pregunta (baños, WiFi, fumadores, mascotas, horario, contacto...),
muestra los cambios antes de guardarlos y deja las respuestas originales en la ficha del local.

## Guías

- [Supabase paso a paso](docs/SUPABASE.md)
- [Seguridad](docs/SEGURIDAD.md)
- [Aspectos legales en Chile](docs/LEGAL.md)
- [Hosting, estadísticas y tiendas de apps](docs/HOSTING.md)
