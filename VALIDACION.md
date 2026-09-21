# Guion de validación manual

Lo que `npm test` **no** puede comprobar: que la aplicación arranque y que un
flujo completo funcione de punta a punta.

Las 151 pruebas verifican piezas —que una tarjeta escapa HTML, que una consulta
lleva su filtro—, y `pages/*.js` no se prueba por decisión (CLAUDE.md §5.3), que
es justo donde está el cableado entre el DOM y los datos. Esto lo cubre a mano.

**Está ordenado por riesgo.** Si falla el bloque 1, para: lo demás no tiene
sentido medirlo hasta arreglarlo.

---

## 0. Preparación

```powershell
npm.cmd run servir
```

Abre `http://localhost:3000` (no `file://` — los módulos ES no cargan así).

**Ten la consola del navegador abierta todo el rato** (F12 → Console). Un módulo
que no carga deja la página en blanco sin decir nada en pantalla: el error solo
sale ahí.

Necesitas las dos cuentas de siempre, una `proveedor` y una `comprador`. Para el
bloque 5 hace falta además una `logistica`; si no la tienes, créala en el paso 2.

> Dos cosas ya sabidas que no son fallos: hay una fila de
> `cumplimiento_transporte` con `servicio_id` en null (documentación que no
> cuelga de ningún servicio) y al menos un perfil sin `company_name`, que se verá
> como "Empresa sin nombre".

---

## 1. ¿Arranca? — el riesgo que afecta a las 13 páginas

Esto es lo único que puede estar roto *sistémicamente*. Un error de ruta o de
orden de carga tumbaría todas las páginas a la vez.

- [ ] `index.html` carga y se ve la cabecera
- [ ] **La consola no tiene ni un error rojo**
- [ ] El pie muestra el año actual
- [ ] Abre las otras 12 páginas a mano por URL. En todas: cabecera, pie, consola
      limpia

> ⚠️ Si alguna sale en blanco o da `Failed to resolve module specifier`, **para
> aquí**. Es un problema de rutas o de capas, y afecta a todo lo demás.

La cabecera y el pie ya no están en el HTML: los inyecta `montarNavbar()`
(CLAUDE.md §4.1.1). Una página sin cabecera significa que no llamó a esa función.

---

## 2. Sesión — cambió el alta de cuenta

El registro ya no escribe `company_type` desde el navegador; lo hace el trigger
`crear_perfil()`. Es el cambio con más riesgo silencioso de todos.

- [ ] Sin sesión: el botón "Login / Registrarse" abre el modal **en `index`**
- [ ] Y **también en una página interna** (p. ej. `mis-residuos.html`) — antes
      ese botón no hacía nada en 12 de 13 páginas
- [ ] Crea una cuenta nueva con rol `logistica`
- [ ] Inicia sesión con ella y entra a **Mi cuenta**
- [ ] El perfil dice *"Mi rol en EcoConnect: Proveedor de transporte y
      logística"*

> ⚠️ Si el rol sale vacío o en "—", el trigger no está escribiendo. Ese usuario
> no podrá publicar nada.

- [ ] Edita ubicación y logo, guarda, recarga: los cambios siguen ahí

---

## 3. El menú por rol

- [ ] Con la cuenta `logistica`, el desplegable RESIDUOS muestra **solo** sus
      tres páginas, ninguna de comprador ni de proveedor
- [ ] Cierra sesión: el desplegable desaparece entero
- [ ] Entra como `proveedor`: ahora aparecen las tres suyas
- [ ] En `index`, el bloque de residuos cambia según el rol

---

## 4. Proveedor — publicar y documentar

Con la cuenta `proveedor`:

- [ ] En `publicar-residuos`, los dos botones de categoría abren el formulario
      con el título correcto (antes eran `onclick`, ahora listeners)
- [ ] Publica un residuo **con al menos dos fotos**
- [ ] En `mis-residuos` aparece, con sus fotos y su badge de gestión ambiental
- [ ] El botón de estado alterna entre disponible y vendido, y se mantiene al
      recargar

### Documentación ambiental — pantalla nueva

- [ ] En `gestion-ambiental`, elige ese residuo y sube un archivo en
      "Documentación"
- [ ] **Aparece un enlace al archivo**, no un recuento. Ábrelo: debe descargar
- [ ] Cambia de pestaña (Condiciones) y vuelve: el resumen corresponde a la
      pestaña activa, no a la anterior

> Ese último punto prueba el guardia de turno. Si al cambiar rápido de residuo
> ves documentos del anterior, ahí hay un fallo.

