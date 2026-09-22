# EcoConnect — Cambios a la plataforma

Septiembre 2026 · Equipo EcoConnect

## Resumen de cambios

La plataforma pasa de ser un tablero de publicaciones a manejar la operación completa: registro con permisos, pago único con Stripe, manifiesto y disputas. Esta tabla lista todos los cambios; cada módulo tiene su sección con el detalle de cómo hacerlo.

| Módulo | Tipo | Cambio | Prioridad |
|---|---|---|---|
| Crear cuenta | Cambiar | Razón social, RFC y tipo de empresa múltiple | Alta |
| Expediente | Agregar | Pantalla nueva con permisos por rol y PDF | Alta |
| Estados de cuenta | Agregar | Pendiente, en revisión, verificado, rechazado, vencido | Alta |
| Publicar residuo | Cambiar | Ficha técnica nueva, catálogo cerrado, declaración de no peligroso | Alta |
| Operación | Agregar | Flujo de solicitud, acuerdo, pago, entrega y cierre | Alta |
| Pagos | Agregar | Stripe Connect con SPEI y reparto automático | Alta |
| Manifiesto | Agregar | Pre-llenado, folio, firmas en doc2sign, escaneo final | Alta |
| Transporte | Cambiar | Solicitud y cotizaciones en lugar de solo un catálogo | Media |
| Disputas | Agregar | Apertura en 72 h con evidencia y resolución | Media |
| Confianza | Agregar | Bloqueo del comprador, indicador de manifiestos, calificaciones, insignias | Media |
| Score y reportes | Agregar | EcoConnect Score, bitácora exportable, reporte ESG premium | Media |
| Textos del sitio | Cambiar | Quitar "certificación", "verificados" y 5% | Alta |
| Seguridad | Cambiar | Corregir políticas de acceso a datos y archivos | Alta |
| Documentación genérica | Quitar | El apartado de documentos genérico se reemplaza por el expediente | Alta |

Prioridad alta = necesario para operar la primera transacción o para no contradecir el pitch.

---

## 1. Crear cuenta

El modal actual se queda casi igual, con tres cambios: razón social en lugar de nombre, RFC nuevo y tipo de empresa con selección múltiple.

| Campo | Estado | Tipo de campo | Texto de ayuda / validación |
|---|---|---|---|
| Razón social * | Cambia (antes "Nombre de la empresa") | Texto | "Escríbela exactamente como aparece en tus permisos ambientales" |
| Nombre comercial | Nuevo, opcional | Texto | "Cómo te conocen tus clientes" |
| RFC * | Nuevo | Texto | 12 caracteres (persona moral) o 13 (persona física); guardar en mayúsculas |
| Correo empresarial * | Sin cambio | Correo | — |
| Tipo de empresa * | Cambia (antes lista de una opción) | Casillas: Generador, Comprador, Transportista | "Puedes elegir más de uno"; mínimo uno |
| Contraseña * | Sin cambio | Mínimo 6 caracteres | — |

**Texto debajo del botón** (reemplaza al actual): *"Después de crear tu cuenta te pediremos tus permisos ambientales. Podrás explorar la plataforma mientras los revisamos."*

**Cómo ponerlo:**

- En la base de datos, el tipo de empresa pasa de un solo valor a una lista de roles (por ejemplo, un arreglo `roles` o una tabla aparte empresa–rol).
- Al crear la cuenta, guardar el estado `pendiente` y llevar al usuario directo a la pantalla de expediente.
- Validar el RFC con una expresión regular de 12 o 13 caracteres y evitar RFC duplicados.

## 2. Expediente (pantalla nueva)

Después de crear la cuenta, la empresa llena su expediente. La pantalla muestra solo los bloques de los roles que eligió, y se puede guardar y regresar después. En la fase 1 solo se aceptan permisos de Coahuila.

| Bloque | Se muestra a | Obligatorio | Campos por documento |
|---|---|---|---|
| Datos generales | Todos | Constancia de Situación Fiscal, identificación del representante legal | PDF |
| Impacto ambiental | Generador y comprador | Sí | Tipo (informe preventivo / manifestación de impacto ambiental), autoridad que la emitió (SMA / SEMARNAT), número de oficio, PDF |
| Registro de generador | Generador | Sí | Número de oficio, fecha, vigencia, PDF |
| Autorización SMA | Comprador | Sí | Tipo (acopio / reciclaje y co-procesamiento / tratamiento), número de oficio, fecha, vigencia, PDF |
| Autorización de transporte | Transportista | Sí | Número de oficio, fecha, vigencia, PDF; placas y tipo de cada vehículo; póliza de seguro |
| Recomendados | Según rol | No | Acta constitutiva, opinión de cumplimiento SAT, caracterización de laboratorio (generador), ISO 14001 o Industria Limpia (comprador), permiso federal de autotransporte (transportista) |

