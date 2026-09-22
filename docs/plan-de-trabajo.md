# Eco Connect — Plan de trabajo

Estado al 2026-09-22. Rama `prototipo-pitch`.

Este archivo lleva el avance de los cambios descritos en `docs/cambios-plataforma.md`,
en el orden de su sección 13. `CLAUDE.md` §0.1 decide qué se construye de verdad y qué
se simula para el pitch.

**Cómo leer cada ficha:**

- **Archivos**: lo que hay que tocar o crear.
- **Supabase**: si hace falta cambiar tablas, columnas o políticas (eso se aplica a mano
  en el panel, no lo hace el código).
- **Tamaño**: chico (cambios en archivos que ya existen), mediano (algún archivo nuevo o
  varios archivos coordinados), grande (pantallas nuevas + cambios en la base + pruebas).
- **Real o simulado**: según `CLAUDE.md` §0.1.

---

## Decisiones tomadas

Tomadas el 2026-09-22. Mandan sobre cualquier otra lectura de los documentos.

| # | Decisión | Qué significa para el trabajo |
|---|---|---|
| D-1 | **Bloque 1 completo y probado antes de empezar el bloque 2** | Nada del bloque 2 se abre hasta que los tres cambios del bloque 1 pasen `npm test`. Fecha del pitch: **2026-10-26, supuesto de trabajo** (ver el calendario al final); con esa fecha el bloque 2 sí entra |
| D-2 | **El expediente guarda de verdad; pago y manifiesto son de muestra** | Documentos reales en almacenamiento privado; la pantalla de pago y el manifiesto son pantallas con datos de ejemplo |
| D-3 | **Tipo múltiple visible, seguridad con un rol** | El formulario deja marcar varias casillas y **se guarda la lista completa**, pero el menú y las reglas de la base siguen usando un rol principal. Los datos no se pierden para después |
| D-4 | **Generador / Comprador / Transportista en pantalla** | Sólo cambian las etiquetas visibles; por dentro siguen siendo `proveedor`, `comprador` y `logistica` |
| D-5 | **Las dos pantallas viejas de documentos se quedan** | "Gestión ambiental" y "Transporte responsable" siguen hasta que el expediente funcione |
| D-6 | **Los cambios de Supabase se aplican a mano, con instrucciones paso a paso** | Cada cambio de base viene con un texto para pegar y una explicación de dónde pegarlo, escrita para alguien que nunca ha abierto el panel |
| D-7 | **La comisión del 3% se muestra en la publicación** | El comprador ve precio unitario, total del lote y total con comisión |
| D-8 | **El catálogo de materiales vive en el código** | Los 10 materiales en `public/js/data/materiales.js`; cambiarlos es un cambio de programa |
| D-9 | **Habrá datos de ejemplo, con nombres inventados** | Nada de nombres de empresas reales, ni siquiera de las del padrón |
| D-10 | **Las cuentas que ya existen quedan como "verificado"** | Para que la demo no se tope con avisos de expediente incompleto |
| D-11 | **Un RFC no se puede repetir** | Regla en la base que rechaza el registro si el RFC ya está usado |
| D-12 | **En el pitch, una cuenta de ejemplo por rol** | Se enseña con tres cuentas distintas (generadora, compradora, transportista). El selector de modo de la tarea 15 se presenta **como parte del plan con inversión**, no como algo que ya funciona |

**Lo único que sigue abierto:** confirmar la fecha real del pitch. Mientras no esté, se
trabaja contra la del calendario de abajo.

---

## Bloque 1 — antes del pitch

Los tres, completos y con `npm test` en verde, antes de tocar el bloque 2 (D-1).

### 1. [x] Cambiar los textos del sitio (cambios-plataforma §11) — hecho el 2026-09-22

