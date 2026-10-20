-- =====================================================================
-- Mesa Gourmet · Esquema de base de datos para Supabase (PostgreSQL)
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar todo > Run.
-- Ver docs/SUPABASE.md para el paso a paso.
-- =====================================================================

-- ---------- Perfiles de usuario (uno por cuenta de Supabase Auth) ----------
create table public.perfiles (
    id uuid primary key references auth.users (id) on delete cascade,
    nombre text not null check (char_length(nombre) between 2 and 40),
    username text unique check (username ~ '^[a-z0-9._]{3,24}$'),   -- el @usuario: minúsculas, números, punto y guion bajo
    avatar_url text,
    rol text not null default 'usuario' check (rol in ('usuario', 'admin')),
    producto_favorito text,
    preferencias jsonb not null default '{}'::jsonb,   -- {"dietas": [...], "notificaciones": ..., "privacidad": ...}
    bloqueado boolean not null default false,
    acepto_terminos_at timestamptz,
    creado_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse (el nombre viene en los metadatos del registro).
-- El @usuario sale de la parte del correo antes de la @ (sin tildes ni símbolos);
-- si ya existe, se le agregan 4 números al azar.
create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    base text := left(regexp_replace(translate(lower(split_part(coalesce(new.email, ''), '@', 1)), 'áàäâéèëêíìïîóòöôúùüûñç', 'aaaaeeeeiiiioooouuuunc'), '[^a-z0-9._]', '', 'g'), 20);
    candidato text;
begin
    if char_length(base) < 3 then base := left(base || 'usuario', 20); end if;
    candidato := base;
    while exists (select 1 from public.perfiles where username = candidato) loop
        candidato := base || lpad((floor(random() * 10000))::int::text, 4, '0');
    end loop;
    insert into public.perfiles (id, nombre, username, acepto_terminos_at)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)), candidato, now());
    return new;
end $$;

create trigger al_registrarse after insert on auth.users
    for each row execute function public.crear_perfil();

-- ¿El usuario actual es administrador?
create function public.es_admin() returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.perfiles where id = auth.uid() and rol = 'admin');
$$;

-- ¿El usuario actual puede publicar? (tiene cuenta y no está bloqueado)
create function public.puede_publicar() returns boolean
language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.perfiles where id = auth.uid() and not bloqueado);
$$;

-- ---------- Locales ----------
create table public.locales (
    id bigint generated always as identity primary key,
    nombre text not null,
    tipo text not null,
    slogan text,
    direccion text,
    referencia text,                         -- punto conocido cercano ("frente a la plaza")
    nota_acceso text,                        -- recomendación para llegar o entrar (escaleras, calle cerrada…)
    telefono text,
    whatsapp text,
    instagram text,
    tiktok text,
    facebook text,
    website text,
    descripcion text,
    imagen_url text,
    lat double precision not null,
    lng double precision not null,
    horarios jsonb not null default '{}'::jsonb,       -- {"Lunes": "13:00 - 22:45", "Domingo": "Cerrado", ...}
    horario_feriados text,
    medios_pago text,
    capacidad text,
    ambiente text,
    tematica text,
    horas_peak text,
    dias_peak text,
    caracteristicas text[] not null default '{}',
    caracteristicas_detalle jsonb not null default '{}'::jsonb,   -- {"WiFi Disponible": "Clave: ...", "Estacionamiento": "En la calle"}
    etiquetas text[] not null default '{}',
    -- Cuántos productos de la carta sirven para cada dieta (la app los convierte en estrellas)
    vegano_productos smallint not null default 0 check (vegano_productos >= 0),
    vegetariano_productos smallint not null default 0 check (vegetariano_productos >= 0),
    sin_gluten_productos smallint not null default 0 check (sin_gluten_productos >= 0),
    sin_lactosa_productos smallint not null default 0 check (sin_lactosa_productos >= 0),
    -- Notas históricas (todas las reseñas). La nota oficial es la de los últimos 30 días: ver la vista notas_locales.
    nota_comida numeric(3,1) not null default 0,
    nota_servicio numeric(3,1) not null default 0,
    nota_mg numeric(3,1) not null default 0,
    distinciones text[] not null default '{}',   -- distinciones fijas; las del mes salen de cierres_mes
    activo boolean not null default true,
    creado_at timestamptz not null default now(),
    actualizado_at timestamptz not null default now()
);