**Botón final:** "Enviar a revisión". Se activa solo cuando están todos los obligatorios del rol. Al enviarlo, la cuenta pasa a `en revisión`.

**Cómo se revisa (panel interno del equipo):**

1. Ashley abre el expediente y compara razón social, número de oficio y vigencia contra el padrón público de la SMA (Región Laguna).
2. El impacto ambiental solo se pre-verifica: que esté cargado, sea legible y la razón social coincida.
3. Marca cada documento como aprobado o rechazado; si rechaza, escribe el motivo, que el usuario ve.
4. Si todo está aprobado, la cuenta pasa a `verificado`.

**Cómo ponerlo:**

- Una tabla de documentos con: empresa, tipo de documento, número de oficio, fecha, vigencia, archivo, estado (pendiente / aprobado / rechazado) y motivo.
- Los PDF en almacenamiento privado: solo los ven la empresa dueña y el equipo. El comprador solo ve las insignias, no los archivos.
- Un panel de administración sencillo (lista de expedientes en revisión, botón aprobar/rechazar). En la fase 1 no hace falta automatizar el cotejo con el padrón.
- Una tarea diaria que revise la vigencia: si un documento vence, la cuenta pasa a `vencido`.

## 3. Estados de la cuenta e insignias

Cada cuenta tiene un estado que decide qué puede hacer. Hoy cualquier cuenta puede publicar; con el cambio, solo las verificadas.

```
Pendiente   → envía expediente → En revisión → aprobado     → Verificado
En revisión → falta o no coincide → Rechazado → corrige    → En revisión
Verificado  → vence un permiso  → Vencido    → sube refrendo → En revisión
```

| Estado | Ver publicaciones | Contactar / comprar | Publicar residuo u ofrecer transporte | Aviso en pantalla |
|---|---|---|---|---|
| Pendiente | Sí | No | No | "Completa tu expediente para empezar a operar" |
| En revisión | Sí | No | No | "Estamos revisando tus documentos (24 a 48 h)" |
| Verificado | Sí | Sí | Sí | — |
| Rechazado | Sí | No | No | Motivo del rechazo y botón para corregir |
| Vencido | Sí | No | No; sus publicaciones se pausan | "Tu autorización venció. Sube el refrendo para reactivar" |

**Insignias en el perfil público:**

- **Registrado en padrón SMA:** todos sus permisos de residuos están cotejados y vigentes.
- **Expediente completo:** además subió todos los documentos recomendados de su rol.

Debajo de las insignias, siempre el texto: *"Documentos proporcionados por la empresa. EcoConnect no certifica su veracidad."*

**Cómo ponerlo:** un campo `estado` en la empresa y una revisión de permisos en cada acción (botón de contactar, publicar, comprar). El botón se muestra desactivado con el aviso correspondiente, no oculto, para que el usuario sepa qué le falta.

## 4. Publicar residuo: ficha técnica

El formulario de "Publica tus residuos disponibles" se reemplaza por esta ficha técnica. El material ya no es texto libre: se elige de un catálogo cerrado.

| Campo | Tipo | Detalle |
|---|---|---|
| Material * | Lista cerrada | Acero, hierro, HMS, cobre, aluminio, PET, HDPE #2, PP #5, tarimas, cartón. Cada uno guarda su clave del Catálogo de Residuos de Manejo Especial para el manifiesto |
| Descripción * | Texto | Ejemplo: "rebaba de maquinado de acero 1018" |
| Cantidad del lote * | Número + unidad (kg / t) | El lote se vende completo |
| Periodicidad * | Lista | Lote único, semanal, mensual, otra |
| Nivel de procesamiento * | Lista | Sin procesar, separado, compactado o empacado, triturado |
| Condición * | Lista + texto | Limpio / con impurezas (describir) |
| Humedad | Número (%) | Solo aparece si el material es cartón o plástico |
| Ubicación * | Lista | Municipio de la planta (fase 1: Torreón) |
| Precio * | Número | Precio por kg o tonelada, obligatorio |
| Fotos * | Imágenes | Mínimo 2 |
| Caracterización de laboratorio | PDF, opcional | Muestra la insignia "material caracterizado" |
| Declaración * | Casilla | "Declaro que este material no es un residuo peligroso y no está contaminado con sustancias peligrosas" |