| | |
|---|---|
| **Archivos tocados** | `public/index.html` (12 textos + una FAQ nueva), `public/profile.html`, `public/publicar-residuos.html`, `public/comprador-detalle-residuo.html`, `public/comprador-detalle-servicio-transporte.html`, `public/comprador-servicios-transporte.html`, `public/js/data/perfiles.js`, `public/js/ui/auth-modal.js`, `public/js/pages/` (`profile`, `comprador-explorar-residuos`, `comprador-servicios-transporte`, los dos de detalle), `tests/capa-datos.test.js`, nuevo `tests/textos-sitio.test.js` |
| **Supabase** | No |
| **Tamaño** | Chico |
| **Real o simulado** | Real |

Qué cambió, en corto: "Certificación EcoConnect" → **EcoConnect Score** (portada y perfil);
la comisión pasa a decirse como es, **3% que paga el comprador**; la FAQ de residuos nombra
los diez materiales del catálogo en vez de "y otros"; se añadió la FAQ *"¿EcoConnect
certifica a las empresas?"*; y los roles se leen como **Generador / Comprador /
Transportista** (D-4), traducidos en un solo sitio, `ETIQUETAS_ROL` de `data/perfiles.js`.

Donde antes decía "proveedores confiables" ahora dice **"empresas que registran sus permisos
ambientales para cotejarlos con el padrón público de la SMA"**: describe el proceso sin
prometer que ya ocurrió, porque el cotejo llega con el expediente (tarea 4).

**Lo que no se tocó, a propósito:** "Certificaciones ambientales" en Transporte responsable
y "permisos o certificaciones" en Gestión ambiental. Suena igual pero significa lo
contrario: son certificados que la empresa consigue por su cuenta (ISO 14001, Industria
Limpia), que el documento maestro §06 llama justo así. Tampoco había "5%" ni "proveedores
verificados" en el sitio: esas dos correcciones de §11 son de la presentación, no del código.

**Queda una prueba que lo vigila:** `tests/textos-sitio.test.js` falla si alguien vuelve a
escribir "certificación EcoConnect", "proveedores verificados" o "recicladores certificados"
en cualquier página. Se comprobó que fallaba con los textos viejos antes de corregirlos
(`CLAUDE.md` §5.4.2).

### 2. [x] Modal de crear cuenta: razón social, RFC y tipo múltiple (§1) — hecho el 2026-09-22

| | |
|---|---|
| **Archivos tocados** | `public/js/ui/auth-modal.js` (formulario y alta), `public/index.html` (se le quitó su copia del modal), `public/profile.html` y `public/js/pages/profile.js` (ver los datos nuevos), `public/css/style.css`, `supabase/politicas.sql` (§1.4, §2, §3.1), `tests/dobles/supabase.js`, nuevo `tests/registro.test.js` |
| **Supabase** | **Aplicado el 2026-09-22.** Columnas `nombre_comercial`, `rfc` y `roles` en `profiles`; índice único `profiles_rfc_unico`; función `rfc_disponible()`; trigger `crear_perfil()` actualizado |
| **Tamaño** | Mediano |
| **Real o simulado** | Real |

El formulario vivía **duplicado** en `index.html` y en `auth-modal.js`. Se borró el de la
portada: con tres campos nuevos, registrarse desde el inicio y desde dentro habría acabado
guardando datos distintos sin que nadie lo notara.

El rol principal es la primera casilla marcada en el orden Generador → Comprador →
Transportista, no la primera que se pulsa (lo fija `registro.test.js`). La lista completa
viaja en `roles` aunque hoy no mande, que es D-3.

Salieron tres arreglos de camino, ninguno previsto: el modal **no se podía desplazar** y el
botón de crear cuenta quedaba fuera de alcance; **solo se cerraba con la ×** porque el clic
en el fondo nunca funcionó (ahora también con Escape); y los botones "Mi cuenta" y "Cerrar
sesión" **se salían del encabezado en celular**, porque su bloque no tenía ni una regla de
CSS.

