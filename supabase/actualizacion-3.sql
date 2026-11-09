-- =====================================================================
-- Mesa Gourmet · Actualización 3 (ejecutar UNA vez, después de actualizacion-2.sql)
-- Supabase > SQL Editor > New query > pegar todo > Run
--
-- Top 50 de clientes de cada local, con envío por correo y borrado automático:
--  1. Apellido y consentimiento para compartir nombre/@usuario con los locales (opcional, se puede retirar)
--  2. Correo de contacto de cada local (solo lo ve el administrador) y beneficio que ofrece a su Top 50
--  3. top50_mes: la lista de cada mes (mínimo 5 reseñas en el mes en ese local). Se BORRA SOLA al cerrar
--     el mes siguiente (ej: la de octubre se envía al cerrar octubre y se borra al cerrar noviembre)
--  4. estadisticas_mes: números del mes SIN datos personales (se guardan para los reportes a los locales)
--  5. envios_top50: registro de qué correo se envió a qué local (para no enviarlo dos veces)
--  6. cerrar_mes ya no guarda la lista de clientes con nombres en cierres_mes (esa tabla es pública)
--  7. Envío automático: el día 1 de cada mes se llama a la función "enviar-top50"
--  8. Privacidad: de los perfiles ajenos solo se puede leer nombre, @usuario, foto y rol (antes cualquiera
--     podía leer preferencias con las dietas —dato de salud—, apellido, bloqueo y consentimientos)
--  9. "Eliminar mi cuenta" borra la cuenta al instante (antes quedaba pendiente para hacerlo a mano)
-- 10. Limpieza al cerrar cada mes: métricas de uso de más de 13 meses y reportes resueltos de más de 12 meses
-- =====================================================================

-- 1. Perfil: apellido y consentimiento ---------------------------------------------------------
alter table public.perfiles add column if not exists apellido text;
alter table public.perfiles add column if not exists comparte_con_locales boolean not null default false;
alter table public.perfiles add column if not exists comparte_con_locales_at timestamptz;

-- Al registrarse: nombre, apellido y consentimiento vienen en los metadatos del registro
create or replace function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    base text := left(regexp_replace(translate(lower(split_part(coalesce(new.email, ''), '@', 1)), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'), '[^a-z0-9._]', '', 'g'), 20);
    candidato text;
    comparte boolean := coalesce((new.raw_user_meta_data ->> 'comparte_con_locales')::boolean, false);
begin
    if char_length(base) < 3 then base := left(base || 'usuario', 20); end if;
    candidato := base;
    while exists (select 1 from public.perfiles where username = candidato) loop
        candidato := base || lpad((floor(random() * 10000))::int::text, 4, '0');
    end loop;
    insert into public.perfiles (id, nombre, apellido, username, acepto_terminos_at, comparte_con_locales, comparte_con_locales_at)
    values (
        new.id,
        coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), nullif(new.raw_user_meta_data ->> 'given_name', ''),
                 nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1)),
        coalesce(nullif(new.raw_user_meta_data ->> 'apellido', ''), nullif(new.raw_user_meta_data ->> 'family_name', '')),
        candidato, now(), comparte, case when comparte then now() end
    );
    return new;
end $$;

-- Al cambiar el consentimiento se guarda la fecha (prueba de cuándo lo dio o lo retiró)
create or replace function public.fecha_consentimiento() returns trigger
language plpgsql set search_path = '' as $$
begin
    if new.comparte_con_locales is distinct from old.comparte_con_locales then
        new.comparte_con_locales_at := now();
    end if;
    return new;
end $$;
drop trigger if exists fecha_consentimiento on public.perfiles;
create trigger fecha_consentimiento before update on public.perfiles
    for each row execute function public.fecha_consentimiento();

-- 2. Contacto y beneficio de cada local --------------------------------------------------------
-- El beneficio es público (lo ven los usuarios que quedan en el Top 50); el correo es privado.
alter table public.locales add column if not exists beneficio_top50 text;

create table if not exists public.contactos_locales (
    local_id bigint primary key references public.locales (id) on delete cascade,
    email text check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    contacto text,                                  -- nombre de la persona que recibe el correo
    recibe_top50 boolean not null default true,     -- el local aceptó recibir la lista mensual
    actualizado_at timestamptz not null default now()
);
alter table public.contactos_locales enable row level security;
drop policy if exists "solo admin contactos" on public.contactos_locales;
create policy "solo admin contactos" on public.contactos_locales for all using (public.es_admin()) with check (public.es_admin());

