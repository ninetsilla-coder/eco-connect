# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# Eco Connect — Contrato del proyecto

Marketplace B2B de economía circular: empresas publican residuos industriales,
otras los compran, y transportistas ofrecen logística, con un módulo de
cumplimiento ambiental encima.

Idioma del proyecto: **español**. Código, comentarios, commits, UI y
documentación en español. Mantenerlo.

---

## 1. Stack

Sitio estático multipágina + una función serverless. **Sin build step, sin
framework, sin npm.**

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla (ES2020+) |
| Datos, auth y archivos | Supabase (Postgres, Auth, Storage) |
| Backend | Una función serverless en Vercel (`api/contacto.js`, CommonJS) |
| Correo | Resend |
| Dependencias de ejecución | 2, por CDN: `@supabase/supabase-js@2.116.0` (esm.sh) y Google Fonts |
| Pruebas | `node --test` (integrado) + `jsdom` como única dependencia de desarrollo |

**Cero dependencias llegan al navegador desde npm.** `node_modules/` existe solo
para las pruebas y está en `.gitignore`. No hay bundler, transpilador ni
TypeScript, y el sitio se sigue sirviendo tal cual se escribe.

**No introducir dependencias de ejecución, bundler ni build step** sin que el
usuario lo pida explícitamente.

### 1.1 Estabilidad de dependencias

Sin bundler ni linter, nada avisa de un import mal escrito ni de una versión que
flota: el fallo aparece en el navegador de un usuario, meses después. Por eso el
grafo de dependencias —externo e interno— está fijado en
`tests/dependencias.test.js` y se verifica con `npm test`.

| Dependencia | Cómo se fija | Por qué |
|---|---|---|
| `@supabase/supabase-js` | versión **exacta** (`@2.116.0`) en la URL de esm.sh | con `@2`, una publicación ajena rompe el sitio sin que nadie toque el repo |
| ídem en `main` | `@2.116.0` en los 13 HTML (jsDelivr) | misma versión en las dos ramas desde el 2026-09-18 |
| CDN | solo `esm.sh` | `ayudas/cargador.js` intercepta ese prefijo; cambiarlo rompe las pruebas |
| Google Fonts | una sola hoja, **idéntica en las 13 páginas** | subconjuntos distintos = páginas que se ven distintas |
| `jsdom` | versión exacta + `package-lock.json` commiteado | usar `npm ci`, no `npm install` |
| `serve` (solo dev) | `serve@14` en `npm run servir` | `npx serve` a secas descarga el último mayor |
| Node | `engines: >=22` | las pruebas usan `readdirSync(recursive)` y `parentPath` |
| Resend | `AbortSignal.timeout(8000)` | un tercero colgado no debe agotar la función de Vercel |

**Subir cualquiera de estas versiones es un commit deliberado**, nunca un efecto
secundario. La prueba obliga a que así sea.

Fuentes: toda familia de `style.css` debe estar servida por la hoja de Google
Fonts, ser del sistema, o figurar en la lista `SIN_PROVEEDOR` de la prueba con su
motivo. Hoy solo `"Cy Grotesk Key"` está ahí (ver §7).

## 2. Comandos y entorno local

```bash
npm test              # suite completa
npm run test:watch    # re-ejecuta al guardar
npm run test:cobertura
npm run servir        # sirve public/ por HTTP
```

No hay build ni linter. **No inventarlos ni reportar que se ejecutaron.**

### Verificar las políticas RLS contra el proyecto real

```bash
npm run verificar:politicas
```

Ejecuta las pruebas de aceptación de [CONTRATO-RLS.md](CONTRATO-RLS.md) §5
intentando de verdad lo que debe fallar. **No** forma parte de `npm test` y no
debe estarlo: necesita red y credenciales, justo lo que §5.4.4 prohíbe a una
prueba unitaria. Por eso vive en `herramientas/`, fuera del glob.

Necesita dos cuentas ya registradas, en variables de entorno:

```powershell
$env:ECO_PROVEEDOR_EMAIL="..."; $env:ECO_PROVEEDOR_PASSWORD="..."
$env:ECO_COMPRADOR_EMAIL="..."; $env:ECO_COMPRADOR_PASSWORD="..."
```

