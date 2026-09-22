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
| D-13 | **El expediente muestra solo los bloques del rol principal** | Aunque la empresa haya marcado varios roles (D-3), por ahora sube los papeles de uno. Decisión de tiempo, no de diseño: el expediente por varios roles va con la tarea 15, donde la verificación pasa a ser por rol |
| D-14 | **Los vehículos del transportista, en un campo de texto** | Tipo y placas escritos juntos, no una lista con "añadir vehículo". La versión real es una tabla, y hace falta cuando el manifiesto se llene solo (tarea 10) |
| D-15 | **El estado de la cuenta bloquea solo en pantalla** | Botones apagados y aviso de qué falta, pero las reglas de la base **no** comprueban el estado: quien llame a la API directamente publica igual. Anotado como pendiente de seguridad en `CLAUDE.md` §7, como exige §0.1. **No presentarlo como control de acceso en el pitch** |

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

### 4. [x] Pantalla de expediente por rol (§2) — hecha el 2026-09-22 · ⚠️ con ajustes pendientes al final

| | |
|---|---|
| **Archivos tocados** | Nuevos: `public/expediente.html`, `public/js/pages/expediente.js`, `public/js/data/expediente.js`, `tests/expediente.test.js`. Modificados: `public/js/ui/estructura.js` (link "Mi expediente" en los tres roles), `public/js/core/almacenamiento.js`, `supabase/politicas.sql` (§8.2, §8.3 y §11), y dos pruebas que contaban páginas y buckets |
| **Supabase** | **Sí.** Tabla `expediente_documentos` con RLS y propiedad; bucket privado `expedientes`; columnas `estado` y `volumen_anual` en `profiles`; función `enviar_expediente_a_revision()` |
| **Tamaño** | Grande |
| **Real o simulado** | Subir y guardar documentos: **real** (D-2). La revisión: **a mano en el panel**. Las vigencias: **no se construyen** |

El catálogo de qué pide cada rol vive en `data/expediente.js`, no en la pantalla: es lógica
pura y se prueba sin navegador. De esa lista cuelga el botón "Enviar a revisión".

**El estado de la cuenta no lo escribe el navegador.** Una empresa que pudiera ponerse
"verificado" sola dejaría sin sentido toda la revisión, así que el botón llama a una función
de la base que solo sabe hacer un movimiento —de *pendiente* o *rechazado* a *en revisión*— y
devuelve el estado que quedó. Es la forma de cumplir C-2 sin esperar a la tarea 5.

Lo mismo con el veredicto de cada documento: `estado` y `motivo_rechazo` están fuera del
permiso de escritura, porque RLS no filtra columnas (misma trampa que C-3).

**D-5 aplicada el 2026-09-22: "Cumple con gestión ambiental" ya no existe.** Se borraron
`public/gestion-ambiental.html` y su módulo de página. La contradicción C-5 se resolvió así:

- `data/cumplimiento.js` y `ui/documentos.js` **no quedaron huérfanos**: los sigue usando
  "Transporte responsable", y `mis-residuos` sigue leyendo la gestión ya guardada.
- De `cumplimiento.js` se quitó solo la función que **escribía** gestión ambiental, que ya no
  llamaba nadie. La tabla queda de **solo lectura desde la aplicación**: lo subido se sigue
  viendo, no se crean filas nuevas.
- La tabla, su bucket y sus políticas **no se tocan**. Los datos siguen ahí hasta que se
  decida qué hacer con ellos.

**"Transporte responsable" se queda** hasta que el bloque del transportista en el expediente
esté terminado.

**Lo que no hace:** no lleva al expediente automáticamente tras registrarse (se entra por el
menú), no hay panel del equipo, y el estado no bloquea todavía publicar ni contactar — eso
es la tarea 5.

---

#### Ajustes del Reglamento de la Ley de Residuos de Coahuila

Anotados el 2026-09-22 y **construidos ese mismo día**, salvo el punto 7. Lo que sigue
describe qué se hizo con cada uno.

| # | Ajuste | Estado |
|---|---|---|
| 1 | Materiales que ampara cada autorización | ✅ casillas y avisos; el bloqueo real, pendiente |
| 2 | El padrón no trae materiales: se revisan en el PDF | ✅ textos de ayuda corregidos |
| 3 | Tres tipos de autorización del comprador | ✅ |
| 4 | Vigencias distintas y "actualización pendiente" | ✅ |
| 5 | Registro del plan de manejo, obligatorio | ✅ |
| 6 | La modalidad del manifiesto sale del tipo de autorización | ✅ |
| 7 | Avisar al generador de un comprador nuevo | ⏳ bloque 3 |

