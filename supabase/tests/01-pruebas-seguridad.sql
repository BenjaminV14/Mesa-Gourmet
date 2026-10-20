-- Pruebas de las reglas de seguridad. Cada bloque imprime OK o FALLA.
\set ON_ERROR_STOP off
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@mg.cl', '{"nombre":"Benjamín"}'),
  ('22222222-2222-2222-2222-222222222222', 'ana@mg.cl', '{"nombre":"Ana"}'),
  ('33333333-3333-3333-3333-333333333333', 'spam@mg.cl', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'ana@otro.cl', '{"nombre":"Otra Ana"}'),
  ('55555555-5555-5555-5555-555555555555', 'José.Pérez+mg@mg.cl', '{"nombre":"José"}'),
  ('66666666-6666-6666-6666-666666666666', 'yo@mg.cl', '{"nombre":"Yo"}');

-- Hacerse admin desde el SQL Editor (sin sesión de usuario) debe funcionar
update public.perfiles set rol = 'admin' where id = '11111111-1111-1111-1111-111111111111';
select case when rol = 'admin' then 'OK  admin asignado desde SQL Editor' else 'FALLA admin' end from public.perfiles where id = '11111111-1111-1111-1111-111111111111';
select case when nombre = 'spam' then 'OK  perfil creado con nombre del correo' else 'FALLA nombre' end from public.perfiles where id = '33333333-3333-3333-3333-333333333333';

-- @usuario automático desde el correo
select case when username = 'ana' then 'OK  @usuario sale del correo: ana' else 'FALLA username ' || coalesce(username, 'null') end from public.perfiles where id = '22222222-2222-2222-2222-222222222222';
select case when username ~ '^ana[0-9]{4}$' then 'OK  @usuario repetido recibe 4 números: ' || username else 'FALLA username repetido ' || coalesce(username, 'null') end from public.perfiles where id = '44444444-4444-4444-4444-444444444444';
select case when username = 'jose.perezmg' then 'OK  @usuario sin tildes ni símbolos: ' || username else 'FALLA username tildes ' || coalesce(username, 'null') end from public.perfiles where id = '55555555-5555-5555-5555-555555555555';
select case when username ~ '^[a-z0-9._]{3,24}$' then 'OK  @usuario corto se completa: ' || username else 'FALLA username corto ' || coalesce(username, 'null') end from public.perfiles where id = '66666666-6666-6666-6666-666666666666';
select case when preferencias = '{}'::jsonb then 'OK  preferencias parten vacías' else 'FALLA preferencias' end from public.perfiles where id = '22222222-2222-2222-2222-222222222222';

insert into public.locales (nombre, tipo, lat, lng) values
  ('La Carlota', 'Café', -35.43, -71.65),
  ('Rincón Peruano', 'Restaurante', -35.42, -71.66),
  ('Sushi Maule', 'Restaurante', -35.44, -71.67);