**Lo que ve el comprador en la publicación:** el precio por unidad, el total del lote y el total con comisión. Ejemplo: *"$4,000/t · Lote de 10 t: $40,000 + comisión EcoConnect 3% ($1,200)"*.

**Materiales prohibidos:** no hay que programar una lista aparte. El catálogo cerrado ya impide publicar aceites, solventes, baterías o lodos. La lista explícita va en términos y condiciones, y la declaración cubre materiales contaminados.

**Cómo ponerlo:** una tabla `materiales` con nombre, categoría y clave oficial, que alimenta la lista. Las claves se toman del Catálogo de Residuos de Manejo Especial de la SMA (pendiente de capturar).

## 5. Flujo de una operación (nuevo)

Hoy la plataforma termina cuando el comprador guarda un interés. Ahora cada compra es una operación con estados, desde la solicitud hasta el cierre.

```
Solicitada → generador acepta → Acordada → SPEI recibido → Pagada → recolección firmada → En tránsito → llega a planta → Entregada
Entregada  → comprador firma recepción → Cerrada
Entregada  → disputa en 72 h → En disputa → resuelta → Cerrada
```

| Paso | Quién | Pantalla o acción | Qué se guarda |
|---|---|---|---|
| 1. Solicitar | Comprador | Botón "Solicitar lote" en la publicación; elige fecha deseada | Operación en estado `solicitada` |
| 2. Acordar | Generador y comprador | El generador acepta o rechaza. El comprador marca: "Me comprometo a firmar el manifiesto al recibir el material" | Precio final, lote, fecha, compromiso aceptado |
| 3. Transporte | Comprador | Solicita cotizaciones y elige transportista (sección 9) | Transportista, flete, placas |
| 4. Pagar | Comprador | Pantalla de pago con CLABE de Stripe (sección 6) | Estado `pagada` al recibir el aviso de Stripe |
| 5. Manifiesto | Generador | Revisa el manifiesto pre-llenado y captura su folio (sección 7) | Manifiesto en borrador |
| 6. Recolección | Generador y transportista | Firman en doc2sign; fotos de carga | Estado `en tránsito`, fecha de embarque |
| 7. Entrega | Comprador | Firma de recepción o botón "Abrir disputa" | Estado `cerrada` o `en disputa` |
| 8. Cierre | Todos | Subir escaneo del original firmado; calificar a la otra parte | Historial, bitácora, Score |

**Pantalla "Mis operaciones"** (nueva, para los tres roles): lista de operaciones con su estado, la siguiente acción pendiente y un aviso cuando le toca actuar al usuario.

**Cómo ponerlo:** una tabla `operaciones` con generador, comprador, transportista, publicación, lote, precio, flete, comisión, estado, fechas de cada paso e identificadores de Stripe y del manifiesto. Cada cambio de estado se registra con fecha para la bitácora.

## 6. Pagos con Stripe Connect (nuevo)

El comprador hace una sola transferencia SPEI y Stripe la reparte en automático: el lote al generador, el flete al transportista y el 3% a EcoConnect. EcoConnect nunca tiene en su cuenta el dinero de terceros. Stripe cobra $7 + IVA por transferencia y por reembolso, y EcoConnect lo absorbe (tarifas de Stripe México).

```
EcoConnect crea el cobro (lote + flete + 3%) → Stripe da una CLABE al comprador → el comprador transfiere por SPEI
→ Stripe avisa a EcoConnect → Stripe envía el lote al generador, el flete al transportista y la comisión a EcoConnect
```

**Pasos para integrarlo:**