-- Respuestas de la encuesta al dueño del local. Van aparte porque traen datos privados
-- (nombre y teléfono del dueño, documentos) y la tabla de locales la puede leer cualquiera.
create table public.encuestas_locales (
    local_id bigint primary key references public.locales (id) on delete cascade,
    respuestas jsonb not null default '{}'::jsonb,
    actualizada_at timestamptz default now()
);

-- Banco de preguntas de la encuesta (se edita desde el panel)
create table public.encuesta_preguntas (
    id text primary key,
    seccion text not null,
    texto text not null,
    uso text not null default 'interno',     -- a qué dato de la app va la respuesta, o 'interno'
    sugerencia text,
    orden integer not null default 0
);

create table public.platos (
    id bigint generated always as identity primary key,
    local_id bigint not null references public.locales (id) on delete cascade,
    nombre text not null,
    categoria text not null default 'Otros',
    precio integer not null check (precio >= 0),
    imagen_url text,
    es_bebida boolean not null default false,
    dietas text[] not null default '{}' check (dietas <@ array['vegano', 'vegetariano', 'sinGluten', 'sinLactosa']),
    likes integer not null default 0,
    orden integer not null default 0
);
create index on public.platos (local_id);

-- Destacado pagado ($29.990 / mes). Un registro por período contratado (queda el historial).
create table public.patrocinios (
    id bigint generated always as identity primary key,
    local_id bigint not null references public.locales (id) on delete cascade,
    plan text not null default 'Destacado mensual',
    precio integer not null default 29990,
    desde date not null,
    hasta date not null check (hasta >= desde),
    pagado boolean not null default false,
    notas text,
    creado_at timestamptz not null default now()
);
create index on public.patrocinios (local_id, hasta);

create table public.eventos (
    id bigint generated always as identity primary key,
    local_id bigint not null references public.locales (id) on delete cascade,
    titulo text not null,
    inicio timestamptz not null,
    descripcion text
);

create table public.promociones (
    id bigint generated always as identity primary key,
    local_id bigint not null references public.locales (id) on delete cascade,
    descripcion text not null,
    icono text default '🏷️',
    metodo text,
    dias smallint[] not null,                -- 0 = domingo ... 6 = sábado
    hora_inicio time,
    hora_fin time
);

-- Cierre de cada mes: las distinciones que ganaron los locales ese mes
create table public.cierres_mes (
    mes text primary key,                    -- por ejemplo 'octubre 2026'
    distinciones jsonb not null,
    creado_at timestamptz default now()
);

-- ---------- Contenido de los usuarios ----------
-- Una reseña es una fila aquí. Sus fotos van aparte en resena_fotos (una o más por plato).
create table public.resenas (
    id uuid primary key default gen_random_uuid(),
    local_id bigint not null references public.locales (id) on delete cascade,
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    productos text[] not null check (cardinality(productos) between 1 and 30),
    nota_comida numeric(3,1) not null check (nota_comida between 0.1 and 10),     -- de 0,1 a 10, con un decimal
    nota_servicio numeric(3,1) not null check (nota_servicio between 0.1 and 10),
    comentario text not null check (char_length(comentario) between 10 and 1000),
    precio_persona text check (char_length(precio_persona) <= 40),   -- rango, por ejemplo '$5.000 – $10.000'
    en_promocion boolean not null default false,
    estado text not null default 'pendiente' check (estado in ('publicada', 'pendiente', 'rechazada')),
    likes integer not null default 0,
    creado_at timestamptz not null default now()
);
create index on public.resenas (local_id, estado);
create index on public.resenas (usuario_id);

create table public.resena_likes (
    resena_id uuid not null references public.resenas (id) on delete cascade,
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    primary key (resena_id, usuario_id)
);

-- Fotos de una reseña: el archivo va en el bucket "fotos-resenas" y aquí queda una fila por foto.
-- Solo se muestran a todos cuando la IA (o un moderador) la verificó.
create table public.resena_fotos (
    id uuid primary key default gen_random_uuid(),
    resena_id uuid not null references public.resenas (id) on delete cascade,
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    plato text not null,                     -- nombre del plato o bebestible de la foto
    path text not null,                      -- ruta en el bucket "fotos-resenas": <id del usuario>/<archivo>
    verificada boolean not null default false,
    likes integer not null default 0,
    creado_at timestamptz default now()
);
create index on public.resena_fotos (resena_id);

