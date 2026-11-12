# Seguridad de Mesa Gourmet

Cada riesgo con su protección y el estado actual. **Demo** = funciona hoy en el navegador. **Supabase** = queda activo al conectar el backend (el código ya está escrito en `supabase/`).

## Cuentas y acceso

| Riesgo | Protección | Estado |
|---|---|---|
| Alguien entra con un correo ajeno | Verificación por correo obligatoria (Supabase Auth) | Supabase |
| Contraseñas débiles o filtradas | Mínimo 8 caracteres + "Leaked password protection" | Demo (8 caracteres) / Supabase |
| Contraseñas guardadas sin cifrar | La app ya **no** guarda contraseñas; Supabase las guarda cifradas (bcrypt) | ✅ Demo |
| Robo de sesión | Tokens de corta duración que se renuevan solos; HTTPS obligatorio | Supabase + hosting |
| Cualquiera entra al panel de administración | Rol `admin` en la base de datos: aunque abran `/admin.html`, la base de datos rechaza sus cambios | Supabase |
| Un usuario se da a sí mismo el rol de administrador o se desbloquea | Regla en la base de datos que lo impide (probada) | ✅ Supabase (probado) |
| Fuerza bruta contra el login | Límite de intentos de Supabase Auth + captcha (Cloudflare Turnstile, gratis) | Supabase (activar captcha) |

## Datos y permisos

| Riesgo | Protección | Estado |
|---|---|---|
| Alguien modifica locales, precios o notas | RLS: solo el administrador escribe en el catálogo | ✅ Supabase (probado) |
| Reseñas o likes a nombre de otra persona | RLS: el `usuario_id` debe ser el de la sesión | ✅ Supabase (probado) |
| Inflar likes | Un like por usuario (clave única); el contador lo calcula la base de datos, no la app | ✅ Demo y Supabase |
| Saltarse la verificación de fotos | La reseña con foto entra "pendiente" y solo el servidor la publica | ✅ Supabase (probado) |
| Notas manipuladas | La nota del local se recalcula en la base de datos desde las reseñas publicadas | ✅ Supabase |
| Spam de reseñas o reportes | Máximo 10 reseñas al día, 1 por local al día y 10 reportes por hora; además, bloqueo de cuentas | ✅ Supabase (probado) |
| Ver datos privados de otros (correo, favoritos, reportes) | RLS: cada uno ve solo lo suyo; los correos nunca se exponen en la app | ✅ Supabase |
| Clave secreta filtrada en GitHub | Solo la clave pública (anon) va en la app; las secretas viven en Supabase Secrets. `.env` está en `.gitignore` | Supabase |

## Contenido que suben los usuarios

| Riesgo | Protección | Estado |
|---|---|---|
| Inyección de código (XSS) en reseñas, nombres o comentarios | Todo texto se escapa antes de mostrarse (`esc()` en `src/utils/html.js`) | ✅ Demo (probado) |
| Links maliciosos (`javascript:`) | `safeUrl()` solo permite http/https; los videos solo aceptan TikTok e Instagram | ✅ Demo y Supabase |
| Fotos falsas o inapropiadas | Verificación con IA + cola de moderación + reportes de usuarios | ✅ Demo (flujo) / Supabase (IA) |
| Archivos gigantes o que no son imágenes | Compresión a 1024 px en el teléfono; el almacenamiento acepta solo JPG, PNG y WebP de hasta 5 MB | ✅ Demo / Supabase |
| Subir archivos a la carpeta de otro usuario | Regla de almacenamiento por carpeta de usuario | ✅ Supabase (probado) |
| Videos de terceros sin permiso | Se muestran con el reproductor oficial (no se copian), el usuario declara que es suyo y pasan por moderación | ✅ Demo |

## Infraestructura (al publicar)

| Riesgo | Protección | Estado |
|---|---|---|
| Tráfico sin cifrar | HTTPS automático del hosting (Netlify, Cloudflare o Vercel) | Hosting |
| Que tu sitio aparezca dentro de otro sitio (clickjacking) | Cabecera `X-Frame-Options: DENY` | Hosting (archivo `_headers`, ver HOSTING.md) |
| Scripts inyectados desde otros dominios | Política de contenido (CSP). La app ya no usa `onclick` dentro del HTML, lo que permite una CSP estricta | Hosting |
| Dependencias con fallas conocidas | `npm audit` antes de cada publicación; Dependabot en GitHub | Al conectar GitHub |
| Pérdida de datos | Respaldos diarios (plan Pro) o respaldo manual semanal desde el panel | Panel admin / Supabase |
| El panel aparece en Google | `noindex` en `admin.html` | ✅ |

## Lo que tienes que hacer tú

1. No compartir nunca la **service_role key**, la contraseña de la base de datos ni la API key de Anthropic.
2. Activar la **verificación en dos pasos** en GitHub, Supabase, Google Cloud y Anthropic.
3. Usar un **gestor de contraseñas** (Bitwarden es gratis).
4. Revisar la cola de moderación y los reportes al menos una vez al día al lanzar.

## Protecciones agregadas en noviembre de 2026

- **Visita comprobada**: cada reseña necesita al menos una foto tomada en los últimos 3 días (fecha que guarda
  la cámara). Si la foto trae ubicación, debe ser a menos de 400 m del local. Si ninguna foto trae fecha
  (capturas, fotos reenviadas por WhatsApp), la reseña queda en revisión. La base de datos rechaza fotos de más
  de 3 días (`actualizacion-6.sql`). Ojo: la fecha la entrega el celular, así que frena al usuario común, no a
  alguien que edite los datos de la foto a propósito.
- **Comentarios revisados por IA**: la función `verificar-foto` también revisa el texto (insultos a personas,
  datos personales, publicidad, spam). Las críticas duras pero honestas se publican.
- **Métricas sin inflar**: cada persona cuenta una vez por local y acción cada 30 minutos, con un tope de 60
  registros por local por minuto (`limitar_metricas` en `actualizacion-6.sql`).
- **Captcha** (Cloudflare Turnstile) al crear cuenta, ingresar y recuperar la contraseña, en la app y el panel.
- **Política de seguridad del navegador (CSP)** en la versión publicada: solo corre el código de la app.