1. **Cuenta de EcoConnect en Stripe** con Connect activado (modo de pruebas gratuito para desarrollar).
2. **Cuentas conectadas.** Al terminar su expediente, cada generador y transportista ve el botón "Conectar cuenta de cobro", que abre el registro de Stripe. Stripe hace su propia verificación de identidad. Guardar el identificador de la cuenta conectada en la empresa.
3. **Crear el cobro** cuando el comprador confirma el pago: monto total, método transferencia bancaria de México, destino = cuenta del generador y comisión de EcoConnect = 3%. Si el flete va a un transportista distinto, se transfiere su parte a su cuenta conectada.
4. **Mostrar la CLABE** y la referencia que devuelve Stripe en la pantalla de pago, con el monto exacto y la fecha límite.
5. **Recibir el aviso (webhook).** Una función del servidor en Vercel recibe el aviso de pago exitoso y pasa la operación a `pagada`. Solo con ese aviso se habilita el manifiesto.
6. **Reembolsos.** Desde el panel interno, cuando una disputa termina en reembolso: se devuelve la parte que corresponda y se revierte la comisión sobre esa parte.

**Pantalla de pago del comprador:**

| Concepto | Ejemplo |
|---|---|
| Lote (al generador) | $40,000 |
| Flete (al transportista) | Según cotización |
| Comisión EcoConnect (3%) | $1,200 |
| **Total a transferir** | **$41,200 + flete** |

Texto: *"Transfiere el monto exacto a esta CLABE. Tu pago se confirma en unos 30 minutos en días hábiles."*

**Pendiente de revisar:** si Stripe Connect tiene algún cargo adicional por cuenta conectada activa.

## 7. Manifiesto (nuevo)

La plataforma genera el Manifiesto de Generador de la SMA ya lleno con los datos que tiene. Mientras no se confirme que la SMA acepta firma electrónica, se usa el modelo híbrido: el original impreso y sellado viaja con el material, y en paralelo cada parte firma en doc2sign.

| Sección del manifiesto | Se llena con |
|---|---|
| 1. Registro como generador | Expediente del generador |
| No. de folio | Lo captura el generador (folio autorizado por la SMA) |
| 2. Razón social, domicilio, municipio, teléfono | Cuenta y expediente del generador |
| 3. Residuo, clave y cantidad en toneladas | Ficha técnica y lote acordado |
| 5. Empresa transportista y número de autorización | Expediente del transportista |
| 7. Tipo de vehículo y placas | Asignación de transporte |
| 8. Empresa destinataria y modalidad | Expediente del comprador; modalidad siempre "Almacenamiento" |
| Firmas, nombres y fechas (secciones 4, 6 y 8) | Cada parte en su etapa |

**Flujo de firmas:**

1. Al pagar, la plataforma genera el PDF del manifiesto en borrador.
2. El generador revisa y captura su folio. Imprime el original (para el sello de la SMA y para que viaje con el material).
3. En la recolección, el generador firma la sección 4 y el transportista la 6, en doc2sign.
4. En la entrega, el comprador firma la sección 8 en doc2sign. Esa firma cierra la operación.
5. El generador sube el escaneo del original firmado y sellado.

**Cómo ponerlo:**

- Generar el PDF con los datos de la operación sobre el formato oficial (una plantilla con los campos en su lugar).
- En la fase 1, como la operación es asistida, Ashley envía el manifiesto desde la cuenta de doc2sign y marca cada firma en la plataforma. No hace falta integrar doc2sign por API todavía.
- Guardar en la operación: folio, PDF del borrador, PDF firmado, escaneo del original y fecha de cada firma.
- Aviso automático al generador si pasan 25 días sin el escaneo del original, porque a los 30 días debe avisar a la SMA.

## 8. Disputas, bloqueo, indicador y calificaciones (nuevo)

La protección del comprador es el manifiesto: si el material no llegó como se acordó, no firma la recepción y abre una disputa.

**Botón "Abrir disputa"** (visible para el comprador durante 72 horas después de la entrega):

| Campo | Tipo |
|---|---|
| Motivo * | Lista: no llegó / llegó menos cantidad / no corresponde a la ficha técnica |
| Descripción * | Texto |
| Fotos al recibir * | Imágenes, mínimo 2 |
| Ticket de báscula | Imagen o PDF, opcional |

El generador recibe aviso y puede responder con su propia evidencia. Ashley y Claudia resuelven desde el panel interno en máximo 5 días hábiles, con tres resultados: sin reembolso, reembolso parcial o reembolso total (con regreso del material y flete a cargo de quien incumplió).

**Reglas automáticas:**

