-- ==============================================================
-- Eco Connect — Políticas de acceso (implementación de CONTRATO-RLS.md)
-- ==============================================================
-- Ejecutar en el SQL Editor de Supabase, de arriba a abajo.
-- Es idempotente: se puede volver a correr sin romper nada.
--
-- ⚠️ ANTES DE EJECUTAR: los nombres de columna se dedujeron de los
-- select/insert del cliente. Verificar contra el esquema real.
--
-- ⚠️ ORDEN DE DESPLIEGUE: la sección 2 (trigger) debe estar aplicada
-- ANTES de publicar el nuevo js/ui/auth-modal.js, que ya no escribe
-- company_type desde el navegador y delega en este trigger.
-- ==============================================================


-- ==============================================================
-- 1. Activar RLS  (Prioridad 1)
-- ==============================================================
-- Sin esto, todo lo demás es decorativo: la llave publishable es
-- pública, así que una tabla sin RLS está abierta a cualquiera.

alter table public.profiles                   enable row level security;
alter table public.residuos_publicados        enable row level security;
alter table public.intereses                  enable row level security;
alter table public.servicios_transporte       enable row level security;
alter table public.residuos_gestion_ambiental enable row level security;
alter table public.cumplimiento_transporte    enable row level security;
alter table public.transporte_documentacion   enable row level security;
alter table public.empresas_registro          enable row level security;


-- ==============================================================
-- 2. Alta de cuenta: el trigger es la única vía para company_type
-- ==============================================================
-- Corrige la carrera de script.js:404. El cliente ya envía los datos
-- en options.data de signUp(); aquí se copian a profiles en la misma
-- transacción que crea el usuario, así que no hay ventana de tiempo.

