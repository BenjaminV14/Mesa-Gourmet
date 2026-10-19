# Hosting, estadísticas y tiendas de apps

## 1. Publicar la web (hosting)

Recomiendo **Netlify** porque es la opción más simple y tiene plan gratis. Cloudflare Pages y Vercel funcionan igual.

### Opción A: arrastrar la carpeta (5 minutos, sin GitHub)

1. En tu computador, dentro del proyecto:

   ```bash
   npm install
   npm run build
   ```

   Esto crea la carpeta `dist/`.
2. Entra a <https://app.netlify.com/drop> y arrastra la carpeta `dist/`.
3. Te entrega un link del tipo `https://nombre-al-azar.netlify.app`. En *Site settings* puedes cambiarlo a `mesagourmet.netlify.app`, si está libre.

### Opción B: conectado a GitHub (recomendado, se actualiza solo)

1. Sube el proyecto a GitHub.
2. En Netlify: **Add new site → Import from Git → GitHub →** elige `mesa-gourmet`.
3. Configuración:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Environment variables:** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (cuando conectemos Supabase).
4. Cada vez que se guarden cambios en GitHub, el sitio se actualiza solo en uno o dos minutos.

El proyecto ya trae `public/_headers` con cabeceras de seguridad que Netlify y Cloudflare aplican automáticamente.

### Dominio propio (cuando lances)

- Un dominio `.cl` se compra en <https://www.nic.cl>. Revisa el precio anual vigente.
- En Netlify: **Domain settings → Add custom domain**, y sigue las instrucciones para apuntar el dominio. El HTTPS se configura solo.

## 2. Estadísticas de uso

La app ya registra los eventos importantes (`src/services/analytics.js`). Solo falta conectar una cuenta:

| Evento | Para qué te sirve |
|---|---|
| `busqueda` (término y cantidad de resultados) | Saber qué busca la gente y qué falta en la app |
| `impresion_destacado`, `ver_local`, `mapa_ver_local` con `destacado: true` | **Mostrarle a cada local cuántas personas vieron su destacado**: es tu argumento de venta para que renueven |
| `click_whatsapp` | Cuántas reservas genera cada local |
| `recomendacion_aleatoria` | Si funciona el 1 de cada 3 destacados |
| `resena_publicada`, `video_compartido`, `reporte_local` | Actividad de la comunidad |
| `registro`, `inicio_sesion`, `entrar_invitado`, `bloqueo_invitado` | Cuántos invitados se convierten en usuarios registrados |

### Recomendado: PostHog

PostHog tiene un plan gratis amplio, funciona en la web y dentro de las apps de tiendas, y permite armar gráficos por local. Revisa los límites vigentes en posthog.com/pricing.

1. Crea una cuenta en <https://posthog.com> y elige la región **EU** o **US**.
2. Copia la **Project API key** y pásamela, o agrégala como `VITE_POSTHOG_KEY` en Netlify.
3. Yo agrego la librería y el aviso de cookies. Desde ese momento los eventos aparecen en su panel.

Si solo quieres visitas y páginas, sin eventos, **Cloudflare Web Analytics** es gratis y no usa cookies.

## 3. App instalable en el celular (PWA)

Es el paso intermedio más barato antes de las tiendas: la gente la "instala" desde el navegador con un ícono en la pantalla de inicio. Necesito el **logo de Mesa Gourmet en alta resolución** (PNG de 1024×1024 sin fondo) para generar los íconos.

## 4. Play Store y App Store

La forma recomendada de llevar esta app a las tiendas es **Capacitor** (<https://capacitorjs.com>). Empaqueta la misma app web como app nativa de Android y iOS, sin reescribirla.

| | Google Play | App Store |
|---|---|---|
| Cuenta de desarrollador | Pago único (referencia: USD 25) | Anual (referencia: USD 99/año) |
| Necesitas | Cualquier computador | **Un Mac** con Xcode para compilar y subir, o un servicio en la nube como Codemagic o Ionic Appflow |
| Revisión | Horas a pocos días | 1 a 3 días; Apple es más estricta |
| Requisitos clave | Política de privacidad, formulario de datos, eliminar cuenta desde la app | Lo mismo + reportar y bloquear contenido de usuarios + "Sign in with Apple" si ofreces login con Google |

Revisa los precios vigentes en cada tienda antes de pagar.

**Orden sugerido:**

1. Web publicada y probada con usuarios reales (PWA).
2. Android con Capacitor, que es más rápido y barato de aprobar.
3. iOS. Ojo: si ofreces "Continuar con Google", Apple exige también "Continuar con Apple", que Supabase soporta.