-- Datos privados y de catálogo cargados por el admin desde el SQL Editor
insert into public.encuestas_locales (local_id, respuestas) values (1, '{"Nombre del dueño":"Carlota","Teléfono":"+56 9 1234 5678"}');
insert into public.encuesta_preguntas (id, seccion, texto) values ('q1', 'basicos', 'Nombre del local');
insert into public.cierres_mes (mes, distinciones) values ('septiembre 2026', '{"Mejor café": 1}');
-- Reseña publicada de "Otra Ana" en Sushi Maule
insert into public.resenas (id, local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
values ('aaaaaaaa-0000-0000-0000-000000000004', 3, '44444444-4444-4444-4444-444444444444', '{"Roll"}', 8, 8, 'Rico sushi y buena atención', 'publicada');

create function pg_temp.como(uid text, rol text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', rol)::text, false);
end $$;

-- ===== Usuario normal (Ana) =====
set role authenticated;
select pg_temp.como('22222222-2222-2222-2222-222222222222');

do $$ begin
  update public.perfiles set rol = 'admin' where id = '22222222-2222-2222-2222-222222222222';
  raise notice 'FALLA: Ana se hizo admin';
exception when others then raise notice 'OK  Ana no puede hacerse admin (%)', sqlerrm; end $$;

do $$ begin
  update public.perfiles set nombre = 'Ana María' where id = '22222222-2222-2222-2222-222222222222';
  raise notice 'OK  Ana cambia su nombre';
exception when others then raise notice 'FALLA cambiar nombre: %', sqlerrm; end $$;

do $$ declare n int; begin
  update public.perfiles set username = 'ana.maria_92', preferencias = '{"dietas":["vegano"],"notificaciones":true}'
  where id = '22222222-2222-2222-2222-222222222222';
  get diagnostics n = row_count;
  raise notice '% Ana cambia su @usuario y preferencias (filas: %)', case when n = 1 then 'OK ' else 'FALLA' end, n;
exception when others then raise notice 'FALLA cambiar @usuario: %', sqlerrm; end $$;

do $$ begin
  update public.perfiles set username = 'Ana María!' where id = '22222222-2222-2222-2222-222222222222';
  raise notice 'FALLA: @usuario con mayúsculas y símbolos aceptado';
exception when check_violation then raise notice 'OK  @usuario con formato inválido rechazado';
  when others then raise notice 'FALLA @usuario inválido (otro error: %)', sqlerrm; end $$;

do $$ begin
  update public.perfiles set username = 'spam' where id = '22222222-2222-2222-2222-222222222222';
  raise notice 'FALLA: @usuario repetido aceptado';
exception when unique_violation then raise notice 'OK  @usuario repetido rechazado';
  when others then raise notice 'FALLA @usuario repetido (otro error: %)', sqlerrm; end $$;

do $$ declare n int; begin
  update public.perfiles set nombre = 'Hackeado' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  raise notice '% Ana no puede editar el perfil de otro (filas: %)', case when n = 0 then 'OK ' else 'FALLA' end, n;
end $$;

do $$ declare n int; begin
  update public.locales set nombre = 'Hackeado';
  get diagnostics n = row_count;
  raise notice '% Ana no puede editar locales (filas: %)', case when n = 0 then 'OK ' else 'FALLA' end, n;
end $$;

-- Encuesta privada y cierres del mes
select case when count(*) = 0 then 'OK  Ana no ve las respuestas de la encuesta' else 'FALLA Ana ve encuestas' end from public.encuestas_locales;
select case when count(*) = 0 then 'OK  Ana no ve las preguntas de la encuesta' else 'FALLA Ana ve preguntas' end from public.encuesta_preguntas;
do $$ begin
  insert into public.encuestas_locales (local_id, respuestas) values (2, '{}');
  raise notice 'FALLA: Ana escribió una encuesta';
exception when others then raise notice 'OK  Ana no puede escribir encuestas'; end $$;
do $$ begin
  insert into public.cierres_mes (mes, distinciones) values ('octubre 2026', '{}');
  raise notice 'FALLA: Ana cerró el mes';
exception when others then raise notice 'OK  Ana no puede escribir cierres del mes'; end $$;
select case when count(*) = 1 then 'OK  Ana ve los cierres del mes' else 'FALLA cierres visibles' end from public.cierres_mes;

-- Reseñas
do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado, precio_persona, en_promocion)
  values (1, '22222222-2222-2222-2222-222222222222', '{"Café"}', 9, 8, 'Muy buen café de especialidad', 'publicada', '$5.000 – $10.000', true);
  raise notice 'OK  publica reseña con precio por persona';
exception when others then raise notice 'FALLA reseña: %', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (1, '22222222-2222-2222-2222-222222222222', '{"Torta"}', 7, 7, 'Segunda reseña el mismo día', 'publicada');
  raise notice 'FALLA: dos reseñas del mismo local en un día';
exception when others then raise notice 'OK  antispam: %', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado, creado_at)
  values (1, '22222222-2222-2222-2222-222222222222', '{"Torta"}', 7, 7, 'Con fecha falsa para saltarse el límite', 'publicada', now() - interval '1 year');
  raise notice 'FALLA: se saltó el antispam con fecha falsa';
exception when others then raise notice 'OK  antispam no se salta con fecha falsa (%)', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (2, '22222222-2222-2222-2222-222222222222', '{"Ceviche"}', 0.1, 10, 'Nota mínima y máxima permitidas', 'pendiente');
  raise notice 'OK  acepta notas 0,1 y 10 (y estado pendiente)';
exception when others then raise notice 'FALLA nota 0,1: %', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (3, '22222222-2222-2222-2222-222222222222', '{"Roll"}', 0, 8, 'Nota cero no debería entrar', 'publicada');
  raise notice 'FALLA: aceptó nota 0';
