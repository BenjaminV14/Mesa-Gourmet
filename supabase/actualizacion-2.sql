-- =====================================================================
-- Mesa Gourmet · Actualización 2 (ejecutar UNA vez, después de datos-iniciales.sql)
-- Supabase > SQL Editor > New query > pegar todo > Run
--
-- Agrega:
--  1. Características sin paréntesis ("Apto para Fumadores", "Ingreso de Mascotas")
--  2. Métricas de cada local (visitas a la ficha y clics en WhatsApp, llamar, cómo llegar, redes)
--  3. Fecha en favoritos y "quiero ir", y que el administrador pueda contarlos para los reportes
--  4. Manual de decisiones del administrador (para que la IA resuelva igual los casos repetidos)
--  5. Vigencia de las promociones (desde / hasta)
--  6. Cierre automático del mes: el último día del mes a las 23:59 (hora de Chile) se guardan
--     las distinciones del Top y los clientes VIP de cada local para el mes siguiente
-- =====================================================================

-- 1. Características: el detalle ("Solo en la terraza") va aparte, no en el nombre
update public.locales set
    caracteristicas = array(
        select distinct case c
            when 'Mascotas (Solo en Terraza)' then 'Ingreso de Mascotas'
            when 'Apto para Fumadores (Solo en Terraza)' then 'Apto para Fumadores'
            else c end
        from unnest(caracteristicas) c),
    caracteristicas_detalle = (caracteristicas_detalle - 'Mascotas (Solo en Terraza)' - 'Apto para Fumadores (Solo en Terraza)')
        || case when 'Mascotas (Solo en Terraza)' = any(caracteristicas) and not (caracteristicas_detalle ? 'Ingreso de Mascotas')
                then jsonb_build_object('Ingreso de Mascotas', coalesce(caracteristicas_detalle ->> 'Mascotas (Solo en Terraza)', 'Solo en la terraza'))
                else '{}'::jsonb end
        || case when 'Apto para Fumadores (Solo en Terraza)' = any(caracteristicas) and not (caracteristicas_detalle ? 'Apto para Fumadores')
                then jsonb_build_object('Apto para Fumadores', coalesce(caracteristicas_detalle ->> 'Apto para Fumadores (Solo en Terraza)', 'Solo en la terraza'))
                else '{}'::jsonb end
where caracteristicas && array['Mascotas (Solo en Terraza)', 'Apto para Fumadores (Solo en Terraza)'];

-- 2. Métricas de cada local (para mostrarles cuánta gente les llevó la app)
create table if not exists public.metricas_locales (
    id bigint generated always as identity primary key,
    local_id bigint not null references public.locales (id) on delete cascade,
    tipo text not null check (tipo in ('vista', 'whatsapp', 'llamar', 'como_llegar', 'carta', 'instagram', 'facebook', 'tiktok', 'web', 'compartir')),
    usuario_id uuid references public.perfiles (id) on delete set null,
    creado_at timestamptz not null default now()
);
create index if not exists metricas_locales_local_fecha on public.metricas_locales (local_id, creado_at);
alter table public.metricas_locales enable row level security;
drop policy if exists "registrar metricas" on public.metricas_locales;
create policy "registrar metricas" on public.metricas_locales for insert to anon, authenticated
    with check (usuario_id is null or usuario_id = auth.uid());
drop policy if exists "admin ve metricas" on public.metricas_locales;
create policy "admin ve metricas" on public.metricas_locales for select using (public.es_admin());
-- Las métricas se cuentan, no se editan
grant insert on public.metricas_locales to anon, authenticated;

-- 3. Favoritos y "quiero ir": desde cuándo, y el administrador los puede contar
alter table public.favoritos add column if not exists creado_at timestamptz not null default now();
alter table public.quiero_ir add column if not exists creado_at timestamptz not null default now();
drop policy if exists "admin ve favoritos" on public.favoritos;
create policy "admin ve favoritos" on public.favoritos for select using (public.es_admin());
drop policy if exists "admin ve quiero ir" on public.quiero_ir;
create policy "admin ve quiero ir" on public.quiero_ir for select using (public.es_admin());

