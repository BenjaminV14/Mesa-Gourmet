# Aspectos legales en Chile

> Esto es una guía práctica para orientarte, **no asesoría legal**. Antes del lanzamiento con usuarios reales, haz revisar los textos por un abogado. Hay abogados y clínicas jurídicas universitarias en Talca que lo hacen a bajo costo.

## 1. Ley 21.719 de Protección de Datos Personales (la más importante)

**Qué es:** reemplaza a la antigua Ley 19.628. Se publicó en diciembre de 2024 y **entra en vigencia el 1 de diciembre de 2026**, o sea, antes de que lances la versión real. Crea la **Agencia de Protección de Datos Personales**, que fiscaliza y puede multar.

**Por qué te aplica:** Mesa Gourmet guarda datos personales: nombre, correo, fotos, reseñas, videos compartidos, favoritos y ubicación aproximada.

### Lo que exige y cómo lo cumple la app

| Exigencia | Qué significa | Cómo lo cumple Mesa Gourmet |
|---|---|---|
| **Base legal (consentimiento)** | Necesitas una razón válida para tratar cada dato | Casilla obligatoria "Acepto los términos y la política de privacidad" al registrarse; la ubicación se pide con el permiso del teléfono |
| **Información clara** | Decir qué datos guardas, para qué y por cuánto tiempo | Política de privacidad (hay un borrador en la app; falta la versión revisada por un abogado) |
| **Finalidad y minimización** | Solo pedir lo necesario | No se pide RUT, teléfono ni fecha de nacimiento. La ubicación no se guarda; solo se usa en el teléfono para calcular distancias |
| **Derecho de acceso y portabilidad** | La persona puede pedir copia de sus datos | Perfil → "Descargar mis datos" |
| **Derecho de supresión** | La persona puede pedir que borres sus datos | Perfil → "Eliminar mi cuenta" (borra reseñas, videos y likes) |
| **Derecho de rectificación y oposición** | Corregir datos u oponerse a un uso | Perfil → "Cambiar mi nombre"; correo de contacto en la política de privacidad |
| **Seguridad** | Medidas técnicas para proteger los datos | Ver `docs/SEGURIDAD.md` |
| **Aviso de filtraciones** | Si hay una filtración, avisar a la Agencia y, según el caso, a los afectados | Tener un correo de contacto y un procedimiento simple (te ayudo a redactarlo) |
| **Menores de edad** | Los menores de 14 años necesitan autorización de sus padres | Agregar en los términos que la app es para mayores de 14 (recomendado: mayores de 18, por la venta de alcohol) |

**Multas:** la ley las gradúa en leves, graves y gravísimas, con montos en UTM que llegan a miles de UTM, y para empresas grandes pueden calcularse como un porcentaje de los ingresos. Revisa los montos exactos con tu abogado; para un proyecto que parte, lo importante es cumplir lo básico de la tabla.

## 2. Ley del Consumidor (19.496): publicidad de los destacados

Los locales que pagan $29.990 aparecen primero. Eso es **publicidad**, y debe poder reconocerse como tal para no ser publicidad engañosa:

- ✅ La app muestra la etiqueta **"★ Destacado"** en tarjetas, búsquedas y mapa.
- ✅ Los términos dicen que los destacados son pagados.
- ✅ El **Top 50 no se puede comprar**: depende solo de las notas. Es clave para la credibilidad de la app.
- Recomendado: un contrato o comprobante simple con cada local que paga, que diga qué incluye y por cuánto tiempo. Debes emitir boleta o factura (ver punto 5).

## 3. Reseñas y contenido de usuarios

- **Responsabilidad:** las opiniones son de quien las escribe, pero debes retirar contenido ofensivo, falso o difamatorio cuando te lo reporten. La app ya tiene reportes y moderación.
- **Reseñas falsas:** no publiques reseñas inventadas como si fueran reales. Los datos de ejemplo de la demo deben borrarse antes del lanzamiento.
- **Derechos sobre fotos y videos:** en los términos, el usuario declara que el contenido es suyo y te da permiso para mostrarlo en la app. Los videos de TikTok e Instagram se muestran con el reproductor oficial (embed), que esas plataformas permiten.
- **Fotos y logos de los locales:** pide autorización por escrito (basta un correo) para usar sus fotos, logos y cartas.

## 4. Sorteos (para más adelante)

Cuando quieras hacer sorteos con premios:

- Publica **bases del sorteo** antes de empezar: quién organiza, quién puede participar, plazos, premio, cómo se elige al ganador y cómo se le avisa. Es habitual protocolizarlas ante notario.
- La Ley del Consumidor obliga a informar claramente las condiciones de promociones y concursos.
- Si el premio es alcohol, solo mayores de 18.
- Consulta con un contador si el premio genera impuestos.

## 5. Formalización y cobros

- Para cobrar los destacados necesitas **iniciar actividades en el SII** y emitir boletas o facturas. Lo más simple es partir como persona natural, o crear una empresa en "Tu empresa en un día".
- Para cobrar en línea más adelante: Mercado Pago, Flow o Webpay (Transbank).

## 6. Requisitos de Play Store y App Store

- **Política de privacidad pública**, con una URL accesible: obligatoria en ambas tiendas.
- **Eliminar la cuenta desde la app:** obligatorio en ambas. ✅ Ya está en Perfil.
- **Formulario de datos** en Google Play (Data safety) y **etiquetas de privacidad** en App Store: se completan con la tabla del punto 1.
- **Moderación del contenido de usuarios:** Apple exige poder reportar contenido y bloquear usuarios abusivos. ✅ Reportes, moderación y bloqueo ya están.
- **Calificación por edad:** al mencionar alcohol, corresponde 17+ en App Store y PEGI/ESRB equivalente en Google Play.

## Lista para el lanzamiento real

- [ ] Términos y condiciones revisados por un abogado
- [ ] Política de privacidad revisada y publicada en una URL
- [ ] Correo de contacto para privacidad (por ejemplo privacidad@mesagourmet.cl)
- [ ] Autorización por escrito de cada local para usar su información e imágenes
- [ ] Inicio de actividades en el SII para cobrar los destacados
- [ ] Borrar los datos y reseñas de ejemplo