create table public.foto_likes (
    foto_id uuid not null references public.resena_fotos (id) on delete cascade,
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    primary key (foto_id, usuario_id)
);

-- Videos: link de TikTok/Instagram, o un archivo subido al bucket "videos".
-- Los archivos los revisa la IA en el servidor (cuadros del video) antes de aprobarlos:
-- futura función "moderar-video". Mientras tanto, los aprueba un moderador.
create table public.videos (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    local_id bigint not null references public.locales (id) on delete cascade,
    plataforma text not null check (plataforma in ('tiktok', 'instagram', 'archivo')),
    url text unique check (url ~ '^https://(www\.)?(tiktok\.com|instagram\.com)/'),
    archivo_path text,                       -- ruta en el bucket "videos": <id del usuario>/<archivo>
    portada_path text,                       -- imagen de portada, en el mismo bucket
    descripcion text check (char_length(descripcion) <= 120),
    estado text not null default 'pendiente' check (estado in ('aprobado', 'pendiente', 'rechazado')),
    motivo_revision text,
    likes integer not null default 0,
    creado_at timestamptz not null default now(),
    -- Un link necesita su URL; un archivo necesita estar en la carpeta de quien lo sube
    check (case when plataforma = 'archivo'
                then archivo_path is not null and starts_with(archivo_path, usuario_id::text || '/')
                else url is not null end),
    check (portada_path is null or starts_with(portada_path, usuario_id::text || '/'))
);

create table public.video_likes (
    video_id uuid not null references public.videos (id) on delete cascade,
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    primary key (video_id, usuario_id)
);

create table public.favoritos (
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    local_id bigint not null references public.locales (id) on delete cascade,
    primary key (usuario_id, local_id)
);

-- "Quiero ir": lista privada de locales pendientes de cada usuario
create table public.quiero_ir (
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    local_id bigint not null references public.locales (id) on delete cascade,
    primary key (usuario_id, local_id)
);

-- Reseñas y videos guardados por cada usuario (privado)
create table public.guardados (
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    tipo text not null check (tipo in ('resena', 'video')),
    item_id uuid not null,
    creado_at timestamptz not null default now(),
    primary key (usuario_id, tipo, item_id)
);

-- Quién sigue a quién
create table public.seguidores (
    seguidor_id uuid not null references public.perfiles (id) on delete cascade,
    seguido_id uuid not null references public.perfiles (id) on delete cascade,
    creado_at timestamptz not null default now(),
    primary key (seguidor_id, seguido_id),
    check (seguidor_id <> seguido_id)
);
create index on public.seguidores (seguido_id);

create table public.reportes (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    local_id bigint references public.locales (id) on delete cascade,
    resena_id uuid references public.resenas (id) on delete cascade,
    tipo text not null check (tipo in ('menu', 'horario', 'cerrado', 'datos', 'otro', 'resena')),
    detalle text check (char_length(detalle) <= 500),
    estado text not null default 'abierto' check (estado in ('abierto', 'resuelto')),
    creado_at timestamptz not null default now()
);

-- Fotos que la IA no pudo confirmar y deben revisarse a mano (foto_id dice cuál foto de la reseña)
create table public.moderacion (
    id bigint generated always as identity primary key,
    resena_id uuid not null references public.resenas (id) on delete cascade,
    foto_id uuid references public.resena_fotos (id) on delete cascade,
    motivo text,
    resuelto boolean not null default false,
    creado_at timestamptz not null default now()
);

-- ---------- Contadores de likes y notas (los mantiene la base de datos, no la app) ----------
create function public.contar_like_resena() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    update public.resenas set likes = (select count(*) from public.resena_likes where resena_id = coalesce(new.resena_id, old.resena_id))
    where id = coalesce(new.resena_id, old.resena_id);
    return null;
end $$;
create trigger likes_resena after insert or delete on public.resena_likes
    for each row execute function public.contar_like_resena();

create function public.contar_like_foto() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    update public.resena_fotos set likes = (select count(*) from public.foto_likes where foto_id = coalesce(new.foto_id, old.foto_id))
    where id = coalesce(new.foto_id, old.foto_id);
    return null;