exception when check_violation then raise notice 'OK  rechaza nota 0';
  when others then raise notice 'FALLA nota 0 (otro error: %)', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (3, '22222222-2222-2222-2222-222222222222', '{"Roll"}', 8, 10.5, 'Nota sobre diez no debería entrar', 'publicada');
  raise notice 'FALLA: aceptó nota 10,5';
exception when check_violation then raise notice 'OK  rechaza nota 10,5';
  when others then raise notice 'FALLA nota 10,5 (otro error: %)', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (3, '22222222-2222-2222-2222-222222222222', '{"Roll"}', 8, 8, 'Intenta crearla como rechazada', 'rechazada');
  raise notice 'FALLA: creó reseña con estado rechazada';
exception when insufficient_privilege then raise notice 'OK  solo puede crear reseñas publicadas o pendientes';
  when others then raise notice 'FALLA estado rechazada (otro error: %)', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (1, '11111111-1111-1111-1111-111111111111', '{"Café"}', 1, 1, 'Reseña a nombre de otro', 'publicada');
  raise notice 'FALLA: reseña a nombre de otro';
exception when others then raise notice 'OK  no puede reseñar a nombre de otro'; end $$;

select case when nota_mg = 8.5 then 'OK  nota del local recalculada: 8.5' else 'FALLA nota ' || nota_mg end from public.locales where id = 1;

do $$ begin
  insert into public.resena_likes (resena_id, usuario_id) select id, '22222222-2222-2222-2222-222222222222' from public.resenas where local_id = 1;
  raise notice 'OK  like propio';
exception when others then raise notice 'FALLA like: %', sqlerrm; end $$;
do $$ begin
  insert into public.resena_likes (resena_id, usuario_id) select id, '22222222-2222-2222-2222-222222222222' from public.resenas where local_id = 1;
  raise notice 'FALLA: like duplicado';
exception when others then raise notice 'OK  no puede dar like dos veces'; end $$;
select case when likes = 1 then 'OK  contador de likes = 1' else 'FALLA likes ' || likes end from public.resenas where local_id = 1;

-- Fotos de la reseña
do $$ begin
  insert into public.resena_fotos (id, resena_id, usuario_id, plato, path)
  select 'bbbbbbbb-0000-0000-0000-000000000001', id, '22222222-2222-2222-2222-222222222222', 'Café', '22222222-2222-2222-2222-222222222222/cafe.jpg'
  from public.resenas where local_id = 1;
  raise notice 'OK  sube foto sin verificar a su reseña';
exception when others then raise notice 'FALLA subir foto: %', sqlerrm; end $$;

do $$ begin
  insert into public.resena_fotos (resena_id, usuario_id, plato, path, verificada)
  select id, '22222222-2222-2222-2222-222222222222', 'Café', '22222222-2222-2222-2222-222222222222/cafe2.jpg', true
  from public.resenas where local_id = 1;
  raise notice 'FALLA: subió foto ya verificada';
exception when insufficient_privilege then raise notice 'OK  no puede subir una foto marcada como verificada';
  when others then raise notice 'FALLA foto verificada (otro error: %)', sqlerrm; end $$;

do $$ begin
  insert into public.resena_fotos (resena_id, usuario_id, plato, path)
  select id, '22222222-2222-2222-2222-222222222222', 'Café', '11111111-1111-1111-1111-111111111111/cafe.jpg'
  from public.resenas where local_id = 1;
  raise notice 'FALLA: foto apuntando a carpeta ajena';
exception when insufficient_privilege then raise notice 'OK  la foto debe estar en su propia carpeta';
  when others then raise notice 'FALLA carpeta ajena (otro error: %)', sqlerrm; end $$;

do $$ begin
  insert into public.resena_fotos (resena_id, usuario_id, plato, path)
  values ('aaaaaaaa-0000-0000-0000-000000000004', '22222222-2222-2222-2222-222222222222', 'Roll', '22222222-2222-2222-2222-222222222222/roll.jpg');
  raise notice 'FALLA: subió foto a la reseña de otra persona';
exception when insufficient_privilege then raise notice 'OK  no puede subir fotos a la reseña de otro';
  when others then raise notice 'FALLA reseña ajena (otro error: %)', sqlerrm; end $$;

