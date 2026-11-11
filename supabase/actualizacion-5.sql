-- =====================================================================
-- Mesa Gourmet · Actualización 5 (ejecutar UNA vez, después de actualizacion-4.sql)
-- Supabase > SQL Editor > New query > pegar todo > Run
--
-- Encuesta, características y promociones:
--  1. Promociones: nuevo tipo 'tarjeta' para los descuentos con bancos o tarjetas
--  2. La lista mensual (Top 50) se envía solo a los locales que la pidieron: por defecto, no
--  3. Capacidad y tipo de público son solo para el administrador: se borran de la tabla pública
--     de locales (siguen guardados en las respuestas de la encuesta, que solo ve el administrador)
--  4. Banco de preguntas corregido (mismos ids, así no se pierde ninguna respuesta)
--  5. Características: "Barra" pasa a "Barra de tragos" (solo donde venden alcohol), "Delivery" se
--     separa en "Delivery por apps" y "Delivery propio", se retira "Apto para menores de edad"
--  6. Detalles sueltos: se borran los que quedaron de respuestas a medio escribir, los de preguntas
--     respondidas solo con "Sí" y los de características que el local ya no tiene. La clave del WiFi
--     queda tal cual la dio el local
--  7. Celíacos: nueva columna locales.celiaco_seguro. Si el local no se protege de la contaminación
--     cruzada (o no sabe), la app no muestra ningún plato suyo como apto para celíacos
-- =====================================================================

-- 1. Descuentos con tarjetas
alter table public.promociones add column if not exists tipo text not null default 'promo';
alter table public.promociones drop constraint if exists promociones_tipo_check;
alter table public.promociones add constraint promociones_tipo_check check (tipo in ('promo', 'tarjeta'));

-- 2. Lista mensual solo si el local la pide (nadie la ha pedido todavía en la encuesta)
alter table public.contactos_locales alter column recibe_top50 set default false;
update public.contactos_locales c set recibe_top50 = false
where not exists (
    select 1 from public.encuestas_locales e
    where e.local_id = c.local_id and e.respuestas->>'q73' ~* '^\s*(s[ií]|ok|claro)($|[^a-zñ])'
);

-- 7. Celíacos (va antes porque la pregunta nueva la usa)
alter table public.locales add column if not exists celiaco_seguro boolean;
comment on column public.locales.celiaco_seguro is 'Encuesta: true = se protegen de la contaminación cruzada con gluten; false = no o no saben (no se muestran platos sin gluten); null = sin responder';

-- 3. Datos privados fuera de la tabla pública
update public.locales set capacidad = null, ambiente = null where capacidad is not null or ambiente is not null;