end $$;
create trigger likes_foto after insert or delete on public.foto_likes
    for each row execute function public.contar_like_foto();

create function public.contar_like_video() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    update public.videos set likes = (select count(*) from public.video_likes where video_id = coalesce(new.video_id, old.video_id))
    where id = coalesce(new.video_id, old.video_id);
    return null;
end $$;
create trigger likes_video after insert or delete on public.video_likes
    for each row execute function public.contar_like_video();

-- Nota histórica del local (promedio de todas las reseñas publicadas)
create function public.recalcular_notas() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lid bigint := coalesce(new.local_id, old.local_id);
begin
    update public.locales l set
        nota_comida = coalesce(s.c, l.nota_comida),
        nota_servicio = coalesce(s.s, l.nota_servicio),
        nota_mg = coalesce(round((s.c + s.s) / 2, 1), l.nota_mg)
    from (select round(avg(nota_comida), 1) c, round(avg(nota_servicio), 1) s
          from public.resenas where local_id = lid and estado = 'publicada') s
    where l.id = lid;
    return null;
end $$;
create trigger notas_local after insert or update of estado or delete on public.resenas
    for each row execute function public.recalcular_notas();

-- Notas de cada local: la oficial es la de los últimos 30 días; la histórica queda como dato secundario.
-- Se calcula al momento desde las reseñas publicadas (respeta las reglas de seguridad de quien consulta).
create view public.notas_locales with (security_invoker = true) as
select l.id as local_id,
       round(avg(r.nota_comida) filter (where r.creado_at > now() - interval '30 days'), 1) as comida_30d,
       round(avg(r.nota_servicio) filter (where r.creado_at > now() - interval '30 days'), 1) as servicio_30d,
       round((avg(r.nota_comida) filter (where r.creado_at > now() - interval '30 days')
            + avg(r.nota_servicio) filter (where r.creado_at > now() - interval '30 days')) / 2, 1) as total_30d,
       count(r.id) filter (where r.creado_at > now() - interval '30 days') as n_30d,
       round(avg(r.nota_comida), 1) as comida_historica,
       round(avg(r.nota_servicio), 1) as servicio_historica,
       round((avg(r.nota_comida) + avg(r.nota_servicio)) / 2, 1) as total_historica,
       count(r.id) as n_historico
from public.locales l
left join public.resenas r on r.local_id = l.id and r.estado = 'publicada'
group by l.id;

-- ---------- Antispam: límites por usuario ----------
create function public.limitar_resenas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    -- La fecha la pone el servidor: así nadie se salta el antispam ni la nota de 30 días con una fecha falsa
    new.creado_at := now();
    if (select count(*) from public.resenas where usuario_id = new.usuario_id and creado_at > now() - interval '1 day') >= 10 then
        raise exception 'Llegaste al máximo de 10 reseñas por día.';
    end if;
    if exists (select 1 from public.resenas where usuario_id = new.usuario_id and local_id = new.local_id and creado_at > now() - interval '1 day') then
        raise exception 'Ya reseñaste este local hoy.';
    end if;
    return new;
end $$;
create trigger antispam_resenas before insert on public.resenas
    for each row execute function public.limitar_resenas();

create function public.limitar_reportes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    new.creado_at := now();
    if (select count(*) from public.reportes where usuario_id = new.usuario_id and creado_at > now() - interval '1 hour') >= 10 then
        raise exception 'Demasiados reportes en poco tiempo. Intenta más tarde.';
    end if;
    return new;
end $$;
create trigger antispam_reportes before insert on public.reportes
    for each row execute function public.limitar_reportes();

-- =====================================================================
-- Seguridad a nivel de fila (RLS): quién puede leer y escribir qué.
-- Sin estas reglas, cualquiera con la clave pública podría modificar todo.
-- =====================================================================
alter table public.perfiles enable row level security;
alter table public.locales enable row level security;
alter table public.encuestas_locales enable row level security;
alter table public.encuesta_preguntas enable row level security;
alter table public.platos enable row level security;
alter table public.patrocinios enable row level security;
alter table public.eventos enable row level security;
alter table public.promociones enable row level security;
alter table public.cierres_mes enable row level security;
alter table public.resenas enable row level security;
alter table public.resena_likes enable row level security;
alter table public.resena_fotos enable row level security;
alter table public.foto_likes enable row level security;
alter table public.videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.favoritos enable row level security;
alter table public.quiero_ir enable row level security;
alter table public.guardados enable row level security;
alter table public.seguidores enable row level security;
alter table public.reportes enable row level security;
alter table public.moderacion enable row level security;

