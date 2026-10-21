# Supabase: guía paso a paso

Supabase es el "backend" de Mesa Gourmet. Te entrega en un solo servicio:

- **Base de datos** (PostgreSQL): locales, cartas, reseñas, videos, usuarios, reportes.
- **Login** con correo y verificación, recuperación de contraseña y Google.
- **Almacenamiento** de las fotos de las reseñas y de los videos que suben los usuarios.
- **Funciones en el servidor** (Edge Functions): la verificación de fotos con IA.

El esquema completo ya está escrito en `supabase/schema.sql`. Tú solo tienes que crear la cuenta y pegarlo.

---

## 1. Crear la cuenta y el proyecto (10 minutos)

1. Entra a <https://supabase.com> y crea una cuenta (puedes usar tu GitHub).
2. **New project**:
   - **Name:** `mesa-gourmet`
   - **Database password:** genera una fuerte y **guárdala en un gestor de contraseñas**. No la compartas con nadie, ni conmigo.
   - **Region:** `South America (São Paulo)`, la más cercana a Talca.
   - **Plan:** Free para empezar.
3. Espera 1 a 2 minutos a que el proyecto termine de crearse.

> Plan gratis: alcanza de sobra para la demo y los primeros usuarios. Un detalle: los proyectos gratis se **pausan si pasan una semana sin uso**. Antes del lanzamiento real conviene pasar al plan Pro. Revisa los precios vigentes en supabase.com/pricing.

## 2. Crear las tablas y la seguridad (2 minutos)

1. En el menú izquierdo: **SQL Editor → New query**.
2. Abre `supabase/schema.sql`, copia **todo** y pégalo.
3. Presiona **Run**. Debe decir *Success. No rows returned*.

Con eso quedan creadas todas las tablas, los contadores automáticos de likes y notas, los límites antispam (máximo 10 reseñas al día y 1 por local al día) y las **reglas de seguridad** (RLS), que deciden quién puede leer y escribir cada cosa.

Estas reglas ya las probé en una base de datos real con 82 casos: por ejemplo, que un usuario no pueda hacerse administrador, mostrar una foto sin verificar, ver la encuesta de un local ni dar dos likes. Las pruebas están en `supabase/tests/`.

### Dónde queda cada cosa

- **Reseñas:** cada reseña es una fila en `resenas` (notas de 0,1 a 10, comentario, precio por persona). Sus fotos se guardan como archivos en el bucket `fotos-resenas` y cada foto tiene además su fila en `resena_fotos` (una o más por plato). Los "me gusta" van en `resena_likes` (a la reseña) y `foto_likes` (a cada foto).
- **Fotos sin verificar:** solo las ve quien las subió y tú. Aparecen para todos cuando la IA (o tú, desde Moderación) las aprueba.
- **Notas:** la nota oficial de cada local es el promedio de los **últimos 30 días** (vista `notas_locales`). El promedio histórico queda como dato secundario.
- **Videos:** los links de TikTok/Instagram y los videos subidos (bucket `videos`, hasta 60 MB) quedan en `videos`, siempre pendientes hasta que los apruebes.
- **Encuesta a los dueños:** las respuestas van en `encuestas_locales` y las preguntas en `encuesta_preguntas`. Son **privadas**: solo las ve el administrador, porque traen datos como el nombre y teléfono del dueño.
- **Social:** `seguidores`, `quiero_ir`, `guardados` y `favoritos`. Las listas de cada usuario son privadas; quién sigue a quién es público.
- **Cierres de mes:** las distinciones de cada mes quedan en `cierres_mes`.

## 3. Activar el tiempo real (1 minuto)

El esquema ya deja las reseñas, sus fotos y los videos conectados al **tiempo real** de Supabase: así el feed de Reseñas muestra lo nuevo sin recargar la página. Para confirmarlo:

1. Ve a **Database → Publications → supabase_realtime**.
2. Revisa que estén marcadas `resenas`, `resena_fotos` y `videos`. Si alguna no está, márcala.

El tiempo real respeta las mismas reglas de seguridad: nadie recibe fotos sin verificar ni reseñas ocultas de otros.

## 4. Configurar el login con verificación de correo

**Authentication → Providers → Email**

- Activa **Confirm email**. Así nadie puede usar la app sin confirmar que el correo es suyo.
- **Minimum password length:** 8.
- Activa **Leaked password protection** si tu plan lo permite: rechaza contraseñas que aparecieron en filtraciones conocidas.