| Regla | Qué hace la plataforma |
|---|---|
| Comprador sin firmar | Si pasan 72 h desde la entrega sin firma ni disputa, la cuenta del comprador se bloquea para nuevas compras hasta que firme |
| Indicador de manifiestos | En el perfil del comprador: porcentaje de manifiestos firmados a tiempo (por ejemplo, "Firma a tiempo: 95%") |
| Generador que no coopera | Si una disputa se resuelve en su contra y no devuelve, su cuenta se suspende |

**Calificaciones:** al cerrar la operación, cada parte califica a la otra de 1 a 5 estrellas en tres aspectos: cumplimiento del acuerdo, calidad o puntualidad, y comunicación. El perfil muestra el promedio y el número de operaciones.

**Cómo ponerlo:** tablas `disputas` (operación, motivo, evidencia, respuesta, resolución, monto reembolsado) y `calificaciones` (operación, quién califica, a quién, tres puntajes). Una tarea periódica revisa las operaciones entregadas hace más de 72 h sin firma para aplicar el bloqueo.

## 9. Transporte

Hoy el comprador solo ve un catálogo de servicios de transporte. Ahora pide cotizaciones para su operación y elige una; el flete se paga en el mismo SPEI, sin comisión para EcoConnect.

| Pantalla | Quién | Qué cambia |
|---|---|---|
| Solicitar transporte | Comprador | Nuevo. Se crea desde la operación acordada: origen, destino, material, toneladas y fecha ya llenos |
| Solicitudes abiertas | Transportista | Nuevo. Ve las solicitudes y envía su cotización (precio, fecha, vehículo y placas) |
| Elegir cotización | Comprador | Nuevo. Compara cotizaciones y elige una; el flete se suma al pago |
| Flota propia | Comprador con rol de transportista | Nuevo. Opción "Usar mi propio transporte"; se asigna a sí mismo |
| Publicar servicio de transporte | Transportista | Se mantiene como perfil de servicio (zonas, tipos de vehículo, materiales), pero sin precio fijo |

**Reglas:**

- Los transportistas tienen 24 horas para cotizar. Si nadie cotiza, el equipo recibe un aviso para contactar transportistas del padrón.
- Solo transportistas verificados con autorización de Coahuila vigente ven solicitudes. Los de Durango pueden participar si tienen autorización de Coahuila.

**Cómo ponerlo:** tablas `solicitudes_transporte` (operación, fecha, estado) y `cotizaciones` (solicitud, transportista, precio, vehículo, placas). La cotización elegida alimenta el pago y las secciones 5 y 7 del manifiesto.

## 10. EcoConnect Score, bitácora y reporte ESG (nuevo)

El Score reemplaza a la "Certificación EcoConnect". Es un número de 0 a 10 visible y gratis en el perfil, calculado solo con datos de la plataforma.

**Score = 10 × (0.40·V + 0.30·T + 0.20·D + 0.10·C)**

| Letra | Componente | Cómo se calcula (valor de 0 a 1) |
|---|---|---|
| V | Valorización | Toneladas vendidas por EcoConnect en 12 meses ÷ generación anual declarada (tope 1). Para compradores: toneladas compradas ÷ meta anual declarada |
| T | Trazabilidad | Operaciones con manifiesto firmado a tiempo ÷ operaciones totales |
| D | Cumplimiento documental | 1 si el expediente está completo y vigente; 0.5 si solo tiene los obligatorios |
| C | Constancia | Meses con al menos una operación en los últimos 12 ÷ 12 |

Para el componente de valorización, el expediente pide un dato nuevo: **generación anual aproximada** (generador) o **consumo anual aproximado** (comprador), en toneladas.

**Impacto ambiental:** por cada operación se calcula CO2 evitado, energía y agua ahorradas multiplicando las toneladas por un factor por material. Los factores se toman de una fuente pública, como el modelo WARM de la EPA, y se guardan en la tabla `materiales`.

| Función | Acceso | Qué genera |
|---|---|---|
| Score en el perfil | Gratis | Número de 0 a 10 e impacto acumulado total |
| Bitácora exportable | Gratis | Archivo con fecha, residuo, cantidad, transportista, placas, destinatario y folio de cada operación, por semestre |
| Reporte ESG | Premium: $1,500 por semestre, el primero gratis | PDF con el desglose del Score y el impacto por material y por operación |

El reporte lleva siempre la leyenda: *"Indicador elaborado por EcoConnect con base en las operaciones registradas en la plataforma. No constituye una certificación ni el Distintivo Nacional de Economía Circular."*

