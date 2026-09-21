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
-- 0. Las 9 tablas existen y se llaman como creemos
-- ==============================================================
-- Los nombres se dedujeron de los select/insert del cliente, así que
-- pueden no coincidir con el esquema real. Sin esta comprobación, un
-- nombre equivocado aborta el script en mitad del `alter table` de
-- abajo con un error de una sola línea, y quedan tablas sin RLS y sin
-- que nadie se entere. Esto lo dice todo junto y antes de tocar nada.
--
-- Son 9 en dos categorías, y la diferencia importa:
--
--   DEL CONTRATO (8)  llevan políticas más abajo; la app las usa.
--   SELLADAS (1)      RLS activo y CERO políticas, a propósito. Ver §9.1.

do $$
declare
  del_contrato text[] := array[
    'profiles',
    'residuos_publicados',
    'intereses',
    'servicios_transporte',
    'residuos_gestion_ambiental',
    'cumplimiento_transporte',
    'empresas_registro'
  ];
  selladas text[] := array[
    'residuos_transporte_doc',
    'transporte_documentacion'
  ];
  faltan text[];
begin
  select array_agg(t order by t) into faltan
  from unnest(del_contrato || selladas) as t
  where to_regclass('public.' || quote_ident(t)) is null;

  if faltan is not null then
    raise exception
      'No existen estas tablas en public: %. Corrige los nombres en este script (y en CONTRATO-RLS.md) antes de seguir; no se ha aplicado nada.',
      array_to_string(faltan, ', ');
  end if;
end $$;


-- ==============================================================
-- 1. Activar RLS  (Prioridad 1)
-- ==============================================================
-- Sin esto, todo lo demás es decorativo: la llave publishable es
-- pública, así que una tabla sin RLS está abierta a cualquiera.
--
-- Explícito y para las 9, sin dar por hecho que alguna ya lo tenía:
-- `enable row level security` es idempotente, así que repetirlo sobre
-- una tabla que ya lo tiene activo no cuesta nada ni da error.
--
-- Nota sobre quién NO queda sujeto a esto: el dueño de la tabla y los
-- roles con el atributo `bypassrls` —en Supabase, `service_role`—
-- siguen viéndolo todo. Es deliberado: esa llave es secreta y solo se
-- usa desde el servidor. Los roles del navegador (`anon` y
-- `authenticated`) no son dueños de nada, así que para ellos `enable`
-- basta y no hace falta `force row level security`.

alter table public.profiles                   enable row level security;
alter table public.residuos_publicados        enable row level security;
alter table public.intereses                  enable row level security;
alter table public.servicios_transporte       enable row level security;
alter table public.residuos_gestion_ambiental enable row level security;
alter table public.cumplimiento_transporte    enable row level security;
alter table public.transporte_documentacion   enable row level security;
alter table public.empresas_registro          enable row level security;

-- Sellada a propósito (§9.1). Ya tenía RLS activo antes de este
-- script; se repite aquí para que su protección deje de depender de
-- que alguien la activara una vez a mano.
alter table public.residuos_transporte_doc    enable row level security;


-- ==============================================================
-- 1.1 Confirmar que quedó activo, antes de crear ninguna política
-- ==============================================================
-- No basta con haber ejecutado el `alter`: aquí se lee el catálogo y
-- se aborta si alguna de las 9 sigue sin RLS. La verificación de §12
-- llega al final, cuando ya se habrían aplicado las 300 líneas
-- restantes sobre tablas abiertas.

do $$
declare
  esperadas text[] := array[
    'profiles',
    'residuos_publicados',
    'intereses',
    'servicios_transporte',
    'residuos_gestion_ambiental',
    'cumplimiento_transporte',
    'transporte_documentacion',
    'empresas_registro',
    'residuos_transporte_doc'
  ];
  abiertas text[];
begin
  select array_agg(c.relname::text order by c.relname) into abiertas
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and c.relname = any(esperadas)
    and not c.relrowsecurity;

  if abiertas is not null then
    raise exception
      'RLS sigue desactivado en: %. No se crean políticas sobre tablas abiertas.',
      array_to_string(abiertas, ', ');
  end if;

  raise notice 'RLS activo en las % tablas cubiertas.', array_length(esperadas, 1);