-- 3. Top 50 del mes (datos personales: se borran al cerrar el mes siguiente) -------------------
create table if not exists public.top50_mes (
    mes date not null,                              -- primer día del mes (ej: 2026-10-01 = octubre)
    local_id bigint not null references public.locales (id) on delete cascade,
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    puesto int not null,
    resenas int not null,
    comparte boolean not null default false,        -- si aceptó compartir su nombre con los locales
    creado_at timestamptz not null default now(),
    primary key (mes, local_id, usuario_id)
);
create index if not exists top50_mes_usuario on public.top50_mes (usuario_id);
alter table public.top50_mes enable row level security;
drop policy if exists "admin ve top50" on public.top50_mes;
create policy "admin ve top50" on public.top50_mes for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "cada uno ve su puesto" on public.top50_mes;
create policy "cada uno ve su puesto" on public.top50_mes for select using (usuario_id = auth.uid());

-- 4. Estadísticas del mes sin datos personales (se guardan) ------------------------------------
create table if not exists public.estadisticas_mes (
    mes date not null,
    local_id bigint not null references public.locales (id) on delete cascade,
    resenas int not null default 0,
    clientes_unicos int not null default 0,         -- personas distintas que reseñaron
    clientes_recurrentes int not null default 0,    -- con 2 o más reseñas en el mes
    clientes_top50 int not null default 0,          -- con 5 o más reseñas en el mes
    clientes_nuevos int not null default 0,         -- primera reseña en ese local
    nota_promedio numeric(3,1),
    vistas int not null default 0,                  -- visitas a la ficha del local
    contactos int not null default 0,               -- WhatsApp, llamar, cómo llegar, carta y redes
    favoritos_nuevos int not null default 0,
    quiero_ir_nuevos int not null default 0,
    creado_at timestamptz not null default now(),
    primary key (mes, local_id)
);
alter table public.estadisticas_mes enable row level security;
drop policy if exists "solo admin estadisticas" on public.estadisticas_mes;
create policy "solo admin estadisticas" on public.estadisticas_mes for all using (public.es_admin()) with check (public.es_admin());

-- 5. Registro de envíos ------------------------------------------------------------------------
create table if not exists public.envios_top50 (
    mes date not null,
    local_id bigint not null references public.locales (id) on delete cascade,
    email text not null,
    personas int not null default 0,
    estado text not null default 'enviado' check (estado in ('enviado', 'error', 'prueba')),
    detalle text,
    enviado_at timestamptz not null default now(),
    primary key (mes, local_id)
);
alter table public.envios_top50 enable row level security;
drop policy if exists "solo admin envios" on public.envios_top50;
create policy "solo admin envios" on public.envios_top50 for all using (public.es_admin()) with check (public.es_admin());

-- 6. Cálculo del mes ---------------------------------------------------------------------------

/** Top 50 de clientes de cada local en el mes: solo quienes tienen 5 reseñas publicadas o más en ese local */
create or replace function public.generar_top50(p_dia date) returns int
language plpgsql security definer set search_path = '' as $$
declare
    v_mes date := date_trunc('month', p_dia)::date;
    v_inicio timestamptz := (v_mes::timestamp at time zone 'America/Santiago');
    v_fin timestamptz := ((v_mes + interval '1 month')::timestamp at time zone 'America/Santiago');
    v_total int;
begin
    delete from public.top50_mes where mes = v_mes;
    insert into public.top50_mes (mes, local_id, usuario_id, puesto, resenas, comparte)
    select v_mes, t.local_id, t.usuario_id, t.puesto, t.n, pf.comparte_con_locales and not pf.bloqueado
    from (
        select local_id, usuario_id, count(*) as n,
               row_number() over (partition by local_id order by count(*) desc, max(creado_at) asc) as puesto
        from public.resenas
        where estado = 'publicada' and creado_at >= v_inicio and creado_at < v_fin
        group by local_id, usuario_id
        having count(*) >= 5
    ) t
    join public.perfiles pf on pf.id = t.usuario_id
    where t.puesto <= 50;
    get diagnostics v_total = row_count;
    return v_total;
