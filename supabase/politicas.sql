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
-- 0.0 Tablas que crea este script
-- ==============================================================
-- `mensajes` es la única tabla que nace aquí; las demás existían antes
-- y este archivo solo les pone políticas.
--
-- Por qué una tabla y no exponer correos: un marketplace necesita que
-- las dos empresas se hablen, y las dos formas de conseguirlo son
-- enseñar el correo del otro o conversar dentro de la app. La primera
-- reabriría la fuga que §4 acaba de cerrar —cualquier cuenta podría
-- recolectar los correos de todos los proveedores— así que el contacto
-- vive aquí dentro y NINGÚN correo cruza entre empresas.
--
-- Un hilo se identifica por la publicación más las dos partes. La
-- publicación es un residuo O un servicio, nunca los dos: lo fija la
-- restricción `una_sola_publicacion`, porque una fila con las dos
-- referencias en null sería un mensaje que no cuelga de nada y no
-- aparecería en ninguna conversación.

create table if not exists public.mensajes (
  id              uuid        primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  residuo_id      uuid references public.residuos_publicados(id)  on delete cascade,
  servicio_id     uuid references public.servicios_transporte(id) on delete cascade,

  remitente_id    uuid not null default auth.uid()
                  references auth.users(id) on delete cascade,
  destinatario_id uuid not null
                  references auth.users(id) on delete cascade,

  cuerpo          text not null,
  leido_at        timestamptz,

  constraint una_sola_publicacion check (
    (residuo_id is not null) <> (servicio_id is not null)
  ),
  constraint cuerpo_no_vacio check (length(btrim(cuerpo)) > 0),
  constraint no_hablar_solo check (remitente_id <> destinatario_id)
);

-- Las tres consultas que hace la app: el hilo de una publicación, la
-- bandeja de cada parte y el recuento de no leídos.
create index if not exists mensajes_residuo_idx     on public.mensajes (residuo_id, created_at);
create index if not exists mensajes_servicio_idx    on public.mensajes (servicio_id, created_at);
create index if not exists mensajes_destinatario_idx on public.mensajes (destinatario_id, leido_at);


-- ==============================================================
-- 0. Las 10 tablas existen y se llaman como creemos
-- ==============================================================
-- Los nombres se dedujeron de los select/insert del cliente, así que
-- pueden no coincidir con el esquema real. Sin esta comprobación, un
-- nombre equivocado aborta el script en mitad del `alter table` de
-- abajo con un error de una sola línea, y quedan tablas sin RLS y sin
-- que nadie se entere. Esto lo dice todo junto y antes de tocar nada.
--
-- Son 10 en dos categorías, y la diferencia importa:
--
--   DEL CONTRATO (8)  llevan políticas más abajo; la app las usa.
--   SELLADAS (2)      RLS activo y CERO políticas, a propósito. Ver §9 y §9.1.
--
-- `mensajes` la crea §0.0, así que para cuando se llega aquí ya existe.