-- 4. Banco de preguntas
--    q8 "¿Pueden ingresar menores de 18?" se reemplaza por q77 "¿El local es solo para mayores de 18?"
--    (la respuesta significa lo contrario, así que la anterior se borra de cada local)
delete from public.encuesta_preguntas where id in ('q8', 'q74');
update public.encuestas_locales set respuestas = respuestas - 'q8' where respuestas ? 'q8';
insert into public.encuesta_preguntas (id, seccion, texto, uso, sugerencia, orden) values
    ('q1', 'basicos', 'Nombre del local', 'nombre', null, 0),
    ('q6', 'basicos', '¿Qué tipo de local es y qué tipo de comida tiene?', 'tipo', 'Restaurante, cafetería, picada, comida rápida, bar… y el estilo (peruana, venezolana, sushi…)', 1),
    ('q2', 'basicos', 'Dirección exacta', 'direccion', 'Calle, número y sector', 2),
    ('q34', 'basicos', '¿Qué punto de referencia conocido hay cerca?', 'referencia', 'Ej: frente a la Plaza de Armas', 3),
    ('q26', 'basicos', '¿Hay alguna dificultad o recomendación para llegar o entrar al local?', 'notaAcceso', 'Escaleras, calle cerrada, entrada por el costado… Si no hay, deja en blanco', 4),
    ('q3', 'basicos', '¿Tienen un slogan o frase que represente al local?', 'slogan', null, 5),
    ('q51', 'basicos', '¿Cuál es el horario de atención de cada día?', 'horario', 'Ej: lunes a viernes 12:00 a 23:00, sábado 13:00 a 01:00, domingo cerrado', 6),
    ('q21', 'basicos', '¿Atienden en feriados? ¿En qué horario?', 'horarioFeriados', null, 7),
    ('q50', 'basicos', '¿Tienen carta digital? ¿Cuál es el link?', 'cartaUrl', 'Si solo tienen carta física, pídele una foto o PDF y cárgala en "Cartas"', 8),
    ('q43', 'contacto', 'Teléfono del local', 'telefono', 'El que se muestra en la app', 9),
    ('q44', 'contacto', 'WhatsApp del local', 'whatsapp', 'Para reservas y consultas desde la app', 10),
    ('q45', 'contacto', 'Instagram', 'instagram', null, 11),
    ('q46', 'contacto', 'TikTok', 'tiktok', null, 12),
    ('q47', 'contacto', 'Facebook', 'facebook', null, 13),
    ('q49', 'contacto', 'Sitio web', 'website', null, 14),
    ('q48', 'contacto', 'Correo del local', 'correoLocal', 'Para avisos de Mesa Gourmet y la lista mensual (si la quieren). No se muestra en la app', 15),
    ('q42', 'contacto', 'Celular del dueño o administrador', 'interno', 'Solo para ti', 16),
    ('q57', 'oferta', '¿Se puede comer en el local, o es solo para llevar?', 'car:Consumo en el local', null, 17),
    ('q56', 'oferta', '¿Se puede pedir para llevar o retirar en el local?', 'det:Pedidos para llevar', null, 18),
    ('q55', 'oferta', '¿Tienen delivery propio, con repartidores del mismo local?', 'det:Delivery propio', 'Basta Sí o No. Si quieres, anota hasta dónde reparten o cuánto cuesta', 19),
    ('q7', 'oferta', '¿Están en apps de delivery? ¿En cuáles?', 'det:Delivery por apps', 'PedidosYa, Uber Eats, Rappi… Basta Sí o No, o los nombres', 20),
    ('q20', 'oferta', '¿Se puede reservar mesa? ¿A qué teléfono o WhatsApp?', 'det:Acepta reservas', null, 21),
    ('q22', 'oferta', '¿Se puede arrendar el local, o un sector, para eventos?', 'det:Arriendo para eventos', 'Si dicen sí, anota para cuántas personas (opcional)', 22),
    ('q11', 'oferta', '¿Venden alcohol?', 'det:Venta de Alcohol', 'Si quieres, anota qué: cerveza, vino, tragos…', 23),
    ('q77', 'oferta', '¿El local es solo para mayores de 18?', 'car:Solo mayores de 18', 'Pregúntalo solo en bares, pubs o discotecas. En restaurantes y cafés marca No sin preguntar', 24),
    ('q24', 'oferta', '¿Qué medios de pago aceptan?', 'mediosPago', 'Efectivo, débito, crédito, transferencia', 25),
    ('q23', 'oferta', '¿Aceptan JUNAEB, Edenred u otras tarjetas de alimentación? ¿Con tarjeta, QR o app?', 'det:Acepta Edenred / BAES', null, 26),
    ('q67', 'oferta', '¿Tienen descuentos con alguna tarjeta o banco? ¿Cuáles, qué días y cuánto?', 'interno', 'Regístralos en "Eventos y promos > Descuentos con tarjetas" para que salgan en la app', 27),
    ('q4', 'oferta', '¿Qué platos son vegetarianos?', 'interno', 'La app los detecta sola al subir la carta; esto sirve para confirmar', 28),
    ('q5', 'oferta', '¿Qué platos son veganos?', 'interno', 'Sirve para confirmar lo que detecta la carta', 29),
    ('q13', 'oferta', '¿Qué productos son sin lactosa?', 'interno', 'Sirve para confirmar lo que detecta la carta', 30),
    ('q14', 'oferta', '¿Qué productos son sin gluten?', 'interno', 'Para celíacos. Sirve para confirmar lo que detecta la carta', 31),
    ('q78', 'oferta', '¿Toman medidas para que los productos sin gluten no se contaminen con gluten?', 'celiacoSeguro', 'Utensilios, superficies y aceite separados. Si dicen que no o no saben, la app no mostrará productos sin gluten de este local', 32),
    ('q18', 'oferta', '¿Tienen carta física o con QR en las mesas?', 'interno', null, 33),
    ('q19', 'oferta', '¿Tienen tarjetas de presentación del local?', 'interno', null, 34),
    ('q10', 'oferta', '¿En qué horario hay más gente?', 'horasPeak', null, 35),
    ('q12', 'oferta', '¿Qué días tienen más público?', 'diasPeak', null, 36),
    ('q71', 'oferta', '¿Cuánto gasta en promedio una persona?', 'interno', 'Precio promedio por persona. Solo para ti', 37),
    ('q9', 'oferta', '¿Qué tipo de público va al local?', 'interno', 'Familias, estudiantes, parejas, after office… Solo para ti, no sale en la app', 38),
    ('q63', 'oferta', '¿Participan en eventos con su propio personal o con otro?', 'interno', null, 39),
    ('q64', 'oferta', 'En eventos (fondas, ferias), ¿suelen unirse a un puesto?', 'interno', null, 40),
    ('q35', 'infra', '¿Tienen baño para el público?', 'det:Baño / WC', null, 41),
    ('q15', 'infra', '¿Tienen WiFi para el público? ¿Cuál es la clave?', 'det:WiFi Disponible', 'Anota la clave tal cual, respetando mayúsculas y minúsculas. Se muestra en la app', 42),
    ('q58', 'infra', '¿Tienen terraza?', 'det:Terraza', null, 43),
    ('q16', 'infra', '¿Aceptan mascotas? ¿En todo el local o solo en la terraza?', 'car:Ingreso de Mascotas', null, 44),
    ('q17', 'infra', '¿Tienen zona para fumadores? ¿Dónde?', 'car:Apto para Fumadores', null, 45),
    ('q28', 'infra', '¿Tienen estacionamiento?', 'det:Estacionamiento', 'Basta Sí o No. Si quieres, agrega dónde: propio, en la calle, parquímetro…', 46),
    ('q32', 'infra', '¿Tienen bicicletero o lugar para dejar bicicletas?', 'det:Bicicletero', null, 47),
    ('q27', 'infra', '¿Tienen acceso para personas en silla de ruedas o con movilidad reducida?', 'det:Acceso Discapacitados', null, 48),
    ('q29', 'infra', '¿Tienen segundo piso para el público?', 'car:Segundo piso', null, 49),
    ('q31', 'infra', '¿Tienen barra de tragos?', 'det:Barra de tragos', 'Una barra para pedir y tomar algo. Un mesón para pagar no cuenta', 50),
    ('q25', 'infra', '¿Tienen aire acondicionado o ventilación?', 'car:Aire Acondicionado / Ventilación', null, 51),
    ('q72', 'infra', '¿Tienen calefacción?', 'det:Calefacción', null, 52),
    ('q70', 'infra', '¿Hay enchufes para cargar el celular o el computador?', 'car:Enchufes para cargar', null, 53),
    ('q69', 'infra', '¿Tienen algo para niños? (silla de bebé, juegos, menú infantil)', 'det:Espacio para niños', null, 54),
    ('q68', 'infra', '¿Tienen música en vivo o shows? ¿Qué días?', 'det:Música en vivo', null, 55),
    ('q66', 'infra', '¿Tienen cámaras de seguridad o guardia?', 'car:Seguridad Completa', null, 56),
    ('q33', 'infra', '¿El local tiene alguna temática o estilo de decoración?', 'tematica', null, 57),
    ('q30', 'infra', '¿Para cuántas personas hay capacidad? (sillas y mesas)', 'interno', 'Solo para ti, no sale en la app', 58),
    ('q73', 'relacion', '¿Quieren recibir cada mes, por correo, la lista de sus mejores clientes de la app (Top 50)?', 'top50:recibe', 'Es gratis y opcional. Solo incluye a clientes que aceptaron compartir su nombre; deben usarla solo para ofrecerles un beneficio y borrarla al mes', 59),
    ('q75', 'relacion', '¿Qué beneficio le darían a su Top 50?', 'beneficioTop50', 'Ej: 10% de descuento mostrando el código MESAGOURMET. Lo ven los clientes en su perfil', 60),
    ('q76', 'relacion', '¿Les interesa aparecer destacados en la app (plan de patrocinio)?', 'interno', 'Incluye estadísticas mensuales de cuánta gente llegó al local por la app', 61),
    ('q62', 'relacion', 'La casa invita', 'interno', null, 62),
    ('q61', 'relacion', 'Compromisos', 'interno', null, 63),
    ('q36', 'relacion', '¿Hacen sorteos?', 'interno', null, 64),
    ('q37', 'relacion', '¿Qué hacen en fechas especiales?', 'interno', 'Día de la Madre, Fiestas Patrias, San Valentín…', 65),
    ('q38', 'relacion', '¿Tienen alguna iniciativa social o ambiental?', 'interno', null, 66),
    ('q39', 'relacion', '¿Tienen socios o alianzas estratégicas?', 'interno', null, 67),
    ('q41', 'relacion', '¿El local está preparado para atender a personas con discapacidad visual, auditiva o cognitiva?', 'interno', null, 68),
    ('q65', 'relacion', '¿Tienen atención preferente o algún protocolo para embarazadas?', 'interno', null, 69),
    ('q53', 'empresa', 'Nombre del dueño', 'interno', null, 70),
    ('q54', 'empresa', '¿Tienen otro negocio de comida?', 'interno', null, 71),
    ('q52', 'empresa', '¿Cuántos trabajadores tienen?', 'interno', null, 72),
    ('q40', 'empresa', '¿Buscan personal seguido o para reemplazos?', 'interno', null, 73),
    ('q59', 'empresa', 'Proyectos de la empresa', 'interno', null, 74),
    ('q60', 'empresa', 'Necesidades', 'interno', null, 75)
