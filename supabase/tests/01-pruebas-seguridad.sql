-- Pruebas de las reglas de seguridad. Cada bloque imprime OK o FALLA.
\set ON_ERROR_STOP off
insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'admin@mg.cl', '{"nombre":"Benjamín"}'),
  ('22222222-2222-2222-2222-222222222222', 'ana@mg.cl', '{"nombre":"Ana"}'),
  ('33333333-3333-3333-3333-333333333333', 'spam@mg.cl', '{}');

-- Hacerse admin desde el SQL Editor (sin sesión de usuario) debe funcionar
update public.perfiles set rol = 'admin' where id = '11111111-1111-1111-1111-111111111111';
select case when rol = 'admin' then 'OK  admin asignado desde SQL Editor' else 'FALLA admin' end from public.perfiles where id = '11111111-1111-1111-1111-111111111111';
select case when nombre = 'spam' then 'OK  perfil creado con nombre del correo' else 'FALLA nombre' end from public.perfiles where id = '33333333-3333-3333-3333-333333333333';

insert into public.locales (nombre, tipo, lat, lng) values ('La Carlota', 'Café', -35.43, -71.65);

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
  update public.perfiles set nombre = 'Hackeado' where id = '11111111-1111-1111-1111-111111111111';
  get diagnostics n = row_count;
  raise notice '% Ana no puede editar el perfil de otro (filas: %)', case when n = 0 then 'OK ' else 'FALLA' end, n;
end $$;

do $$ declare n int; begin
  update public.locales set nombre = 'Hackeado';
  get diagnostics n = row_count;
  raise notice '% Ana no puede editar locales (filas: %)', case when n = 0 then 'OK ' else 'FALLA' end, n;
end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado, foto_path)
  values (1, '22222222-2222-2222-2222-222222222222', '{"Café"}', 9, 9, 'Muy buen café de especialidad', 'publicada', '2222/foto.jpg');
  raise notice 'FALLA: publicó con foto sin verificar';
exception when others then raise notice 'OK  no puede publicar con foto saltándose la IA'; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (1, '22222222-2222-2222-2222-222222222222', '{"Café"}', 9, 8, 'Muy buen café de especialidad', 'publicada');
  raise notice 'OK  publica reseña sin foto';
exception when others then raise notice 'FALLA reseña sin foto: %', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (1, '22222222-2222-2222-2222-222222222222', '{"Torta"}', 7, 7, 'Segunda reseña el mismo día', 'publicada');
  raise notice 'FALLA: dos reseñas del mismo local en un día';
exception when others then raise notice 'OK  antispam: %', sqlerrm; end $$;

do $$ begin
  insert into public.resenas (local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado)
  values (1, '11111111-1111-1111-1111-111111111111', '{"Café"}', 1, 1, 'Reseña a nombre de otro', 'publicada');
  raise notice 'FALLA: reseña a nombre de otro';
exception when others then raise notice 'OK  no puede reseñar a nombre de otro'; end $$;

select case when nota_mg = 8.5 then 'OK  nota del local recalculada: 8.5' else 'FALLA nota ' || nota_mg end from public.locales where id = 1;

do $$ begin
  insert into public.resena_likes (resena_id, usuario_id) select id, '22222222-2222-2222-2222-222222222222' from public.resenas limit 1;
  raise notice 'OK  like propio';
exception when others then raise notice 'FALLA like: %', sqlerrm; end $$;
do $$ begin
  insert into public.resena_likes (resena_id, usuario_id) select id, '22222222-2222-2222-2222-222222222222' from public.resenas limit 1;
  raise notice 'FALLA: like duplicado';
exception when others then raise notice 'OK  no puede dar like dos veces'; end $$;
select case when likes = 1 then 'OK  contador de likes = 1' else 'FALLA likes ' || likes end from public.resenas limit 1;

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
  insert into public.reportes (usuario_id, local_id, tipo, detalle) values ('22222222-2222-2222-2222-222222222222', 1, 'menu', 'Subió el precio');
  raise notice 'OK  reporte creado';
exception when others then raise notice 'FALLA reporte: %', sqlerrm; end $$;

do $$ begin
  insert into storage.objects (bucket_id, name) values ('fotos-resenas', '11111111-1111-1111-1111-111111111111/x.jpg');
  raise notice 'FALLA: subió foto en carpeta ajena';
exception when others then raise notice 'OK  no puede subir fotos a la carpeta de otro'; end $$;
do $$ begin
  insert into storage.objects (bucket_id, name) values ('fotos-resenas', '22222222-2222-2222-2222-222222222222/x.jpg');
  raise notice 'OK  sube foto a su carpeta';
exception when others then raise notice 'FALLA subir foto: %', sqlerrm; end $$;

-- ===== Invitado (sin cuenta) =====
reset role;
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
select case when count(*) = 1 then 'OK  invitado ve locales' else 'FALLA invitado locales' end from public.locales;
select case when count(*) = 0 then 'OK  invitado no ve reportes' else 'FALLA invitado ve reportes' end from public.reportes;
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

-- ===== Usuario bloqueado =====
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
