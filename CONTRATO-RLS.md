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
| 1 | Confirmar que **RLS está activo** en las 8 tablas | 🔴 Bloqueante | [§5](#5-verificación) |
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

```sql
create policy "sube_en_su_carpeta" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'gestion-ambiental'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
```

Los buckets privados obligan al único cambio de código de este contrato:
`getPublicUrl()` → `createSignedUrl(path, segundos)` en `gestion-ambiental.html`
y `transporte-responsable.html`.

---

## 5. Verificación

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

---

## 6. Estado

| Cláusula | Estado | Verificado |
|---|---|---|
| RLS activo en las 8 tablas | ⬜ Pendiente | |
| C1 — Propiedad en `UPDATE`/`DELETE` | ⬜ Pendiente | |
| C2 — Identidad en `INSERT` | ⬜ Pendiente | |
| C3 — `company_type` inmutable | ⬜ Pendiente | |
| C4 — Rol por tabla | ⬜ Pendiente | |
| C5 — Lecturas | ⬜ Pendiente | |
| C6 — Storage | ⬜ Pendiente | |

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