-- Perfiles: todos ven nombre y avatar; cada uno edita lo suyo (nombre, @usuario, preferencias),
-- pero nunca su rol ni el bloqueo
create policy "perfiles visibles" on public.perfiles for select using (true);
create policy "editar mi perfil" on public.perfiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "admin gestiona perfiles" on public.perfiles for all using (public.es_admin());

-- Solo un administrador puede cambiar el rol o el bloqueo de una cuenta
create function public.proteger_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    -- auth.role() es 'authenticated' para usuarios de la app; en el SQL Editor o con la clave de servicio no aplica
    if (new.rol is distinct from old.rol or new.bloqueado is distinct from old.bloqueado)
       and coalesce(auth.role(), '') in ('authenticated', 'anon') and not public.es_admin() then
        raise exception 'No tienes permiso para cambiar el rol o el bloqueo.';
    end if;
    return new;
end $$;
create trigger proteger_perfil before update on public.perfiles
    for each row execute function public.proteger_perfil();

-- Catálogo (locales, platos, eventos, promociones, patrocinios, cierres del mes): lectura pública, escritura solo admin
create policy "locales visibles" on public.locales for select using (activo or public.es_admin());
create policy "admin edita locales" on public.locales for all using (public.es_admin()) with check (public.es_admin());
create policy "platos visibles" on public.platos for select using (true);
create policy "admin edita platos" on public.platos for all using (public.es_admin()) with check (public.es_admin());
create policy "eventos visibles para cuentas" on public.eventos for select using (auth.uid() is not null);
create policy "admin edita eventos" on public.eventos for all using (public.es_admin()) with check (public.es_admin());
create policy "promociones visibles para cuentas" on public.promociones for select using (auth.uid() is not null);
create policy "admin edita promociones" on public.promociones for all using (public.es_admin()) with check (public.es_admin());
create policy "patrocinios visibles" on public.patrocinios for select using (true);
create policy "admin edita patrocinios" on public.patrocinios for all using (public.es_admin()) with check (public.es_admin());
create policy "cierres visibles" on public.cierres_mes for select using (true);
create policy "admin cierra el mes" on public.cierres_mes for all using (public.es_admin()) with check (public.es_admin());

-- Encuesta a los dueños: privada, solo el admin la ve y la edita
create policy "solo admin ve encuestas" on public.encuestas_locales for all using (public.es_admin()) with check (public.es_admin());
create policy "solo admin ve preguntas" on public.encuesta_preguntas for all using (public.es_admin()) with check (public.es_admin());

-- Reseñas: se ven las publicadas (y las propias). Se pueden crear publicadas o pendientes;
-- lo que protege contra fotos falsas es que cada foto queda oculta hasta que la IA la verifica (ver resena_fotos).
create policy "resenas visibles" on public.resenas for select
    using (estado = 'publicada' or usuario_id = auth.uid() or public.es_admin());
create policy "crear mi resena" on public.resenas for insert
    with check (usuario_id = auth.uid() and public.puede_publicar()
                and likes = 0 and estado in ('publicada', 'pendiente'));
create policy "borrar mi resena" on public.resenas for delete using (usuario_id = auth.uid() or public.es_admin());
create policy "admin modera resenas" on public.resenas for update using (public.es_admin()) with check (public.es_admin());

create policy "likes visibles" on public.resena_likes for select using (true);
create policy "dar like" on public.resena_likes for insert with check (usuario_id = auth.uid() and public.puede_publicar());
create policy "quitar like" on public.resena_likes for delete using (usuario_id = auth.uid());

-- Fotos de reseñas: todos ven las verificadas de reseñas publicadas; el dueño y el admin ven todas.
-- Se suben siempre sin verificar, a la reseña propia y a la carpeta propia.
-- Solo el admin (o la función verificar-foto, con la clave de servicio) las marca como verificadas.
create policy "fotos visibles" on public.resena_fotos for select
    using ((verificada and exists (select 1 from public.resenas r where r.id = resena_id and r.estado = 'publicada'))
           or usuario_id = auth.uid() or public.es_admin());
