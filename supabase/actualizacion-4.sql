-- =====================================================================
-- Mesa Gourmet · Actualización 4 (ejecutar UNA vez, después de actualizacion-3.sql)
-- Supabase > SQL Editor > New query > pegar todo > Run
--
-- Locales que cierran: se ARCHIVAN en vez de borrarse (borrar un local borra en cascada sus reseñas,
-- fotos, videos y estadísticas, y a los autores les baja el nivel).
--  1. Fecha y motivo del cierre
--  2. Cualquiera puede leer los locales archivados (solo nombre y logo se usan, para mostrar
--     "Local cerrado" en las reseñas propias); la app no los muestra en ninguna lista
--  3. No se pueden publicar reseñas ni videos nuevos de un local cerrado
--  4. Los locales cerrados no entran al Top 50 de locales, al Top 50 de clientes ni a las estadísticas del mes
-- =====================================================================

-- 1. Fecha y motivo del cierre
alter table public.locales add column if not exists cerrado_at timestamptz;
alter table public.locales add column if not exists motivo_cierre text;

-- 2. Los archivados también se pueden leer (la app los separa y no los muestra)
drop policy if exists "locales visibles" on public.locales;
create policy "locales visibles" on public.locales for select using (true);

-- 3. Nada nuevo en locales cerrados
create or replace function public.bloquear_local_cerrado() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if exists (select 1 from public.locales where id = new.local_id and not activo) then
        raise exception 'Este local cerró: ya no se pueden publicar reseñas ni videos.';
    end if;
    return new;
end $$;
drop trigger if exists bloquear_local_cerrado on public.resenas;
create trigger bloquear_local_cerrado before insert on public.resenas
    for each row execute function public.bloquear_local_cerrado();
drop trigger if exists bloquear_local_cerrado on public.videos;
create trigger bloquear_local_cerrado before insert on public.videos
    for each row execute function public.bloquear_local_cerrado();

-- 4. Rankings, Top 50 de clientes y estadísticas solo con locales abiertos
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
          and local_id in (select id from public.locales where activo)
        group by local_id, usuario_id
        having count(*) >= 5
    ) t
    join public.perfiles pf on pf.id = t.usuario_id
    where t.puesto <= 50;
    get diagnostics v_total = row_count;
    return v_total;
end $$;

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
    where l.activo
    on conflict (mes, local_id) do update set
        resenas = excluded.resenas, clientes_unicos = excluded.clientes_unicos, clientes_recurrentes = excluded.clientes_recurrentes,
        clientes_top50 = excluded.clientes_top50, clientes_nuevos = excluded.clientes_nuevos, nota_promedio = excluded.nota_promedio,
        vistas = excluded.vistas, contactos = excluded.contactos, favoritos_nuevos = excluded.favoritos_nuevos,
        quiero_ir_nuevos = excluded.quiero_ir_nuevos, creado_at = now();
end $$;

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
              and local_id in (select id from public.locales where activo)
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
                  and res.local_id in (select id from public.locales where activo)
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

revoke all on function public.generar_top50(date) from public, anon, authenticated;
revoke all on function public.generar_estadisticas_mes(date) from public, anon, authenticated;
revoke all on function public.cerrar_mes(date) from public, anon, authenticated;