end $$;


-- ==============================================================
-- 1.2 ¿Hay alguna tabla que este script no cubre?
-- ==============================================================
-- Las 9 de arriba son las que hay hoy. Toda tabla fuera de esa lista
-- es una decisión que nadie ha tomado:
--
--   · sin RLS  -> abierta a cualquiera con la llave publishable;
--   · con RLS y sin política -> sellada, y si la app la usa, se queda
--     en blanco sin dar ningún error.
--
-- La primera versión de esta comprobación solo miraba las tablas SIN
-- RLS, así que el segundo caso se le escapaba: `residuos_transporte_doc`
-- pasó por aquí sin decir nada y solo apareció en el diagnóstico de
-- §12.1, al final del script. Ahora se reporta toda tabla ajena a la
-- lista, en el estado que sea.
--
-- Avisa en vez de abortar: puede ser una tabla legítima que aún no se
-- ha contemplado. Pero si aparece algo aquí, va a CONTRATO-RLS.md
-- antes de dar el despliegue por terminado.

do $$
declare
  cubiertas text[] := array[
    'profiles',
    'residuos_publicados',
    'intereses',
    'servicios_transporte',
    'residuos_gestion_ambiental',
    'cumplimiento_transporte',
    'transporte_documentacion',
    'empresas_registro',
    'residuos_transporte_doc'
  ];
  huerfanas text[];
begin
  select array_agg(
           c.relname::text ||
           case
             when not c.relrowsecurity then ' (SIN RLS: abierta)'
             when not exists (
               select 1 from pg_policies p
               where p.schemaname = 'public' and p.tablename = c.relname
             ) then ' (RLS sin politicas: sellada)'
             else ' (con politicas ajenas a este script)'
           end
           order by c.relname
         ) into huerfanas
  from pg_class c
  where c.relnamespace = 'public'::regnamespace
    and c.relkind = 'r'
    and c.relname <> all(cubiertas);

  if huerfanas is not null then
    raise warning
      'Tablas en public que este script NO cubre: %. Decide qué hacer con ellas y anotalo en CONTRATO-RLS.md.',
      array_to_string(huerfanas, ', ');
  end if;
end $$;


-- ==============================================================
-- 1.3 Borrar TODA política anterior sobre estas tablas
-- ==============================================================
-- Esta sección existe por un fallo real, encontrado el 2026-09-17 por
-- las pruebas de aceptación. Merece la pena entenderlo entero.
--
-- El script creaba sus políticas precedidas de `drop policy if exists`
-- con LOS NOMBRES QUE ÉL MISMO USA. Parecía suficiente y no lo era:
-- el proyecto tenía además políticas creadas a mano desde el panel de
-- Supabase, con otros nombres, que el script nunca tocaba.
--
-- Y en Postgres varias políticas PERMISIVAS se combinan con OR. Basta
-- que UNA permita para que la operación pase, por muy estricta que sea
-- la de al lado. Sobre residuos_publicados convivían:
--
--   residuos_inserta                   with check (... mi_rol()='proveedor')
--   insert_residuos_any_authenticated  with check (true)
--
-- La segunda anulaba por completo a la primera. Un comprador podía
-- publicar residuos, que es justo lo que C4 existe para impedir. Había
-- siete agujeros así repartidos por cinco tablas.
--
-- Lo peor es que NADA lo delataba: la política correcta existía y
-- estaba bien escrita, así que el diagnóstico de §12.1 —que lee el
-- catálogo— daba todo por bueno. Solo apareció al intentar de verdad
-- la operación que debía fallar (`npm run verificar:politicas`).
--
-- Por eso ahora se borra todo y se reconstruye: este archivo pasa a
-- ser la ÚNICA fuente de verdad de las políticas de estas tablas. Si
-- una política no está escrita aquí, no existe.
--
-- ⚠️ CONSECUENCIA: cualquier política que alguien añada desde el panel
-- desaparecerá la próxima vez que se corra esto. Es deliberado. Lo que
-- haga falta se añade a este archivo, se comenta y se versiona.
--
-- ⚠️ SI EL SCRIPT FALLA A PARTIR DE AQUÍ, las tablas quedan con RLS y
-- sin políticas: selladas. La app dejaría de leer datos. No es un
-- estado peligroso —falla cerrado, no abierto— pero hay que volver a
-- correr el script entero para salir de él.