do $$
declare
  del_contrato text[] := array[
    'profiles',
    'residuos_publicados',
    'intereses',
    'servicios_transporte',
    'residuos_gestion_ambiental',
    'cumplimiento_transporte',
    'empresas_registro',
    'mensajes'
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
alter table public.mensajes                   enable row level security;

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
    'residuos_transporte_doc',
    'mensajes'
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
    'residuos_transporte_doc',
    'mensajes'
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
    'residuos_transporte_doc',
    'mensajes'
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
-- 1.4 Columnas del alta de cuenta (2026-09-22)
-- ==============================================================
-- El registro pasó de "nombre + tipo" a la ficha de empresa que pide
-- docs/cambios-plataforma.md §1. Tres columnas nuevas:
--
--   nombre_comercial  opcional, "cómo te conocen tus clientes"
--   rfc               obligatorio, 12 o 13 caracteres, en MAYÚSCULAS
--   roles             TODAS las casillas que marcó la empresa
--
-- `company_name` pasa a significar razón social. No se renombra a
-- propósito: de él cuelga la vista empresas_publicas (§7.2), y tocar
-- esa vista es un cambio del contrato C7.
--
-- `roles` es un dato, no un permiso. Quien manda sigue siendo
-- company_type (decisión D-3 de docs/plan-de-trabajo.md): mi_rol() y
-- las cinco políticas de escritura leen ese, no este. El día que los
-- roles múltiples sean de verdad, este arreglo es el punto de partida
-- y el cambio será de políticas, no de formulario.

alter table public.profiles
  add column if not exists nombre_comercial text,
  add column if not exists rfc              text,
  add column if not exists roles            text[];

-- Un RFC identifica a UNA empresa (D-11). El índice es parcial porque
-- las cuentas anteriores al 2026-09-22 no tienen RFC: sin el WHERE,
-- todas ellas competirían por el mismo valor nulo en algunos motores.
create unique index if not exists profiles_rfc_unico
  on public.profiles (rfc)
  where rfc is not null;


-- ==============================================================
-- 1.5 Ficha técnica del residuo (2026-09-22)
-- ==============================================================
-- El formulario de publicar pasó de siete campos de texto libre a la
-- ficha de docs/cambios-plataforma.md §4. Ocho columnas nuevas:
--
--   material_clave            clave del Catálogo de Residuos de Manejo
--                             Especial. HOY ES PROVISIONAL: las de
--                             verdad están sin capturar (CLAUDE.md §0.1)
--   cantidad_lote / unidad    el número y su unidad, separados; antes
--                             era una sola cadena ("500 kg por mes")
--   precio                    por unidad. Sin él no hay comisión que
--                             calcular, y era obligatorio en el §4
--   nivel_procesamiento       sin procesar / separado / compactado /
--                             triturado
--   condicion_detalle         qué impurezas trae, si las trae
--   humedad                   solo cartón y plásticos
--   declaracion_no_peligroso  la casilla que firma el generador
--
-- `tipo` se queda y pasa a guardar el NOMBRE del material del catálogo.
-- No se renombra: de esa columna cuelgan la búsqueda del comprador y
-- todas las publicaciones anteriores a esta fecha.
--
-- Ninguna política cambia. `residuos_catalogo` sigue filtrando por
-- estado y `residuos_inserta` sigue exigiendo rol de proveedor: la
-- ficha añade columnas, no una forma nueva de escribir.
--
-- ⚠️ La declaración NO es un control de seguridad. Es una afirmación
-- del generador, con valor legal (documento maestro §04), no una
-- comprobación: nadie verifica que el material sea lo que dice.

alter table public.residuos_publicados
  add column if not exists material_clave           text,
  add column if not exists cantidad_lote            numeric,
  add column if not exists unidad                   text,
  add column if not exists precio                   numeric,
  add column if not exists nivel_procesamiento      text,
  add column if not exists condicion_detalle        text,
  add column if not exists humedad                  numeric,
  add column if not exists declaracion_no_peligroso boolean default false;


-- ==============================================================
-- 2. Alta de cuenta: el trigger es la única vía para company_type
-- ==============================================================
-- Corrige la carrera de script.js:404. El cliente ya envía los datos
-- en options.data de signUp(); aquí se copian a profiles en la misma
-- transacción que crea el usuario, así que no hay ventana de tiempo.
--
-- Y es la única vía también para rfc y roles. Si el navegador pudiera
-- escribirlos, una empresa se cambiaría el rol o el RFC después de que
-- el equipo revisara su expediente — la misma escalada que cierra C3.
-- Por eso NO entran en el `grant update` de §4.

create or replace function public.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, company_name, nombre_comercial, rfc,
    company_type, roles, created_at, updated_at
  )
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'company_name',
    nullif(new.raw_user_meta_data ->> 'nombre_comercial', ''),
    nullif(upper(new.raw_user_meta_data ->> 'rfc'), ''),
    new.raw_user_meta_data ->> 'company_type',
    -- roles llega como arreglo JSON: ["proveedor","comprador"].
    -- Si no viene (cuenta creada por otra vía), se asume el principal,
    -- para que la columna nunca quede nula contradiciendo a company_type.
    coalesce(
      (select array_agg(valor)
         from jsonb_array_elements_text(
                coalesce(new.raw_user_meta_data -> 'roles', '[]'::jsonb)
              ) as valor),
      array[new.raw_user_meta_data ->> 'company_type']
    ),
    now(),
    now()
  )
  on conflict (id) do update
    set company_name     = coalesce(public.profiles.company_name,     excluded.company_name),
        nombre_comercial = coalesce(public.profiles.nombre_comercial, excluded.nombre_comercial),
        rfc              = coalesce(public.profiles.rfc,              excluded.rfc),
        company_type     = coalesce(public.profiles.company_type,     excluded.company_type),
        roles            = coalesce(public.profiles.roles,            excluded.roles),
        email            = coalesce(public.profiles.email,            excluded.email);
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
-- 3.1 ¿Está libre este RFC?
-- ==============================================================
-- El índice único de §1.4 ya impide el duplicado, pero lo rechaza el
-- motor: al navegador le llega "Database error saving new user", que no
-- le dice nada a quien se está registrando. Esta función existe para
-- poder avisar ANTES, con una frase entendible.
--
-- Devuelve un booleano y nada más. No expone de quién es el RFC, ni
-- cuántos hay, ni ninguna fila: es el mismo criterio de C7 —enseñar un
-- dato derivado sin abrir la tabla— llevado a una función.
--
-- Concesión aceptada: quien tenga una lista de RFC puede averiguar,
-- uno por uno, cuáles están registrados en EcoConnect. El RFC de una
-- empresa es público y el índice único revelaría lo mismo intentando
-- el alta, así que no abre nada nuevo. Si algún día molesta, la
-- solución es limitar el ritmo, igual que en §10.
--
-- SECURITY DEFINER porque profiles solo se lee a sí mismo (§4): sin
-- esto, quien no ha iniciado sesión no vería ningún RFC y la función
-- respondería "libre" siempre.