-- 4. Manual de decisiones: cada vez que resuelves algo queda anotado; si un tipo de caso siempre
--    lo resuelves igual, puedes dejar que la IA lo haga sola (reglas_admin.automatico)
create table if not exists public.decisiones_admin (
    id bigint generated always as identity primary key,
    tipo text not null,                -- por ejemplo 'reporte_resena', 'foto', 'video', 'reporte_local:horario'
    caso text,                         -- resumen del caso
    decision text not null,            -- por ejemplo 'mantener', 'ocultar', 'aprobar', 'rechazar', 'resuelto'
    nota text,
    creado_at timestamptz not null default now()
);
create table if not exists public.reglas_admin (
    tipo text primary key,
    decision text not null,
    automatico boolean not null default false,
    nota text,
    actualizado_at timestamptz not null default now()
);
alter table public.decisiones_admin enable row level security;
alter table public.reglas_admin enable row level security;
drop policy if exists "solo admin decisiones" on public.decisiones_admin;
create policy "solo admin decisiones" on public.decisiones_admin for all using (public.es_admin()) with check (public.es_admin());
drop policy if exists "solo admin reglas" on public.reglas_admin;
create policy "solo admin reglas" on public.reglas_admin for all using (public.es_admin()) with check (public.es_admin());

-- 5. Promociones con vigencia: al pasar la fecha "hasta" dejan de mostrarse solas
alter table public.promociones add column if not exists desde date;
alter table public.promociones add column if not exists hasta date;

-- 6. Cierre del mes
alter table public.cierres_mes add column if not exists clientes jsonb not null default '{}'::jsonb;

-- Texto en minúsculas y sin tildes (igual que el buscador de la app)
create or replace function public.texto_simple(t text) returns text
language sql immutable as $$
    select lower(translate(coalesce(t, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun'))
$$;

/**
 * Cierra un mes: guarda el Top 50 general, el Top 10 de cada tipo de comida y los clientes
 * de cada local (5 visitas o más en el mes = VIP durante el mes siguiente).
 * Se puede ejecutar a mano: select public.cerrar_mes('2026-10-31');
 */
create or replace function public.cerrar_mes(p_dia date) returns text
language plpgsql security definer set search_path = '' as $$
declare
    meses text[] := array['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    v_mes text := meses[extract(month from p_dia)::int] || ' ' || extract(year from p_dia)::int;
    v_fin timestamptz := ((date_trunc('month', p_dia::timestamp) + interval '1 month') at time zone 'America/Santiago');
    v_inicio timestamptz := (date_trunc('month', p_dia::timestamp) at time zone 'America/Santiago');
    v_distinciones jsonb := '{}'::jsonb;
    v_clientes jsonb := '{}'::jsonb;
    r record;
    cat record;
begin
    -- Top 50 general: promedio de comida y servicio de los últimos 30 días
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

    -- Clientes de cada local en el mes (las 50 personas que más vinieron; con 5 visitas o más son VIP)
    for r in
        select res.local_id,
               jsonb_agg(jsonb_build_object('id', res.usuario_id, 'nombre', pf.nombre, 'username', pf.username,
                                            'visitas', res.visitas, 'vip', res.visitas >= 5)
                         order by res.visitas desc, res.ultima desc) as lista
        from (
            select local_id, usuario_id, count(*) as visitas, max(creado_at) as ultima,
                   row_number() over (partition by local_id order by count(*) desc, max(creado_at) desc) as puesto
            from public.resenas
            where estado <> 'rechazada' and creado_at >= v_inicio and creado_at < v_fin
            group by local_id, usuario_id
        ) res
        join public.perfiles pf on pf.id = res.usuario_id
        where res.puesto <= 50
        group by res.local_id
    loop
        v_clientes := jsonb_set(v_clientes, array[r.local_id::text], r.lista);
    end loop;

    insert into public.cierres_mes (mes, distinciones, clientes)
    values (v_mes, v_distinciones, v_clientes)
    on conflict (mes) do update set distinciones = excluded.distinciones, clientes = excluded.clientes, creado_at = now();
    return v_mes;
end $$;

-- Se revisa cada hora (al minuto 59): si en Chile es el último día del mes a las 23:59, se cierra el mes
create or replace function public.cerrar_mes_si_corresponde() returns void
language plpgsql security definer set search_path = '' as $$
declare
    ahora timestamp := now() at time zone 'America/Santiago';
begin
    if extract(hour from ahora) = 23 and (ahora + interval '1 day')::date = date_trunc('month', ahora + interval '1 day')::date then
        perform public.cerrar_mes(ahora::date);
    end if;
end $$;

revoke all on function public.cerrar_mes(date) from public, anon, authenticated;
revoke all on function public.cerrar_mes_si_corresponde() from public, anon, authenticated;

-- Programación automática con pg_cron (viene incluido en Supabase)
do $$
begin
    if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
        create extension if not exists pg_cron with schema pg_catalog;
        if exists (select 1 from cron.job where jobname = 'cerrar-mes') then
            perform cron.unschedule('cerrar-mes');
        end if;
        perform cron.schedule('cerrar-mes', '59 * * * *', 'select public.cerrar_mes_si_corresponde()');
    else
        raise notice 'pg_cron no está disponible: el mes se puede cerrar a mano desde el panel.';
    end if;
end $$;