Empieza por dos **controles positivos**, y el orden es deliberado: las
pruebas confirman que algo *no* se puede hacer, así que todas pasarían solas si
la conexión estuviera rota. Sin esos controles, un proyecto caído las daría
todas en verde, en falso.

Cero dependencias: habla por HTTP con PostgREST y GoTrue usando el `fetch` de
Node, no con `@supabase/supabase-js`.

**Node 24.19.0 y npm 11.17.0** instalados el 2026-09-03 vía winget en ámbito de
usuario (sin admin), en
`%LOCALAPPDATA%\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_*\node-v24.19.0-win-x64`.
Está en el PATH de usuario: un shell nuevo lo encuentra, uno ya abierto no.

**Hace falta un servidor HTTP: `file://` no sirve.** El navegador bloquea por
CORS los `<script type="module">` cargados con `file://`; abrir el HTML a doble
clic deja la página en blanco. Usar `npm run servir` o **Live Server** de VS Code.

Vercel CLI no está instalado, así que `/api/contacto` **solo se puede probar en
un deploy**. Sus variables (`RESEND_API_KEY`, `CORREO_DESTINO`) van en el panel
de Vercel; `.env.local` es solo para `vercel dev` si algún día se instala.

## 3. Arquitectura actual

### El sistema de roles lo gobierna todo

`profiles.company_type` tiene tres valores y determina la navegación completa:

| Rol | Páginas |
|---|---|
| `proveedor` | `publicar-residuos`, `mis-residuos`, `gestion-ambiental` |
| `comprador` | `comprador-explorar-residuos`, `comprador-mis-intereses`, `comprador-servicios-transporte` (+ las dos de detalle) |
| `logistica` | `publicar-servicio-transporte`, `mis-servicios-transporte`, `transporte-responsable` |

Los links del dropdown se declaran una sola vez, en `ui/estructura.js`, marcados
con `data-role`. `ui/navbar.js` muestra los del rol activo y oculta el resto, con
el rol que `core/sesion.js` resolvió una única vez.

> ⚠️ **Este gating es solo visual.** `company_type` nunca se comprueba antes de
> un `insert`/`update`/`delete`. La separación real de roles depende
> exclusivamente de las políticas RLS. Ver [CONTRATO-RLS.md](CONTRATO-RLS.md).

### Un módulo por página, sin globales

Cada HTML carga **una sola línea**: `<script type="module" src="js/pages/<pagina>.js">`.
Cero `<script>` inline, cero variables globales, cero dependencias de orden de
carga. La conexión se importa desde `js/core/supabase.js`.

La llave que contiene es la *publishable* (pública por diseño); lo que protege
los datos son las políticas RLS.

### Tablas (9)

`profiles`, `residuos_publicados`, `intereses`, `servicios_transporte`,
`residuos_gestion_ambiental`, `cumplimiento_transporte`, `empresas_registro`,
`mensajes` (la crea `politicas.sql` §0.0; es la única que nace de ese script).

**Selladas** (RLS activo, cero políticas, nadie las toca desde el navegador):
`residuos_transporte_doc` (`politicas.sql` §9.1) y `transporte_documentacion`
(§9, sellada el 2026-09-21 — ver §7).

Columna de propiedad: `user_id` en todas, salvo `profiles`, donde es `id`.

### Vistas (2)

| Vista | Expone | Para qué |
|---|---|---|
| `transporte_cumplimiento_resumen` (§8.1) | `servicio_id` + 3 booleanos | Que el comprador vea si un transportista tiene papeles, sin acceder a las rutas de los documentos |
| `empresas_publicas` (§7.2) | `id` + `company_name` | Poner nombre a una conversación, sin abrir `profiles` |

Las dos **atraviesan RLS a propósito** (`security_invoker = false`): corren con
los permisos de su dueño. Su seguridad está entera en la lista de columnas del
`select`, no en una política que alguien pueda revisar.