**Authentication → URL Configuration**

- **Site URL:** la dirección donde publiques la app (por ejemplo `https://mesagourmet.netlify.app`).
- **Redirect URLs:** agrega también `http://localhost:5173` para las pruebas.

**Authentication → Email Templates**

- Traduce al español los asuntos y textos de *Confirm signup* y *Reset password*. Si me pasas acceso de lectura a los textos, te los dejo redactados.

> Para el lanzamiento real, configura un servicio de correo propio (SMTP), por ejemplo Resend o Brevo, en **Authentication → SMTP Settings**. El correo que trae Supabase tiene un límite bajo de envíos por hora y suele terminar en spam.

## 5. Login con Google (opcional, 15 minutos)

1. En <https://console.cloud.google.com> crea un proyecto.
2. Ve a **APIs & Services → OAuth consent screen**: tipo *External*, nombre "Mesa Gourmet", tu correo de contacto.
3. Ve a **Credentials → Create credentials → OAuth client ID**: tipo *Web application*.
   - En **Authorized redirect URIs** pega la URL que aparece en Supabase en **Authentication → Providers → Google** (termina en `/auth/v1/callback`).
4. Copia el **Client ID** y el **Client secret** en Supabase → **Authentication → Providers → Google** y actívalo.

## 6. Convertirte en administrador

1. Regístrate en la app con tu correo y confírmalo.
2. En **SQL Editor** ejecuta, con tu correo:

   ```sql
   update public.perfiles set rol = 'admin'
   where id = (select id from auth.users where email = 'tu-correo@ejemplo.cl');
   ```

Desde ese momento, solo tu cuenta puede entrar al panel de administración y cambiar locales, cartas, destacados y moderación.

## 7. Verificación de fotos con IA

La función `supabase/functions/verificar-foto` usa la IA de Anthropic (Claude) para revisar, **foto por foto**, que cada una muestre el plato indicado:

- **Aprobada:** la foto aparece para todos con el sello "✔ Foto verificada".
- **Dudosa:** la reseña sigue publicada, pero esa foto queda oculta en *Moderación → Fotos sin verificar* hasta que la revises.
- **Rechazada** (no es comida o es inapropiada): la reseña completa queda oculta en *Moderación → Reseñas en revisión* hasta que decidas.

Los videos subidos los revisas tú por ahora. Más adelante, una función `moderar-video` revisará con IA algunos cuadros del video antes de aprobarlo.

Lo hace el servidor, no la app, así que nadie puede saltarse el filtro. Para activarla:

1. Crea una cuenta en <https://console.anthropic.com>, carga crédito y crea una **API key**.
2. Instala la herramienta de Supabase en tu computador: <https://supabase.com/docs/guides/cli>.
3. En la carpeta del proyecto ejecuta:

   ```bash
   supabase login
   supabase link --project-ref TU_REF_DEL_PROYECTO
   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
   supabase functions deploy verificar-foto
   supabase functions deploy analizar-carta
   ```

La función `supabase/functions/analizar-carta` la usa solo el administrador en **Cartas → 🤖 Detectar opciones dietéticas**:
la IA lee los platos y sugiere cuáles son vegetarianos, veganos, sin gluten o sin lactosa. Las sugerencias se revisan antes
de guardar (con "sin gluten" la IA es conservadora, por los celíacos). Sin el servidor conectado, el panel usa reglas por ingredientes.

La clave de Anthropic queda guardada **solo en Supabase**. Nunca va dentro de la app ni en GitHub.

## 8. Lo que necesito de ti para conectar la app

En **Project Settings → API** copia estos dos datos y pásamelos (o pégalos tú en el archivo `.env`):

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

- La **anon key** es pública por diseño: va dentro de la app y la protegen las reglas de seguridad del paso 2.
- **Nunca compartas la `service_role key`** ni la contraseña de la base de datos. Esas dan acceso total.

Con esos dos datos reemplazo la capa de datos de la demo (`src/data/store.js`) por Supabase: login real, reseñas compartidas entre todos, fotos en el servidor y el panel de administración protegido.

## 9. Respaldos

- El plan gratis no incluye respaldos automáticos descargables. Mientras tanto, usa **Panel admin → Usuarios y datos → Descargar respaldo** cada semana, o `supabase db dump` desde tu computador.
- El plan Pro incluye respaldos diarios.