create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, company_name, company_type, created_at, updated_at)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'company_name',
    new.raw_user_meta_data ->> 'company_type',
    now(),
    now()
  )
  on conflict (id) do update
    set company_name = coalesce(public.profiles.company_name, excluded.company_name),
        company_type = coalesce(public.profiles.company_type, excluded.company_type),
        email        = coalesce(public.profiles.email,        excluded.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.crear_perfil();


-- ==============================================================
-- 3. Función de rol
-- ==============================================================
-- SECURITY DEFINER para poder leer profiles desde políticas sin
-- provocar recursión infinita en las políticas de la propia tabla.
--
-- ⚠️ NO sustituir por auth.jwt() -> 'user_metadata' -> 'company_type':
-- ese campo lo reescribe el propio usuario con auth.updateUser(), y
-- usarlo aquí reabriría la escalada de privilegios que cierra §5.

create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select company_type from public.profiles where id = auth.uid();
$$;

revoke execute on function public.mi_rol() from public;
grant  execute on function public.mi_rol() to authenticated;


-- ==============================================================
-- 4. profiles
-- ==============================================================

drop policy if exists "perfil_lectura"     on public.profiles;
drop policy if exists "perfil_propio_ins"  on public.profiles;
drop policy if exists "perfil_propio_upd"  on public.profiles;

-- Lectura: el propio perfil siempre; los ajenos solo por su nombre
-- público (el marketplace muestra quién publica).
create policy "perfil_lectura" on public.profiles
  for select to authenticated
  using (true);

create policy "perfil_propio_ins" on public.profiles
  for insert to authenticated
  with check (auth.uid() = id);

create policy "perfil_propio_upd" on public.profiles
  for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- C3 — company_type inmutable desde el cliente.
-- RLS no filtra columnas; esto sí. Sin estas dos líneas cualquiera
-- se cambia de rol enviando {company_type:'logistica'}.
revoke update on public.profiles from authenticated;
grant  update (location, logo_url, updated_at) on public.profiles to authenticated;


-- ==============================================================
-- 5. residuos_publicados        (escribe: proveedor)
-- ==============================================================

drop policy if exists "residuos_catalogo"    on public.residuos_publicados;
drop policy if exists "residuos_inserta"     on public.residuos_publicados;
drop policy if exists "residuos_actualiza"   on public.residuos_publicados;
drop policy if exists "residuos_borra"       on public.residuos_publicados;

-- El filtro .eq("estado","disponible") de comprador-explorar-residuos
-- es del cliente; se replica aquí o se exponen borradores.
create policy "residuos_catalogo" on public.residuos_publicados
  for select to anon, authenticated
  using (estado = 'disponible' or auth.uid() = user_id);

create policy "residuos_inserta" on public.residuos_publicados
  for insert to authenticated
  with check (auth.uid() = user_id and public.mi_rol() = 'proveedor');

create policy "residuos_actualiza" on public.residuos_publicados
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "residuos_borra" on public.residuos_publicados
  for delete to authenticated
  using (auth.uid() = user_id);

alter table public.residuos_publicados
  alter column user_id set default auth.uid();


-- ==============================================================
-- 6. servicios_transporte       (escribe: logistica)
-- ==============================================================
-- Cierra el delete de mis-servicios-transporte.html:199 y el update
-- de :229, que hoy filtran solo por id tomado del DOM.

drop policy if exists "servicios_catalogo"  on public.servicios_transporte;
drop policy if exists "servicios_inserta"   on public.servicios_transporte;
drop policy if exists "servicios_actualiza" on public.servicios_transporte;
drop policy if exists "servicios_borra"     on public.servicios_transporte;

create policy "servicios_catalogo" on public.servicios_transporte
  for select to anon, authenticated
  using (estado = 'activo' or auth.uid() = user_id);

create policy "servicios_inserta" on public.servicios_transporte
  for insert to authenticated
  with check (auth.uid() = user_id and public.mi_rol() = 'logistica');

create policy "servicios_actualiza" on public.servicios_transporte
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "servicios_borra" on public.servicios_transporte
  for delete to authenticated
  using (auth.uid() = user_id);

alter table public.servicios_transporte
  alter column user_id set default auth.uid();


-- ==============================================================
-- 7. intereses                  (escribe: comprador)
-- ==============================================================

drop policy if exists "intereses_propios"  on public.intereses;
drop policy if exists "intereses_inserta"  on public.intereses;
drop policy if exists "intereses_borra"    on public.intereses;

create policy "intereses_propios" on public.intereses
  for select to authenticated
  using (auth.uid() = user_id);

create policy "intereses_inserta" on public.intereses
  for insert to authenticated
  with check (auth.uid() = user_id and public.mi_rol() = 'comprador');

create policy "intereses_borra" on public.intereses
  for delete to authenticated
  using (auth.uid() = user_id);

alter table public.intereses
  alter column user_id set default auth.uid();

-- PENDIENTE DE PRODUCTO: hoy solo el comprador ve sus intereses.
-- Si el proveedor debe ver quién se interesó en su residuo, añadir:
--
-- create policy "intereses_visibles_al_dueno" on public.intereses
--   for select to authenticated
--   using (exists (
--     select 1 from public.residuos_publicados r
--     where r.id = residuo_id and r.user_id = auth.uid()
--   ));


-- ==============================================================
-- 8. Cumplimiento: propiedad transitiva
-- ==============================================================
-- No basta con ser proveedor: la documentación debe colgar de un
-- residuo propio. Igual para transporte sobre servicio propio.

drop policy if exists "gestion_propia"   on public.residuos_gestion_ambiental;
drop policy if exists "gestion_inserta"  on public.residuos_gestion_ambiental;
drop policy if exists "gestion_borra"    on public.residuos_gestion_ambiental;

create policy "gestion_propia" on public.residuos_gestion_ambiental
  for select to authenticated
  using (auth.uid() = user_id);

create policy "gestion_inserta" on public.residuos_gestion_ambiental
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.mi_rol() = 'proveedor'
    and exists (
      select 1 from public.residuos_publicados r
      where r.id = residuo_id and r.user_id = auth.uid()
    )
  );