**Añadir una columna a cualquiera de las dos es un cambio de contrato.** En
concreto, meter `email` en `empresas_publicas` tiraría por tierra §4 y el modelo
de mensajería completo. Las comprobaciones 17 y 18 de `verificar:politicas`
acotan la primera por los dos lados.

Es el patrón de **C7** en CONTRATO-RLS.md: para enseñar un dato de una fila
ajena se hace una vista con lo público, nunca se relaja la política de la tabla.

### Buckets (5)

`residuos-fotos`, `fotos-transporte`, `company-logos` (públicos);
`gestion-ambiental`, `docs-transporte` (deben ser privados — documentación
regulatoria).

**Convención obligatoria:** toda subida se nombra `${user.id}/...`. Hoy se
cumple en los 5 buckets y es lo que hace posible la política per-usuario. **No
romperla.**

### Flujo de contacto

`script.js:198` inserta en `empresas_registro` y **después** llama a
`/api/contacto` en fire-and-forget. El orden es deliberado: si el correo falla,
el lead ya está guardado. No invertirlo.

`api/contacto.js` escapa HTML antes de componer el correo (`limpiar()`) — es la
única entrada de datos de usuario a un canal externo.

## 4. Arquitectura

Migración completada el 2026-09-03. **El stack se queda**: vanilla JS, sin build.

### 4.1 Estructura

```
public/js/
  core/supabase.js       cliente, version fijada
  core/sesion.js         sesión + perfil, resueltos UNA vez
  core/almacenamiento.js subidas a Storage y URLs firmadas
  ui/estructura.js       markup de la cabecera y el pie (el QUÉ se pinta)
  ui/navbar.js           comportamiento de esa estructura (el CÓMO)
  ui/auth-modal.js       modal de login/registro (se inyecta donde falte)
  ui/residuo-card.js     tarjeta de residuo compartida
  ui/detalle.js          bloques de las páginas de detalle
  ui/documentos.js       enlaces a documentos ya firmados
  ui/conversacion.js     hilos de mensajes y caja de redacción
  data/<tabla>.js        todas las queries de esa tabla
  pages/<pagina>.js      lo específico de cada página
```

`ui/conversacion.js` y `ui/documentos.js` no importan `data` —la capa `ui` no
consulta— pero sí orquestan un ciclo completo: `montarConversacion()` y
`montarBandeja()` reciben `cargar` y `enviar` **como funciones**. Así el ciclo
pintar → enviar → repintar se escribe una vez para las cuatro pantallas que lo
usan, sin que `ui` sepa qué tabla hay detrás.

Supabase se importa desde esm.sh con **versión exacta** (`@2.116.0`). Con `@2`
flotante, un cambio upstream rompe el sitio sin que nadie toque el repo. Subirla
es una decisión deliberada.

### 4.1.1 La cabecera y el pie viven en un solo sitio

El `<header>` y el `<footer>` estaban copiados en los 13 HTML. Ahora los HTML
empiezan directamente por su `<main>`: `montarNavbar()` inyecta ambos.

El reparto es **markup / comportamiento**:

| Archivo | Responsabilidad |
|---|---|
| `ui/estructura.js` | `HEADER`, `FOOTER` y `montarEstructura()`. Qué se pinta. |
| `ui/navbar.js` | login, logout, rol, hamburguesa, año, scroll. Cómo se comporta. |

La junta entre ambos son los identificadores de `IDS`, exportado por
`estructura.js` y documentado ahí. `estructura.test.js` compara esa lista con
los `getElementById` que `navbar.js` ejecuta de verdad, **en los dos sentidos**:
un id renombrado en un archivo y no en el otro rompería el cableado sin lanzar
ningún error, así que lo dice la prueba.

`montarEstructura()` es idempotente: respeta un header ya presente en el HTML.

> ⚠️ Las plantillas se insertan con `insertAdjacentHTML`. Eso es seguro **solo**
> porque son literales fijos sin una sola interpolación — §4.4 prohíbe meter
> datos en HTML, no escribir HTML estático. Hay una prueba que falla si alguien
> introduce una interpolación en ellas. Un valor variable se pinta con
> `textContent` **después** de insertarlas.

