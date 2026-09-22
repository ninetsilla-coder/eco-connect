# Contrato de seguridad — RLS y Storage

**Proyecto:** Eco Connect
**Fecha de auditoría:** 2026-09-03
**Ámbito:** políticas de acceso en Supabase (Postgres + Storage)

Este documento define **qué debe ser cierto** en Supabase para que la separación
de roles de Eco Connect sea real. No es documentación de lo que hay hoy: es el
contrato contra el cual se verifica.

Regla que lo gobierna todo: **el cliente decide qué se muestra, Postgres decide
qué se puede hacer.** La llave `sb_publishable_...` de `public/js/supabase.js` es
pública por diseño; ocultar botones con `style.display = "none"` no protege nada.

---

## 1. Prioridad de ejecución

> **Los 8 puntos están aplicados y verificados** (último, el 6, el 2026-09-21).
> Esta tabla se conserva como registro del orden en que hubo que hacerlo, no
> como lista de tareas pendientes. El estado vivo está en [§6](#6-estado).

En este orden. Cada punto asume el anterior resuelto.

| # | Acción | Severidad | Referencia |
|---|--------|-----------|------------|
| 1 | Confirmar que **RLS está activo** en las 10 tablas | 🔴 Bloqueante | [§5](#5-verificación) |
| 2 | `USING (auth.uid() = user_id)` en los `UPDATE`/`DELETE` | 🔴 Crítico | [C1](#c1--propiedad-en-escrituras-destructivas) |
| 3 | `WITH CHECK (auth.uid() = user_id)` en los `INSERT` | 🔴 Crítico | [C2](#c2--identidad-no-falsificable-en-inserts) |
| 4 | Bloquear `company_type` en el `UPDATE` de `profiles` | 🟠 Alto | [C3](#c3--el-rol-es-inmutable-desde-el-cliente) |
| 5 | Añadir la comprobación de **rol** en las políticas de escritura | 🟠 Alto | [C4](#c4--el-rol-decide-quién-escribe-qué) |
| 6 | Pasar `gestion-ambiental` y `docs-transporte` a **privados** | 🟠 Alto | [C6](#c6--storage) |
| 7 | Cerrar `SELECT` sobre `empresas_registro` | 🟡 Medio | [C5](#c5--lecturas) |
| 8 | Replicar en la política el filtro de `estado` | 🟡 Medio | [C5](#c5--lecturas) |

Los puntos 1–5 y 7–8 son **configuración en Supabase**: no requieren tocar el
código de la aplicación. Solo el punto 6 obliga a un cambio en el cliente
(`getPublicUrl` → `createSignedUrl`).

---

## 2. Hallazgo que motiva el contrato

> **Auditoría 2026-09-03 — cerrado el 2026-09-18.** Se conserva porque es la
> razón de ser de este documento, pero **ya no describe el estado actual**.

Al auditar, `company_type` aparecía 13 veces en el código y **las 13 eran de
presentación**: navbar, dropdown, texto del perfil y el alta de cuenta. No había
ni una sola comprobación de rol antes de un `insert`, `update` o `delete`.

Consecuencia de entonces: un `comprador` podía publicar residuos y un `proveedor`
podía publicar servicios de transporte. **Si las políticas no comprueban el rol,
los tres roles son en la práctica el mismo rol.**

### Qué sigue siendo cierto, y por diseño

La primera mitad del hallazgo no se ha «arreglado» porque **no era el defecto**:
en el código actual, todo uso de `company_type` sigue siendo de presentación
—`ui/navbar.js` para el dropdown, `pages/index.js` para los paths del home,
`pages/profile.js` para la etiqueta— y **no hay ninguna comprobación de rol antes
de escribir**. Es exactamente lo que manda la regla de este contrato: el cliente
decide qué se muestra, Postgres decide qué se puede hacer. Añadir un `if (rol ===
...)` antes de un `insert` no aportaría seguridad y daría la falsa impresión de
tenerla.

`core/sesion.js` expone `requiereSesion()` y `requiereRol()`, que redirigen. Son
**experiencia de usuario, no control**: evitan aterrizar en una página que no
sirve, y no impiden nada a quien llame a la API directamente.

### Qué cambió

La segunda mitad —la consecuencia— está cerrada. El rol se comprueba en **cinco
políticas de `INSERT`** (`public.mi_rol()`), más la propiedad transitiva de §8.

Y no está cerrada porque las políticas existan: entre el 2026-09-14 y el
2026-09-17 existieron **y aun así un comprador podía publicar**, porque políticas
heredadas del panel las anulaban por `OR` (ver §6). Está cerrada porque se
intentó de verdad la operación y Postgres la rechazó:

| Prueba | Qué intenta |
|---|---|
| 1 | un `comprador` publicando residuos |
| 6 | un `comprador` publicando servicios de transporte |
| 9 | un `proveedor` registrando intereses |
| 10 | un `comprador` subiendo gestión ambiental |
| 11 | un `comprador` subiendo cumplimiento de transporte |
| 12 | documentación colgada de un residuo ajeno |

`npm run verificar:politicas` las repite cuando haga falta.

---

## 3. Función de rol

Las políticas necesitan leer `company_type`, pero consultar `profiles` desde una
política **sobre** `profiles` provoca recursión infinita.

```sql
create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select company_type from public.profiles where id = auth.uid();
$$;
```

> ⚠️ **No usar `auth.jwt() -> 'user_metadata' -> 'company_type'`.** Ese campo lo
> puede reescribir el propio usuario con `auth.updateUser()`: usarlo en una
> política es exactamente la escalada de privilegios que C3 intenta cerrar.

---

## 4. Cláusulas

Nomenclatura: `user_id` es la columna de propiedad en todas las tablas salvo
`profiles`, donde es `id`. Los nombres de columna provienen de los `select` e
`insert` del cliente — **verificar contra el esquema real antes de aplicar.**

### C1 — Propiedad en escrituras destructivas

Cuatro operaciones filtran **solo por `id`**, tomado de un `data-id` del DOM:

| Operación | Ubicación |
|---|---|
| `delete()` servicio | `mis-servicios-transporte.html:199-202` |
| `update({estado})` servicio | `mis-servicios-transporte.html:229-232` |
| `update({estado})` residuo | `mis-residuos.html:421-423` |
| `delete()` interés | `comprador-mis-intereses.html:414-416` |

**Contrato:** ninguna fila puede ser modificada ni borrada por quien no es su
propietario, aunque la petición llegue con un `id` arbitrario.

```sql
create policy "propietario_modifica" on public.servicios_transporte
  for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "propietario_borra" on public.servicios_transporte
  for delete to authenticated
  using (auth.uid() = user_id);
```

Repetir para `residuos_publicados`, `intereses`, `cumplimiento_transporte` y
`residuos_gestion_ambiental`.

> Añadir `.eq("user_id", ...)` en el JavaScript **no sustituye a esta política**:
> un atacante no usa la página, llama a la API directamente. Es defensa en
> profundidad, no el control.

### C2 — Identidad no falsificable en `insert`

Los 5 inserts envían `user_id: user.id` construido en JavaScript:
`publicar-residuos.html:482`, `publicar-servicio-transporte.html:202`,
`transporte-responsable.html:242`, `gestion-ambiental.html:517` y
`comprador-detalle-residuo.html:394`.

**Contrato:** una fila insertada siempre pertenece a quien la inserta.

```sql
alter table public.residuos_publicados
  alter column user_id set default auth.uid();

create policy "inserta_como_uno_mismo" on public.residuos_publicados
  for insert to authenticated
  with check (auth.uid() = user_id);
```

El `DEFAULT` hace irrelevante el valor que mande el cliente; el `WITH CHECK` lo
rechaza si no coincide. Ambos, no uno.

### C3 — El rol es inmutable desde el cliente

`js/profile.js:235-247` envía solo `location`, `logo_url` y `updated_at`. Pero
**RLS no filtra columnas**: con una política `auth.uid() = id`, nada impide
enviar `{ company_type: "logistica" }` y cambiarse de rol.

**Contrato:** `company_type` solo cambia por vía administrativa.

```sql
revoke update on public.profiles from authenticated;
grant  update (location, logo_url, updated_at) on public.profiles to authenticated;

create policy "perfil_propio" on public.profiles
  for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);
```

Sin esta cláusula, todas las demás son decorativas.

### C4 — El rol decide quién escribe qué

**Contrato:** cada tabla acepta escrituras de un solo rol.

| Tabla | Rol autorizado |
|---|---|
| `residuos_publicados` | `proveedor` |
| `residuos_gestion_ambiental` | `proveedor` |
| `servicios_transporte` | `logistica` |
| `cumplimiento_transporte` | `logistica` |
| `intereses` | `comprador` |

```sql
create policy "solo_proveedor_publica" on public.residuos_publicados
  for insert to authenticated
  with check (auth.uid() = user_id and public.mi_rol() = 'proveedor');
```

Además, la propiedad debe ser **transitiva**: un `residuos_gestion_ambiental`
solo puede colgar de un residuo propio, y un `cumplimiento_transporte` de un
servicio propio.

```sql
create policy "gestion_sobre_residuo_propio" on public.residuos_gestion_ambiental
  for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.residuos_publicados r
      where r.id = residuo_id and r.user_id = auth.uid()
    )
  );
```

### C5 — Lecturas

**Contrato:**

- `empresas_registro` acepta `INSERT` de `anon` (el formulario de contacto no
  exige login) y **niega `SELECT` a todos**. Sin esto, la lista de leads
  comerciales es pública.
- `residuos_publicados` y `servicios_transporte` se leen públicamente **solo en
  estado publicado**. El filtro `.eq("estado", "disponible")` de
  `comprador-explorar-residuos.html:296` es del cliente; la política debe
  replicarlo o se exponen borradores e inactivos.
- `intereses` es privado del comprador. Pendiente de decisión de producto: si el
  proveedor debe ver quién se interesó en su residuo, hace falta una política
  adicional acotada a las filas que apuntan a residuos suyos.
- `profiles` se lee **solo a sí mismo** (`auth.uid() = id`). Ver C7.

### C6 — Storage

Los 5 buckets suben con prefijo `${user.id}/` — `publicar-residuos.html:452`,
`gestion-ambiental.html:487`, `transporte-responsable.html:210`,
`publicar-servicio-transporte.html:175`, `js/profile.js:203`. **Esa convención es
correcta** y hace posible la política estándar.

| Bucket | Visibilidad | Motivo |
|---|---|---|
| `residuos-fotos` | Pública | Catálogo |
| `fotos-transporte` | Pública | Catálogo |
| `company-logos` | Pública | Marca |
| `gestion-ambiental` | **Privada** | Documentación regulatoria |
| `docs-transporte` | **Privada** | Permisos y licencias |

**Contrato:** solo el propietario escribe en su carpeta; los dos buckets de
cumplimiento no son legibles por URL adivinada.

El criterio es idéntico para los dos buckets de cumplimiento — el primer
segmento de la ruta tiene que ser el id de quien sube:

```sql
create policy "sube_en_su_carpeta_gestion" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gestion-ambiental'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "sube_en_su_carpeta_docs" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'docs-transporte'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

Y lo mismo para los tres públicos (`residuos-fotos`, `fotos-transporte`,
`company-logos`): que un bucket sea de lectura pública no significa que
cualquiera pueda escribir en la carpeta de otro.

> **Cómo se implementa.** `supabase/politicas.sql` §11 no crea cinco políticas
> casi idénticas: usa una sola con `bucket_id in (...)` sobre los cinco buckets.
> El efecto es el mismo —varias políticas permisivas se combinan con `OR`— y hay
> un objeto que revisar en vez de cinco que pueden divergir. Este documento las
> lista por separado porque describe **qué debe ser cierto** para cada bucket;
> el script elige cómo cumplirlo.

**El mismo criterio vale para el `DELETE`,** y ahí hay un matiz que conviene
fijar: la política de borrado debe estar acotada a esos cinco buckets, igual que
la de subida. Una política de `DELETE` sobre `storage.objects` sin filtro de
`bucket_id` alcanza también a cualquier bucket que se cree en el futuro, antes
de que a nadie le dé tiempo a escribirle una política propia.

**Y el `SELECT` de los buckets privados no es opcional.** `createSignedUrl()`
exige permiso de lectura de base sobre el objeto: sin `lee_privados_propios`, el
dueño tampoco puede firmar, y la pantalla de documentos saldría vacía sin dar un
solo error. Por eso la prueba 5 del verificador comprueba **las dos direcciones**
—que el dueño sí lee y que nadie más— y no solo la denegación: una lectura rota
para todo el mundo también deniega, y pasaría por segura.

**Contrato: NO hay política de `UPDATE`, y es deliberado.** La app nunca
reemplaza un archivo — `core/almacenamiento.js` sube con `upsert: false` y nombra
cada objeto con un UUID, así que toda subida es un `INSERT`. Una política que no
cubre ninguna operación real es superficie de ataque sin contrapartida.
`almacenamiento.test.js` fija ese flag para que no cambie por descuido: con
`upsert: true` la petición pasaría a ser un `UPDATE`, RLS la denegaría, y el
usuario vería un fallo al subir sin ninguna pista de la causa. Si algún día hace
falta reemplazar archivos, **primero** la política (está escrita y comentada en
`politicas.sql` §11.1) y **después** el flag.

Los buckets privados obligan al único cambio de código de este contrato:
`getPublicUrl()` → `createSignedUrl(path, segundos)` en `gestion-ambiental.html`
y `transporte-responsable.html`.

### C7 — Exponer un dato sin exponer su fila

Dos veces ha aparecido la misma necesidad: enseñar *algo* de una fila ajena sin
enseñarla entera. Y las dos veces la solución equivocada es la misma, porque
parece la obvia:

> **`using (true)` no significa "solo lo público".** RLS decide qué FILAS se ven,
> nunca qué COLUMNAS. Una política permisiva de `SELECT` entrega la fila completa
> a cualquiera que pida `select=*`.

**Caso 1 — `profiles`.** La política era `using (true)` con un comentario que
prometía "los ajenos solo por su nombre público". Cualquier sesión podía leer el
correo de todas las empresas registradas. Cerrada a `auth.uid() = id`, que es lo
que la app necesita: sus tres lecturas filtran ya por el id propio.

**Caso 2 — documentación de transporte.** El comprador necesita saber si un
transportista tiene papeles antes de contratarlo, pero `cumplimiento_transporte`
guarda las rutas de permisos, licencias y seguros. Abrirla habría repetido el
caso 1 con documentación regulatoria.

**Contrato:** cuando haga falta exponer un dato derivado de filas ajenas, se hace
con una **vista** que seleccione solo lo público, nunca relajando la política de
la tabla.

```sql
create or replace view public.transporte_cumplimiento_resumen
with (security_invoker = false) as
select c.servicio_id,
       bool_or(c.permisos_urls        is not null) as tiene_permisos,
       bool_or(c.certificaciones_urls is not null) as tiene_certificaciones,
       bool_or(c.seguros_urls         is not null) as tiene_seguros
from public.cumplimiento_transporte c
group by c.servicio_id;

grant select on public.transporte_cumplimiento_resumen to anon, authenticated;
```

`security_invoker = false` es el mecanismo, no un descuido: la vista corre con
los permisos de su dueño y por eso atraviesa la RLS de la tabla base.

**Consecuencia:** es la única pieza del esquema sin política que la respalde, así
que su seguridad vive entera en la lista de columnas del `select`. Las pruebas 17
y 18 de §5 la acotan por los dos lados — que no devuelva las rutas, y que el
comprador sí pueda leerla. Añadir una columna a esa vista es un cambio de
contrato.

```sql
create policy "lead_anonimo" on public.empresas_registro
  for insert to anon, authenticated with check (true);
-- No se crea ninguna política SELECT: con RLS activo, eso ya lo cierra.

create policy "catalogo_publico" on public.residuos_publicados
  for select to anon, authenticated
  using (estado = 'disponible' or auth.uid() = user_id);
```

### C8 — El contacto vive dentro de la app

Un marketplace tiene que dejar que las dos empresas se hablen. Las dos formas de
conseguirlo no son equivalentes:

| | Qué implica |
|---|---|
| Enseñar el correo del que publica | Cualquier cuenta registrada puede recolectar los correos de todos los proveedores. Es la fuga de C7 con otro nombre. |
| **Conversar dentro de la app** | Ningún correo cruza entre empresas. Elegida. |

**Contrato:** `mensajes` es la única tabla donde dos empresas comparten datos, y
lo que comparten es lo que cada una escribe a propósito.

- **Leer** (`mensajes_propios`): solo las dos partes del hilo. No existe "el
  dueño ve todos los mensajes sobre su residuo": cada conversación es con una
  empresa concreta y las demás no son asunto suyo.
- **Escribir** (`mensajes_envia`): firmas con tu `auth.uid()` y el hilo cuelga
  de una publicación en la que **una de las dos partes es el dueño**. Si el
  remitente no lo es, el destinatario tiene que serlo — por eso la tabla no
  puede usarse como chat general entre desconocidos.
- **Marcar leído** (`mensajes_marca`): solo el destinatario, y **solo la columna
  `leido_at`**. Sin el `grant update (leido_at)`, esa política dejaría reescribir
  el `cuerpo` de un mensaje recibido: RLS no filtra columnas, igual que en C3.
- **Borrar**: no hay política. Un mensaje enviado no se borra desde el
  navegador; es el registro de lo que se acordó entre dos empresas.

El nombre de la otra empresa sale de `empresas_publicas` (§7.2), la segunda
aplicación de C7. **El correo no entra ahí**: es justo lo que este diseño existe
para no repartir.

**Limitación aceptada:** el dueño de una publicación puede escribir primero a
cualquiera, así que cualquiera puede publicar un residuo y ganar permiso para
escribir a otros. Es deliberado —un proveedor querrá responder a quien mostró
interés— y no es peor que el formulario de contacto sin límite de tasa de §10.
La solución de los dos es la misma: limitar el ritmo.


---

## 5. Verificación

`supabase/politicas.sql` ya no espera a que alguien corra esto a mano. El script
comprueba por sí mismo, **antes de crear ninguna política**:

| Paso | Qué hace | Si falla |
|---|---|---|
| §0.0 | crea `mensajes`, la única tabla que nace del script | — |
| §0 | que las 10 tablas existan con ese nombre | **aborta** sin aplicar nada |
| §1 | `enable row level security` en las 10, explícito | — |
| §1.1 | relee el catálogo y confirma que quedó activo | **aborta** antes de las políticas |
| §1.2 | busca tablas en `public` sin RLS que el script no cubra | **avisa** (`warning`) |

El paso §1.2 es el que cubre el hueco de este documento: las tablas listadas son
las que se conocían al escribirlo, y una creada después queda abierta sin que
nadie lo note.

**Ya pasó una vez.** La primera ejecución destapó `residuos_transporte_doc`, una
novena tabla que no estaba en este contrato: existe en la base, no la usa ninguna
parte del código, y tenía RLS activo con cero políticas. Todo apunta a que es un
nombre anterior de `transporte_documentacion` abandonado durante el desarrollo.

**Decisión: se conserva, sellada.** RLS activo y sin políticas es el estado más
seguro para una tabla sin uso, así que se deja como está — pero ahora de forma
deliberada y no por accidente: `politicas.sql` §9.1 lo documenta, §1 le aplica el
`enable` explícito para que no dependa de que alguien lo hiciera a mano, y §12.1
la excluye del diagnóstico para que cada fila de ese informe siga siendo un
problema real.

Si algún día la app pasa a usarla, necesita una columna de propiedad (hoy no se
le conoce ninguna), sus políticas, y salir de las dos listas de excepción.

Las consultas de abajo siguen sirviendo para auditar el estado en cualquier
momento, no solo tras desplegar.

```sql
-- 1) ¿RLS activo? Cualquier `false` es una tabla completamente abierta.
select relname as tabla, relrowsecurity as rls_activo
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by relname;

-- 2) Políticas existentes
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname = 'public' order by tablename, cmd;

-- 3) Buckets públicos
select id, public from storage.buckets order by id;
```

Prueba de aceptación, con dos cuentas de rol distinto:

1. Un `comprador` **no** puede insertar en `residuos_publicados`.
2. Un `proveedor` **no** puede borrar el residuo de otro proveedor por `id`.
3. Un usuario **no** puede cambiar su propio `company_type`.
4. Un anónimo **no** puede leer `empresas_registro`.
5. Una URL de `docs-transporte` **no** abre sin firmar.

**Las cuatro primeras están automatizadas:** `npm run verificar:politicas`
(`herramientas/verificar-politicas.mjs`). La quinta sigue siendo manual — el
script no conoce la ruta de ningún objeto sin subir uno primero.

Dos detalles de esa herramienta que conviene entender antes de fiarse de un ✔:

- **Empieza por controles positivos.** Las cinco pruebas comprueban que algo
  *no* se puede hacer, y eso pasa solo si la conexión está rota o la llave es
  inválida. Los controles confirman primero que el catálogo responde y que cada
  cuenta tiene el rol que dice tener.
- **Un `DELETE` o un `UPDATE` denegados por RLS no dan error.** Postgres no
  rechaza la petición: simplemente no toca ninguna fila. Mirar solo el código
  HTTP daría un ✔ falso, así que el script usa `Prefer: return=representation`
  y cuenta las filas afectadas.

Si una prueba de escritura se cuela (fallo real de política), el script borra
la fila que acaba de crear y la reporta como FALLA.

---

## 6. Estado

`supabase/politicas.sql` aplicado el **2026-09-14**.

Hay dos columnas y no una porque significan cosas distintas. **Aplicada** = el
objeto existe en Postgres; lo confirma el diagnóstico de §12.1 leyendo el
catálogo. **Verificada** = hace lo que dice; eso solo lo demuestran las pruebas
de aceptación de §5, con dos cuentas de rol distinto. Una política puede existir
y estar mal escrita.

| Cláusula | Aplicada | Verificada |
|---|---|---|
| RLS activo en las 10 tablas | ✅ 2026-09-14 · `mensajes` 2026-09-21 | ✅ §12.1 no devuelve ninguna `TABLA SIN RLS` |
| C1 — Propiedad en `UPDATE`/`DELETE` | ✅ 2026-09-14 | ✅ 2026-09-18, pruebas 2, 13, 14 y 15 |
| C2 — `WITH CHECK` en `INSERT` | ✅ 2026-09-14 | ✅ 2026-09-17, implícito en 1 y 6 |
| C2 — `DEFAULT auth.uid()` en las 5 | ✅ 2026-09-18 | — (defensa en profundidad) |
| C3 — `company_type` inmutable | ✅ 2026-09-14 | ✅ 2026-09-17, prueba 3 |
| C4 — Rol por tabla (las 5) | 🔴 Rota → corregida 2026-09-17 | ✅ 2026-09-18, pruebas 1, 6, 9, 10 y 11 |
| C4 — Propiedad transitiva | ✅ 2026-09-14 | ✅ 2026-09-18, prueba 12 |
| C5 — Lecturas: `empresas_registro` | ✅ 2026-09-14 | ✅ 2026-09-17, prueba 4 |
| C5 — Lecturas: filtro de `estado` | 🔴 Rota → corregida 2026-09-17 | ✅ 2026-09-17, prueba 7 |
| C6 — Storage: políticas | 🔴 Rota → corregida 2026-09-17 | ✅ 2026-09-17, prueba 8 |
| C6 — Storage: buckets privados (flag `public`) | ✅ 2026-09-21 | ✅ §12.1 no devuelve `BUCKET QUE DEBERIA SER PRIVADO` |
| C7 — Vistas en vez de políticas permisivas | ✅ 2026-09-21 | ✅ 2026-09-21, pruebas 16, 17 y 18 |
| C8 — Mensajería entre empresas | ✅ 2026-09-21 | ✅ 2026-09-21, pruebas 19 a 23 |

> **La 22 y la 23 se validan mutuamente, y por eso van juntas.** `mensajes_marca`
> deja al destinatario hacer `UPDATE`; lo único que le impide reescribir el
> `cuerpo` de lo que recibió es un `grant` de columna, y un `grant` mal puesto no
> se ve leyendo el catálogo — la misma clase de agujero que costó los 12 del
> 2026-09-17.
>
> La 22 sola no bastaría: si el `UPDATE` estuviera roto para todo el mundo,
> también afectaría cero filas y pasaría por segura. La 23 marca `leido_at` sobre
> **la misma fila** y confirma que el `UPDATE` funciona. Cero filas en la 22 con
> una fila en la 23 solo puede significar una cosa: la columna está vetada.

## ✅ Estado al 2026-09-21: 25 pruebas pasan, 0 fallan, 0 saltadas

Verificado contra el proyecto real tras aplicar `politicas.sql`. Las ocho
comprobaciones añadidas ese día:

| # | Qué fija |
|---|---|
| 16 | Un usuario no lee el perfil de otra empresa (cierra la fuga de correos de C7) |
| 17 | La vista de cumplimiento no devuelve `permisos_urls`, `certificaciones_urls`, `seguros_urls` ni `user_id` |
| 18 | Un comprador **sí** puede leer el resumen — sin esto, revocar el grant dejaría la 17 en verde y los badges rotos |
| 19 | Sin sesión no se lee ningún mensaje |
| 20 | Un usuario solo ve los hilos en los que participa |
| 21 | No se puede firmar un mensaje con el `uid` de otro |
| 22 | El destinatario no puede reescribir el `cuerpo` de lo que recibió |
| 23 | El destinatario **sí** puede marcarlo como leído — el par de la 22 |

La 21 y la 22 reutilizan un hilo de prueba que se busca por su cuerpo y solo se
crea si no existe: C8 no tiene política de `DELETE`, así que un mensaje nuevo por
ejecución se acumularía para siempre.

La 8 también se endureció: comprobaba solo el código de estado, y Storage
responde `400` tanto a una petición mal formada como a una denegada por RLS.
Ahora exige que el cuerpo hable de autorización, para que un error del propio
script no pueda dar verde sin que la política llegue a evaluarse.

### Estado anterior (2026-09-18: 17 pruebas)

### Las dos últimas lagunas, cerradas

Revisando los hallazgos originales F1–F6 uno por uno aparecieron dos huecos que
la cuenta de pruebas no delataba:

**F1 nombraba cuatro operaciones destructivas y ninguna estaba probada.** La
prueba 2 cubría el borrado de un residuo — una quinta distinta. Las cuatro que la
auditoría llamó «la vulnerabilidad más explotable del proyecto» (borrar y
desactivar un servicio, desactivar un residuo, borrar un interés) no las
ejercitaba nada. Las cubren las pruebas 13, 14 y 15.

La 14 tiene un diseño que conviene entender: los intereses son privados, así que
el id de uno ajeno **no se puede descubrir desde fuera**. La prueba lo crea con
la cuenta del comprador, intenta borrarlo con la del proveedor y lo limpia. Eso
reproduce a un atacante que haya adivinado el id, que es el caso que importa.

**F2 pedía dos defensas y había puesta una.** `residuos_gestion_ambiental` y
`cumplimiento_transporte` tenían el `WITH CHECK` pero no el `DEFAULT auth.uid()`.
El agujero estaba cerrado —el `WITH CHECK` rechaza un `user_id` falsificado—,
pero C2 dice «ambos, no uno», y una asimetría así invita a copiar el patrón
incompleto. Las cinco tablas lo tienen desde el 2026-09-18.

**El contrato está cerrado.** Las siete cláusulas están aplicadas y verificadas
—no leyendo el catálogo, sino intentando de verdad cada operación que debe
fallar— con dos cuentas de rol distinto y una tercera para probar el acceso a
datos ajenos.

Reproducible en cualquier momento con `npm run verificar:politicas`.

Conviene correrlo **cada vez que alguien toque la configuración de Supabase**, no
solo cuando cambie el SQL: los 12 agujeros del 2026-09-17 no los introdujo un
commit, sino políticas creadas a mano desde el panel.

---


C4 pone una comprobación de rol en el `INSERT` de cinco tablas. Hasta el
2026-09-18 solo dos estaban ejercitadas (`residuos_publicados` y
`servicios_transporte`); las otras tres —`intereses`,
`residuos_gestion_ambiental` y `cumplimiento_transporte`— son las que menos se
tocan, que es donde una política mal escrita puede vivir años sin que nadie la
ejecute. Y la propiedad transitiva no la comprobaba nada.

Las pruebas 9 a 12 cierran esas cuatro lagunas, y distinguen el **código de
error**: si el rechazo viene de una clave foránea (`23503`) en vez de RLS
(`42501`), reportan SALTADA. Una prueba que pasa por violar una FK no ha probado
la política.

La prueba 2 (C1) estuvo saltada varios días porque todos los residuos de la base
pertenecían a la misma cuenta: no había nada ajeno que intentar borrar. Se
resolvió registrando una segunda cuenta `proveedor` y publicando un residuo desde
ella. **Saltada no es pasada**, y C1 —las escrituras destructivas sobre datos de
otros— era la cláusula que más caro costaba dejar sin demostrar.

> Es el requisito de datos que tiene esta suite: hacen falta **tres cuentas** —un
> `comprador`, y dos `proveedor` para que una tenga algo que la otra no posea— y
> al menos un residuo de cada proveedor, uno de ellos en estado distinto de
> `disponible` (prueba 7). Con menos, algunas pruebas salen saltadas y el
> contrato queda a medio demostrar sin que el recuento lo grite.

### Storage tenía el mismo problema, y peor

Revisado `storage.objects` después de limpiar `public`, aparecieron **ocho
políticas heredadas** más, cinco de ellas agujeros:

| Política | Qué abría |
|---|---|
| `read_docs_transporte` | `select to public` sobre todo el bucket: **cualquier anónimo** descargaba los permisos y licencias de todas las empresas |
| `gestion-ambiental 18bzzz3_0` | subir a la carpeta de cualquier empresa |
| `upload_docs_transporte` | ídem |
| `upload_residuos_fotos_authenticated 113fh0g_0` | ídem |
| `allow authenticated upload 1mvdji2_0` | ídem, además con rol `public` |

Las cuatro de subida comprobaban el `bucket_id` pero no
`(storage.foldername(name))[1] = auth.uid()`, que es el único cimiento de la
separación entre empresas en Storage.

> **Volver el bucket privado no habría bastado.** El flag `public` del bucket
> gobierna la URL directa; la lectura por API la decide la política. Con
> `read_docs_transporte` en pie, los documentos habrían seguido siendo
> descargables por cualquiera. Por eso la prueba 5 comprueba **las dos vías**:
> anónimo por URL pública, y con sesión ajena por API.

`politicas.sql` §11 borra ahora todas las políticas de `storage.objects` antes de
crear las suyas, igual que §1.3 con las tablas.

**Total del 2026-09-17: 12 agujeros en 5 tablas y 5 buckets**, todos invisibles
para cualquier herramienta que lea el catálogo.

La limpieza del 2026-09-17 se hizo con `drop policy` dirigidos sobre las 19
políticas heredadas, no re-ejecutando el script. El estado final es el mismo.
`politicas.sql` §1.3 existe para que esto no vuelva a hacer falta: la próxima
ejecución barrerá sola cualquier política que aparezca por fuera.

### Por qué C4 y C5 aparecían aplicadas y estaban rotas

La primera ejecución real de `npm run verificar:politicas` (2026-09-17) destapó
que **un `comprador` podía publicar residuos**. La política del contrato existía
y estaba correctamente escrita; el problema era otro.

El proyecto arrastraba políticas creadas a mano desde el panel de Supabase, con
nombres distintos a los del script. `politicas.sql` solo hacía `drop policy if
exists` de **sus propios nombres**, así que las heredadas sobrevivían intactas. Y
en Postgres las políticas permisivas se combinan con **OR**: basta que una
permita para que la operación pase.

```
residuos_inserta                   with check (... mi_rol() = 'proveedor')
insert_residuos_any_authenticated  with check (true)      ← ganaba esta
```

Eran **siete agujeros en cinco tablas**: INSERT sin comprobar rol en
`residuos_publicados`, `servicios_transporte` e `intereses`; INSERT saltándose la
propiedad transitiva en `cumplimiento_transporte` y `residuos_gestion_ambiental`;
y `SELECT using (true)` en `residuos_publicados` y `servicios_transporte`, que
dejaba ver borradores y vendidos de otras empresas a cualquiera con sesión.

**Ninguna herramienta que lea el catálogo podía detectarlo.** El diagnóstico de
§12.1 confirmaba que la política correcta existía, y era verdad. Solo apareció al
intentar de verdad la operación que debía fallar.

Dos cambios lo cierran:

1. `politicas.sql` §1.3 borra **todas** las políticas de sus tablas antes de
   crear las suyas. El archivo pasa a ser la única fuente de verdad: lo que no
   esté escrito ahí, no existe.
2. El verificador añade las pruebas 6 y 7, una por cada agujero que no era el de
   la prueba 1.

### El punto 6, cerrado — y por qué estuvo bloqueado

Esta sección afirmaba durante días que los buckets de cumplimiento «siguen en
`public = true`» mientras la tabla de arriba los daba por privados desde el
2026-09-17. **Se contradecía sola**, que es exactamente el defecto que este
contrato persigue en el SQL.

La secuencia real, que explica las dos mitades:

| Fecha | Qué pasó |
|---|---|
| 2026-09-17 | Se aplicaron las **políticas** de Storage (`sube_en_su_carpeta`, `lee_privados_propios`…). La tabla de arriba se refiere a esto. |
| — | El **flag `public` del bucket** quedó bloqueado a propósito: las páginas usaban `getPublicUrl()`, y volverlos privados habría hecho ilegibles los documentos ya subidos. |
| 2026-09-21 | La migración movió las páginas a rutas firmadas y `ui/documentos.js` estrenó la pantalla que los muestra. Se descomentó la línea de §11 y se aplicó. |

Confirmado al ejecutar `politicas.sql`: §12.1 devuelve **cero filas**, y esa
consulta incluye `BUCKET QUE DEBERIA SER PRIVADO`. Los dos buckets son privados.

> El bloqueo tenía dos condiciones y las dos se cumplieron: que ninguna página
> llamara a `getPublicUrl()` —hoy `data/cumplimiento.js` guarda rutas y
> `referenciar()` las firma, incluidas las URLs completas de filas antiguas— y
> que `urlsDeDocumentos()` tuviera quien la llamara, porque con los buckets
> privados una URL pública deja de resolver. La segunda se cerró el 2026-09-21:
> `gestion-ambiental` y `transporte-responsable` enlazan ya sus documentos.

---

## 7. Fuera de alcance

Detectado en la auditoría, **no cubierto por este contrato** — son defectos de
aplicación, no de políticas:

- **Carrera en el alta de cuenta.** `js/script.js:404-410` hace `.update()` sobre
  `profiles` asumiendo que un trigger ya creó la fila. Si aún no existe, el update
  afecta 0 filas **sin devolver error** y el usuario queda sin `company_type`. Un
  perfil sin rol es un perfil que `mi_rol()` no puede clasificar, así que esto
  toca el contrato de lado.
- **Versión flotante de `@supabase/supabase-js@2`** cargada por CDN.
- ~~**`transporte_documentacion`**: requiere decidir si sigue en uso.~~
  **Decidido el 2026-09-21: no lo está.** Nadie escribe nunca en ella; el
  formulario de transporte responsable guarda en `cumplimiento_transporte`, con
  otras columnas y otro vocabulario. El badge del comprador la leía, así que
  salía siempre en "Sin documentación" por mucho que el transportista subiera
  sus papeles. El cliente ahora lee la vista de C7 y la tabla queda **sellada**
  (RLS activo, cero políticas) como `residuos_transporte_doc`.
- **Sin límite de tasa** en `empresas_registro`: el formulario es spameable
  aunque las políticas sean correctas.
