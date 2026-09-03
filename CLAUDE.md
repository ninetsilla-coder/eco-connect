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
| Dependencias de ejecución | 2, por CDN: `@supabase/supabase-js@2.39.7` (esm.sh) y Google Fonts |
| Pruebas | `node --test` (integrado) + `jsdom` como única dependencia de desarrollo |

**Cero dependencias llegan al navegador desde npm.** `node_modules/` existe solo
para las pruebas y está en `.gitignore`. No hay bundler, transpilador ni
TypeScript, y el sitio se sigue sirviendo tal cual se escribe.

**No introducir dependencias de ejecución, bundler ni build step** sin que el
usuario lo pida explícitamente.

## 2. Comandos y entorno local

```bash
npm test              # suite completa
npm run test:watch    # re-ejecuta al guardar
npm run test:cobertura
npm run servir        # sirve public/ por HTTP
```

No hay build ni linter. **No inventarlos ni reportar que se ejecutaron.**

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

`js/script.js` lo aplica en dos sitios: los "paths" del home (`script.js:35`) y
los links del dropdown (`script.js:82`). Ambos consultan `profiles` por separado,
y se repiten enteros en cada `onAuthStateChange`.

> ⚠️ **Este gating es solo visual.** `company_type` nunca se comprueba antes de
> un `insert`/`update`/`delete`. La separación real de roles depende
> exclusivamente de las políticas RLS. Ver [CONTRATO-RLS.md](CONTRATO-RLS.md).

### Un módulo por página, sin globales

Cada HTML carga **una sola línea**: `<script type="module" src="js/pages/<pagina>.js">`.
Cero `<script>` inline, cero variables globales, cero dependencias de orden de
carga. La conexión se importa desde `js/core/supabase.js`.

La llave que contiene es la *publishable* (pública por diseño); lo que protege
los datos son las políticas RLS.

### Tablas (8)

`profiles`, `residuos_publicados`, `intereses`, `servicios_transporte`,
`residuos_gestion_ambiental`, `cumplimiento_transporte`,
`transporte_documentacion` (aparece una sola vez, posiblemente en desuso),
`empresas_registro`.

Columna de propiedad: `user_id` en todas, salvo `profiles`, donde es `id`.

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
  ui/navbar.js           navbar, dropdown por rol, hamburguesa, footer
  ui/auth-modal.js       modal de login/registro (se inyecta donde falte)
  ui/residuo-card.js     tarjeta de residuo compartida
  ui/detalle.js          bloques de las páginas de detalle
  data/<tabla>.js        todas las queries de esa tabla
  pages/<pagina>.js      lo específico de cada página
```

Supabase se importa desde esm.sh con **versión exacta** (`@2.39.7`). Con `@2`
flotante, un cambio upstream rompe el sitio sin que nadie toque el repo. Subirla
es una decisión deliberada.

### 4.2 Una capa de datos por tabla

Toda query vive en `data/<tabla>.js` y se expone como función con nombre
(`listarDisponibles()`, `publicarResiduo(datos)`). Un solo punto de cambio
cuando evoluciona el esquema.

**Regla: ninguna query dentro de un `.html` ni de un `pages/*.js`.**

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

### 5.3 Qué NO se prueba

- **Supabase, el navegador o jsdom.** No son código nuestro.
- **Las políticas RLS.** No se pueden probar desde aquí: viven en Postgres. Su
  verificación son las pruebas de aceptación de [CONTRATO-RLS.md](CONTRATO-RLS.md) §5,
  hechas a mano con dos cuentas de rol distinto.
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

Pendientes:

- **Las políticas de `supabase/politicas.sql` no están aplicadas.** Hasta que se
  ejecuten, los `.eq("user_id")` del cliente son lo único que separa a un usuario
  de los datos de otro — y eso no protege nada. Es la prioridad 1.
- **Buckets de cumplimiento aún públicos.** El código ya guarda rutas y sabe
  firmar URLs; falta descomentar la sección 11 de `politicas.sql`. Ojo: las filas
  antiguas guardan URLs completas — `referenciar()` maneja ambas formas.
- **Fuente inexistente en CSS.** `style.css` referencia `"Cy Grotesk Key"`, que
  no se carga desde ningún sitio, y con dos grafías distintas
  (`"Cy Groteks Key"` en `style.css:62`). Cae al fallback `system-ui`.
- **`empresas_registro` sin límite de tasa**: el formulario es spameable.
- **Botón "Editar" sin función** en `mis-residuos` y `mis-servicios-transporte`.
- **`transporte_documentacion`**: solo se lee, nadie escribe en ella. Decidir si
  sigue en uso.
