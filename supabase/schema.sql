-- =====================================================================
-- Mesa Gourmet · Esquema de base de datos para Supabase (PostgreSQL)
-- Cómo usarlo: Supabase > SQL Editor > New query > pegar todo > Run.
-- Ver docs/SUPABASE.md para el paso a paso.
-- =====================================================================

-- ---------- Perfiles de usuario (uno por cuenta de Supabase Auth) ----------
create table public.perfiles (
    id uuid primary key references auth.users (id) on delete cascade,
    nombre text not null check (char_length(nombre) between 2 and 40),
    avatar_url text,
    rol text not null default 'usuario' check (rol in ('usuario', 'admin')),
    producto_favorito text,
    bloqueado boolean not null default false,
    acepto_terminos_at timestamptz,
    creado_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse (el nombre viene en los metadatos del registro)
create function public.crear_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    insert into public.perfiles (id, nombre, acepto_terminos_at)
    values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'nombre', ''), split_part(new.email, '@', 1)), now());
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
    direccion text,
    telefono text,
    whatsapp text,
    instagram text,
    tiktok text,
    website text,
    descripcion text,
    imagen_url text,
    lat double precision not null,
    lng double precision not null,
    horarios jsonb not null default '{}'::jsonb,       -- {"Lunes": "13:00 - 22:45", "Domingo": "Cerrado", ...}
    caracteristicas text[] not null default '{}',
    etiquetas text[] not null default '{}',
    vegano smallint not null default 0 check (vegano between 0 and 5),
    vegetariano smallint not null default 0 check (vegetariano between 0 and 5),
    sin_gluten smallint not null default 0 check (sin_gluten between 0 and 5),
    sin_lactosa smallint not null default 0 check (sin_lactosa between 0 and 5),
    nota_comida numeric(3,1) not null default 0,
    nota_servicio numeric(3,1) not null default 0,
    nota_mg numeric(3,1) not null default 0,
    distinciones text[] not null default '{}',
    encuesta jsonb,                          -- respuestas originales de la encuesta al dueño del local
    activo boolean not null default true,
    creado_at timestamptz not null default now(),
    actualizado_at timestamptz not null default now()
);

create table public.platos (
    id bigint generated always as identity primary key,
    local_id bigint not null references public.locales (id) on delete cascade,
    nombre text not null,
    categoria text not null default 'Otros',
    precio integer not null check (precio >= 0),
    imagen_url text,
    es_bebida boolean not null default false,
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

-- ---------- Contenido de los usuarios ----------
create table public.resenas (
    id uuid primary key default gen_random_uuid(),
    local_id bigint not null references public.locales (id) on delete cascade,
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    productos text[] not null check (cardinality(productos) between 1 and 30),
    foto_path text,                          -- ruta en el bucket "fotos-resenas"
    foto_verificada boolean not null default false,
    nota_comida numeric(3,1) not null check (nota_comida between 1 and 10),
    nota_servicio numeric(3,1) not null check (nota_servicio between 1 and 10),
    comentario text not null check (char_length(comentario) between 10 and 1000),
    gasto integer check (gasto between 0 and 1000000),
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

create table public.videos (
    id uuid primary key default gen_random_uuid(),
    usuario_id uuid not null references public.perfiles (id) on delete cascade,
    local_id bigint not null references public.locales (id) on delete cascade,
    plataforma text not null check (plataforma in ('tiktok', 'instagram')),
    url text not null unique check (url ~ '^https://(www\.)?(tiktok\.com|instagram\.com)/'),
    descripcion text check (char_length(descripcion) <= 120),
    estado text not null default 'pendiente' check (estado in ('aprobado', 'pendiente', 'rechazado')),
    likes integer not null default 0,
    creado_at timestamptz not null default now()
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

-- Fotos que la IA no pudo confirmar y deben revisarse a mano
create table public.moderacion (
    id bigint generated always as identity primary key,
    resena_id uuid not null references public.resenas (id) on delete cascade,
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

create function public.contar_like_video() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    update public.videos set likes = (select count(*) from public.video_likes where video_id = coalesce(new.video_id, old.video_id))
    where id = coalesce(new.video_id, old.video_id);
    return null;
end $$;
create trigger likes_video after insert or delete on public.video_likes
    for each row execute function public.contar_like_video();

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

-- ---------- Antispam: límites por usuario ----------
create function public.limitar_resenas() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
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
alter table public.platos enable row level security;
alter table public.patrocinios enable row level security;
alter table public.eventos enable row level security;
alter table public.promociones enable row level security;
alter table public.resenas enable row level security;
alter table public.resena_likes enable row level security;
alter table public.videos enable row level security;
alter table public.video_likes enable row level security;
alter table public.favoritos enable row level security;
alter table public.reportes enable row level security;
alter table public.moderacion enable row level security;

-- Perfiles: todos ven nombre y avatar; cada uno edita lo suyo, pero nunca su rol ni el bloqueo
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

-- Catálogo (locales, platos, eventos, promociones, patrocinios): lectura pública, escritura solo admin
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

-- Reseñas: se ven las publicadas (y las propias); se crean solo como pendientes,
-- o publicadas si no traen foto. La verificación con IA las publica desde el servidor.
create policy "resenas visibles" on public.resenas for select
    using (estado = 'publicada' or usuario_id = auth.uid() or public.es_admin());
create policy "crear mi resena" on public.resenas for insert
    with check (usuario_id = auth.uid() and public.puede_publicar()
                and likes = 0 and foto_verificada = false
                and (estado = 'pendiente' or (estado = 'publicada' and foto_path is null)));
create policy "borrar mi resena" on public.resenas for delete using (usuario_id = auth.uid() or public.es_admin());
create policy "admin modera resenas" on public.resenas for update using (public.es_admin()) with check (public.es_admin());

create policy "likes visibles" on public.resena_likes for select using (true);
create policy "dar like" on public.resena_likes for insert with check (usuario_id = auth.uid() and public.puede_publicar());
create policy "quitar like" on public.resena_likes for delete using (usuario_id = auth.uid());

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

-- Favoritos: privados de cada usuario
create policy "mis favoritos" on public.favoritos for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Reportes: cada usuario crea y ve los suyos; el admin los ve y resuelve todos
create policy "crear reporte" on public.reportes for insert
    with check (usuario_id = auth.uid() and public.puede_publicar() and estado = 'abierto');
create policy "ver reportes" on public.reportes for select using (usuario_id = auth.uid() or public.es_admin());
create policy "admin resuelve reportes" on public.reportes for update using (public.es_admin()) with check (public.es_admin());

create policy "solo admin modera" on public.moderacion for all using (public.es_admin()) with check (public.es_admin());

-- =====================================================================
-- Almacenamiento de fotos de reseñas
-- Cada usuario sube solo a su carpeta: fotos-resenas/<su id>/<archivo>.jpg
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-resenas', 'fotos-resenas', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "subir mis fotos" on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos-resenas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "borrar mis fotos" on storage.objects for delete to authenticated
    using (bucket_id = 'fotos-resenas' and ((storage.foldername(name))[1] = auth.uid()::text or public.es_admin()));

-- =====================================================================
-- Después de crear tu cuenta en la app, conviértete en administrador
-- (reemplaza el correo y ejecuta solo esta línea):
-- update public.perfiles set rol = 'admin' where id = (select id from auth.users where email = 'tu-correo@ejemplo.cl');
-- =====================================================================