on conflict (id) do update set seccion = excluded.seccion, texto = excluded.texto, uso = excluded.uso,
    sugerencia = excluded.sugerencia, orden = excluded.orden;

-- 5. Características
-- "Barra": barra de tragos solo si el local vende alcohol y no era un mesón
update public.locales set
    caracteristicas = array_replace(caracteristicas, 'Barra', 'Barra de tragos'),
    caracteristicas_detalle = (caracteristicas_detalle - 'Barra')
        || case when caracteristicas_detalle ? 'Barra' then jsonb_build_object('Barra de tragos', caracteristicas_detalle->'Barra') else '{}'::jsonb end
where 'Barra' = any (caracteristicas) and 'Venta de Alcohol' = any (caracteristicas)
  and coalesce(caracteristicas_detalle->>'Barra', '') !~* 'mes[oó]n';
update public.locales set caracteristicas = array_remove(caracteristicas, 'Barra') where 'Barra' = any (caracteristicas);

-- "Delivery" venía de la pregunta por las apps
update public.locales set
    caracteristicas = array_replace(caracteristicas, 'Delivery', 'Delivery por apps'),
    caracteristicas_detalle = (caracteristicas_detalle - 'Delivery')
        || case when caracteristicas_detalle ? 'Delivery' then jsonb_build_object('Delivery por apps', caracteristicas_detalle->'Delivery') else '{}'::jsonb end