**Consecuencia nueva:** una página que no llame a `montarNavbar()` se queda sin
cabecera y sin pie. Antes el HTML la traía puesta, así que olvidarlo no se
notaba. Hay una prueba que lo exige en las 13.

### 4.2 Una capa de datos por tabla

Toda query vive en `data/<tabla>.js` y se expone como función con nombre
(`listarDisponibles()`, `publicarResiduo(datos)`). Un solo punto de cambio
cuando evoluciona el esquema.

**Regla: ninguna query dentro de un `.html` ni de un `pages/*.js`.**

`dependencias.test.js` la vigila por dos vías, porque escrita y sin vigilar se
erosiona una query cada vez:

1. **Ningún `pages/*.js` importa `core/supabase.js`.** El permiso `pages → core`
   de §4.1 lo dejaba pasar; sin cliente, una página no puede saltarse `data/`
   aunque quiera.
2. **`.from("<tabla>")` solo aparece en `data/`.** Única excepción declarada:
   `core/sesion.js` consulta `profiles`, porque resuelve el perfil junto con la
   sesión y no puede importar `data/` (core no conoce a nadie).

### 4.3 Sesión resuelta una sola vez

`core/sesion.js` cachea `{ session, usuario, perfil, rol }` y expone un único
`onAuthStateChange` al que se enganchan los módulos. Las llamadas simultáneas
comparten una sola consulta.

`requiereSesion()` y `requiereRol()` son **experiencia de usuario, no
seguridad**: redirigen, no impiden nada.

### 4.4 Nada de HTML construido con interpolación

Las tarjetas y detalles se construyen con nodos y `textContent`. La versión
anterior usaba `meta.innerHTML += \`<span>${r.cantidad}</span>\`` sobre
publicaciones de otras empresas: bastaba publicar HTML en un campo para
ejecutarlo en el navegador de quien lo viera.

### 4.5 Seguridad en RLS, no en el cliente

El JS decide **qué se ve**; Postgres decide **qué se puede hacer**. Toda regla de
autorización nueva se implementa como política, no como `if` en el navegador.
Filtrar por `user_id` en el cliente es defensa en profundidad, nunca el control.

Contrato completo y prioridades: [CONTRATO-RLS.md](CONTRATO-RLS.md).

### 4.6 Escalada futura: Astro, no Next.js

Si la duplicación de **HTML** llega a pesar (la de JS la resuelve 4.1), el salto
natural es Astro: multipágina y estático por defecto, los `.html` se vuelven
`.astro` casi sin cambios, y aporta layouts y componentes reales sin enviar JS de
framework. Next.js exigiría reescribir todo a React para dar SSR y rutas API que
hoy no se necesitan.

**Señales de que llegó el momento:** SEO real en las páginas de residuos,
secretos de servidor más allá del correo, o más gente en el código.

## 5. Pruebas unitarias

Runner: **`node --test`**, integrado en Node. Cero dependencias de ejecución.
`jsdom` es la única de desarrollo y existe por una razón concreta: sin un DOM
real no se puede comprobar que un campo con HTML se quede en texto plano.

```
tests/
  ayudas/registrar.js   engancha el hook (--import)
  ayudas/cargador.js    mapea la URL de esm.sh al doble
  ayudas/dom.js         monta jsdom y publica document/window
  dobles/supabase.js    cliente falso: registra llamadas, devuelve respuestas
  <area>.test.js        las pruebas
```

### 5.1 Por qué hace falta el hook de resolución

`core/supabase.js` importa desde `https://esm.sh/...`. Eso funciona en el
navegador, pero **Node no resuelve imports por HTTP** (`--experimental-network-imports`
se eliminó). Sin `ayudas/cargador.js`, cualquier prueba que toque `core/` o
`data/` falla al cargar.

El hook sustituye ese especificador por `dobles/supabase.js`. **El código de
producción no se toca**: sigue importando la URL real, que es lo que necesita el
navegador. No introducir inyección de dependencias solo para poder probar.

### 5.2 Qué se prueba

Por orden de valor:

1. **Invariantes del contrato.** Si este archivo dice "no romperla", hay una
   prueba que lo fija. Ejemplo: toda subida empieza por `${usuarioId}/`
   (`almacenamiento.test.js`), sin lo cual la política de storage no separa nada.
2. **Regresiones de defectos corregidos.** Todo defecto arreglado deja una prueba
   que falla si vuelve. Ver `seguridad-xss.test.js`.
3. **Forma de las consultas.** No que Supabase funcione, sino que se le pide lo
   correcto: filtro de propiedad presente, columna correcta según el tipo,
   `company_type` nunca en el payload de `profiles`.
4. **Lógica pura**: agrupaciones, etiquetas, mapeos.
5. **El grafo de dependencias** (`dependencias.test.js`). Es el caso extremo del
   punto 1: fija §1.1 (versiones exactas, CDN y fuentes) y §4.1 (qué capa puede
   importar de cuál, sin ciclos ni huérfanos). Ocupa el hueco que en otros
   proyectos llenan el linter y el bundler, que aquí no existen.

### 5.3 Qué NO se prueba

- **Supabase, el navegador o jsdom.** No son código nuestro.
- **Las políticas RLS.** No se pueden probar desde aquí: viven en Postgres, y una
  prueba que necesite red o credenciales está mal planteada (§5.4.4). Para eso
  está `npm run verificar:politicas`, una herramienta aparte —fuera de `tests/`
  para que el glob no la recoja— que intenta de verdad contra el proyecto real
  las cinco operaciones que deben fallar. Ver §2.
- **`pages/*.js`.** Son pegamento entre el DOM y `data/`. Si una página necesita
  lógica que merece prueba, esa lógica está en el sitio equivocado: va a `data/`
  o a `ui/`.
- **Maquetación y estilos.**

### 5.4 Reglas

1. **Toda corrección de defecto lleva su prueba de regresión**, escrita de forma
   que falle con el código anterior.
2. **Una prueba que no falla ante la regresión que dice cubrir no sirve.** Al
   escribirla, romper a propósito el código y comprobar que falla; luego
   restaurar. Esa comprobación se hizo con `pintarMeta` y falló exactamente 1 de
   50, la correcta.
3. **Nombres y mensajes en español**, describiendo el comportamiento esperado, no
   el nombre de la función: "el HTML de un campo no se convierte en elementos",
   no "test pintarMeta".
4. **Ninguna prueba toca la red ni Supabase real.** Si una prueba necesita
   credenciales, está mal planteada.
5. **`beforeEach(reiniciar)`** siempre que se use el doble: su estado es global y
   filtra entre pruebas.

   Única excepción, documentada en el propio archivo: `sesion-eventos.test.js`.
   `listenerInstalado` es estado de módulo que no se puede revertir desde fuera,
   y `reiniciar()` vacía `registro.suscriptores` — dejaría a `sesion.js` creyendo
   que tiene instalado un listener que el doble ya no conoce, el evento no
   llegaría a ninguna parte y las pruebas pasarían **en falso**. Se monta una vez
   en `before()` y solo se reinicia el contador de consultas. Exportar un
   reinicio solo para pruebas sería tocar producción para poder probarla, que es
   lo que §5.1 descarta.
6. `core/sesion.js` cachea a nivel de módulo — llamar también a
   `invalidarSesion()` entre pruebas.
7. **No perseguir un porcentaje de cobertura.** Cubrir invariantes y regresiones;
   `npm run test:cobertura` informa, no manda.

## 6. Reglas de trabajo

1. **No añadir dependencias de ejecución ni build step** salvo petición explícita.
   Las de desarrollo (pruebas) se justifican en §5.
2. **Español** en todo: código, comentarios, UI, commits y pruebas.
3. **No poner secretos en `public/`.** Ahí solo va la llave publishable. Las
   secretas viven en variables de entorno de Vercel y se leen desde `api/`.
4. **Cambio de esquema o de política ⇒ actualizar [CONTRATO-RLS.md](CONTRATO-RLS.md).**
5. **No presentar un control de acceso del lado cliente como si fuera seguridad.**
6. Al tocar una página, mover su lógica hacia los módulos de §4 en vez de
   ampliar el `<script>` inline.