**Pendiente que deja abierto:** `CONTRATO-RLS.md` C9 no tiene prueba automatizada. Que
`rfc` y `roles` no se puedan reescribir desde el navegador está en el `grant`, pero nadie
lo intenta de verdad. Va con la próxima pasada de `verificar:politicas`.

Por D-3, el rol principal (`company_type`) sigue siendo **un solo valor**: `mi_rol()` y las
cinco políticas que deciden quién escribe en cada tabla **no se tocan**, y el menú sigue
mostrando los links de un rol. La lista completa se guarda aparte, sólo como dato.

Dos cuidados que vienen del contrato de seguridad:

- La lista de roles y el RFC los escribe **el trigger**, no el navegador. Si acaban en la
  lista de columnas que el usuario puede modificar, una empresa podría cambiarse de rol
  sola (ver C-3).
- Guardar los campos nuevos desde el perfil **no va a funcionar** hasta ampliar el permiso
  de escritura de `profiles`, y falla en silencio (ver C-3).

### 3. [x] Ficha técnica con catálogo cerrado y declaración (§4) — hecho el 2026-09-22

| | |
|---|---|
| **Archivos tocados** | Nuevos: `public/js/data/materiales.js`, `tests/ficha-tecnica.test.js`. Modificados: `public/publicar-residuos.html`, `public/js/pages/publicar-residuos.js`, `public/js/data/residuos.js`, y las tres pantallas que lo muestran (`comprador-explorar-residuos`, `comprador-detalle-residuo`, `mis-residuos`) |
| **Supabase** | **Sí** (`politicas.sql` §1.5): ocho columnas nuevas en `residuos_publicados`. Ninguna política cambia |
| **Tamaño** | Mediano |
| **Real o simulado** | Real, salvo las claves del catálogo: provisionales (§0.1) |

El material sale de una lista cerrada de diez; lo que no está en ella no se puede publicar,
que es la primera de las tres capas contra los residuos peligrosos (maestro §04). El precio
es obligatorio y el comprador ve el total con la comisión del 3% (D-7).

**Decisiones de compatibilidad, para que no sorprendan:**

- `tipo` se conserva y pasa a guardar el **nombre del material del catálogo**. De esa columna
  cuelgan la búsqueda del comprador y las publicaciones anteriores.
- `cantidad` (texto libre) se sigue escribiendo con la versión legible del número y la
  unidad. Es un dato repetido, asumido a propósito: hay filas viejas que solo entienden esa
  columna y dejarla vacía las dejaría en blanco sin dar ningún error.
- Las publicaciones sin precio **no muestran un total de $0**: se omite la línea.
- Los valores viejos de periodicidad (`unica`, `constante`) se muestran tal cual en vez de
  desaparecer.

**Pendiente heredado:** `material_clave` guarda `PENDIENTE-SMA` en todas. Las claves reales
hacen falta de verdad para el manifiesto (tarea 10), así que hay que capturarlas antes.

---

## Bloque 2 — antes del pitch si da tiempo

No se empieza hasta cerrar el bloque 1 (D-1).

### 4. [ ] Pantalla de expediente por rol (§2)

| | |
|---|---|
| **Archivos** | Nuevos: `public/expediente.html`, `public/js/pages/expediente.js`, `public/js/data/expediente.js`. Modificados: `public/js/ui/estructura.js` (link en el menú), `public/js/ui/auth-modal.js` (llevar ahí tras registrarse). Se reaprovechan `public/js/core/almacenamiento.js` y `public/js/ui/documentos.js` |
| **Supabase** | **Sí.** Tabla nueva de documentos del expediente, con RLS activo y políticas de propiedad (§0.1 no lo relaja). Un bucket privado nuevo, o reusar `gestion-ambiental` con otra subcarpeta |
| **Tamaño** | Grande |
| **Real o simulado** | Subir y guardar documentos: **real** (D-2). La revisión de Ashley: **simulada**, el estado se cambia a mano desde el panel. Las vigencias automáticas: **no se construyen** |