where 'Delivery' = any (caracteristicas);

-- "Delivery propio" para quienes respondieron que sí a "¿Hacen delivery?"
update public.locales l set caracteristicas = array_append(l.caracteristicas, 'Delivery propio')
from public.encuestas_locales e
where e.local_id = l.id and e.respuestas->>'q55' ~* '^\s*s[ií]($|[^a-zñ])' and not ('Delivery propio' = any (l.caracteristicas));

-- Nombres antiguos con el detalle entre paréntesis (la app ya los corregía al cargar)
update public.locales set
    caracteristicas = array_replace(caracteristicas, 'Mascotas (Solo en Terraza)', 'Ingreso de Mascotas'),
    caracteristicas_detalle = caracteristicas_detalle || case when caracteristicas_detalle ? 'Ingreso de Mascotas' then '{}'::jsonb
        else jsonb_build_object('Ingreso de Mascotas', coalesce(caracteristicas_detalle->>'Mascotas (Solo en Terraza)', 'Solo en la terraza')) end
where 'Mascotas (Solo en Terraza)' = any (caracteristicas) and not ('Ingreso de Mascotas' = any (caracteristicas));
update public.locales set
    caracteristicas = array_replace(caracteristicas, 'Apto para Fumadores (Solo en Terraza)', 'Apto para Fumadores'),
    caracteristicas_detalle = caracteristicas_detalle || case when caracteristicas_detalle ? 'Apto para Fumadores' then '{}'::jsonb
        else jsonb_build_object('Apto para Fumadores', coalesce(caracteristicas_detalle->>'Apto para Fumadores (Solo en Terraza)', 'Solo en la terraza')) end
