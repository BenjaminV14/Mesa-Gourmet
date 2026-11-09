// Términos y condiciones y Política de privacidad de Mesa Gourmet.
// Un solo lugar para los textos: los usan las ventanas de la app (registro y Perfil) y la página pública legal.html
// (la URL que piden Google Play y App Store).
//
// ⚠️ ANTES DEL LANZAMIENTO:
//   1. Completa RESPONSABLE (nombre o razón social, RUT, domicilio y correo de contacto).
//   2. Haz revisar estos textos por un abogado (ver docs/LEGAL.md).
//   3. Si cambias algo importante, sube VERSION y la fecha, y avisa en la app.

export const RESPONSABLE = {
    nombre: '',          // Ej: 'Benjamín Vergara' o la razón social si creas una empresa
    rut: '',             // Ej: '12.345.678-9'
    domicilio: '',       // Ej: 'Talca, Región del Maule, Chile'
    correo: ''           // Ej: 'privacidad@mesagourmet.cl' (recibe solicitudes de datos y reclamos)
};

export const VERSION = '1.0';
export const ACTUALIZADO = '9 de noviembre de 2026';

const dato = (valor, falta) => valor ? valor : `<span class="legal-falta">[${falta}]</span>`;
const quien = () => `${dato(RESPONSABLE.nombre, 'nombre o razón social')}, RUT ${dato(RESPONSABLE.rut, 'RUT')}, con domicilio en ${dato(RESPONSABLE.domicilio, 'domicilio')}`;
const correo = () => RESPONSABLE.correo ? `<a href="mailto:${RESPONSABLE.correo}">${RESPONSABLE.correo}</a>` : dato('', 'correo de contacto');