create or replace function public.rfc_disponible(rfc_consultado text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles
    where rfc = upper(trim(rfc_consultado))
  );
$$;

revoke execute on function public.rfc_disponible(text) from public;
grant  execute on function public.rfc_disponible(text) to anon, authenticated;


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
-- 7.1 mensajes   (conversaciones entre las dos empresas)
-- ==============================================================

drop policy if exists "mensajes_propios"  on public.mensajes;
drop policy if exists "mensajes_envia"    on public.mensajes;
drop policy if exists "mensajes_marca"    on public.mensajes;

-- Lectura: solo las dos partes del hilo. No hay "dueño del residuo ve
-- todos los mensajes sobre su residuo": cada conversación es con una
-- empresa concreta y las demás no son asunto suyo.
create policy "mensajes_propios" on public.mensajes
  for select to authenticated
  using (auth.uid() = remitente_id or auth.uid() = destinatario_id);

-- Envío: firmas con tu propio uid y el hilo cuelga de una publicación
-- en la que UNA de las dos partes es el dueño.
--
-- Eso es lo que impide que dos desconocidos usen la tabla como chat
-- general: si el remitente no es el dueño, el destinatario tiene que
-- serlo, así que un comprador solo puede escribir a quien publicó.
--
-- ⚠️ Limitación conocida y aceptada: el dueño de una publicación puede
-- escribir primero a cualquiera. Es deliberado —un proveedor querrá
-- responder a quien mostró interés— pero significa que cualquiera puede
-- publicar un residuo y con eso ganar permiso para escribir a otros. No
-- es peor que el formulario de contacto sin límite de tasa que ya hay
-- (§10), y la solución de los dos es la misma: limitar el ritmo. Está
-- anotado en CLAUDE.md §7.
create policy "mensajes_envia" on public.mensajes
  for insert to authenticated
  with check (
    auth.uid() = remitente_id
    and (
      exists (
        select 1 from public.residuos_publicados r
        where r.id = residuo_id
          and (r.user_id = remitente_id or r.user_id = destinatario_id)
      )
      or exists (
        select 1 from public.servicios_transporte s
        where s.id = servicio_id
          and (s.user_id = remitente_id or s.user_id = destinatario_id)
      )
    )
  );

-- Marcar como leído. Misma trampa que C3: RLS no filtra columnas, así
-- que sin el grant de abajo esta política dejaría reescribir el CUERPO
-- de un mensaje recibido. Nadie debe poder editar lo que otro escribió.
create policy "mensajes_marca" on public.mensajes
  for update to authenticated
  using (auth.uid() = destinatario_id)
  with check (auth.uid() = destinatario_id);