create policy "subir foto a mi resena" on public.resena_fotos for insert
    with check (usuario_id = auth.uid() and public.puede_publicar()
                and verificada = false and likes = 0
                and starts_with(path, auth.uid()::text || '/')
                and exists (select 1 from public.resenas r where r.id = resena_id and r.usuario_id = auth.uid()));
create policy "admin verifica fotos" on public.resena_fotos for update using (public.es_admin()) with check (public.es_admin());
create policy "borrar mi foto" on public.resena_fotos for delete using (usuario_id = auth.uid() or public.es_admin());

create policy "likes foto visibles" on public.foto_likes for select using (true);
create policy "dar like foto" on public.foto_likes for insert with check (usuario_id = auth.uid() and public.puede_publicar());
create policy "quitar like foto" on public.foto_likes for delete using (usuario_id = auth.uid());

-- Videos: públicos los aprobados; se envían siempre como pendientes
create policy "videos visibles" on public.videos for select
    using (estado = 'aprobado' or usuario_id = auth.uid() or public.es_admin());
create policy "compartir video" on public.videos for insert
    with check (usuario_id = auth.uid() and public.puede_publicar() and estado = 'pendiente' and likes = 0);
create policy "borrar mi video" on public.videos for delete using (usuario_id = auth.uid() or public.es_admin());
create policy "admin modera videos" on public.videos for update using (public.es_admin()) with check (public.es_admin());

create policy "likes video visibles" on public.video_likes for select using (true);
create policy "dar like video" on public.video_likes for insert with check (usuario_id = auth.uid() and public.puede_publicar());
create policy "quitar like video" on public.video_likes for delete using (usuario_id = auth.uid());

-- Favoritos, "quiero ir" y guardados: privados de cada usuario
create policy "mis favoritos" on public.favoritos for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "mis quiero ir" on public.quiero_ir for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
create policy "mis guardados" on public.guardados for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Seguidores: todos ven quién sigue a quién; cada uno sigue o deja de seguir solo por sí mismo
create policy "seguidores visibles" on public.seguidores for select using (true);
create policy "seguir" on public.seguidores for insert with check (seguidor_id = auth.uid() and public.puede_publicar());
create policy "dejar de seguir" on public.seguidores for delete using (seguidor_id = auth.uid());

-- Reportes: cada usuario crea y ve los suyos; el admin los ve y resuelve todos
create policy "crear reporte" on public.reportes for insert
    with check (usuario_id = auth.uid() and public.puede_publicar() and estado = 'abierto');
create policy "ver reportes" on public.reportes for select using (usuario_id = auth.uid() or public.es_admin());
create policy "admin resuelve reportes" on public.reportes for update using (public.es_admin()) with check (public.es_admin());

create policy "solo admin modera" on public.moderacion for all using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- Almacenamiento de archivos
-- Cada usuario sube solo a su carpeta:
--   fotos-resenas/<su id>/<archivo>.jpg
--   videos/<su id>/<archivo>.mp4   y la portada en videos/<su id>/portadas/<archivo>.jpg
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-resenas', 'fotos-resenas', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Videos de hasta 60 MB (las imágenes son para las portadas)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 62914560,
        array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "subir mis fotos" on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos-resenas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar mis fotos" on storage.objects for delete to authenticated
    using (bucket_id = 'fotos-resenas' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));

create policy "subir mis videos" on storage.objects for insert to authenticated
    with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar mis videos" on storage.objects for delete to authenticated
    using (bucket_id = 'videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));

-- =====================================================================
-- Tiempo real: avisa a la app cuando hay reseñas, fotos o videos nuevos,
-- para que el feed de Reseñas se actualice solo (sin recargar).
-- Respeta las mismas reglas de seguridad de arriba.
-- =====================================================================
do $$ begin
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        alter publication supabase_realtime add table public.resenas, public.resena_fotos, public.videos;
    end if;
end $$;

-- =====================================================================
-- Después de crear tu cuenta en la app, conviértete en administrador
-- (reemplaza el correo y ejecuta solo esta línea):
-- update public.perfiles set rol = 'admin' where id = (select id from auth.users where email = 'tu-correo@ejemplo.cl');
-- =====================================================================
