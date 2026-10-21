# Ideas para más adelante

Ideas que se conversaron y quedaron guardadas para cuando se necesiten nuevas funciones.

- **Recorrer el Top en el mapa**: una barra sobre el mapa con ◀ ▶ que lleva de un local a otro del Top 50
  (Top 1, Top 2…), centrando el mapa en cada uno y mostrando su ficha rápida. Se probó en octubre de 2026 y
  se dejó para después.
- **Insignias por tipo de plato**: hoy aparecen cuando 5 locales ofrecen el plato. Con más locales en la app
  se puede ajustar ese número o agregar insignias de temporada (Fiestas Patrias, invierno).
- **"La casa invita"** como beneficio para los usuarios de Mesa Gourmet (pendiente de definir con los locales).

## Mapa propio (sin depender de terceros)

Hoy el mapa usa las calles de OpenStreetMap (o MapTiler si hay clave). Más adelante se puede tener un mapa propio
solo de la Región del Maule (o de Chile), servido desde nuestro mismo hosting:

1. Descargar los datos de Chile de OpenStreetMap (`download.geofabrik.de`, archivo `chile-latest.osm.pbf`).
2. Recortar la Región del Maule y convertirla a un solo archivo `.pmtiles` (Protomaps / planetiler). Pesa entre 30 y 80 MB.
3. Subir ese archivo a Supabase Storage o a GitHub Pages y mostrarlo con la librería `pmtiles` + estilos de `protomaps.com`.

Ventajas: no hay límites de uso, no se necesita clave y funciona igual en todas partes. Para prepararlo desde Claude
hay que permitir en la red del entorno los dominios `download.geofabrik.de` y `*.protomaps.com`.