revoke update on public.mensajes from authenticated;
grant  update (leido_at) on public.mensajes to authenticated;

-- Sin política de DELETE a propósito: un mensaje enviado no se borra
-- desde el navegador. Es el registro de lo que se acordó entre dos
-- empresas, y borrarlo unilateralmente destruiría la mitad de una
-- conversación ajena.


-- ==============================================================
-- 7.2 empresas_publicas   (cómo se llama la otra parte)
-- ==============================================================
-- Una conversación necesita un nombre: "Conversación con Peñoles", no
-- "con 8f3a-...". Pero §4 cerró profiles a `auth.uid() = id`, así que
-- nadie puede leer el perfil de otra empresa — y eso no se toca.
--
-- Es el mismo caso que §8.1, resuelto igual y por la razón de C7: una
-- vista que selecciona SOLO lo público. Aquí el nombre comercial, que
-- las empresas ya publican al usar el marketplace. El correo NO entra:
-- es justo lo que esta arquitectura existe para no repartir.
--
-- ⚠️ Añadir `email` a esta vista tiraría por tierra §4 y todo el
-- modelo de mensajería. Si algún día hace falta un contacto directo,
-- se pide consentimiento explícito y se registra, no se añade aquí.
--
-- Se concede también a `anon`, y es deliberado: el catálogo ya es
-- público (§5 y §6 dejan leer residuos y servicios sin sesión), así que
-- ocultar quién publica solo serviría para que dos anuncios del mismo
-- material fueran indistinguibles. Un nombre comercial en un
-- marketplace es información que la empresa publica al usarlo.
--
-- ⚠️ TRAMPA DE SUPABASE, aprendida aquí: la primera versión ponía
--
--     revoke all on ... from public;
--     grant select on ... to authenticated;
--
-- creyendo que eso dejaba fuera a los anónimos. No lo hacía. Supabase
-- trae `alter default privileges in schema public grant all on tables
-- to anon, authenticated`, así que el objeto NACE con permiso para
-- `anon`; y `revoke ... from public` quita el del pseudo-rol PUBLIC,
-- que es otra cosa. Anon seguía leyendo.
--
-- Es el mismo patrón que perfil_lectura: un comentario prometiendo algo
-- que el SQL no cumplía. Para EXCLUIR a los anónimos de verdad hace
-- falta nombrarlos: `revoke select on ... from anon;`

create or replace view public.empresas_publicas
with (security_invoker = false) as
select p.id, p.company_name
from public.profiles p;

revoke all on public.empresas_publicas from public;
grant select on public.empresas_publicas to anon, authenticated;


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
-- 8.2 expediente_documentos   (2026-09-22)
-- ==============================================================
-- Los permisos ambientales que sube cada empresa
-- (docs/cambios-plataforma.md §2). Sustituye a la documentación
-- genérica de `residuos_gestion_ambiental` y `cumplimiento_transporte`,
-- que pedía papeles iguales para todos: aquí cada rol tiene los suyos.
--
-- `estado` y `motivo_rechazo` los mueve el EQUIPO, no la empresa. En la
-- fase 1 eso se hace a mano desde este panel (CLAUDE.md §0.1), y por eso
-- no hay política que deje al dueño cambiarlos: la de UPDATE de abajo
-- existe para corregir un documento antes de enviarlo, no para
-- aprobárselo uno mismo.
--
-- ⚠️ Esa es la razón de que el `with check` repita la condición del
-- `using`: sin él, el dueño podría cambiar el user_id de su fila y
-- colgársela a otra empresa.