Por D-5, las pantallas de "Gestión ambiental" y "Transporte responsable" se quedan donde
están mientras tanto. Sólo cuando el expediente funcione se decide qué pasa con ellas, y ahí
hay que leer la contradicción C-5 antes de borrar nada.

### 5. [ ] Estados de cuenta e insignias en el perfil (§3)

| | |
|---|---|
| **Archivos** | `public/js/core/sesion.js` (leer el estado junto con el rol), `public/js/data/perfiles.js`, `public/js/pages/profile.js:44-68`, `public/profile.html:23-42`, y los avisos en las páginas de publicar/contactar |
| **Supabase** | **Sí.** Columna `estado` en `profiles`. **No** debe entrar en el permiso de escritura de `politicas.sql:432`: si el usuario puede escribir su propio estado, se verifica solo. Las cuentas que ya existen se marcan "verificado" (D-10) |
| **Tamaño** | Mediano |
| **Real o simulado** | Mostrar el estado y desactivar botones: **real**. Que el estado impida de verdad publicar: sólo si se añade a las políticas (ver C-2). Cambiar de estado: **a mano en el panel** |

Las insignias que otras empresas ven son un cambio de contrato de seguridad, no un cambio
de pantalla. Ver C-4.

**Posible mejora: un estado por rol, en vez de uno por cuenta.** Es lo coherente con
la tarea 15, y el caso real lo pide: una empresa puede tener cotejado su registro de
generador y todavía no su autorización de acopio, así que debería poder **vender
mientras espera para comprar**. Con un estado único por cuenta hay que elegir entre
bloquearla entera o darla por buena entera, y ninguna de las dos es verdad.

Qué implicaría, para decidirlo cuando toque:

- **En la base**, el estado deja de ser una columna en la empresa y pasa a ser una
  fila por rol (empresa + rol + estado + motivo del rechazo). Cambia de "un dato" a
  "una tabla chica", con su RLS.
- **En el expediente**, los bloques ya son por rol, así que encaja casi solo: cada
  bloque se envía a revisión y se aprueba por separado, en vez de todo junto.
- **En los avisos**, el mensaje deja de ser "tu cuenta está pendiente" y pasa a ser
  "puedes vender, pero para comprar nos falta tu autorización de acopio". Es más
  trabajo de redacción que de programación, y es la parte que más se nota.
- **En el prototipo no cambia nada**, porque el estado se mueve a mano desde el
  panel (§0.1): con una cuenta de ejemplo por rol (D-12) el caso mixto ni aparece.
- **El costo de no hacerlo ahora es bajo**: pasar de una columna a una tabla es un
  cambio contenido, y hasta que exista el selector de modo nadie opera con dos roles.

### 6. [ ] Pantalla de pago y manifiesto de ejemplo (§6 y §7)

| | |
|---|---|
| **Archivos** | Nuevos: `public/pago.html`, `public/manifiesto.html` y sus dos `public/js/pages/*.js` |
| **Supabase** | No: los datos son de ejemplo (D-2, D-9) |
| **Tamaño** | Mediano |
| **Real o simulado** | **Simulado entero** (§0.1): desglose con CLABE de ejemplo, botón "Simular pago recibido", manifiesto como vista previa en HTML y firmas como pasos marcados. Sin Stripe, sin PDF, sin doc2sign |

Cada archivo simulado lleva su comentario `// SIMULADO:` explicando qué hará la versión
real (§0.1). Las empresas que aparezcan en el ejemplo son inventadas (D-9).

---

## Bloque 3 — con la inversión

Todo este bloque es **grande**, toca Supabase y no se construye para el pitch. Se listan
para no perderlos de vista.