export function terminosHtml() {
    return `
<p class="legal-meta">Versión ${VERSION} · Actualizados el ${ACTUALIZADO}</p>

<h3>1. Quiénes somos</h3>
<p>Mesa Gourmet es una guía gastronómica de Talca (Chile) donde puedes buscar locales, ver sus cartas, horarios y promociones,
y publicar reseñas, fotos y videos sobre tus visitas. La app es administrada por ${quien()} ("Mesa Gourmet", "nosotros").
Contacto: ${correo()}.</p>

<h3>2. Aceptación y edad mínima</h3>
<p>Al crear una cuenta o usar la app aceptas estos términos y la Política de privacidad. Para crear una cuenta debes tener
<b>14 años o más</b>. Parte del contenido (tragos, promociones con alcohol) está dirigido solo a mayores de 18 años; la venta de
alcohol a menores está prohibida y es responsabilidad de cada local. Puedes usar la app como invitado, sin cuenta, para ver locales y reseñas.</p>

<h3>3. Tu cuenta</h3>
<ul>
<li>Debes entregar datos verdaderos y mantener segura tu contraseña. Puedes ingresar con correo y contraseña o con tu cuenta de Google.</li>
<li>Una cuenta por persona. No puedes hacerte pasar por otra persona ni por un local.</li>
<li>Puedes cambiar tus datos, descargar una copia o eliminar tu cuenta en cualquier momento desde <b>Perfil</b>.</li>
</ul>

<h3>4. Reseñas, fotos y videos</h3>
<p>Lo que publicas debe ser <b>tu experiencia real</b> en el local. No está permitido:</p>
<ul>
<li>Reseñas falsas, de locales que no visitaste, o hechas a cambio de pago, descuentos o regalos <b>sin decirlo en la misma reseña</b>.
Tampoco reseñas de dueños o trabajadores sobre su propio local o la competencia.</li>
<li>Contenido ofensivo, discriminatorio, sexual, violento, difamatorio, con amenazas o que promueva actividades ilegales.</li>
<li>Datos personales de otras personas (nombres completos, teléfonos, fotos de terceros identificables sin su permiso).</li>
<li>Fotos o videos que no sean tuyos o que infrinjan derechos de autor, y publicidad o spam.</li>
</ul>
<p>Puedes publicar una reseña por local al día. Sigues siendo dueño de tu contenido, pero nos das un <b>permiso gratuito y no exclusivo</b>
para mostrarlo en la app y en las redes de Mesa Gourmet (siempre con tu @usuario), mientras esté publicado. El permiso termina cuando
lo borras o eliminas tu cuenta, salvo publicaciones que ya hayamos compartido en redes antes de eso.</p>

<h3>5. Moderación y verificación con inteligencia artificial</h3>
<p>Para cuidar la confianza en la app, las fotos de las reseñas y algunas cartas se revisan con un sistema de inteligencia artificial
(Claude, de Anthropic) que indica si la foto corresponde al plato. Si hay dudas, la reseña o la foto queda en revisión y la ve una persona del
equipo. <b>Nunca bloqueamos una cuenta solo por una decisión automática</b>, y puedes pedir que una persona revise cualquier decisión
escribiéndonos. También revisamos los reportes de otros usuarios. Podemos ocultar o eliminar contenido que no cumpla estas reglas y,
si los incumplimientos son graves o repetidos, suspender la cuenta. Te diremos el motivo.</p>

<h3>6. Notas, rankings y destacados</h3>
<ul>
<li>Las notas y el <b>Top 50 de locales</b> se calculan solo con las reseñas de los usuarios (promedio de comida y servicio de los últimos 30 días).
<b>No se pueden comprar.</b></li>
<li>Los locales marcados como <b>"★ Destacado"</b> pagaron por aparecer primero o resaltados: es publicidad y siempre se identifica así.</li>
</ul>

<h3>7. Top 50 de clientes y beneficios de los locales</h3>
<ul>
<li>Cada local tiene un Top 50 de clientes del mes: las personas con <b>5 reseñas publicadas o más en ese local</b> en el mes calendario
(si hay empate, queda primero quien llegó antes a esa cantidad). Tu puesto solo lo ves tú.</li>
<li>Cada local decide <b>libremente</b> si ofrece un beneficio a su Top 50, cuál es y sus condiciones (por ejemplo, un descuento por tiempo limitado).
El beneficio lo entrega y responde por él el local; Mesa Gourmet solo informa y, si hay un problema, te ayuda a resolverlo con el local.</li>
<li>Para cobrarlo muestras en el local el código <b>MESAGOURMET</b> y tu @usuario desde tu perfil. Es personal e intransferible.</li>
<li>El local recibe tu nombre, apellido y @usuario <b>solo si lo autorizas</b> (lo puedes activar o desactivar en Perfil → Privacidad).</li>
<li>Las reseñas hechas solo para subir en el ranking, o falsas, se eliminan y dejan sin efecto el puesto y el beneficio.</li>
</ul>

<h3>8. Información de los locales</h3>
<p>Horarios, precios, cartas, promociones y características de los locales son referenciales: los entrega cada local o los recopilamos
nosotros, y pueden cambiar. Confírmalos con el local antes de ir, sobre todo si tienes alergias o necesidades alimentarias:
las etiquetas vegano, vegetariano, sin gluten y sin lactosa son orientativas y <b>no reemplazan la confirmación con el local</b>.</p>

<h3>9. Promociones, eventos y sorteos</h3>
<p>Las promociones y eventos son de cada local y se rigen por sus condiciones. Si Mesa Gourmet organiza un sorteo, publicará antes sus bases
(organizador, plazos, requisitos, premio y forma de elegir y avisar al ganador).</p>

<h3>10. Propiedad intelectual</h3>
<p>El nombre, logo, diseño y código de Mesa Gourmet nos pertenecen. Los logos, fotos y cartas de los locales pertenecen a cada local y se usan con su autorización.</p>

<h3>11. Responsabilidad</h3>
<p>Hacemos lo posible para que la app funcione bien y la información sea correcta, pero puede tener interrupciones o errores.
No respondemos por la atención, los productos, los precios ni los beneficios de los locales, ni por las opiniones de los usuarios.
Nada de esto limita los derechos que te da la Ley 19.496 de Protección de los Derechos de los Consumidores.</p>

<h3>12. Cambios</h3>
<p>Si cambiamos estos términos de forma importante, te avisaremos en la app antes de que empiecen a regir. Si no estás de acuerdo, puedes eliminar tu cuenta.</p>

<h3>13. Ley aplicable y reclamos</h3>
<p>Estos términos se rigen por las leyes de Chile. Puedes escribirnos a ${correo()} y te responderemos. Como consumidor, también puedes acudir al SERNAC
o al Juzgado de Policía Local que corresponda.</p>
`;
}