create table if not exists public.expediente_documentos (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users(id) on delete cascade,
  bloque         text not null,
  tipo_documento text not null,
  subtipo        text,
  autoridad      text,
  numero_oficio  text,
  fecha          date,
  vigencia       date,
  archivo_ruta   text,
  notas          text,
  -- Qué materiales del catálogo ampara este documento. Las
  -- autorizaciones de la SMA son POR RESIDUO (Reglamento de la Ley de
  -- Residuos de Coahuila): una recicladora autorizada para PET no puede
  -- recibir cobre.
  materiales     text[],
  estado         text not null default 'pendiente',
  motivo_rechazo text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Un documento por tipo y empresa... salvo las tres autorizaciones.
--
-- La regla original valía para la constancia fiscal: nadie tiene dos, y
-- volver a subirla debe sustituir a la anterior en vez de acumular
-- copias que nadie sabe cuál es la buena.
--
-- Pero la SMA autoriza POR ESTABLECIMIENTO: una empresa con tres
-- plantas tiene tres registros de generador, cada uno con su oficio y
-- sus materiales. Por eso quedan fuera del índice (2026-09-22).
drop index if exists public.expediente_documento_unico;

create unique index if not exists expediente_documento_unico
  on public.expediente_documentos (user_id, tipo_documento)
  where tipo_documento not in
    ('registro_generador', 'autorizacion_sma', 'autorizacion_transporte');

alter table public.expediente_documentos enable row level security;

drop policy if exists "expediente_propio"      on public.expediente_documentos;
drop policy if exists "expediente_inserta"     on public.expediente_documentos;
drop policy if exists "expediente_actualiza"   on public.expediente_documentos;
drop policy if exists "expediente_borra"       on public.expediente_documentos;

create policy "expediente_propio" on public.expediente_documentos
  for select to authenticated
  using (auth.uid() = user_id);

create policy "expediente_inserta" on public.expediente_documentos
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy "expediente_actualiza" on public.expediente_documentos
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "expediente_borra" on public.expediente_documentos
  for delete to authenticated
  using (auth.uid() = user_id);

-- El dueño NO puede tocar el veredicto del equipo. RLS no filtra
-- columnas (C3, C7): sin este grant, la política de UPDATE de arriba
-- dejaría a cualquiera ponerse `estado = 'aprobado'`.
revoke update on public.expediente_documentos from authenticated;
grant  update (bloque, tipo_documento, subtipo, autoridad, numero_oficio,
               fecha, vigencia, archivo_ruta, notas, materiales, updated_at)
  on public.expediente_documentos to authenticated;

-- Para una tabla que ya existía antes del 2026-09-22.
alter table public.expediente_documentos
  add column if not exists materiales text[];


-- ==============================================================
-- 8.3 Estado de la cuenta y envío a revisión
-- ==============================================================
-- El estado decide qué puede hacer una empresa
-- (docs/cambios-plataforma.md §3). Es, por tanto, exactamente lo que el
-- navegador no puede escribir: una empresa que se pone `verificado`
-- sola deja sin sentido toda la revisión.
--
-- `volumen_anual` sí lo escribe ella: es un dato declarado para el
-- Score (§10), no un permiso.

alter table public.profiles
  add column if not exists estado        text not null default 'pendiente',
  add column if not exists volumen_anual numeric;

grant update (location, logo_url, updated_at, volumen_anual)
  on public.profiles to authenticated;

-- El único movimiento de estado que puede pedir el navegador, y no
-- elige el resultado: de `pendiente` o `rechazado` a `en_revision`.
-- Cualquier otro salto —a `verificado`, sobre todo— lo hace el equipo.
--
-- Devuelve el estado que quedó, para que la página no tenga que
-- adivinarlo ni asumir que funcionó.
create or replace function public.enviar_expediente_a_revision()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  nuevo text;
begin
  update public.profiles
     set estado = 'en_revision', updated_at = now()
   where id = auth.uid()
     and estado in ('pendiente', 'rechazado')
  returning estado into nuevo;

  -- Sin fila actualizada, el estado es otro (ya en revisión, verificado
  -- o vencido). Se devuelve el que hay en vez de fingir un cambio.
  if nuevo is null then
    select estado into nuevo from public.profiles where id = auth.uid();
  end if;

  return nuevo;
end;
$$;

revoke execute on function public.enviar_expediente_a_revision() from public;
grant  execute on function public.enviar_expediente_a_revision() to authenticated;


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
                  'gestion-ambiental','docs-transporte','expedientes')
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
                  'gestion-ambiental','docs-transporte','expedientes')
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
    bucket_id in ('gestion-ambiental','docs-transporte','expedientes')
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
--                   'gestion-ambiental','docs-transporte','expedientes')
--     and (storage.foldername(name))[1] = auth.uid()::text
--   )
--   with check (
--     bucket_id in ('residuos-fotos','fotos-transporte','company-logos',
--                   'gestion-ambiental','docs-transporte','expedientes')
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
