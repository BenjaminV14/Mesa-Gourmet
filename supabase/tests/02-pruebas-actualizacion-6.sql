-- Pruebas de actualizacion-6.sql (fecha de fotos, revisión de comentarios y métricas sin inflar). Imprime OK o FALLA.
\set ON_ERROR_STOP off
insert into auth.users (id, email, raw_user_meta_data) values
  ('77777777-7777-7777-7777-777777777777', 'pepa@mg.cl', '{"nombre":"Pepa"}') on conflict do nothing;
create function pg_temp.como(uid text, rol text default 'authenticated') returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', rol)::text, false);
end $$;

-- ===== Métricas (como visitante sin cuenta) =====
set role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', false);
do $$ begin
  for i in 1..5 loop
    insert into public.metricas_locales (local_id, tipo, visitante) values (1, 'vista', 'visitante-a');
  end loop;
  insert into public.metricas_locales (local_id, tipo, visitante) values (1, 'whatsapp', 'visitante-a');
  insert into public.metricas_locales (local_id, tipo, visitante) values (1, 'vista', 'visitante-b');
  raise notice 'OK  el visitante registra métricas sin error';
exception when others then raise notice 'FALLA registrar métricas: %', sqlerrm; end $$;
reset role;
do $$ declare n int; begin
  select count(*) into n from public.metricas_locales where local_id = 1;
  raise notice '% 5 vistas repetidas cuentan 1 (+1 WhatsApp +1 otro visitante = 3): %', case when n = 3 then 'OK ' else 'FALLA' end, n;
end $$;
set role anon;
do $$ begin
  for i in 1..100 loop
    insert into public.metricas_locales (local_id, tipo, visitante) values (2, 'vista', 'bot-' || i);
  end loop;
end $$;
reset role;
do $$ declare n int; begin
  select count(*) into n from public.metricas_locales where local_id = 2;
  raise notice '% 100 visitas de un programa en 1 minuto quedan en 60: %', case when n = 60 then 'OK ' else 'FALLA' end, n;
end $$;

-- ===== Reseñas y fotos (Pepa) =====
set role authenticated;
select pg_temp.como('77777777-7777-7777-7777-777777777777');
do $$ begin
  insert into public.resenas (id, local_id, usuario_id, productos, nota_comida, nota_servicio, comentario, estado, motivo_revision, comentario_revisado)
  values ('bbbbbbbb-0000-0000-0000-000000000001', 1, '77777777-7777-7777-7777-777777777777', '{"Ceviche"}', 9, 9, 'Muy rico todo, volveré', 'pendiente', 'Fotos sin fecha', true);
  raise notice 'OK  Pepa publica su reseña';
exception when others then raise notice 'FALLA publicar reseña: %', sqlerrm; end $$;
reset role;
do $$ declare v boolean; begin
  select comentario_revisado into v from public.resenas where id = 'bbbbbbbb-0000-0000-0000-000000000001';
  raise notice '% Pepa no puede marcar su comentario como revisado (queda: %)', case when v = false then 'OK ' else 'FALLA' end, v;
end $$;
set role authenticated;
select pg_temp.como('77777777-7777-7777-7777-777777777777');
do $$ begin
  insert into public.resena_fotos (resena_id, usuario_id, plato, path, tomada_at)
  values ('bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'Ceviche', '77777777-7777-7777-7777-777777777777/b/1.jpg', now() - interval '10 days');
  raise notice 'FALLA se aceptó una foto de hace 10 días';
exception when others then raise notice 'OK  foto de hace 10 días rechazada (%)', sqlerrm; end $$;
do $$ begin
  insert into public.resena_fotos (resena_id, usuario_id, plato, path, tomada_at)
  values ('bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'Ceviche', '77777777-7777-7777-7777-777777777777/b/2.jpg', now() - interval '2 hours');
  insert into public.resena_fotos (resena_id, usuario_id, plato, path, tomada_at)
  values ('bbbbbbbb-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'Ceviche', '77777777-7777-7777-7777-777777777777/b/3.jpg', null);
  raise notice 'OK  fotos de hoy y sin fecha se aceptan';
exception when others then raise notice 'FALLA fotos de hoy: %', sqlerrm; end $$;
reset role;