do $$
declare
  gestionadas text[] := array[
    'profiles',
    'residuos_publicados',
    'intereses',
    'servicios_transporte',
    'residuos_gestion_ambiental',
    'cumplimiento_transporte',
    'transporte_documentacion',
    'empresas_registro',
    'residuos_transporte_doc'
  ];
  politica record;
  borradas int := 0;
begin
  for politica in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(gestionadas)
  loop
    execute format(
      'drop policy %I on public.%I',
      politica.policyname,
      politica.tablename
    );
    borradas := borradas + 1;
  end loop;

  raise notice 'Políticas anteriores borradas: %. Se recrean abajo.', borradas;
end $$;


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

-- Lectura: SOLO el propio perfil.
--
-- Aquí ponía `using (true)` con un comentario que decía "los ajenos
-- solo por su nombre público". Ese comentario describía una intención
-- que la política no podía cumplir: **RLS no filtra columnas**. Es la
-- misma trampa que C3 cierra para el UPDATE, y se había colado en el
-- SELECT.
--
-- El efecto real era que cualquier usuario con sesión podía hacer
--
--   supabaseClient.from("profiles").select("*")
--
-- y llevarse la tabla entera: el correo de todas las empresas
-- registradas. Un problema del mismo tamaño que dejar `empresas_registro`
-- abierta, que es justo lo que §10 evita.
--
-- Se cierra a `auth.uid() = id` porque es lo que la app necesita y ni
-- una fila más: las tres lecturas de profiles —core/sesion.js y las dos
-- de data/perfiles.js— filtran ya por el id del propio usuario, y
-- ninguna página muestra quién publicó un residuo.
--
-- ⚠️ Si algún día el marketplace tiene que mostrar el nombre de la
-- empresa que publica, NO se vuelve a `using (true)`: eso reabriría la
-- fuga de correos. Se expone solo lo público, con una vista
-- (`create view empresas_publicas as select id, company_name from
-- profiles`) o denormalizando el nombre en la propia publicación.
create policy "perfil_lectura" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

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


-- C2 pide las DOS cosas, no una: el DEFAULT hace irrelevante el
-- user_id que mande el cliente, y el WITH CHECK lo rechaza si no
-- coincide. Estas dos tablas tenían solo el WITH CHECK — que basta para
-- cerrar el agujero, pero deja la mitad de la defensa sin poner y la
-- asimetría invita a que alguien copie el patrón incompleto.
alter table public.residuos_gestion_ambiental
  alter column user_id set default auth.uid();

alter table public.cumplimiento_transporte
  alter column user_id set default auth.uid();


-- ==============================================================
-- 8.1 Qué servicios tienen documentación, sin enseñar cuál
-- ==============================================================
-- El comprador necesita saber si un transportista tiene sus papeles en
-- regla antes de contratarlo. Pero `cumplimiento_propio` (§8) restringe
-- cumplimiento_transporte a su dueño, y con razón: ahí están las rutas
-- de permisos, licencias y seguros, documentación regulatoria que no es
-- asunto de los demás.
--
-- La salida NO es abrir la tabla con `using (true)`. Eso es exactamente
-- la trampa que §4 acaba de cerrar en profiles: RLS no filtra columnas,
-- así que "solo para ver si tiene papeles" acabaría entregando las
-- rutas de los documentos de todas las empresas.
--
-- Se expone lo mínimo con una vista: tres booleanos por servicio. Ni
-- rutas, ni user_id, ni el texto de las prácticas.
--
-- `security_invoker = false` es deliberado y es el mecanismo: la vista
-- se ejecuta con los permisos de su dueño, así que atraviesa la RLS de
-- la tabla base. Por eso la seguridad de esta sección está en QUÉ
-- columnas devuelve el select, no en una política. Es también el
-- default en PostgreSQL 15+, pero se escribe explícito: si algún día
-- cambia el default, este archivo dice qué se quería.
--
-- Agrega con bool_or porque cada envío del formulario inserta una fila
-- nueva (es un historial, no un update): un transportista puede subir
-- los permisos un día y los seguros otro.

