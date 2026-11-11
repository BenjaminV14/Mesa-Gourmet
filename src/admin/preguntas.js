// Banco de preguntas de la encuesta a los dueños de locales.
// - texto: la pregunta tal como se la haces al dueño
// - sugerencia: cómo anotar la respuesta o qué aclarar (se ve debajo de la pregunta)
// - seccion: grupo (los colores de tu planilla)
// - uso: a qué dato de la app va la respuesta, o 'interno' si es solo para ti
// Se puede editar todo desde el panel (Encuesta > Preguntas).
//
// Los ids son fijos: las respuestas de cada local se guardan por id, así que una pregunta
// puede cambiar de texto o de lugar sin perder lo que ya respondieron.
// Si cambias este archivo, actualiza también la tabla encuesta_preguntas (ver supabase/actualizacion-5.sql).

export const SECCIONES = {
    basicos: { nombre: 'Datos básicos', color: '#8b2635' },
    contacto: { nombre: 'Contacto', color: '#9ccc7c' },
    oferta: { nombre: 'Oferta y atención', color: '#e8a07a' },
    infra: { nombre: 'Infraestructura', color: '#a8a5a5' },
    relacion: { nombre: 'Relación con Mesa Gourmet', color: '#f2d27a' },
    empresa: { nombre: 'Empresa (solo para ti)', color: '#bcd7ec' },
    documentos: { nombre: 'Documentos', color: '#8fb3df' },
    otros: { nombre: 'Otros', color: '#d9d9d9' }
};

const p = (id, seccion, texto, uso, sugerencia = '') => ({ id, seccion, texto, uso, sugerencia });