end $$;

/** Números del mes de cada local (sin datos personales) */
create or replace function public.generar_estadisticas_mes(p_dia date) returns void
language plpgsql security definer set search_path = '' as $$
declare
    v_mes date := date_trunc('month', p_dia)::date;
    v_inicio timestamptz := (v_mes::timestamp at time zone 'America/Santiago');
    v_fin timestamptz := ((v_mes + interval '1 month')::timestamp at time zone 'America/Santiago');
begin
    insert into public.estadisticas_mes (mes, local_id, resenas, clientes_unicos, clientes_recurrentes, clientes_top50,
                                         clientes_nuevos, nota_promedio, vistas, contactos, favoritos_nuevos, quiero_ir_nuevos)
    select v_mes, l.id,
        coalesce(r.resenas, 0), coalesce(r.unicos, 0), coalesce(r.recurrentes, 0), coalesce(r.top50, 0),
        coalesce(r.nuevos, 0), r.nota,
        coalesce(m.vistas, 0), coalesce(m.contactos, 0),
        (select count(*) from public.favoritos f where f.local_id = l.id and f.creado_at >= v_inicio and f.creado_at < v_fin),
        (select count(*) from public.quiero_ir q where q.local_id = l.id and q.creado_at >= v_inicio and q.creado_at < v_fin)
    from public.locales l
    left join lateral (
        select sum(x.n)::int as resenas, count(*)::int as unicos,
               count(*) filter (where x.n >= 2)::int as recurrentes,
               count(*) filter (where x.n >= 5)::int as top50,
               count(*) filter (where not exists (
                   select 1 from public.resenas a
                   where a.local_id = l.id and a.usuario_id = x.usuario_id and a.estado = 'publicada' and a.creado_at < v_inicio))::int as nuevos,
               round((sum(x.suma) / nullif(sum(x.n), 0))::numeric, 1) as nota
        from (
            select usuario_id, count(*) as n, sum((nota_comida + nota_servicio) / 2) as suma
            from public.resenas
            where local_id = l.id and estado = 'publicada' and creado_at >= v_inicio and creado_at < v_fin
            group by usuario_id
        ) x
    ) r on true
    left join lateral (
        select count(*) filter (where tipo = 'vista')::int as vistas,
               count(*) filter (where tipo <> 'vista')::int as contactos
        from public.metricas_locales
        where local_id = l.id and creado_at >= v_inicio and creado_at < v_fin
    ) m on true
    on conflict (mes, local_id) do update set
        resenas = excluded.resenas, clientes_unicos = excluded.clientes_unicos, clientes_recurrentes = excluded.clientes_recurrentes,
        clientes_top50 = excluded.clientes_top50, clientes_nuevos = excluded.clientes_nuevos, nota_promedio = excluded.nota_promedio,
        vistas = excluded.vistas, contactos = excluded.contactos, favoritos_nuevos = excluded.favoritos_nuevos,
        quiero_ir_nuevos = excluded.quiero_ir_nuevos, creado_at = now();
end $$;

/** Borra las listas con datos personales de meses anteriores al mes indicado */
create or replace function public.borrar_top50_vencidos(p_dia date) returns int
language plpgsql security definer set search_path = '' as $$
declare
    v_total int;
begin
    delete from public.top50_mes where mes < date_trunc('month', p_dia)::date;
    get diagnostics v_total = row_count;
    return v_total;
end $$;

-- cerrar_mes: distinciones como antes + Top 50 + estadísticas + borrado de la lista del mes anterior.
-- Ya NO guarda nombres de clientes en cierres_mes (esa tabla la puede leer cualquiera).
create or replace function public.cerrar_mes(p_dia date) returns text
language plpgsql security definer set search_path = '' as $$
declare
    meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    v_mes text := meses[extract(month from p_dia)::int] || ' ' || extract(year from p_dia)::int;
    v_fin timestamptz := ((date_trunc('month', p_dia::timestamp) + interval '1 month') at time zone 'America/Santiago');
    v_distinciones jsonb := '{}'::jsonb;
    r record;
    cat record;
