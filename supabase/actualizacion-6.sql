-- =====================================================================
-- Mesa Gourmet · Actualización 6 (ejecutar UNA vez, después de actualizacion-5.sql)
-- Supabase > SQL Editor > New query > pegar todo > Run
--
-- Visitas comprobadas y números confiables:
--  1. Fotos de reseñas: fecha en que se tomó la foto (tomada_at). No se aceptan fotos de hace más de 3 días
--  2. Reseñas: motivo por el que quedó en revisión (por ejemplo "Fotos sin fecha") y si la IA ya revisó
--     el comentario (comentario_revisado). Nadie puede marcar su propio comentario como revisado
--  3. Métricas de los locales (visitas a la ficha, clics en WhatsApp...): cada persona cuenta una vez
--     por local y tipo cada 30 minutos, y como máximo 60 registros por local por minuto. Así nadie puede
--     inflar (ni hundir) los números que se les muestran a los locales
-- =====================================================================

-- 1. Fecha de la foto -----------------------------------------------------------------------------
alter table public.resena_fotos add column if not exists tomada_at timestamptz;

create or replace function public.validar_fecha_foto() returns trigger
language plpgsql set search_path = '' as $$
begin
    -- Fecha en el futuro: la hora del celular está mal puesta; se guarda como "sin fecha"
    if new.tomada_at is not null and new.tomada_at > now() + interval '6 hours' then
        new.tomada_at := null;
    end if;
    if new.tomada_at is not null and new.tomada_at < now() - interval '3 days 6 hours' then
        raise exception 'La foto es de hace más de 3 días. Usa fotos de tu visita.';
    end if;
    return new;
end $$;
drop trigger if exists validar_fecha_foto on public.resena_fotos;
create trigger validar_fecha_foto before insert on public.resena_fotos
    for each row execute function public.validar_fecha_foto();

-- 2. Revisión de la reseña ------------------------------------------------------------------------
alter table public.resenas add column if not exists motivo_revision text check (char_length(motivo_revision) <= 200);
alter table public.resenas add column if not exists comentario_revisado boolean not null default false;
-- Las reseñas que ya existían no se vuelven a revisar
update public.resenas set comentario_revisado = true where creado_at < now() and not comentario_revisado;

create or replace function public.resena_valores_servidor() returns trigger
language plpgsql set search_path = '' as $$
begin
    -- Lo decide la IA en el servidor (función verificar-foto), nunca la app
    new.comentario_revisado := false;
    return new;
end $$;
drop trigger if exists resena_valores_servidor on public.resenas;
create trigger resena_valores_servidor before insert on public.resenas
    for each row execute function public.resena_valores_servidor();

-- 3. Métricas sin inflar ---------------------------------------------------------------------------
-- "visitante": número al azar que la app guarda en el navegador de quien no tiene cuenta
alter table public.metricas_locales add column if not exists visitante text check (char_length(visitante) <= 64);
create index if not exists metricas_locales_quien on public.metricas_locales (local_id, tipo, creado_at);

create or replace function public.limitar_metricas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    v_quien text := coalesce(new.usuario_id::text, new.visitante);
begin
    new.creado_at := now();
    -- La misma persona, el mismo local y la misma acción: una vez cada 30 minutos
    if v_quien is not null and exists (
        select 1 from public.metricas_locales m
        where m.local_id = new.local_id and m.tipo = new.tipo
          and coalesce(m.usuario_id::text, m.visitante) = v_quien
          and m.creado_at > now() - interval '30 minutes'
    ) then
        return null;   -- se ignora sin error
    end if;
    -- Tope por local: 60 registros por minuto (frena a quien intente llenar los números con un programa)
    if (select count(*) from public.metricas_locales m
        where m.local_id = new.local_id and m.creado_at > now() - interval '1 minute') >= 60 then
        return null;
    end if;
    return new;
end $$;
drop trigger if exists limitar_metricas on public.metricas_locales;
create trigger limitar_metricas before insert on public.metricas_locales
    for each row execute function public.limitar_metricas();