export const DEFAULT_PREGUNTAS = [
    // ---------- Datos básicos ----------
    p('q1', 'basicos', 'Nombre del local', 'nombre'),
    p('q6', 'basicos', '¿Qué tipo de local es y qué tipo de comida tiene?', 'tipo', 'Restaurante, cafetería, picada, comida rápida, bar… y el estilo (peruana, venezolana, sushi…)'),
    p('q2', 'basicos', 'Dirección exacta', 'direccion', 'Calle, número y sector'),
    p('q34', 'basicos', '¿Qué punto de referencia conocido hay cerca?', 'referencia', 'Ej: frente a la Plaza de Armas'),
    p('q26', 'basicos', '¿Hay alguna dificultad o recomendación para llegar o entrar al local?', 'notaAcceso', 'Escaleras, calle cerrada, entrada por el costado… Si no hay, deja en blanco'),
    p('q3', 'basicos', '¿Tienen un slogan o frase que represente al local?', 'slogan'),
    p('q51', 'basicos', '¿Cuál es el horario de atención de cada día?', 'horario', 'Ej: lunes a viernes 12:00 a 23:00, sábado 13:00 a 01:00, domingo cerrado'),
    p('q21', 'basicos', '¿Atienden en feriados? ¿En qué horario?', 'horarioFeriados'),
    p('q50', 'basicos', '¿Tienen carta digital? ¿Cuál es el link?', 'cartaUrl', 'Si solo tienen carta física, pídele una foto o PDF y cárgala en "Cartas"'),

    // ---------- Contacto ----------
    p('q43', 'contacto', 'Teléfono del local', 'telefono', 'El que se muestra en la app'),
    p('q44', 'contacto', 'WhatsApp del local', 'whatsapp', 'Para reservas y consultas desde la app'),
    p('q45', 'contacto', 'Instagram', 'instagram'),
    p('q46', 'contacto', 'TikTok', 'tiktok'),
    p('q47', 'contacto', 'Facebook', 'facebook'),
    p('q49', 'contacto', 'Sitio web', 'website'),
    p('q48', 'contacto', 'Correo del local', 'correoLocal', 'Para avisos de Mesa Gourmet y la lista mensual (si la quieren). No se muestra en la app'),
    p('q42', 'contacto', 'Celular del dueño o administrador', 'interno', 'Solo para ti'),

    // ---------- Oferta y atención ----------
    p('q57', 'oferta', '¿Se puede comer en el local, o es solo para llevar?', 'car:Consumo en el local'),
    p('q56', 'oferta', '¿Se puede pedir para llevar o retirar en el local?', 'det:Pedidos para llevar'),
    p('q55', 'oferta', '¿Tienen delivery propio, con repartidores del mismo local?', 'det:Delivery propio', 'Basta Sí o No. Si quieres, anota hasta dónde reparten o cuánto cuesta'),
    p('q7', 'oferta', '¿Están en apps de delivery? ¿En cuáles?', 'det:Delivery por apps', 'PedidosYa, Uber Eats, Rappi… Basta Sí o No, o los nombres'),
    p('q20', 'oferta', '¿Se puede reservar mesa? ¿A qué teléfono o WhatsApp?', 'det:Acepta reservas'),
    p('q22', 'oferta', '¿Se puede arrendar el local, o un sector, para eventos?', 'det:Arriendo para eventos', 'Si dicen sí, anota para cuántas personas (opcional)'),
    p('q11', 'oferta', '¿Venden alcohol?', 'det:Venta de Alcohol', 'Si quieres, anota qué: cerveza, vino, tragos…'),
    p('q77', 'oferta', '¿El local es solo para mayores de 18?', 'car:Solo mayores de 18', 'Pregúntalo solo en bares, pubs o discotecas. En restaurantes y cafés marca No sin preguntar'),
    p('q24', 'oferta', '¿Qué medios de pago aceptan?', 'mediosPago', 'Efectivo, débito, crédito, transferencia'),
    p('q23', 'oferta', '¿Aceptan JUNAEB, Edenred u otras tarjetas de alimentación? ¿Con tarjeta, QR o app?', 'det:Acepta Edenred / BAES'),
    p('q67', 'oferta', '¿Tienen descuentos con alguna tarjeta o banco? ¿Cuáles, qué días y cuánto?', 'interno', 'Regístralos en "Eventos y promos > Descuentos con tarjetas" para que salgan en la app'),
    p('q4', 'oferta', '¿Qué platos son vegetarianos?', 'interno', 'La app los detecta sola al subir la carta; esto sirve para confirmar'),
    p('q5', 'oferta', '¿Qué platos son veganos?', 'interno', 'Sirve para confirmar lo que detecta la carta'),
    p('q13', 'oferta', '¿Qué productos son sin lactosa?', 'interno', 'Sirve para confirmar lo que detecta la carta'),
    p('q14', 'oferta', '¿Qué productos son sin gluten?', 'interno', 'Para celíacos. Sirve para confirmar lo que detecta la carta'),
    p('q78', 'oferta', '¿Toman medidas para que los productos sin gluten no se contaminen con gluten?', 'celiacoSeguro', 'Utensilios, superficies y aceite separados. Si dicen que no o no saben, la app no mostrará productos sin gluten de este local'),
    p('q18', 'oferta', '¿Tienen carta física o con QR en las mesas?', 'interno'),
    p('q19', 'oferta', '¿Tienen tarjetas de presentación del local?', 'interno'),
    p('q10', 'oferta', '¿En qué horario hay más gente?', 'horasPeak'),
    p('q12', 'oferta', '¿Qué días tienen más público?', 'diasPeak'),
    p('q71', 'oferta', '¿Cuánto gasta en promedio una persona?', 'interno', 'Precio promedio por persona. Solo para ti'),
    p('q9', 'oferta', '¿Qué tipo de público va al local?', 'interno', 'Familias, estudiantes, parejas, after office… Solo para ti, no sale en la app'),
    p('q63', 'oferta', '¿Participan en eventos con su propio personal o con otro?', 'interno'),
    p('q64', 'oferta', 'En eventos (fondas, ferias), ¿suelen unirse a un puesto?', 'interno'),

    // ---------- Infraestructura ----------
    p('q35', 'infra', '¿Tienen baño para el público?', 'det:Baño / WC'),
    p('q15', 'infra', '¿Tienen WiFi para el público? ¿Cuál es la clave?', 'det:WiFi Disponible', 'Anota la clave tal cual, respetando mayúsculas y minúsculas. Se muestra en la app'),
    p('q58', 'infra', '¿Tienen terraza?', 'det:Terraza'),
    p('q16', 'infra', '¿Aceptan mascotas? ¿En todo el local o solo en la terraza?', 'car:Ingreso de Mascotas'),
    p('q17', 'infra', '¿Tienen zona para fumadores? ¿Dónde?', 'car:Apto para Fumadores'),
    p('q28', 'infra', '¿Tienen estacionamiento?', 'det:Estacionamiento', 'Basta Sí o No. Si quieres, agrega dónde: propio, en la calle, parquímetro…'),
    p('q32', 'infra', '¿Tienen bicicletero o lugar para dejar bicicletas?', 'det:Bicicletero'),
    p('q27', 'infra', '¿Tienen acceso para personas en silla de ruedas o con movilidad reducida?', 'det:Acceso Discapacitados'),
    p('q29', 'infra', '¿Tienen segundo piso para el público?', 'car:Segundo piso'),
    p('q31', 'infra', '¿Tienen barra de tragos?', 'det:Barra de tragos', 'Una barra para pedir y tomar algo. Un mesón para pagar no cuenta'),
    p('q25', 'infra', '¿Tienen aire acondicionado o ventilación?', 'car:Aire Acondicionado / Ventilación'),
    p('q72', 'infra', '¿Tienen calefacción?', 'det:Calefacción'),
    p('q70', 'infra', '¿Hay enchufes para cargar el celular o el computador?', 'car:Enchufes para cargar'),
    p('q69', 'infra', '¿Tienen algo para niños? (silla de bebé, juegos, menú infantil)', 'det:Espacio para niños'),
    p('q68', 'infra', '¿Tienen música en vivo o shows? ¿Qué días?', 'det:Música en vivo'),
    p('q66', 'infra', '¿Tienen cámaras de seguridad o guardia?', 'car:Seguridad Completa'),
    p('q33', 'infra', '¿El local tiene alguna temática o estilo de decoración?', 'tematica'),
    p('q30', 'infra', '¿Para cuántas personas hay capacidad? (sillas y mesas)', 'interno', 'Solo para ti, no sale en la app'),

    // ---------- Relación con Mesa Gourmet ----------
    p('q73', 'relacion', '¿Quieren recibir cada mes, por correo, la lista de sus mejores clientes de la app (Top 50)?', 'top50:recibe', 'Es gratis y opcional. Solo incluye a clientes que aceptaron compartir su nombre; deben usarla solo para ofrecerles un beneficio y borrarla al mes'),
    p('q75', 'relacion', '¿Qué beneficio le darían a su Top 50?', 'beneficioTop50', 'Ej: 10% de descuento mostrando el código MESAGOURMET. Lo ven los clientes en su perfil'),
    p('q76', 'relacion', '¿Les interesa aparecer destacados en la app (plan de patrocinio)?', 'interno', 'Incluye estadísticas mensuales de cuánta gente llegó al local por la app'),
    p('q62', 'relacion', 'La casa invita', 'interno'),
    p('q61', 'relacion', 'Compromisos', 'interno'),
    p('q36', 'relacion', '¿Hacen sorteos?', 'interno'),
    p('q37', 'relacion', '¿Qué hacen en fechas especiales?', 'interno', 'Día de la Madre, Fiestas Patrias, San Valentín…'),
    p('q38', 'relacion', '¿Tienen alguna iniciativa social o ambiental?', 'interno'),
    p('q39', 'relacion', '¿Tienen socios o alianzas estratégicas?', 'interno'),
    p('q41', 'relacion', '¿El local está preparado para atender a personas con discapacidad visual, auditiva o cognitiva?', 'interno'),
    p('q65', 'relacion', '¿Tienen atención preferente o algún protocolo para embarazadas?', 'interno'),

    // ---------- Empresa (solo para ti) ----------
    p('q53', 'empresa', 'Nombre del dueño', 'interno'),
    p('q54', 'empresa', '¿Tienen otro negocio de comida?', 'interno'),
    p('q52', 'empresa', '¿Cuántos trabajadores tienen?', 'interno'),
    p('q40', 'empresa', '¿Buscan personal seguido o para reemplazos?', 'interno'),
    p('q59', 'empresa', 'Proyectos de la empresa', 'interno'),
    p('q60', 'empresa', 'Necesidades', 'interno')
];