begin
    -- Top 50 general de locales: promedio de comida y servicio de los últimos 30 días
    for r in
        select local_id, row_number() over (order by nota desc, n desc) as puesto
        from (
            select local_id, avg((nota_comida + nota_servicio) / 2) as nota, count(*) as n
            from public.resenas
            where estado = 'publicada' and creado_at > v_fin - interval '30 days' and creado_at <= v_fin
            group by local_id
        ) t
        order by puesto
        limit 50
    loop
        v_distinciones := jsonb_set(v_distinciones, array[r.local_id::text],
            coalesce(v_distinciones -> r.local_id::text, '[]'::jsonb) || to_jsonb('Top ' || r.puesto || ' de Talca · ' || v_mes));
    end loop;

    -- Top 10 por tipo de comida (mismas palabras clave que la app)
    for cat in
        select * from (values
            ('completos', 'Completos', '🌭', array['completo', 'hot dog', 'italiano', 'dinamico']),
            ('ceviches', 'Ceviches', '🦐', array['ceviche', 'cebiche', 'seviche']),
            ('pizzas', 'Pizzas', '🍕', array['pizza']),
            ('sushi', 'Sushi', '🍣', array['sushi', 'roll', 'maki', 'nigiri', 'gyoza', 'handroll']),
            ('empanadas', 'Empanadas', '🥟', array['empanada']),
            ('hamburguesas', 'Hamburguesas', '🍔', array['hamburguesa', 'burger']),
            ('sandwiches', 'Sándwiches', '🥪', array['sandwich', 'sanguche', 'churrasco', 'barros', 'chacarero', 'lomito', 'chemilico']),
            ('cafes', 'Cafés', '☕', array['cafe', 'latte', 'espresso', 'cappuccino', 'capuchino', 'americano', 'mocha', 'cortado']),
            ('postres', 'Postres', '🍰', array['postre', 'torta', 'pie', 'kuchen', 'helado', 'suspiro', 'tres leches', 'crema volteada', 'brownie', 'cheesecake']),
            ('tragos', 'Tragos', '🍸', array['pisco', 'sour', 'mojito', 'coctel', 'spritz', 'terremoto', 'piscola', 'margarita'])
        ) as c(id, nombre, emoji, palabras)
    loop
        for r in
            select local_id, row_number() over (order by nota desc, n desc) as puesto
            from (
                select res.local_id, avg(res.nota_comida) as nota, count(*) as n
                from public.resenas res
                where res.estado = 'publicada' and res.creado_at > v_fin - interval '30 days' and res.creado_at <= v_fin
                  and exists (
                      select 1 from unnest(res.productos) p, unnest(cat.palabras) k
                      where ' ' || public.texto_simple(p) || ' ' like '% ' || k || '%')
                group by res.local_id
            ) t
            order by puesto
            limit 10
        loop
            v_distinciones := jsonb_set(v_distinciones, array[r.local_id::text],
                coalesce(v_distinciones -> r.local_id::text, '[]'::jsonb) || to_jsonb(cat.emoji || ' Top ' || r.puesto || ' ' || cat.nombre || ' · ' || v_mes));
        end loop;
    end loop;

    -- Clientes: primero se borra la lista del mes anterior (ya se envió el mes pasado) y luego se arma la de este mes
    perform public.borrar_top50_vencidos(p_dia);
    perform public.generar_top50(p_dia);
    perform public.generar_estadisticas_mes(p_dia);

    -- Plazos de conservación (ver política de privacidad): las estadísticas del mes ya quedaron guardadas sin datos personales
    delete from public.metricas_locales where creado_at < now() - interval '13 months';
    delete from public.reportes where estado <> 'abierto' and creado_at < now() - interval '12 months';

    insert into public.cierres_mes (mes, distinciones, clientes)
    values (v_mes, v_distinciones, '{}'::jsonb)
    on conflict (mes) do update set distinciones = excluded.distinciones, clientes = '{}'::jsonb, creado_at = now();
    return v_mes;
end $$;

-- Las listas de clientes con nombres que quedaron guardadas en cierres_mes (tabla pública) se borran
update public.cierres_mes set clientes = '{}'::jsonb where clientes <> '{}'::jsonb;

revoke all on function public.generar_top50(date) from public, anon, authenticated;
revoke all on function public.generar_estadisticas_mes(date) from public, anon, authenticated;
revoke all on function public.borrar_top50_vencidos(date) from public, anon, authenticated;
revoke all on function public.cerrar_mes(date) from public, anon, authenticated;