select case when count(*) = 1 then 'OK  Ana ve su foto sin verificar' else 'FALLA Ana fotos ' || count(*) end from public.resena_fotos;

do $$ declare n int; begin
  update public.resena_fotos set verificada = true;
  get diagnostics n = row_count;
  raise notice '% Ana no puede verificar su propia foto (filas: %)', case when n = 0 then 'OK ' else 'FALLA' end, n;
end $$;

-- Videos
do $$ begin
  insert into public.videos (usuario_id, local_id, plataforma, url, estado)
  values ('22222222-2222-2222-2222-222222222222', 1, 'tiktok', 'https://www.tiktok.com/@ana/video/1234567890', 'aprobado');
  raise notice 'FALLA: video autoaprobado';
exception when others then raise notice 'OK  video no se puede autoaprobar'; end $$;
do $$ begin
  insert into public.videos (usuario_id, local_id, plataforma, url)
  values ('22222222-2222-2222-2222-222222222222', 1, 'tiktok', 'https://evil.com/x');
  raise notice 'FALLA: link no válido aceptado';
exception when others then raise notice 'OK  solo links de TikTok/Instagram'; end $$;
do $$ begin
  insert into public.videos (usuario_id, local_id, plataforma)
  values ('22222222-2222-2222-2222-222222222222', 1, 'instagram');
  raise notice 'FALLA: link sin URL aceptado';
exception when check_violation then raise notice 'OK  link de TikTok/Instagram necesita URL';
  when others then raise notice 'FALLA link sin URL (otro error: %)', sqlerrm; end $$;
do $$ begin
  insert into public.videos (usuario_id, local_id, plataforma)
  values ('22222222-2222-2222-2222-222222222222', 1, 'archivo');
  raise notice 'FALLA: video archivo sin archivo_path';
exception when check_violation then raise notice 'OK  video subido necesita archivo';
  when others then raise notice 'FALLA archivo sin ruta (otro error: %)', sqlerrm; end $$;
do $$ begin
  insert into public.videos (usuario_id, local_id, plataforma, archivo_path)
  values ('22222222-2222-2222-2222-222222222222', 1, 'archivo', '11111111-1111-1111-1111-111111111111/v.mp4');
  raise notice 'FALLA: video en carpeta ajena';
exception when check_violation then raise notice 'OK  video subido debe estar en su carpeta';
  when others then raise notice 'FALLA video carpeta ajena (otro error: %)', sqlerrm; end $$;
do $$ begin
  insert into public.videos (usuario_id, local_id, plataforma, archivo_path, portada_path)
  values ('22222222-2222-2222-2222-222222222222', 1, 'archivo', '22222222-2222-2222-2222-222222222222/v.mp4', '22222222-2222-2222-2222-222222222222/portadas/v.jpg');
  raise notice 'OK  sube video propio (queda pendiente)';
exception when others then raise notice 'FALLA video archivo: %', sqlerrm; end $$;

do $$ begin
  insert into public.reportes (usuario_id, local_id, tipo, detalle) values ('22222222-2222-2222-2222-222222222222', 1, 'menu', 'Subió el precio');
  raise notice 'OK  reporte creado';
exception when others then raise notice 'FALLA reporte: %', sqlerrm; end $$;

-- Social
do $$ begin
  insert into public.seguidores (seguidor_id, seguido_id) values ('22222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222');
  raise notice 'FALLA: se siguió a sí misma';
exception when check_violation then raise notice 'OK  no puede seguirse a sí misma';
  when others then raise notice 'FALLA seguirse (otro error: %)', sqlerrm; end $$;
do $$ begin
  insert into public.seguidores (seguidor_id, seguido_id) values ('22222222-2222-2222-2222-222222222222', '44444444-4444-4444-4444-444444444444');
  raise notice 'OK  sigue a otra usuaria';
exception when others then raise notice 'FALLA seguir: %', sqlerrm; end $$;
do $$ begin
  insert into public.seguidores (seguidor_id, seguido_id) values ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111');
  raise notice 'FALLA: hizo seguir a otra persona';
exception when others then raise notice 'OK  no puede seguir a nombre de otro'; end $$;
do $$ begin
  insert into public.quiero_ir (usuario_id, local_id) values ('22222222-2222-2222-2222-222222222222', 2);
  insert into public.guardados (usuario_id, tipo, item_id) values ('22222222-2222-2222-2222-222222222222', 'resena', 'aaaaaaaa-0000-0000-0000-000000000004');
  raise notice 'OK  guarda "quiero ir" y una reseña';