create policy "gestion_borra" on public.residuos_gestion_ambiental
  for delete to authenticated
  using (auth.uid() = user_id);


drop policy if exists "cumplimiento_propio"  on public.cumplimiento_transporte;
drop policy if exists "cumplimiento_inserta" on public.cumplimiento_transporte;
drop policy if exists "cumplimiento_borra"   on public.cumplimiento_transporte;

create policy "cumplimiento_propio" on public.cumplimiento_transporte
  for select to authenticated
  using (auth.uid() = user_id);

create policy "cumplimiento_inserta" on public.cumplimiento_transporte
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.mi_rol() = 'logistica'
    and exists (
      select 1 from public.servicios_transporte s
      where s.id = servicio_id and s.user_id = auth.uid()
    )
  );

create policy "cumplimiento_borra" on public.cumplimiento_transporte
  for delete to authenticated
  using (auth.uid() = user_id);


-- ==============================================================
-- 9. transporte_documentacion
-- ==============================================================
-- Se lee en comprador-servicios-transporte.html:443 para marcar qué
-- servicios tienen documentación. No se le detectó columna de
-- propiedad: solo lectura hasta decidir si sigue en uso (CLAUDE.md §3).

drop policy if exists "documentacion_lectura" on public.transporte_documentacion;

create policy "documentacion_lectura" on public.transporte_documentacion
  for select to anon, authenticated
  using (true);


-- ==============================================================
-- 10. empresas_registro         (formulario de contacto, sin login)
-- ==============================================================
-- Insert anónimo por diseño. NO se crea política de select: con RLS
-- activo, eso ya deja la lista de leads cerrada al público.

drop policy if exists "lead_anonimo" on public.empresas_registro;

create policy "lead_anonimo" on public.empresas_registro
  for insert to anon, authenticated
  with check (true);


-- ==============================================================
-- 11. Storage
-- ==============================================================
-- Los 5 buckets ya suben con prefijo ${user.id}/ — esa convención es
-- lo que hace posible todo lo de abajo. No romperla.

-- ⚠️ NO EJECUTAR TODAVÍA — bloqueado a propósito.
--
-- Volver privados los buckets de cumplimiento rompe los documentos YA
-- subidos: las filas existentes guardan URLs públicas completas, y
-- gestion-ambiental.html y transporte-responsable.html siguen usando
-- getPublicUrl(). Al pasarlos a privados, esas URLs dejan de resolver.
--
-- Descomentar SOLO cuando esas dos páginas estén migradas a
-- js/data/cumplimiento.js y usen urlFirmada(). Es el punto 6 de la
-- prioridad de CONTRATO-RLS.md.
--
-- update storage.buckets set public = false where id in ('gestion-ambiental', 'docs-transporte');

update storage.buckets set public = true where id in ('residuos-fotos', 'fotos-transporte', 'company-logos');

drop policy if exists "sube_en_su_carpeta"   on storage.objects;
drop policy if exists "borra_en_su_carpeta"  on storage.objects;
drop policy if exists "lee_privados_propios" on storage.objects;
drop policy if exists "lee_publicos"         on storage.objects;

create policy "sube_en_su_carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('residuos-fotos','fotos-transporte','company-logos',
                  'gestion-ambiental','docs-transporte')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "borra_en_su_carpeta" on storage.objects
  for delete to authenticated
  using ((storage.foldername(name))[1] = auth.uid()::text);

create policy "lee_publicos" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('residuos-fotos','fotos-transporte','company-logos'));

create policy "lee_privados_propios" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('gestion-ambiental','docs-transporte')
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ==============================================================
-- 12. Verificación
-- ==============================================================
-- Cualquier rls_activo = false es una tabla completamente abierta.

select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

select tablename, policyname, cmd, roles
from pg_policies where schemaname = 'public'
order by tablename, cmd;

select id, public from storage.buckets order by id;