create or replace view public.transporte_cumplimiento_resumen
with (security_invoker = false) as
select
  c.servicio_id,
  bool_or(c.permisos_urls        is not null) as tiene_permisos,
  bool_or(c.certificaciones_urls is not null) as tiene_certificaciones,
  bool_or(c.seguros_urls         is not null) as tiene_seguros
from public.cumplimiento_transporte c
group by c.servicio_id;

revoke all on public.transporte_cumplimiento_resumen from public;
grant select on public.transporte_cumplimiento_resumen to anon, authenticated;


-- ==============================================================
-- 9. transporte_documentacion   — SELLADA A PROPÓSITO
-- ==============================================================
-- Hasta ahora esta tabla tenía `documentacion_lectura` con
-- `using (true)`, creada porque comprador-servicios-transporte le pedía
-- los datos para pintar los badges de documentación.
--
-- El problema: NADIE ESCRIBE NUNCA EN ELLA. El formulario de transporte
-- responsable guarda en cumplimiento_transporte (§8), con otras
-- columnas y otro vocabulario:
--
--   escribe:  permisos_urls · certificaciones_urls · seguros_urls
--   leía:     tipo ∈ (permiso, licencia, bitacora)
--
-- Las dos mitades de la función hablaban con tablas distintas. El
-- efecto era que un transportista subía toda su documentación y los
-- compradores seguían viendo "Sin documentación ✗ ✗ ✗", mientras el
-- propio transportista veía "Docs OK" en su página. Dos vistas del
-- mismo servicio que se contradecían.
--
-- DECISIÓN: la fuente de verdad es cumplimiento_transporte. El cliente
-- ahora lee la vista de §8.1, y esta tabla queda sellada igual que
-- §9.1: RLS activo y CERO políticas. La política anterior se borra en
-- §1.3 junto con las demás y aquí no se recrea ninguna.
--
-- No se borra la tabla por si contiene datos de alguna prueba anterior.
-- Si algún día se confirma que está vacía, el borrado es limpio: ya no
-- queda código que la nombre.


-- ==============================================================
-- 9.1 residuos_transporte_doc   — SELLADA A PROPÓSITO
-- ==============================================================
-- Tabla que existe en la base pero que NO aparece en ninguna parte del
-- código: ni en public/js, ni en los HTML, ni en la documentación.
-- Todo apunta a que es un nombre anterior de transporte_documentacion
-- (§9), que sí se usa, y que quedó abandonado durante el desarrollo.
--
-- DECISIÓN: se conserva, no se borra.
--
-- Y al conservarla, el estado correcto es el que ya tenía: RLS activo
-- y CERO políticas. Eso la deja sellada — nadie la lee ni la escribe
-- desde el navegador. Para una tabla sin uso, sellada es lo más seguro
-- que puede estar; lo peligroso sería lo contrario.
--
-- Por eso aquí NO se crea ninguna política. La ausencia es el
-- contenido de esta sección, y está escrita para que se lea como una
-- decisión y no como un olvido.
--
-- Si algún día la app pasa a usarla, hará falta:
--   1. una columna de propiedad (hoy no se le conoce ninguna),
--   2. sus políticas, siguiendo el patrón de §5 a §8,
--   3. sacarla de la lista `selladas` de §0 y de la excepción de §12.1.
--
-- Mientras tanto, §12.1 la excluye de 'RLS SIN NINGUNA POLITICA' — no
-- para esconderla, sino para que ese diagnóstico siga significando
-- "cada fila es un problema". Una excepción declarada en un sitio vale
-- más que un aviso que se aprende a ignorar.


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