| | Cambio | Archivos principales | Supabase | Notas |
|---|---|---|---|---|
| 7. [ ] | Corregir políticas de acceso a datos y archivos | `supabase/politicas.sql` | Sí | El contrato actual ya está cerrado y verificado (25 pruebas). Lo que queda es cubrir las tablas nuevas |
| 8. [ ] | Flujo de operación y "Mis operaciones" (§5) | Pantalla nueva + `data/operaciones.js` | Tabla `operaciones` con RLS | Es la pieza sobre la que se apoyan 9, 10, 12 y 13 |
| 9. [ ] | Stripe Connect (§6) | `api/` (función nueva) + pantalla de pago real | Identificadores de Stripe en `profiles` y `operaciones` | Choca con el stack actual, ver C-6 |
| 10. [ ] | Manifiesto pre-llenado y firmas (§7) | Generador de PDF + seguimiento | Columnas de folio y firmas | Necesita una librería de PDF: ver C-6 |
| 11. [ ] | Transporte con cotizaciones (§9) | Reescribe las 3 páginas de transporte | Tablas `solicitudes_transporte` y `cotizaciones` | La regla de 24 h queda fuera (§0.1) |
| 12. [ ] | Disputas, bloqueo, indicador y calificaciones (§8) | Pantallas nuevas | Tablas `disputas` y `calificaciones` | El bloqueo a 72 h necesita algo que corra solo: ver C-7 |
| 13. [ ] | Score, bitácora y reporte premium (§10) | Perfil + exportación | Factores por material en el catálogo | En el prototipo se enseña con datos de ejemplo |
| 14. [ ] | Panel interno de revisión y disputas | Sitio aparte | Rol de equipo | §0.1 lo excluye por completo |
| 15. [ ] | Selector de modo para empresas con varios roles | Encabezado, "Mis operaciones", perfil | Verificación y Score por rol | Diseño completo abajo. **Bloqueado por C-1** |

Aquí es donde vuelve D-3: si alguna vez una empresa tiene que **operar** con dos roles a la
vez, la lista que se guarda desde el bloque 1 es el dato que lo permite, pero las reglas de
la base hay que rehacerlas igual (C-1).

### 15. Selector de modo para empresas con varios roles

Propuesta del equipo, 2026-09-22. **Diseño acordado, sin construir.**

Una empresa puede ser generadora y compradora a la vez (documento maestro §05). El
problema no es guardar los dos roles —eso ya se hace desde la tarea 2— sino qué ve
al entrar, porque el menú y las pantallas son distintas para cada rol.

**La solución no es tener dos cuentas.** Es una sola cuenta con un selector de modo:

| Pieza | Cómo funciona |
|---|---|
| Selector | En el encabezado, **"Operando como: Generador ▾"**. Aparece **solo** si la empresa tiene más de un rol; con uno solo no hay nada que elegir y no se muestra |
| Qué cambia al cambiar de modo | El menú y lo que lista "Mis operaciones": ventas si es generador, compras si es comprador, traslados si es transportista |
| Qué **no** cambia nunca | Perfil, expediente, RFC, calificaciones y Score. Son de la empresa, no del modo |
| Memoria | La plataforma recuerda el último modo usado y entra en ese |

**La verificación es por rol, no por cuenta.** Una empresa puede estar verificada
como generadora y pendiente como compradora: sus permisos de generador ya están
cotejados y los de acopio o reciclaje no. Entonces puede vender y todavía no
comprar, y el aviso tiene que decir exactamente eso.

**En modo comprador no ve sus propias publicaciones al explorar.** Nadie se compra
a sí mismo, y verlas ahí haría dudar de que el filtro funcione.

**Score por rol** en el perfil: *"como generador: 7.2 · como comprador: 8.1"*. Tiene
sentido porque los componentes del Score se miden distinto en cada lado
(cambios-plataforma §10): valorización es lo que vendes si generas y lo que
incorporas si compras.

