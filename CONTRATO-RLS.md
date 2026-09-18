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

En este orden. Cada punto asume el anterior resuelto.

| # | Acción | Severidad | Referencia |
|---|--------|-----------|------------|
| 1 | Confirmar que **RLS está activo** en las 9 tablas | 🔴 Bloqueante | [§5](#5-verificación) |
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

`company_type` aparece 13 veces en el código y **las 13 son de presentación**:
navbar (`js/script.js:52`), dropdown (`js/script.js:94`), texto del perfil
(`js/profile.js:80`) y el alta de cuenta.

**No existe ni una sola comprobación de rol antes de un `insert`, `update` o
`delete`.** Hoy, un `comprador` puede publicar residuos y un `proveedor` puede
publicar servicios de transporte. Si las políticas no comprueban el rol, los tres
roles son en la práctica el mismo rol.

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

```sql
create policy "lead_anonimo" on public.empresas_registro
  for insert to anon, authenticated with check (true);
-- No se crea ninguna política SELECT: con RLS activo, eso ya lo cierra.

create policy "catalogo_publico" on public.residuos_publicados
  for select to anon, authenticated
  using (estado = 'disponible' or auth.uid() = user_id);
```

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

---

## 5. Verificación

`supabase/politicas.sql` ya no espera a que alguien corra esto a mano. El script
comprueba por sí mismo, **antes de crear ninguna política**:

| Paso | Qué hace | Si falla |
|---|---|---|
| §0 | que las 9 tablas existan con ese nombre | **aborta** sin aplicar nada |
| §1 | `enable row level security` en las 8, explícito | — |
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
| RLS activo en las 9 tablas | ✅ 2026-09-14 | ✅ §12.1 no devuelve ninguna `TABLA SIN RLS` |
| C1 — Propiedad en `UPDATE`/`DELETE` | ✅ 2026-09-14 | ⬜ prueba 2 saltada: falta un residuo ajeno |
| C2 — Identidad en `INSERT` | ✅ 2026-09-14 | ✅ 2026-09-17, implícito en 1 y 6 |
| C3 — `company_type` inmutable | ✅ 2026-09-14 | ✅ 2026-09-17, prueba 3 |
| C4 — Rol por tabla (las 5) | 🔴 Rota → corregida 2026-09-17 | ✅ 2026-09-18, pruebas 1, 6, 9, 10 y 11 |
| C4 — Propiedad transitiva | ✅ 2026-09-14 | ✅ 2026-09-18, prueba 12 |
| C5 — Lecturas: `empresas_registro` | ✅ 2026-09-14 | ✅ 2026-09-17, prueba 4 |
| C5 — Lecturas: filtro de `estado` | 🔴 Rota → corregida 2026-09-17 | ✅ 2026-09-17, prueba 7 |
| C6 — Storage: políticas | 🔴 Rota → corregida 2026-09-17 | ✅ 2026-09-17, prueba 8 |
| C6 — Storage: buckets privados | ✅ 2026-09-17 | ✅ 2026-09-17, prueba 5 |

**Estado al 2026-09-18: 13 pruebas pasan, 0 fallan.**

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

Queda una sin cubrir:

- **Prueba 2** (C1, borrar residuo ajeno): saltada porque todos los residuos de
  la base pertenecen a la misma cuenta. Para cubrirla hace falta un residuo
  publicado desde una segunda cuenta `proveedor`. **Saltada no es pasada**: C1 es
  la única cláusula que sigue sin demostrar, y cubre precisamente las escrituras
  destructivas sobre datos ajenos.

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

**Lo único que falta por aplicar es el punto 6 de §1:** `gestion-ambiental` y
`docs-transporte` siguen en `public = true`. La línea que los cierra está
comentada a propósito en `politicas.sql` §11, y por eso el diagnóstico devuelve
esas dos filas cada vez. Son las únicas dos que debe devolver.

> **El motivo de ese bloqueo ya no aplica.** El comentario de §11 dice que
> `gestion-ambiental.html` y `transporte-responsable.html` usan `getPublicUrl()`,
> pero eso se corrigió en la migración: hoy `data/cumplimiento.js` guarda rutas,
> no URLs, y `referenciar()` firma tanto las rutas nuevas como las URLs completas
> de las filas antiguas. Ninguna página llama ya a `getPublicUrl()`.
>
> Queda una comprobación antes de descomentarlo: `urlsDeDocumentos()` existe en
> `data/cumplimiento.js` pero **ninguna página la llama todavía**, así que ahora
> mismo los documentos se suben y no se muestran en ninguna parte. Volver los
> buckets privados no rompe nada visible — no hay nada que mostrar —, pero la
> pantalla que los muestre tendrá que usar esa función desde el primer día.

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
- **`transporte_documentacion`**: aparece una sola vez
  (`comprador-servicios-transporte.html:443`) y no se le detectó columna de
  propiedad. Requiere decidir si sigue en uso antes de escribirle política.
- **Sin límite de tasa** en `empresas_registro`: el formulario es spameable
  aunque las políticas sean correctas.