export function privacidadHtml() {
    return `
<p class="legal-meta">Versión ${VERSION} · Actualizada el ${ACTUALIZADO}</p>
<p>Esta política explica qué datos personales trata Mesa Gourmet, para qué, con quién se comparten, cuánto tiempo se guardan y cómo puedes
ejercer tus derechos, conforme a la Ley 19.628 y a la Ley 21.719 sobre protección de datos personales.</p>

<h3>1. Responsable</h3>
<p>${quien()}. Correo para temas de privacidad y para ejercer tus derechos: ${correo()}.</p>

<h3>2. Qué datos tratamos</h3>
<ul>
<li><b>Cuenta:</b> nombre, apellido, correo, @usuario, foto de perfil y la fecha en que aceptaste estos documentos. La contraseña la guarda cifrada
nuestro proveedor (Supabase); nosotros no la vemos. Si entras con Google, recibimos tu nombre, correo y foto de esa cuenta.</li>
<li><b>Lo que publicas:</b> reseñas, notas, productos que consumiste, precio por persona, fotos, videos y comentarios.</li>
<li><b>Tu actividad:</b> favoritos, "quiero ir", personas que sigues, guardados, "me gusta" y reportes que haces.</li>
<li><b>Preferencias:</b> comida favorita, configuración de notificaciones y privacidad, y tus necesidades alimentarias (vegano, vegetariano,
sin gluten, sin lactosa). Estas últimas pueden revelar información de salud: las usamos <b>solo para filtrar locales</b>, nadie más puede verlas
y puedes borrarlas cuando quieras.</li>
<li><b>Uso de la app:</b> cuando abres la ficha de un local o tocas WhatsApp, llamar, cómo llegar, la carta o sus redes, lo registramos
(asociado a tu cuenta si iniciaste sesión) para medir cuánta gente lleva la app a cada local.</li>
<li><b>Ubicación:</b> si das permiso, se usa <b>solo en tu teléfono</b> para calcular distancias. No la guardamos ni la enviamos.</li>
<li><b>Datos técnicos:</b> tu dirección IP y el tipo de navegador quedan en los registros de nuestros proveedores; tu sesión y una copia de los datos
para abrir más rápido quedan en el almacenamiento de tu navegador. No usamos cookies de publicidad.</li>
</ul>
<p>No pedimos RUT, teléfono, fecha de nacimiento ni datos bancarios.</p>

<h3>3. Para qué los usamos y con qué base</h3>
<ul>
<li><b>Prestarte el servicio</b> (cuenta, reseñas, perfil, favoritos, misiones y niveles): porque aceptas los Términos.</li>
<li><b>Moderar y proteger la app</b> (verificar fotos, revisar reportes, evitar spam y cuentas falsas): interés legítimo en mantener una guía confiable.</li>
<li><b>Estadísticas para los locales</b>: les mostramos números <b>agregados, sin datos personales</b> (reseñas, clientes distintos, clientes que volvieron, visitas a su ficha).</li>
<li><b>Compartir tu nombre, apellido y @usuario con un local si quedas en su Top 50 de clientes</b>: <b>solo con tu consentimiento</b>, que es opcional
y puedes retirar en cualquier momento en Perfil → Privacidad (desde ese momento no se comparte más).</li>
<li><b>Avisos del servicio</b> (por ejemplo, confirmar tu correo o cambios en estos documentos). No te enviamos publicidad sin tu consentimiento.</li>
</ul>

<h3>4. Qué es público en la app</h3>
<p>Tu nombre (sin apellido), @usuario, foto de perfil, nivel, insignias, reseñas, fotos y videos publicados. Si desactivas "Perfil público" en
Perfil → Privacidad, nadie más puede abrir tu perfil (nivel, insignias y lista de reseñas), pero tus reseñas siguen apareciendo en la ficha de cada
local con tu nombre y @usuario. Tu apellido, correo, preferencias, necesidades alimentarias y tu puesto en el Top 50 de clientes no son públicos.</p>

<h3>5. Con quién compartimos datos</h3>
<p><b>No vendemos ni arrendamos tus datos.</b> Los compartimos solo con:</p>
<ul>
<li><b>Proveedores que nos prestan servicios</b> (encargados del tratamiento), que solo pueden usarlos para eso:
Supabase (base de datos, cuentas y archivos; servidores en Brasil), Anthropic (análisis de fotos y cartas con IA; Estados Unidos),
Resend (envío de correos a los locales; Estados Unidos), Google (solo si ingresas con Google), GitHub Pages (alojamiento de la app; registra la IP de
las visitas) y los proveedores de mapas y tipografías (OpenStreetMap, Google Fonts), que reciben tu IP al cargar el mapa y las letras.</li>
<li><b>Locales:</b> solo el Top 50 de clientes de cada local, solo de quienes lo autorizaron, una vez al mes y con la obligación de usarlo únicamente
para ofrecer beneficios y de borrarlo al mes.</li>
<li><b>Autoridades</b>, cuando una ley o un tribunal lo exija.</li>
</ul>

<h3>6. Transferencias internacionales</h3>
<p>Algunos proveedores procesan datos fuera de Chile (Brasil y Estados Unidos). Los elegimos porque aplican medidas de seguridad y compromisos
contractuales de protección de datos. Si la ley exige garantías adicionales, las solicitaremos.</p>

<h3>7. Cuánto tiempo guardamos los datos</h3>
<ul>
<li><b>Cuenta y publicaciones:</b> mientras tengas la cuenta. Si la eliminas, se borran de inmediato tu cuenta, perfil, reseñas, fotos, videos y actividad.
Pueden quedar en copias de seguridad del proveedor hasta que se sobrescriban (en ciclos de hasta 30 días).</li>
<li><b>Top 50 de clientes con nombres:</b> se borra al cerrar el mes siguiente (por ejemplo, la lista de octubre se borra a fines de noviembre).</li>
<li><b>Registros de uso</b> (visitas a fichas y contactos): 13 meses. <b>Reportes resueltos:</b> 12 meses.</li>
<li><b>Estadísticas mensuales de cada local:</b> se guardan, porque no contienen datos personales.</li>
</ul>

<h3>8. Seguridad</h3>
<p>Usamos conexiones cifradas (HTTPS), contraseñas cifradas, reglas en la base de datos que impiden ver o cambiar datos ajenos y acceso de
administrador restringido. Si ocurre una vulneración de seguridad que afecte tus datos, avisaremos a la Agencia de Protección de Datos Personales y,
cuando corresponda, a las personas afectadas, sin demoras indebidas.</p>

<h3>9. Tus derechos</h3>
<p>Puedes ejercer en forma gratuita tus derechos de <b>acceso, rectificación, supresión, oposición, portabilidad y bloqueo temporal</b>, y
<b>retirar tu consentimiento</b> cuando quieras, sin efecto retroactivo. Varias cosas las puedes hacer tú mismo en Perfil:</p>
<ul>
<li><b>Descargar mis datos</b> (acceso y portabilidad, en un archivo).</li>
<li><b>Editar perfil</b> (rectificación) y <b>Privacidad</b> (consentimientos y perfil público).</li>
<li><b>Eliminar mi cuenta</b> (supresión inmediata).</li>
</ul>
<p>Para todo lo demás escríbenos a ${correo()} desde el correo de tu cuenta. Responderemos dentro de <b>30 días corridos</b> (prorrogables una vez
por 30 días más, avisándote el motivo) y las solicitudes de bloqueo temporal dentro de 2 días hábiles. Si no respondemos o no estás de acuerdo con la
respuesta, puedes reclamar ante la Agencia de Protección de Datos Personales.</p>

<h3>10. Decisiones automatizadas</h3>
<p>La revisión de fotos con IA puede dejar una reseña o foto en revisión. Esa decisión no tiene efectos sobre tu cuenta sin revisión de una persona, y
puedes pedir que una persona la revise, explicar tu punto de vista y conocer los criterios usados escribiéndonos.</p>

<h3>11. Menores de edad</h3>
<p>La app no está dirigida a menores de 14 años y no pueden crear una cuenta. Si nos enteramos de que una cuenta pertenece a un menor de 14 años,
la eliminaremos. Los padres o tutores pueden escribirnos.</p>

<h3>12. Cambios a esta política</h3>
<p>Si hacemos cambios importantes te avisaremos en la app antes de que rijan. La versión vigente siempre está en esta página.</p>
`;
}
