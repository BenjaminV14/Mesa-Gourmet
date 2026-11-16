-- =====================================================================
-- Mesa Gourmet · Actualización 6 (ejecutar UNA vez, después de actualizacion-5.sql)
-- Supabase > SQL Editor > New query > pegar todo > Run
--
-- Etiquetas para niños y preguntas repetidas:
--  1. "¿Tienen algo para niños?" se separa en tres preguntas de Sí o No, cada una con su etiqueta:
--     Silla de bebé, Juegos para niños y Menú infantil
--  2. Se borran dos preguntas agregadas a mano que repetían otras del banco (no tenían respuestas):
--     "¿Tienen sillas para niños?" (ahora es la pregunta de la silla de bebé) y
--     "¿Quieren recibir la lista mensual de sus clientes?" (ya está la que activa el correo mensual)
-- =====================================================================

-- 2. Preguntas repetidas (sus respuestas, si alguna hubiera, pasan a la pregunta equivalente)
update public.encuestas_locales set respuestas = (respuestas - 'qmwbs0aaz') || jsonb_build_object('q69', respuestas->'qmwbs0aaz')
where respuestas ? 'qmwbs0aaz' and coalesce(respuestas->>'q69', '') = '';
update public.encuestas_locales set respuestas = (respuestas - 'qmwbsa4ie') || jsonb_build_object('q73', respuestas->'qmwbsa4ie')
where respuestas ? 'qmwbsa4ie' and coalesce(respuestas->>'q73', '') = '';
update public.encuestas_locales set respuestas = respuestas - 'qmwbs0aaz' - 'qmwbsa4ie'
where respuestas ?| array['qmwbs0aaz', 'qmwbsa4ie'];
delete from public.encuesta_preguntas where id in ('qmwbs0aaz', 'qmwbsa4ie');

-- 1. Banco de preguntas (mismo orden que el panel)
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
    ('q69', 'infra', '¿Tienen sillas de bebé o sillas altas para niños?', 'car:Silla de bebé', 'Basta Sí o No', 54),
    ('q79', 'infra', '¿Tienen juegos o una zona para niños?', 'car:Juegos para niños', 'Basta Sí o No', 55),
    ('q80', 'infra', '¿Tienen menú infantil?', 'car:Menú infantil', 'Basta Sí o No', 56),
    ('q68', 'infra', '¿Tienen música en vivo o shows? ¿Qué días?', 'det:Música en vivo', null, 57),
    ('q66', 'infra', '¿Tienen cámaras de seguridad o guardia?', 'car:Seguridad Completa', null, 58),
    ('q33', 'infra', '¿El local tiene alguna temática o estilo de decoración?', 'tematica', null, 59),
    ('q30', 'infra', '¿Para cuántas personas hay capacidad? (sillas y mesas)', 'interno', 'Solo para ti, no sale en la app', 60),
    ('q73', 'relacion', '¿Quieren recibir cada mes, por correo, la lista de sus mejores clientes de la app (Top 50)?', 'top50:recibe', 'Es gratis y opcional. Solo incluye a clientes que aceptaron compartir su nombre; deben usarla solo para ofrecerles un beneficio y borrarla al mes', 61),
    ('q75', 'relacion', '¿Qué beneficio le darían a su Top 50?', 'beneficioTop50', 'Ej: 10% de descuento mostrando el código MESAGOURMET. Lo ven los clientes en su perfil', 62),
    ('q76', 'relacion', '¿Les interesa aparecer destacados en la app (plan de patrocinio)?', 'interno', 'Incluye estadísticas mensuales de cuánta gente llegó al local por la app', 63),
    ('q62', 'relacion', 'La casa invita', 'interno', null, 64),
    ('q61', 'relacion', 'Compromisos', 'interno', null, 65),
    ('q36', 'relacion', '¿Hacen sorteos?', 'interno', null, 66),
    ('q37', 'relacion', '¿Qué hacen en fechas especiales?', 'interno', 'Día de la Madre, Fiestas Patrias, San Valentín…', 67),
    ('q38', 'relacion', '¿Tienen alguna iniciativa social o ambiental?', 'interno', null, 68),
    ('q39', 'relacion', '¿Tienen socios o alianzas estratégicas?', 'interno', null, 69),
    ('q41', 'relacion', '¿El local está preparado para atender a personas con discapacidad visual, auditiva o cognitiva?', 'interno', null, 70),
    ('q65', 'relacion', '¿Tienen atención preferente o algún protocolo para embarazadas?', 'interno', null, 71),
    ('q53', 'empresa', 'Nombre del dueño', 'interno', null, 72),
    ('q54', 'empresa', '¿Tienen otro negocio de comida?', 'interno', null, 73),
    ('q52', 'empresa', '¿Cuántos trabajadores tienen?', 'interno', null, 74),
    ('q40', 'empresa', '¿Buscan personal seguido o para reemplazos?', 'interno', null, 75),
    ('q59', 'empresa', 'Proyectos de la empresa', 'interno', null, 76),
    ('q60', 'empresa', 'Necesidades', 'interno', null, 77)
on conflict (id) do update set seccion = excluded.seccion, texto = excluded.texto, uso = excluded.uso,
    sugerencia = excluded.sugerencia, orden = excluded.orden;

-- La etiqueta antigua "Espacio para niños" pasa a "Juegos para niños"
update public.locales set
    caracteristicas = array_replace(caracteristicas, 'Espacio para niños', 'Juegos para niños'),
    caracteristicas_detalle = (caracteristicas_detalle - 'Espacio para niños')
        || case when caracteristicas_detalle ? 'Espacio para niños' then jsonb_build_object('Juegos para niños', caracteristicas_detalle->'Espacio para niños') else '{}'::jsonb end
where 'Espacio para niños' = any (caracteristicas);