7. Los comentarios existentes son didácticos y explican qué es público y qué
   secreto. Conservar ese tono al escribir nuevos.
8. **Correr `npm test` antes de dar por terminado un cambio**, y añadir la prueba
   de regresión que pida §5.4.
9. **No borrar `api/package.json`.** La raíz declara `type: module` para que Node
   pueda importar los módulos ES en las pruebas; ese archivo devuelve `api/` a
   CommonJS, que es lo que necesita `contacto.js`. Sin él, el despliegue rompe.

## 7. Estado de los defectos detectados

Corregidos en la migración:

- **Login muerto en 12 páginas.** Todas tenían `#login-button` pero solo
  `index.html` tenía el modal, así que el botón no hacía nada. Ahora
  `ui/auth-modal.js` lo inyecta donde falte.
- **Carrera en el alta de cuenta.** El cliente ya no escribe `company_type`; lo
  hace el trigger `crear_perfil()` en la misma transacción que crea el usuario.
- **XSS almacenado** en las listas y detalles: se construía HTML interpolando
  campos de publicaciones ajenas. Ahora todo son nodos con `textContent`.
- **Badges de documentación congelados** en `comprador-servicios-transporte`:
  solo se calculaban al cargar, así que al filtrar se quedaban en "Cargando...".
- **Consulta duplicada a `profiles`** en cada carga y en cada evento de auth.
- **Anclajes del menú rotos en 12 páginas.** El header copiado escribía
  `href="#quienes-somos"`, que solo resuelve dentro de `index.html`. En las otras
  once, CONÓCENOS / IMPACTO / BENEFICIOS / FAQ no hacían nada. Solo
  `profile.html` los tenía bien (`index.html#quienes-somos`), y esa es la versión
  que quedó en `ui/estructura.js`. `montarScrollSuave()` acepta ahora las dos
  formas, para que el scroll del home siga funcionando.
- **Ocho páginas sin footer.** `montarAnioFooter()` buscaba un `#year` que allí
  no existía. Ahora el pie lo inyecta `ui/estructura.js` en las 13.
- **El link CONTACTO existía en una sola página**, `profile.html`.
- **El rol `logistica` veía otra tipografía.** Sus tres páginas
  (`mis-servicios-transporte`, `publicar-servicio-transporte`,
  `transporte-responsable`) no cargaban el `<link>` de Google Fonts, así que todo
  su texto caía a `system-ui` mientras el resto del sitio usaba Poppins. Lo
  detectó `dependencias.test.js` al exigir una sola hoja de fuentes en las 13
  páginas; no estaba en ninguna auditoría previa.
- **Fuga de correos en `perfil_lectura`** (2026-09-21). La política era
  `using (true)` con un comentario que prometía "los ajenos solo por su nombre
  público" — pero RLS no filtra columnas, así que cualquier sesión podía hacer
  `select("*")` sobre `profiles` y llevarse el correo de todas las empresas. Es
  la misma trampa que C3 cierra para el `UPDATE`, colada en el `SELECT`.
- **Las dos mitades del cumplimiento de transporte hablaban con tablas
  distintas** (2026-09-21). El formulario escribía en `cumplimiento_transporte`;
  el badge del comprador leía `transporte_documentacion`, donde no escribe nadie.
  Un transportista subía todos sus papeles y los compradores seguían viendo
  "Sin documentación ✗ ✗ ✗", mientras él veía "Docs OK" en su propia página: dos
  vistas del mismo servicio que se contradecían. Y "Docs OK" salía incluso con
  cero archivos, porque solo se comprobaba que existiera fila. Las dos páginas
  leen ahora la misma vista (§8.1) y con el mismo criterio.
- **La documentación de cumplimiento se subía a ciegas** (2026-09-21).
  `urlsDeDocumentos()` existía sin que la llamara nadie: los permisos, licencias
  y seguros se guardaban y no se mostraban en ningún sitio, así que quien los
  cargaba no podía comprobar qué había quedado ni notar que faltaba uno. Ahora
  `gestion-ambiental` y `transporte-responsable` los enlazan, firmados.