- [ ] En `mis-residuos`, el badge pasa a "Gestión ambiental parcial · Doc ✓"

---

## 5. Logística — el bug que se arregló

Con la cuenta `logistica`:

- [ ] Publica un servicio de transporte con foto
- [ ] En `mis-servicios-transporte` aparece con el badge **"Sin docs"**
- [ ] En `transporte-responsable`, elige ese servicio: dice *"Todavía no has
      registrado documentación para este servicio"*
- [ ] Sube **solo un permiso** (deja certificaciones y seguros vacíos) y guarda
- [ ] **El servicio sigue seleccionado** y el panel muestra el permiso enlazado
- [ ] En `mis-servicios-transporte` el badge es ahora **"Docs incompletos"**

> Esto es exactamente lo que estaba roto: antes decía "Docs OK" con un solo
> archivo, o incluso con ninguno.

- [ ] Sube certificaciones y seguros. El badge pasa a **"Docs OK"**

---

## 6. Comprador — ahora sí lo ve

Con la cuenta `comprador`:

- [ ] `comprador-explorar-residuos` muestra el residuo del bloque 4
- [ ] Los filtros de tipo y ubicación funcionan
- [ ] En `comprador-servicios-transporte`, el servicio del bloque 5 muestra
      **"Documentación completa · Permisos ✓ · Certificaciones ✓ · Seguros ✓"**

> ⚠️ Este es **el** punto. Antes el comprador veía siempre "Sin documentación ✗
> ✗ ✗" mientras el transportista veía "Docs OK": las dos mitades leían tablas
> distintas. Si aquí sale en rojo, el arreglo no llegó.

- [ ] Aplica un filtro. Los badges se recalculan — **no se quedan en
      "Cargando documentación..."**
- [ ] Guarda un interés en el residuo y compruébalo en `comprador-mis-intereses`
- [ ] Bórralo desde ahí y desaparece

---

## 7. Mensajería — todo esto es nuevo

El flujo que hace que esto sea un marketplace y no un catálogo.

**Como `comprador`:**

- [ ] En el detalle del residuo, "Contactar proveedor" abre la conversación
- [ ] Escribe un mensaje y envíalo: aparece en el hilo firmado como **"Tú"**
- [ ] Vuelve a la lista y pulsa "Contactar proveedor" desde la tarjeta: te lleva
      al detalle **con el hilo ya abierto**

**Como `proveedor`:**

- [ ] En `mis-residuos`, el botón "Mensajes" del residuo despliega la
      conversación
- [ ] Se ve el mensaje del comprador, con **el nombre de su empresa**, y el
      título marca los no leídos
- [ ] Responde. Tu mensaje aparece como "Tú"

**De vuelta como `comprador`:**

- [ ] Recarga el detalle y abre la conversación: está la respuesta
- [ ] El contador de no leídos ya no marca los que abriste

**Lo que NO debe pasar:**

- [ ] Con una **tercera** cuenta, abre el mismo residuo y escribe. Como
      proveedor verás **dos conversaciones separadas**, no una mezclada
- [ ] Desde esa tercera cuenta **no** debes ver nada de la conversación anterior
- [ ] En ningún sitio aparece el **correo** de la otra empresa, solo el nombre

> Ese último punto es el motivo de todo el diseño: ningún correo cruza entre
> empresas (CONTRATO-RLS.md C8).

---

## 8. Formulario de contacto

- [ ] En `index`, envía el formulario de empresas
- [ ] Sale el mensaje de éxito
- [ ] En Supabase, la fila está en `empresas_registro`

> El **correo no llegará** en local: `/api/contacto` solo existe en un deploy de
> Vercel. Que falle el correo es lo esperado aquí; lo que importa es que el lead
> se guardó (ese orden es deliberado, CLAUDE.md §3).

---

## 9. Solo verificable en el deploy

Después de mezclar a `main`:

- [ ] Vercel sirve el sitio (ojo: ahora hay un `package.json` donde antes no
      había ninguno — puede cambiar su detección del directorio estático)
- [ ] El formulario de contacto **envía el correo** a `CORREO_DESTINO`
- [ ] `RESEND_API_KEY` y `CORREO_DESTINO` están en el panel de Vercel

---

## Si algo falla

1. **Apunta el error exacto de la consola**, no solo "no funciona".
2. Mira si es de una página o de todas. De todas = capas o rutas. De una =
   cableado de esa página.
3. Un `403` o una lista vacía sin error suele ser RLS, no JavaScript. Corre
   `npm.cmd run verificar:politicas`.
4. Si lo arreglamos, va con su prueba de regresión (CLAUDE.md §5.4.1).