exception when others then raise notice 'FALLA quiero ir / guardados: %', sqlerrm; end $$;

-- Archivos
do $$ begin
  insert into storage.objects (bucket_id, name) values ('fotos-resenas', '11111111-1111-1111-1111-111111111111/x.jpg');
  raise notice 'FALLA: subió foto en carpeta ajena';
exception when others then raise notice 'OK  no puede subir fotos a la carpeta de otro'; end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('fotos-resenas', '22222222-2222-2222-2222-222222222222/x.jpg');
  raise notice 'OK  sube foto a su carpeta';
exception when others then raise notice 'FALLA subir foto: %', sqlerrm; end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('videos', '11111111-1111-1111-1111-111111111111/v.mp4');
  raise notice 'FALLA: subió video en carpeta ajena';
exception when others then raise notice 'OK  no puede subir videos a la carpeta de otro'; end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('videos', '22222222-2222-2222-2222-222222222222/v.mp4');
  raise notice 'OK  sube video a su carpeta';
exception when others then raise notice 'FALLA subir video: %', sqlerrm; end $$;

-- ===== Otra usuaria (antes de que la foto se verifique) =====
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select case when count(*) = 0 then 'OK  otra usuaria no ve la foto sin verificar' else 'FALLA otra ve foto sin verificar' end from public.resena_fotos;
select case when count(*) = 0 then 'OK  otra usuaria no ve los "quiero ir" ni guardados ajenos' else 'FALLA ve listas ajenas' end
  from (select 1 from public.quiero_ir union all select 1 from public.guardados) x;
select case when count(*) = 0 then 'OK  otra usuaria no ve el video pendiente' else 'FALLA ve video pendiente' end from public.videos;

-- ===== Invitado (sin cuenta) =====
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select case when count(*) = 3 then 'OK  invitado ve locales' else 'FALLA invitado locales' end from public.locales;
select case when count(*) = 0 then 'OK  invitado no ve reportes' else 'FALLA invitado ve reportes' end from public.reportes;
select case when count(*) = 0 then 'OK  invitado no ve la foto sin verificar' else 'FALLA invitado ve foto sin verificar' end from public.resena_fotos;
select case when count(*) = 0 then 'OK  invitado no ve la encuesta' else 'FALLA invitado ve encuesta' end from public.encuestas_locales;
select case when count(*) = 1 then 'OK  invitado ve quién sigue a quién' else 'FALLA seguidores' end from public.seguidores;
do $$ begin
  insert into public.resena_likes (resena_id, usuario_id) select id, '22222222-2222-2222-2222-222222222222' from public.resenas limit 1;
  raise notice 'FALLA: invitado dio like';
exception when others then raise notice 'OK  invitado no puede dar like'; end $$;
select case when count(*) = 0 then 'OK  invitado no ve la cartelera de eventos' else 'FALLA eventos' end from public.eventos;

-- ===== Admin =====
reset role;
set role authenticated;
select pg_temp.como('11111111-1111-1111-1111-111111111111');
do $$ begin
  update public.perfiles set bloqueado = true where id = '33333333-3333-3333-3333-333333333333';
  raise notice 'OK  admin bloquea una cuenta';
exception when others then raise notice 'FALLA bloquear: %', sqlerrm; end $$;
select case when count(*) = 1 then 'OK  admin ve los reportes' else 'FALLA admin reportes' end from public.reportes;
do $$ begin
  insert into public.patrocinios (local_id, desde, hasta) values (1, current_date, current_date + 29);
  raise notice 'OK  admin activa destacado';
exception when others then raise notice 'FALLA destacado: %', sqlerrm; end $$;
select case when count(*) = 1 then 'OK  admin ve las respuestas de la encuesta' else 'FALLA admin encuestas' end from public.encuestas_locales;
select case when count(*) = 1 then 'OK  admin ve las preguntas de la encuesta' else 'FALLA admin preguntas' end from public.encuesta_preguntas;
do $$ begin
  insert into public.cierres_mes (mes, distinciones) values ('octubre 2026', '{"Mejor café": 1}');
  raise notice 'OK  admin cierra el mes';