> **Depende de resolver C-1, y por eso no entra en el prototipo.** El selector es
> la parte de arriba; debajo hace falta que las políticas de la base entiendan que
> una empresa tiene varios roles, y hoy `mi_rol()` devuelve **uno solo** y cinco
> políticas de escritura comparan contra él. Mientras eso no cambie, un selector
> de modo sería otra vez apariencia sin permiso detrás — justo lo que prohíbe
> `CLAUDE.md` §4.5.
>
> Y ojo con el orden: el modo elegido **no puede** ser lo que autorice. Vive en el
> navegador, así que decide qué se enseña, nunca qué se puede hacer. Lo que manda
> siguen siendo los roles guardados en la base.

---

## 2. Contradicciones entre los documentos nuevos y lo que hay hoy

### C-1 · Una empresa con varios roles rompe la regla de seguridad de la base

Los documentos piden que una empresa pueda ser generadora y compradora a la vez
(cambios §1, maestro §05). Pero hoy el rol es **un solo valor**, y no sólo en la pantalla:
`mi_rol()` (`politicas.sql:367-375`) devuelve un texto, y cinco políticas de la base
comparan ese texto contra un rol exacto para decidir quién puede escribir en cada tabla
(`CONTRATO-RLS.md` C4). Pasar a varios roles obliga a reescribir esas políticas y a volver
a correr `npm run verificar:politicas`. **No es un cambio de formulario.**

D-3 la deja aparcada a propósito: se guardan los roles marcados, pero quien manda sigue
siendo uno solo.

### C-2 · Bloquear por estado de cuenta en la pantalla no es seguridad

Cambios §3 dice que el estado de la cuenta decide quién publica y quién compra, y que el
botón se muestre desactivado. `CLAUDE.md` §4.5 y su regla 5 prohíben presentar un control
de pantalla como si fuera seguridad: mientras el estado no esté en las políticas, una
cuenta "pendiente" puede publicar llamando a la API directamente. §0.1 lo permite para el
prototipo **a condición de anotarlo como pendiente de seguridad en `CLAUDE.md` §7**.

### C-3 · Los campos nuevos del perfil no se van a poder guardar, y sin dar error

`politicas.sql:431-432` quita a los usuarios el permiso de escribir en `profiles` y se lo
devuelve **sólo** para `location`, `logo_url` y `updated_at`. Si se añaden razón social,
RFC o generación anual sin ampliar esa lista, guardar no falla: simplemente no cambia nada
(es la misma trampa del "fallo silencioso" que `CLAUDE.md` §7 ya documenta). Y al revés:
`estado`, el rol y la lista de roles de D-3 **nunca** deben entrar en esa lista (cláusula
C3 del contrato).

### C-4 · Las insignias "en el perfil público" son un cambio de contrato

Hoy una empresa **sólo puede leer su propio perfil**; lo único que ven las demás es
`id` y nombre, por la vista `empresas_publicas` (`politicas.sql:634`). Enseñar el estado,
las insignias, el Score o el "firma a tiempo: 95%" de otra empresa obliga a ampliar esa
vista, y `CLAUDE.md` dice literalmente que eso **es un cambio de contrato** que hay que
documentar y volver a verificar (pruebas 17 y 18). El correo y el RFC no pueden entrar ahí:
la fuga de correos del 2026-09-21 se cerró exactamente por eso.

### C-5 · Quitar las dos pantallas viejas rompería la suite de pruebas

Cambios §12 manda quitar "Gestión ambiental" y "Transporte responsable". Las pruebas exigen
que cada HTML tenga su módulo y que **ningún módulo quede huérfano**
(`tests/dependencias.test.js`). Al borrar esas dos páginas quedan sin dueño
`js/data/cumplimiento.js`, `js/ui/documentos.js` y sus dos archivos de prueba: o se
reaprovechan en el expediente, o se borran con ellas. Además `CLAUDE.md` §7 celebra esas
pantallas como un defecto **corregido el 2026-09-21**; hay que actualizar esa sección o el
archivo se contradice solo.

Por D-5 esto no se toca todavía, pero la decisión sigue esperando al final del bloque 2.