#### Segunda pasada del expediente (2026-09-22, misma tarde)

- **Dos niveles.** Arriba, *Documentos de la empresa* (datos generales e impacto ambiental):
  se llenan una vez y valen para cualquier rol, así que ya no dicen "documentos que pedimos
  a un generador". Abajo, *Autorizaciones*, y al final los recomendados.
- **Varios registros por autorización.** La SMA autoriza **por establecimiento**: una empresa
  con tres plantas tiene tres registros, cada uno con su oficio, su PDF y **sus** materiales.
  Botón "+ Agregar otro registro" en los tres documentos de autorización. Los materiales de
  la empresa son la **suma** de todos.
  - En Supabase bastó **cambiar una regla**: el índice único pasó a ser parcial y excluye a
    las tres autorizaciones. Ni tabla nueva, ni políticas nuevas, ni bucket nuevo.
  - En el código, la identidad de un documento deja de ser su tipo y pasa a ser **su fila**:
    con dos registros de generador, el tipo ya no distingue uno del otro.
  - Basta **un** registro entregado para que el documento cuente. Exigir los dos bloquearía a
    quien está dando de alta la segunda planta.
  - El plan de manejo **no** se repite, aunque viva en el bloque del registro: no es una
    autorización de la SMA. Lo destapó una prueba al pedir lo contrario. **Si resulta que el
    plan también es por establecimiento, es una línea.**
- **Los textos de ayuda son instrucciones para la empresa**, no apuntes del revisor. "Marca
  los materiales que aparecen en tu autorización", no "se coteja contra el padrón". Lo
  segundo vive ahora en comentarios del código: en pantalla no le dice a nadie qué hacer y
  además promete una revisión que el usuario no controla.
- **"Mi expediente" salió del menú Residuos** y está junto a "Mi cuenta": es de la empresa, no
  de un rol, y ahí lo encuentran los tres.
- **"Manifiesto (ejemplo)" y "Pago de una operación (ejemplo)"** se llaman ya sin el paréntesis:
  el aviso de que son demostraciones está dentro de cada página, que es donde se lee.

**1. Las autorizaciones de la SMA son por residuo, no generales.**
Cada autorización del expediente necesita un campo **"Materiales que ampara"**: casillas con
los diez materiales del catálogo. De ahí salen tres reglas:

| Quién | Regla |
|---|---|
| Generador | Solo publica materiales que estén en su registro |
| Comprador | Solo solicita materiales que su autorización cubra. Si no: *"Tu autorización no ampara este material"* |
| Transportista | Solo ve solicitudes de materiales que cubre |

En el prototipo, **casillas y aviso en pantalla**. El bloqueo real va con la inversión, junto
con lo de D-15: es la misma pieza —comprobar en la base, no en el navegador— y conviene
hacerlas de una vez.

*Construido así:* columna `materiales` en `expediente_documentos`; las casillas en las tres
autorizaciones; en publicar residuos, los materiales no amparados salen apagados y dicen por
qué; en el detalle de un residuo, el comprador ve el aviso antes de escribirle a nadie. El
transportista queda fuera porque **todavía no hay solicitudes** que filtrar (tarea 11).

Una decisión que sostiene todo lo demás: **una empresa que aún no declaró materiales no está
"autorizada para nada"**. Sin datos no se bloquea nada. Tratarlo al revés dejaría el sitio
inservible para todas las cuentas anteriores a hoy, y es el tipo de regla que parece
prudente y en realidad apaga el producto.

**2. El padrón público no sirve para cotejar materiales.** Trae nombre, dirección, contacto y
vigencia, y nada más. Los materiales autorizados solo aparecen en el PDF de la autorización,
así que esa parte de la revisión es **lectura humana del documento**, no cotejo contra el
padrón. Cambia lo que promete el texto de ayuda de esos documentos.

**3. El comprador puede tener tres tipos de autorización**, y las tres existen en la SMA:
acopio y/o almacenamiento, reciclado y/o co-procesamiento, o tratamiento. La lista de
subtipos del expediente hay que ajustarla a esa redacción.

**4. Las vigencias no son todas iguales.**