where 'Apto para Fumadores (Solo en Terraza)' = any (caracteristicas) and not ('Apto para Fumadores' = any (caracteristicas));
update public.locales set caracteristicas = array_remove(array_remove(caracteristicas, 'Mascotas (Solo en Terraza)'), 'Apto para Fumadores (Solo en Terraza)')
where caracteristicas && array['Mascotas (Solo en Terraza)', 'Apto para Fumadores (Solo en Terraza)'];

update public.locales set caracteristicas = array_remove(caracteristicas, 'Apto para menores de edad')
where 'Apto para menores de edad' = any (caracteristicas);

-- 6. Detalles: el que quedó a medio escribir en La Cocina de Ramsés y la clave del WiFi de ¡Que Empanadas!
update public.locales set caracteristicas_detalle = caracteristicas_detalle - 'Estacionamiento'
where caracteristicas_detalle->>'Estacionamiento' = 'En';
update public.locales set caracteristicas_detalle = jsonb_set(caracteristicas_detalle, '{WiFi Disponible}', '"Clave: quempanadas"')
where caracteristicas_detalle->>'WiFi Disponible' = 'Quempanadas';

-- Preguntas de características respondidas solo con "Sí": la etiqueta queda, sin detalle (ej. Bicicletero de Carlota)
update public.locales l set caracteristicas_detalle = l.caracteristicas_detalle - array(
    select substr(p.uso, 5) from public.encuesta_preguntas p
    join public.encuestas_locales e on e.local_id = l.id
    where p.uso ~ '^(det|car):' and coalesce(e.respuestas->>p.id, '') ~* '^\s*(s[ií]|x|ok)\s*[.!]?\s*$'
      and substr(p.uso, 5) <> 'Ingreso de Mascotas' and substr(p.uso, 5) <> 'Apto para Fumadores'
)
where exists (select 1 from public.encuestas_locales e where e.local_id = l.id);

-- Detalles de características que el local ya no tiene (o vacíos)
update public.locales l set caracteristicas_detalle = coalesce((
    select jsonb_object_agg(d.key, d.value) from jsonb_each(l.caracteristicas_detalle) d
    where d.key = any (l.caracteristicas) and coalesce(d.value #>> '{}', '') <> ''
), '{}'::jsonb)
where exists (
    select 1 from jsonb_each(l.caracteristicas_detalle) d
    where not (d.key = any (l.caracteristicas)) or coalesce(d.value #>> '{}', '') = ''
);