### C-6 · Stripe, doc2sign y PDF chocan con el stack declarado

`CLAUDE.md` §1 y su regla 1 prohíben añadir dependencias, bundler o build step sin petición
explícita, y §9 da por hecho que existe **una sola** función en `api/`. El webhook de Stripe
sería una segunda, y generar el PDF del manifiesto pide una librería. No hay choque hoy
porque §0.1 los simula, pero sí lo habrá en el bloque 3, y es una decisión que pide permiso.

### C-7 · Lo que tiene que correr solo no tiene dónde correr

Vigencias que vencen, bloqueo a las 72 horas, aviso a los 25 días, las 24 horas para
cotizar: cambios §2, §8 y §9 los dan por hechos. En el stack actual —sitio estático más una
función que responde cuando alguien la llama— no hay nada que se ejecute por su cuenta.
§0.1 ya los deja fuera del prototipo; conviene que el pitch no los prometa como existentes.

### C-8 · El catálogo de materiales se describe de dos formas

Cambios §4 pide una tabla `materiales` con las claves oficiales; §0.1 dice usar un texto
provisional porque esas claves no se han capturado. **Resuelto por D-8:** los 10 materiales
viven en el código, sin tabla ni permisos nuevos. Cuando existan las claves oficiales y
haga falta editarlas sin programar, se revisa.

### C-9 · Los roles se llaman distinto en los documentos y en el código

Los documentos dicen Generador / Comprador / Transportista. La base y el sitio dicen
`proveedor` / `comprador` / `logistica`. **Resuelto por D-4:** se cambia sólo lo que se ve,
con el mapa de etiquetas de `public/js/data/perfiles.js:10-14`. Por dentro nada cambia, así
que las políticas de la base siguen valiendo.

### Aviso, que no es contradicción: lo que exige cada pantalla nueva

Toda página nueva (expediente, pago, manifiesto, mis operaciones) tiene que cargar
**exactamente un** `<script type="module">` que apunte a `js/pages/<mismo-nombre>.js`,
llevar el **mismo** `<link>` de Google Fonts que las demás y llamar a `montarNavbar()`, o
fallan `dependencias.test.js` y `estructura.test.js`. No es un capricho: cada una de esas
reglas viene de un defecto real que ya ocurrió.

---

## 3. Calendario supuesto

Las once decisiones de la primera ronda están arriba, en "Decisiones tomadas".

La fecha del pitch no está confirmada. Como D-1 pide que el bloque 2 se intente, se fija
**2026-10-26 como supuesto de trabajo**: es la fecha más cercana que deja entrar los seis
cambios de los bloques 1 y 2 con una semana de margen. No es un dato, es una suposición —
en cuanto se sepa la fecha real, se cambia aquí y el plan se ajusta solo.

| Tramo | Fechas | Qué tiene que estar listo |
|---|---|---|
| Bloque 1 | 2026-09-22 → 2026-10-02 | Textos, registro con RFC y ficha técnica, con `npm test` en verde y los cambios de Supabase ya aplicados |
| Bloque 2 | 2026-10-05 → 2026-10-19 | Expediente, estados de cuenta e insignias, pantallas de pago y manifiesto |
| Margen y ensayo | 2026-10-20 → 2026-10-26 | Datos de ejemplo (D-9), repaso de pantallas y ensayo del recorrido que se va a enseñar |

**Las dos fechas que importan si el pitch se adelanta:**

- Si cae **antes del 2026-10-19**, el bloque 2 no llega completo: hay que elegir cuáles de
  sus tres pantallas se intentan.
- Si cae **antes del 2026-10-05**, el bloque 2 no se empieza y el prototipo se queda en el
  bloque 1. Eso sigue cubriendo los "cambios visibles" que pide `cambios-plataforma.md` §13.

El margen de la última semana no es relleno: los cambios de Supabase se aplican a mano
(D-6) y es donde aparecen las sorpresas que nadie ve en el navegador hasta que falla.