/** Para el panel: el administrador puede recalcular el Top 50 de un mes a mano */
create or replace function public.admin_generar_top50(p_dia date) returns int
language plpgsql security definer set search_path = '' as $$
begin
    if not public.es_admin() then raise exception 'Solo el administrador.'; end if;
    perform public.generar_estadisticas_mes(p_dia);
    return public.generar_top50(p_dia);
end $$;
revoke all on function public.admin_generar_top50(date) from public, anon;
grant execute on function public.admin_generar_top50(date) to authenticated;

/**
 * Lista para el correo de un local: SOLO quienes aceptaron compartir su nombre.
 * Quienes no aceptaron se cuentan, pero no se envían sus datos.
 */
create or replace view public.top50_para_locales with (security_invoker = true) as
select t.mes, t.local_id, t.puesto, t.resenas, t.comparte,
       case when t.comparte then pf.nombre end as nombre,
       case when t.comparte then pf.apellido end as apellido,
       case when t.comparte then pf.username end as username
from public.top50_mes t
join public.perfiles pf on pf.id = t.usuario_id;

-- 7. Envío automático del correo el día 1 de cada mes a las 10:00 (hora de verano de Chile) -----
-- Llama a la función "enviar-top50" (supabase/functions/enviar-top50). La función solo envía meses ya
-- cerrados y nunca dos veces al mismo local, así que llamarla de más no tiene efecto.
do $$
begin
    if exists (select 1 from pg_available_extensions where name = 'pg_net')
       and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        create extension if not exists pg_net with schema extensions;
        create extension if not exists pg_cron with schema pg_catalog;
        if exists (select 1 from cron.job where jobname = 'enviar-top50') then
            perform cron.unschedule('enviar-top50');
        end if;
        perform cron.schedule('enviar-top50', '0 13 1 * *', $cmd$
            select net.http_post(
                url := 'https://gaguteunateuwebyeaax.supabase.co/functions/v1/enviar-top50',
                headers := '{"Content-Type": "application/json"}'::jsonb,
                body := '{}'::jsonb,
                timeout_milliseconds := 60000
            );
        $cmd$);
    else
        raise notice 'pg_net o pg_cron no están disponibles: envía el Top 50 desde el panel.';
    end if;
end $$;

-- 8. Privacidad de los perfiles ---------------------------------------------------------------
-- La app solo necesita mostrar de otras personas su nombre, @usuario y foto. El resto (apellido, preferencias
-- con dietas, consentimientos, bloqueo, producto favorito) solo lo lee la propia persona con mi_perfil().
-- "Perfil público" (Perfil → Privacidad): columna pública para saber si se puede ver el perfil de alguien
alter table public.perfiles add column if not exists perfil_publico boolean not null default true;
update public.perfiles set perfil_publico = coalesce((preferencias ->> 'perfilPublico')::boolean, true);

revoke select on public.perfiles from anon, authenticated;
grant select (id, nombre, username, avatar_url, rol, creado_at, perfil_publico) on public.perfiles to anon, authenticated;

create or replace function public.mi_perfil() returns setof public.perfiles
language sql stable security definer set search_path = '' as $$
    select * from public.perfiles where id = auth.uid();
$$;
revoke all on function public.mi_perfil() from public, anon;
grant execute on function public.mi_perfil() to authenticated;

-- 9. Eliminar mi cuenta (Ley 21.719, derecho de supresión; también lo exigen Play Store y App Store) ----
-- Borra el usuario de Supabase Auth; por las claves foráneas se borran en cascada su perfil, reseñas, fotos
-- (registros), videos, likes, favoritos, seguidos, guardados, reportes y su lugar en el Top 50.
-- Los archivos (fotos y videos) los borra la app antes de llamar a esta función.
create or replace function public.eliminar_mi_cuenta() returns void
language plpgsql security definer set search_path = '' as $$
declare
    v_id uuid := auth.uid();
begin
    if v_id is null then raise exception 'Debes iniciar sesión.'; end if;
    if exists (select 1 from public.perfiles where id = v_id and rol = 'admin') then
        raise exception 'Una cuenta de administrador no se puede eliminar desde la app.';
    end if;
    delete from auth.users where id = v_id;
end $$;
revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;