-- Los dos buckets de cumplimiento guardan permisos y licencias, no
-- fotos de catálogo. Privados: es el punto 6 de CONTRATO-RLS.md §1.
--
-- Esta línea estuvo bloqueada a propósito mientras
-- gestion-ambiental.html y transporte-responsable.html usaban
-- getPublicUrl(): al volver privado el bucket, esas URLs dejan de
-- resolver y los documentos ya subidos se pierden de vista.
--
-- Ese bloqueo ya no aplica. La migración movió las dos páginas a
-- js/data/cumplimiento.js, que guarda RUTAS en vez de URLs, y
-- referenciar() firma tanto las rutas nuevas como las URLs completas
-- que quedaron en las filas antiguas. Ninguna página llama ya a
-- getPublicUrl().
--
-- ⚠️ Lo que sí sigue siendo cierto: urlsDeDocumentos() existe en
-- data/cumplimiento.js pero NINGUNA página la llama todavía. Hoy los
-- documentos se suben y no se muestran en ningún sitio, así que este
-- cambio no rompe nada visible. La pantalla que acabe mostrándolos
-- tiene que usar esa función desde el primer día: con los buckets ya
-- privados, una URL pública no funcionaría y el fallo sería inmediato
-- en vez de silencioso.

update storage.buckets set public = false where id in ('gestion-ambiental', 'docs-transporte');

update storage.buckets set public = true where id in ('residuos-fotos', 'fotos-transporte', 'company-logos');

-- Igual que §1.3, y por el mismo motivo: borrar solo los cuatro
-- nombres propios no basta. El 2026-09-17 se encontraron aquí OCHO
-- políticas heredadas del panel, cinco de ellas agujeros:
--
--   read_docs_transporte      select to public using (bucket_id='docs-transporte')
--
-- Esa daba a CUALQUIERA, anónimos incluidos, la documentación
-- regulatoria de todas las empresas. Y no la habría cerrado volver el
-- bucket privado: el flag `public` del bucket gobierna la URL directa,
-- pero la lectura por API la decide esta política.
--
-- Las otras cuatro permitían subir a un bucket sin comprobar
-- `foldername[1] = auth.uid()`, es decir, escribir en la carpeta de
-- otra empresa. Esa convención es el único cimiento de la separación
-- per-usuario en Storage (CLAUDE.md §3).
--
-- Se borran TODAS y se recrean las cuatro de abajo, que cubren los
-- cinco buckets. Lo que no esté escrito aquí, no existe.
do $$
declare
  politica record;
  borradas int := 0;
begin
  for politica in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
  loop
    execute format('drop policy %I on storage.objects', politica.policyname);
    borradas := borradas + 1;
  end loop;

  raise notice 'Políticas de storage.objects borradas: %. Se recrean abajo.', borradas;
end $$;

-- Una sola política con `in (...)` en vez de cinco casi idénticas: el
-- efecto es el mismo y hay un objeto que revisar, no cinco que puedan
-- divergir. El criterio es el de CONTRATO-RLS.md C6, igual para los
-- cinco buckets: el primer segmento de la ruta es el id de quien sube.
create policy "sube_en_su_carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('residuos-fotos','fotos-transporte','company-logos',
                  'gestion-ambiental','docs-transporte')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Misma lista de buckets que la de subida, y no por simetría estética:
-- sin el filtro de bucket_id esta política alcanza CUALQUIER bucket de
-- storage.objects, incluido uno que se cree mañana. Ese bucket nuevo
-- nacería con borrado abierto a todo usuario autenticado sobre su
-- propia carpeta, antes de que nadie le escriba una política pensada.
create policy "borra_en_su_carpeta" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('residuos-fotos','fotos-transporte','company-logos',
                  'gestion-ambiental','docs-transporte')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "lee_publicos" on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('residuos-fotos','fotos-transporte','company-logos'));