**Cómo ponerlo:** el Score se recalcula al cerrar cada operación. La bitácora es una exportación de la tabla `operaciones` filtrada por empresa y semestre. El reporte premium se cobra con Stripe (pago único) y se genera como PDF.

## 11. Textos del sitio

Varios textos del sitio prometen cosas que EcoConnect ya no hace. Hay que reemplazarlos en inicio, beneficios, FAQ y perfiles.

| Quitar | Poner en su lugar |
|---|---|
| "Certificación EcoConnect" | "EcoConnect Score" |
| "Proveedores verificados" | "Documentación cotejada con el padrón de la SMA" |
| "Garantiza que cumple la normativa" | "Organizamos tu documentación y la cotejamos con padrones oficiales" |
| "Nosotros realizamos la documentación ambiental" | "Te ayudamos a subir tu documentación; cada empresa responde por la suya" |
| "Comisión de 5%" o "pago por acceso y uso de la plataforma" | "Comisión de 3% por operación, pagada por el comprador" |
| "Certifica tu impacto ambiental" | "Mide tu impacto ambiental" |
| Referencias a residuos peligrosos, aceite o cemento | Solo los materiales del catálogo |
| "TRANSFORMAMOS TUS RESIDUOS INDUSTRIALES EN RECURSOS ESTRATÉGICOS CON TRAZABILIDAD ESG" | Se puede mantener; es coherente con el Score |

**Textos nuevos:**

- En términos y condiciones, la cláusula de deslinde completa y la lista de materiales prohibidos (ver documento maestro, secciones 4 y 6).
- En la FAQ: "¿EcoConnect certifica a las empresas?" → "No. Cotejamos sus permisos con el padrón público de la SMA y medimos su circularidad con el EcoConnect Score. Cada empresa responde por su documentación."
- En la FAQ: "¿Cuánto cuesta?" → "Registrarse y publicar es gratis. El comprador paga una comisión de 3% por operación."

## 12. Qué quitar de la plataforma actual

| Quitar | Por qué | Lo reemplaza |
|---|---|---|
| Apartado de documentación genérico ("Cumple con gestión ambiental", "Cumple con transporte responsable") | Pedía documentos genéricos; ahora cada rol tiene permisos específicos | Expediente (sección 2) |
| Material como texto libre al publicar | Permitía publicar residuos peligrosos | Catálogo cerrado (sección 4) |
| Tipo de empresa de una sola opción | Una empresa puede generar y comprar | Selección múltiple (sección 1) |
| Publicar sin verificación | Cualquier cuenta podía publicar | Estados de cuenta (sección 3) |
| Precio fijo en servicios de transporte | Cada traslado se cotiza | Solicitudes y cotizaciones (sección 9) |
| Cualquier mención de "certificación" o "verificados" | Contradice la política de pre-verificación | Textos de la sección 11 |

El menú de "Mis intereses" del comprador puede quedarse como lista de favoritos, pero la compra se hace desde "Solicitar lote".

## 13. Orden de implementación

Para el pitch basta con que el prototipo muestre los bloques 1 y 2; el resto se construye con la inversión.

**Bloque 1: antes del pitch (cambios visibles)**

- [ ] Cambiar textos del sitio (sección 11)
- [ ] Modal de crear cuenta con razón social, RFC y tipo múltiple (sección 1)
- [ ] Ficha técnica con catálogo cerrado y declaración (sección 4)

**Bloque 2: antes del pitch si da tiempo (pantallas de muestra)**

- [ ] Pantalla de expediente por rol (sección 2)
- [ ] Estados de cuenta e insignias en el perfil (sección 3)
- [ ] Pantalla de pago y manifiesto de ejemplo, aunque sea sin funcionar (secciones 6 y 7)

**Bloque 3: con la inversión (fase 1, ~7 meses de desarrollo)**

- [ ] Corregir políticas de acceso a datos y archivos
- [ ] Flujo de operación y "Mis operaciones" (sección 5)
- [ ] Stripe Connect en modo de pruebas y luego en producción (sección 6)
- [ ] Manifiesto pre-llenado y seguimiento de firmas (sección 7)
- [ ] Transporte con cotizaciones (sección 9)
- [ ] Disputas, bloqueo, indicador y calificaciones (sección 8)
- [ ] Score, bitácora y reporte premium (sección 10)
- [ ] Panel interno de revisión y disputas