exception when others then raise notice 'FALLA cierre del mes: %', sqlerrm; end $$;
do $$ declare n int; begin
  update public.resena_fotos set verificada = true where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  raise notice '% admin verifica la foto (filas: %)', case when n = 1 then 'OK ' else 'FALLA' end, n;
end $$;

-- ===== Con la foto verificada =====
select pg_temp.como('44444444-4444-4444-4444-444444444444');
select case when count(*) = 1 then 'OK  otra usuaria ve la foto verificada' else 'FALLA no ve foto verificada' end from public.resena_fotos;
do $$ begin
  insert into public.foto_likes (foto_id, usuario_id) values ('bbbbbbbb-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444');
  raise notice 'OK  like a una foto';
exception when others then raise notice 'FALLA like foto: %', sqlerrm; end $$;
do $$ begin
  insert into public.foto_likes (foto_id, usuario_id) values ('bbbbbbbb-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444');
  raise notice 'FALLA: like a foto duplicado';
exception when others then raise notice 'OK  no puede dar like dos veces a la misma foto'; end $$;
do $$ declare n int; begin
  update public.resena_fotos set likes = 999;
  get diagnostics n = row_count;
  raise notice '% otra usuaria no puede inflar los likes de la foto (filas: %)', case when n = 0 then 'OK ' else 'FALLA' end, n;
end $$;
select pg_temp.como('22222222-2222-2222-2222-222222222222');
do $$ begin
  insert into public.foto_likes (foto_id, usuario_id) values ('bbbbbbbb-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222');
exception when others then raise notice 'FALLA like foto Ana: %', sqlerrm; end $$;
select case when likes = 2 then 'OK  contador de likes de la foto = 2' else 'FALLA likes foto ' || likes end from public.resena_fotos where id = 'bbbbbbbb-0000-0000-0000-000000000001';

reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select case when count(*) = 1 then 'OK  invitado ve la foto verificada' else 'FALLA invitado no ve foto verificada' end from public.resena_fotos;

-- ===== Usuario bloqueado =====
reset role;
set role authenticated;
select pg_temp.como('33333333-3333-3333-3333-333333333333');
do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (1, '33333333-3333-3333-3333-333333333333', '{"Café"}', 1, 1, 'Spam spam spam spam', 'publicada');
  raise notice 'FALLA: usuario bloqueado publicó';
exception when others then raise notice 'OK  usuario bloqueado no puede publicar'; end $$;
do $$ begin
  update public.perfiles set bloqueado = false where id = '33333333-3333-3333-3333-333333333333';
  raise notice 'FALLA: se desbloqueó solo';
exception when others then raise notice 'OK  no puede desbloquearse solo'; end $$;
reset role;

-- ===== Notas de 30 días vs. históricas =====
-- Una reseña antigua (hace 60 días) cuenta en la nota histórica pero no en la oficial de 30 días
insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
values (1, '44444444-4444-4444-4444-444444444444', '{"Té"}', 5, 5, 'Reseña de hace dos meses', 'publicada');
update public.resenas set creado_at = now() - interval '60 days' where usuario_id = '44444444-4444-4444-4444-444444444444' and local_id = 1;
select case when total_30d = 8.5 and n_30d = 1 and total_historica = 6.8 and n_historico = 2
            then 'OK  nota oficial 30 días = 8.5, histórica = 6.8'
            else format('FALLA notas_locales 30d=%s (n=%s) hist=%s (n=%s)', total_30d, n_30d, total_historica, n_historico) end
  from public.notas_locales where local_id = 1;
select case when nota_mg = 6.8 then 'OK  nota histórica guardada en el local: 6.8' else 'FALLA nota histórica ' || nota_mg end from public.locales where id = 1;
select case when n_30d = 0 and total_30d is null then 'OK  reseña pendiente no cuenta en la nota' else 'FALLA pendiente cuenta' end from public.notas_locales where local_id = 2;

-- ===== Tiempo real =====
select case when count(*) = 3 then 'OK  reseñas, fotos y videos en tiempo real' else 'FALLA tiempo real (' || count(*) || ' tablas)' end
  from pg_publication_tables where pubname = 'supabase_realtime' and tablename in ('resenas', 'resena_fotos', 'videos');

-- ===== Todas las tablas con RLS =====
select case when count(*) = 0 then 'OK  todas las tablas tienen RLS activado' else 'FALLA tablas sin RLS: ' || string_agg(relname, ', ') end
  from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;