-- Sin esta, urlFirmada() no puede firmar nada: createSignedUrl() exige
-- permiso de lectura de base sobre el objeto. Con el bucket privado y
-- sin esta política, la pantalla de documentos saldría vacía sin dar un
-- solo error. La prueba 5 del verificador lo comprueba en los dos
-- sentidos: que el dueño SÍ lee, y que nadie más.
create policy "lee_privados_propios" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('gestion-ambiental','docs-transporte')
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ==============================================================
-- 11.1 Por qué NO hay política de UPDATE en storage.objects
-- ==============================================================
-- Son cuatro políticas y no cinco a propósito. La app nunca reemplaza
-- un archivo: core/almacenamiento.js sube con `upsert: false` y nombra
-- cada objeto con crypto.randomUUID(), así que dos subidas del mismo
-- fichero nunca colisionan. Toda subida es un INSERT.
--
-- Una política que no cubre ninguna operación real es superficie de
-- ataque sin contrapartida, así que no se escribe.
--
-- ⚠️ Si algún día hace falta reemplazar archivos —editar el logo en su
-- sitio, versionar un documento—, el orden importa: PRIMERO la política
-- aquí, DESPUÉS el `upsert: true`. Al revés, la petición pasa a ser un
-- UPDATE, RLS la deniega, y el usuario ve un error de subida sin
-- ninguna pista de la causa. `almacenamiento.test.js` fija ese flag en
-- false para que el cambio no se cuele sin pensarlo.
--
-- create policy "reemplaza_en_su_carpeta" on storage.objects
--   for update to authenticated
--   using (
--     bucket_id in ('residuos-fotos','fotos-transporte','company-logos',
--                   'gestion-ambiental','docs-transporte')
--     and (storage.foldername(name))[1] = auth.uid()::text
--   )
--   with check (
--     bucket_id in ('residuos-fotos','fotos-transporte','company-logos',
--                   'gestion-ambiental','docs-transporte')
--     and (storage.foldername(name))[1] = auth.uid()::text
--   );


-- ==============================================================
-- 12. Verificación
-- ==============================================================
-- ⚠️ El SQL Editor de Supabase muestra el resultado de la ÚLTIMA
-- consulta, y no siempre enseña los mensajes de `raise notice` ni
-- `raise warning`. Por eso el diagnóstico es UNA sola consulta que
-- devuelve FILAS: lo que no se ve, no sirve de nada.
--
-- Para leer los listados detallados del final, selecciónalos con el
-- ratón y pulsa Run: el editor ejecuta solo lo seleccionado.

-- --------------------------------------------------------------
-- 12.1 Diagnóstico — cada fila es un problema
-- --------------------------------------------------------------
-- Sin filas = todo correcto.
--
-- Excepción esperada: mientras la línea de buckets privados de §11
-- siga comentada, saldrán 'gestion-ambiental' y 'docs-transporte'.
-- Es correcto que aparezcan; es el punto 6 de CONTRATO-RLS.md §1.

select 'TABLA SIN RLS' as problema,
       c.relname::text as objeto,
       'Abierta a cualquiera que tenga la llave publishable' as detalle
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and not c.relrowsecurity

union all

-- RLS activo y cero políticas no es seguridad: es un cierre total.
-- La tabla deja de responder y la página que la usa se queda vacía.
--
-- Excepciones declaradas: residuos_transporte_doc (§9.1) y
-- transporte_documentacion (§9) están selladas a propósito. Se excluyen
-- aquí para que cada fila de este diagnóstico siga siendo un problema de
-- verdad; un aviso permanente que hay que aprender a ignorar acaba
-- tapando los que sí importan.
select 'RLS SIN NINGUNA POLITICA',
       c.relname::text,
       'Nadie puede leer ni escribir; la app verá la tabla vacía'
from pg_class c
where c.relnamespace = 'public'::regnamespace
  and c.relkind = 'r'
  and c.relrowsecurity
  and c.relname <> all(array['residuos_transporte_doc', 'transporte_documentacion'])
  and not exists (
    select 1 from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname
  )

union all

select 'BUCKET QUE DEBERIA SER PRIVADO',
       b.id,
       'Documentacion regulatoria accesible por URL adivinada'
from storage.buckets b
where b.id in ('gestion-ambiental', 'docs-transporte')
  and b.public

order by 1, 2;


-- --------------------------------------------------------------
-- 12.2 Listados detallados (ejecutar seleccionando cada uno)
-- --------------------------------------------------------------

-- select relname as tabla, relrowsecurity as rls_activo
-- from pg_class
-- where relnamespace = 'public'::regnamespace and relkind = 'r'
-- order by relname;

-- select tablename, policyname, cmd, roles
-- from pg_policies where schemaname = 'public'
-- order by tablename, cmd;

-- select id, public from storage.buckets order by id;