- **El marketplace no conectaba a nadie** (2026-09-21). "Contactar proveedor"
  decía "versión futura" en los 4 sitios donde aparece. Se resolvió con
  mensajería interna (§7.1): las dos empresas conversan dentro de la app y
  **ningún correo cruza de una a otra**. Enseñar el correo del que publica
  habría sido más rápido, pero reabría una versión de la fuga que acababa de
  cerrarse en `perfil_lectura`.

Pendientes:

- **Cómo se sube la versión de `supabase-js`** (resuelto el 2026-09-18, pero el
  método vale para la próxima). Esta rama importaba `@2.39.7` mientras `main`
  cargaba `@2` flotante — que el CDN resolvía a **2.116.0**. O sea que producción
  llevaba meses en 2.116.0 y mezclar habría **degradado el cliente 77 versiones
  menores en silencio**, sin que nadie lo notara porque esta rama nunca se ha
  desplegado. Hacia atrás no hay garantía de semver.

  Ya están las dos ramas en `@2.116.0`. La trampa a recordar: **`npm test` no
  cubre este cambio.** El hook de §5.1 sustituye la URL de esm.sh por el doble,
  así que la librería real nunca se carga y la suite pasa igual con una versión
  inexistente. Para verificar un bump hay dos formas:

  1. `npm run servir` y abrir el navegador.
  2. Cargar el módulo real en Node con un hook que resuelva los imports por HTTP
     —lo inverso al de las pruebas— e importar `core/supabase.js` de verdad. Así
     se comprobó 2.116.0: el cliente se construye, expone `from`, `auth` y
     `storage`, y una consulta real al catálogo devolvió filas.

- **El contrato RLS está cerrado** (2026-09-21: 20 pasan, 0 fallan, 0 saltadas,
  verificado contra el proyecto real).
  No es una tarea pendiente, sino la advertencia que la sustituye: correr
  `npm run verificar:politicas` **cada vez que alguien toque la configuración de
  Supabase**, no solo cuando cambie el SQL. Los 12 agujeros del 2026-09-17 no los
  introdujo ningún commit — eran políticas creadas a mano desde el panel, y el
  panel sigue ahí.
- **Sin límite de tasa en `mensajes`.** El dueño de una publicación puede
  escribir primero a cualquiera (§7.1), así que cualquiera puede publicar un
  residuo y con eso ganar permiso para escribir a otros. No es peor que
  `empresas_registro`, y la solución de los dos es la misma.
- **Los mensajes no avisan.** No hay notificación por correo ni contador en el
  navbar: las dos partes tienen que entrar a la publicación para ver si les
  escribieron. Es la limitación aceptada al elegir mensajería interna sobre
  repartir correos.
- **Fuente inexistente en CSS.** `style.css` referencia `"Cy Grotesk Key"` en 12
  reglas y no la sirve nadie: es comercial y no está en Google Fonts, así que
  cae al fallback `system-ui`. La errata de grafía (`"Cy Groteks Key"`, 9 reglas)
  ya está unificada, y la familia figura en la lista `SIN_PROVEEDOR` de
  `dependencias.test.js`: al alojarla en `public/` o sustituirla, quitarla de esa
  lista y la prueba dirá si queda alguna regla suelta.
- **`empresas_registro` sin límite de tasa**: el formulario es spameable.
- **Botón "Editar" sin función** en `mis-residuos` y `mis-servicios-transporte`.
  En `mis-servicios-transporte` no hay ni handler: el botón no hace nada.
- **Fallo silencioso en `profile.js`.** Si falla la carga del perfil, la página
  se queda en blanco sin explicación. Es el último `catch` de `pages/` que no
  avisa al usuario; los otros cuatro se cerraron el 2026-09-21.
- **`alert()` y `confirm()`** en 8 sitios, conviviendo con el patrón
  `mostrarEstado()` del resto. Bloquean el hilo y son inconsistentes.
- **Accesibilidad**: un solo `aria-label` en todo el sitio (la hamburguesa).
  Sin `aria-live` en los `.form-status`, un lector de pantalla no anuncia
  "Guardando..." ni los errores.