| Documento | Regla |
|---|---|
| Transporte, acopio, reciclado, tratamiento | Vencen a los **2 años** y se refrendan |
| Registro de generador | **No vence**: se actualiza cada **3 años** |

Consecuencia para la pantalla: para un generador, el estado no es "vencido" sino
**"actualización pendiente"**. Toca `ui/estado-cuenta.js`, donde hoy solo hay un `vencido`
para todos.

**5. Un documento obligatorio más para el generador: el registro del plan de manejo.** En la
fase 1 solo entran grandes generadores, así que no es opcional para nadie del catálogo.

**6. La modalidad del destinatario en el manifiesto sale del tipo de autorización del
comprador**, no es siempre "Almacenamiento" como está hoy en la pantalla de ejemplo. Es un
**supuesto**: no se encontró el formato oficial para confirmarlo (documento maestro §20).

**7. Idea para el bloque 3.** Cuando un generador vende a un comprador con el que no había
operado, avisarle de que **debe registrar a esa empresa** en la actualización de su registro
y de su plan de manejo, y darle la lista de empresas con las que ha operado. Es trabajo que
hoy nadie lleva, sale gratis de la bitácora que ya habrá que construir (tarea 13), y es
justo el tipo de cosa por la que una empresa se queda en la plataforma.

### 5. [x] Estados de cuenta e insignias en el perfil (§3) — hecho el 2026-09-22

| | |
|---|---|
| **Archivos tocados** | Nuevos: `public/js/ui/estado-cuenta.js`, `tests/estado-cuenta.test.js`. Modificados: `public/js/core/sesion.js` (el estado viaja con la sesión), `profile.html` y `pages/profile.js` (insignias), `pages/expediente.js` (reusa el catálogo en vez de su copia), las cinco páginas de publicar y contactar, y `css/style.css` |
| **Supabase** | No: la columna `estado` entró con la tarea 4 |
| **Tamaño** | Mediano |
| **Real o simulado** | **Visual (D-15).** El aviso y los botones apagados son reales; el bloqueo de verdad no existe |

Los botones se **apagan, no se esconden** (§3 lo pide así): quien llega tiene que ver qué le
falta, no creer que la página está rota. El motivo viaja en `title` y en `aria-label`, para
que también lo reciba quien usa un lector de pantalla.

Una cuenta sin estado —las anteriores al 2026-09-22— se trata como `pendiente`, no como
verificada: si algo falla, que falle hacia el lado que pide papeles.

> 🔴 **Esto no es seguridad y no debe presentarse como tal.** Ver D-15 y `CLAUDE.md` §7,
> donde está escrito qué falta para cerrarlo y cómo demostrarlo.

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

### 6. [x] Pantalla de pago y manifiesto de ejemplo (§6 y §7) — hecho el 2026-09-22

| | |
|---|---|
| **Archivos tocados** | Nuevos: `public/pago.html`, `public/manifiesto.html`, sus dos `pages/*.js` y `public/js/data/operacion-ejemplo.js`. Modificados: `ui/estructura.js` (los dos enlaces) y la prueba que cuenta páginas |
| **Supabase** | No: los datos son de ejemplo (D-2, D-9) |
| **Tamaño** | Mediano |
| **Real o simulado** | **Simulado entero** (§0.1) |

**Pago:** desglose con lote, flete y comisión del 3%, CLABE de ejemplo, los cuatro pasos del
cobro y un botón "Simular pago recibido" que enciende el enlace al manifiesto.

**Manifiesto:** vista previa en HTML con las ocho secciones del formato de la SMA y sus
números, campo para capturar el folio, y las tres firmas como casillas que se marcan.

Las empresas son inventadas (D-9): ni siquiera se usan nombres del padrón como ejemplo. Una
captura circulando con el nombre de alguien que nunca aceptó salir ahí es un problema.

**Cada pantalla dice en su propia cara que es una demostración**, no solo en los comentarios
del código: que el pago lo confirma Stripe y no un botón, que la CLABE no existe en ningún
banco, y que esas firmas no tienen valor legal. Los avisos se escriben desde el JS a
propósito: si algún día esto se conecta de verdad, quitarlos es parte de tocar ese archivo.

Se llega desde el menú: "Pago de una operación (ejemplo)" en comprador y "Manifiesto
(ejemplo)" en generador, cada uno del rol que lo usa en el flujo real. Cuando exista "Mis
operaciones" (tarea 8), ese será el camino y estos enlaces sobran.

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
