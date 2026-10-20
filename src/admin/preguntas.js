// Banco de preguntas de la encuesta a los dueños de locales.
// - texto: la pregunta tal como la usas hoy
// - sugerencia: redacción propuesta (más clara o que pide el dato que usa la app)
// - seccion: grupo (los colores de tu planilla)
// - uso: a qué dato de la app va la respuesta, o 'interno' si es solo para ti
// Se puede editar todo desde el panel (Encuesta > Preguntas).

export const SECCIONES = {
    basicos: { nombre: 'Datos básicos', color: '#8b2635' },
    oferta: { nombre: 'Oferta y atención', color: '#e8a07a' },
    infra: { nombre: 'Infraestructura', color: '#a8a5a5' },
    relacion: { nombre: 'Relación con Mesa Gourmet', color: '#f2d27a' },
    contacto: { nombre: 'Contacto', color: '#9ccc7c' },
    documentos: { nombre: 'Documentos', color: '#8fb3df' },
    empresa: { nombre: 'Empresa', color: '#bcd7ec' },
    otros: { nombre: 'Otros', color: '#d9d9d9' }
};

let n = 0;
const p = (seccion, texto, uso, sugerencia = '') => ({ id: `q${++n}`, seccion, texto, uso, sugerencia });

export const DEFAULT_PREGUNTAS = [
    // Faltaban en la lista original y la app los necesita
    p('basicos', 'Nombre del local', 'nombre'),
    p('basicos', 'Dirección', 'direccion', 'Dirección exacta (calle, número y sector)'),
    p('basicos', 'Slogan o frase del local', 'slogan', '¿Tienen un slogan, refrán o frase que represente al local?'),

    p('oferta', '¿Tienen opción vegetariana? / ¿Tienen alguna comida que se pueda considerar vegetariana?', 'dietaN:vegetariano', '¿Cuántos platos vegetarianos tienen? ¿Cuáles?'),
    p('oferta', '¿Tienen opción vegana? / ¿Tienen alguna comida que se pueda considerar vegana?', 'dietaN:vegano', '¿Cuántos platos veganos tienen? ¿Cuáles?'),
    p('oferta', '¿Qué tipo de local maneja específicamente?', 'tipo', '¿Qué tipo de local es? (restaurante, cafetería, picada, comida rápida, bar…) ¿Qué tipo de comida?'),
    p('oferta', '¿Está trabajando con alguna empresa de delivery?, ¿Cuál?', 'det:Delivery', '¿Trabajan con apps de delivery? ¿Cuáles? (PedidosYa, Uber Eats, Rappi, propio)'),
    p('oferta', '¿Pueden ingresar menores de 18 años?', 'car:Apto para menores de edad'),
    p('oferta', '¿Cómo describiría el tipo de público que se concentra en el local?', 'ambiente', '¿Cómo describiría el ambiente y el público del local? (familiar, estudiantes, parejas, after office…)'),
    p('oferta', '¿Cuáles son las horas pick de afluencia de público?', 'horasPeak', '¿En qué horario hay más gente? (horas peak)'),
    p('oferta', '¿Venden alcohol?', 'car:Venta de Alcohol'),
    p('oferta', '¿Qué días son los que reciben mayor cantidad de público?', 'diasPeak', '¿Qué días tienen más público?'),
    p('oferta', '¿Tienen productos sin lactosa?', 'dietaN:sinLactosa', '¿Cuántos productos sin lactosa tienen? ¿Cuáles?'),
    p('oferta', '¿Tienen productos para celiacos?', 'dietaN:sinGluten', '¿Cuántos productos sin gluten (aptos para celíacos) tienen? ¿Cuáles?'),
    p('oferta', '¿Tienen wifi disponible para el público?', 'det:WiFi Disponible', '¿Tienen WiFi para el público? ¿Cuál es la clave? (se mostrará en la app)'),
    p('oferta', '¿Pueden ingresar con mascotas? / ¿en la terraza?', 'car:Mascotas (Solo en Terraza)', '¿Aceptan mascotas? ¿En todo el local o solo en la terraza?'),
    p('oferta', '¿Sitio apto para fumadores? / ¿en algún lugar?', 'car:Apto para Fumadores (Solo en Terraza)', '¿Tienen zona para fumadores? ¿Dónde? (terraza, patio…)'),
    p('oferta', '¿Tienen carta para público?', 'interno', '¿Tienen carta física o digital (QR) para el público?'),
    p('oferta', '¿Tienen tarjeta de contacto?', 'interno'),
    p('oferta', '¿Se puede reservar alguna mesa? / ¿Algún telefono para esto?', 'det:Acepta reservas', '¿Se puede reservar mesa? ¿A qué teléfono o WhatsApp?'),
    p('oferta', '¿Atienden en festividades/feriados? / ¿Desde que horario?', 'horarioFeriados', '¿Atienden en feriados? ¿En qué horario?'),
    p('oferta', '¿Reserva para fechas especiales? / ¿Se puede reservar el local?', 'car:Arriendo para eventos', '¿Se puede arrendar o reservar el local completo para eventos?'),
    p('oferta', '¿Aceptan JUNAEB? / ¿Tarjeta, Codigo QR o Aplicación?', 'det:Acepta Edenred / BAES', '¿Aceptan JUNAEB, Edenred u otras tarjetas de alimentación? ¿Con tarjeta, código QR o app?'),
    p('oferta', '¿Qué tipos de medios de pago manejan?', 'mediosPago', '¿Qué medios de pago aceptan? (efectivo, débito, crédito, transferencia)'),
    p('oferta', '¿Tienen aire acondicionado?', 'car:Aire Acondicionado / Ventilación'),
    p('oferta', '¿Alguna restricción para ingresar/llegar al local?', 'notaAcceso', '¿Hay alguna dificultad o recomendación para llegar o entrar al local? (escaleras, calle cerrada…)'),

    p('infra', '¿Tienen acceso a personas minuválidas?', 'car:Acceso Discapacitados', '¿Tienen acceso para personas con movilidad reducida o en silla de ruedas?'),
    p('infra', '¿Tienen estacionamiento o lugar para estacionar?', 'det:Estacionamiento', '¿Tienen estacionamiento? ¿Propio o en la calle?'),
    p('infra', '¿Cuentan con segundo piso disponible para el público?', 'car:Segundo piso'),
    p('infra', '¿Cúal es la capacidad del local en sillas/mesas?', 'capacidad', '¿Para cuántas personas hay capacidad? (sillas y mesas)'),
    p('infra', '¿Tienen barra?', 'car:Barra'),
    p('infra', '¿Tienen para dejar bicicleta?', 'car:Bicicletero', '¿Tienen bicicletero o lugar para dejar bicicletas?'),
    p('infra', '¿Hay alguna temática de decoración?', 'tematica', '¿El local tiene alguna temática o estilo de decoración?'),
    p('infra', '¿Hay algún punto de referencia conocido por el sector?', 'referencia', '¿Qué punto de referencia conocido hay cerca? (ej: frente a la plaza)'),
    p('infra', '¿Tienen baño disponible para el público?', 'car:Baño / WC'),

    p('relacion', '¿Realizan sorteos?', 'interno'),
    p('relacion', '¿Qué hacen para fechas especiales?', 'interno', '¿Qué hacen en fechas especiales? (Día de la madre, Fiestas Patrias, San Valentín…)'),
    p('relacion', '¿Tienen algún aporte a la sociedad?', 'interno', '¿Tienen alguna iniciativa social o ambiental?'),
    p('relacion', '¿Tienen socios estrategicos?', 'interno', '¿Tienen socios o alianzas estratégicas?'),
    p('relacion', '¿Busca personal recurrentemente o para reemplazo de algunos días?', 'interno'),
    p('relacion', '¿Es un buen ambiente para personas con capacidades diferentes?', 'interno', '¿El local está preparado para atender a personas con discapacidad (visual, auditiva, cognitiva)?'),

    p('contacto', 'Celular administrador o jefe', 'interno'),
    p('contacto', 'Telefono/celular local', 'telefono', 'Teléfono del local (público)'),
    p('contacto', 'Whattsapp local', 'whatsapp', 'WhatsApp del local (para reservas desde la app)'),
    p('contacto', 'Instagram', 'instagram'),
    p('contacto', 'Tiktok', 'tiktok'),
    p('contacto', 'Facebook', 'facebook'),
    p('contacto', 'Correo', 'interno'),
    p('contacto', 'Sitio Web', 'website'),

    p('documentos', '001 MENÚ / CADA VEZ QUE LO ACTUALICEN', 'interno', 'Carta con precios (pídela en foto o PDF y cárgala en "Cartas")'),
    p('documentos', '003 HORARIOS', 'horario', 'Horario de atención por día (ej: lunes a viernes 12:00 a 23:00, domingo cerrado)'),
    p('documentos', '005 NÚMERO DE TRABAJADORES', 'interno'),

    p('empresa', 'Nombre del Dueño', 'interno'),
    p('empresa', '¿Manejan otro negocio de comida?', 'interno'),
    p('oferta', '¿Hacen delivery?', 'car:Delivery', 'Se puede unir con "¿Trabajan con apps de delivery?"'),
    p('oferta', '¿Se pueden realizar pedidos?', 'car:Pedidos para llevar', '¿Se puede pedir para llevar o retirar en el local?'),
    p('empresa', '¿Se puede ingresar al local?', 'car:Consumo en el local', '¿Se puede comer en el local o es solo para llevar?'),
    p('empresa', '¿Cuentan con terraza?', 'car:Terraza'),
    p('empresa', 'PROYECTOS DE LA EMPRESA', 'interno'),
    p('empresa', 'NECESIDADES', 'interno'),
    p('contacto', 'Compromisos', 'interno'),
    p('contacto', 'La casa invita', 'interno'),
    p('oferta', '¿Participan en algún tipo de evento con su propio personal o uno diferente?', 'interno'),
    p('oferta', 'En eventos (fondas, ferias), ¿suelen unirse a un puesto?', 'interno'),
    p('otros', 'Protocolo embarazadas', 'interno', '¿Tienen atención preferente o algún protocolo para embarazadas?'),
    p('otros', '¿Tienen camaras de seguridad o guardia?', 'car:Seguridad Completa', '¿Tienen cámaras de seguridad o guardia?')
];
