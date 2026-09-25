# Qué tiene el prototipo de EcoConnect

Inventario al 24 de septiembre de 2026, hecho revisando las pantallas tal como están
programadas hoy, no los documentos de diseño.

**Cómo leer las marcas:**

- 🎭 **Simulado**: se ve y se puede usar, pero no pasa nada de verdad detrás.
- ⚠️ **No coincide**: lo que hay hoy es distinto de lo que dice el **documento de cambios**
  (el de los cambios a la plataforma) o el **plan de trabajo**. Se explica en cada caso.
- 🔒 **Ojo en el pitch**: algo que se ve como un control, pero no lo es del todo.

Todo lo que no lleva marca funciona de verdad: se guarda y se vuelve a ver al entrar otra vez.

---

## 1. Los tres roles y qué páginas ve cada uno

Al registrarse, la empresa marca uno o varios tipos. Cada tipo se llama así en pantalla:

| Rol | Qué ve en el menú "Residuos" |
|---|---|
| **Generador de residuos** | Publica tus residuos disponibles · Mis residuos publicados · Mi registro de generador · Manifiesto |
| **Comprador industrial** | Explorar residuos · Mis intereses · Servicios de transporte · Mi autorización SMA · Pago de una operación |
| **Transportista** | Publicar servicio de transporte · Ver mis servicios · Mi autorización de transporte |

**Lo que ven los tres**, arriba a la derecha y fuera del menú: **Mi expediente**, **Mi cuenta**
(el perfil de la empresa) y **Cerrar sesión**.

**Quien no ha iniciado sesión** ve la portada (quiénes somos, impacto, beneficios, preguntas
frecuentes y un formulario de contacto que sí llega al equipo) y el botón para entrar o
registrarse. El menú "Residuos" no se despliega.

**Páginas a las que se llega con un clic, no desde el menú:** el detalle de un residuo y el
detalle de un servicio de transporte (desde las listas del comprador).

**Una empresa con varios roles ve el menú de uno solo.** Manda el primero marcado en este
orden: Generador → Comprador → Transportista. Los demás se guardan y aparecen en el perfil
("También registrada como: …"), pero no le abren sus pantallas. Es una decisión tomada a
propósito para el prototipo.

> ⚠️ **No coincide con el documento de cambios**, que pide que el expediente muestre "los
> bloques de los roles que eligió". Hoy muestra solo los del rol principal. El plan de
> trabajo lo decidió así por tiempo y deja el cambio de modo para después de la inversión.

---

## 2. Los campos del registro de cuenta

| Campo | ¿Obligatorio? | Qué se comprueba |
|---|---|---|
| Razón social | Sí | Ayuda: "Escríbela exactamente como aparece en tus permisos ambientales." |
| Nombre comercial | No | — |
| RFC | Sí | Que tenga la forma de un RFC: 12 caracteres (persona moral) o 13 (persona física). Se pasa a mayúsculas solo. **No se puede repetir**: si ya existe, avisa "Ese RFC ya está registrado" |
| Correo empresarial | Sí | Que sea un correo |
| Tipo de empresa | Sí, al menos uno | Casillas: Generador de residuos · Comprador industrial · Transportista. Si se marcan varias, avisa cuál menú va a ver |
| Contraseña | Sí | Mínimo 6 caracteres |

Debajo del botón dice: *"Después de crear tu cuenta te pediremos tus permisos ambientales.
Podrás explorar la plataforma mientras los revisamos."*

Al terminar sale *"Cuenta creada. Ya puedes iniciar sesión."* y la ventana se cierra. La cuenta
nace en estado **Expediente pendiente**.

El RFC además decide una cosa del expediente: a quien tiene RFC de 13 caracteres (persona
física) no se le pide acta constitutiva.

> ⚠️ **No coincide con el documento de cambios**, que dice que al crear la cuenta se lleve al
> usuario directo a su expediente. Hoy no lo lleva: entra por el menú. El plan de trabajo lo
> reconoce como algo que no se hizo.

---

## 3. Los estados de cuenta y qué permite cada uno

| Estado | Qué le dice la pantalla | ¿Ve publicaciones? | ¿Publica residuos u ofrece transporte? | ¿Contacta y guarda intereses? |
|---|---|---|---|---|
| **Expediente pendiente** | "Completa tu expediente para empezar a operar." | Sí | No | No |
| **En revisión** | "Estamos revisando tus documentos (24 a 48 horas)." | Sí | No | No |
| **Verificado** | Sin aviso | Sí | Sí | Sí |
| **Rechazado** | "Revisa el motivo en tu expediente y vuelve a enviarlo." | Sí | No | No |
| **Autorización vencida** | "Tu autorización venció. Sube el refrendo para reactivar tus publicaciones." | Sí | No | No |
| **Actualización pendiente** (solo generadores) | "Tu registro de generador se actualiza cada tres años. Sube la actualización para seguir publicando." | Sí | No | No |

Cuando la cuenta no está verificada, los botones de publicar y de contactar **se ven apagados,
no escondidos**, con un aviso arriba que dice qué falta y un enlace a "Ir a mi expediente".

**Quién mueve cada estado:**

- La empresa solo puede hacer un movimiento: **enviar a revisión** (de pendiente o rechazado a
  en revisión), con el botón de su expediente.
- **Todo lo demás lo hace el equipo a mano** desde el panel de la base de datos: verificar,
  rechazar, marcar vencido. No hay pantalla interna para eso.
- Cuando el equipo rechaza un documento, puede escribir el motivo y la empresa lo ve junto a
  ese documento.

> 🔒 **Ojo en el pitch: el bloqueo es solo de pantalla.** Una cuenta que no está verificada ve
> los botones apagados, pero alguien con conocimientos técnicos que se saltara la pantalla
> podría publicar igual. Está anotado como pendiente de seguridad. **No presentarlo como un
> control de acceso.**

> 🔒 **Lo que el estado no frena ni en pantalla:** el generador puede marcar sus residuos como
> vendidos o disponibles, el transportista puede activar, desactivar o borrar sus servicios, y
> cualquiera puede contestar mensajes que ya le llegaron.

> ⚠️ **No coincide con el documento de cambios** en tres puntos:
>
> - **"Actualización pendiente"** no está en el documento de cambios. Sí está en el plan de
>   trabajo: el registro de generador no vence, se actualiza cada tres años.
> - El documento dice que en "Vencido" **las publicaciones se pausan**. Hoy no se pausa nada:
>   solo se apagan los botones.
> - El documento da por hecho que una cuenta **pasa sola a vencida** cuando vence un permiso.
>   Hoy nada cambia solo; el equipo tendría que hacerlo a mano.

---

## 4. Los documentos del expediente y de las autorizaciones

Los documentos están repartidos en **dos pantallas**:

- **Mi expediente**: lo que describe a la empresa. Se llena una vez y vale para cualquier rol.
- **Mis autorizaciones**: lo que la SMA le autoriza. Cada rol llega desde su propio enlace del
  menú (Mi registro de generador / Mi autorización SMA / Mi autorización de transporte) y solo
  ve sus bloques.

### Cómo funciona un documento

- Se sube un **PDF o una imagen** y se pulsa **Guardar**. Cada documento se guarda por separado,
  y se puede volver otro día.
- Cada documento lleva la etiqueta **Obligatorio** o **Recomendado**. Una vez guardado, además
  muestra **En revisión**, **Aprobado** o **Rechazado** según el estado.
- Después de guardar aparece **"Ver el archivo cargado"**. Los archivos son privados: solo los
  ve la empresa dueña.
- Para guardar, lo único que se exige es el **archivo** (o el texto, en el caso de los
  vehículos) y, en las autorizaciones, **al menos un material marcado**. El número de oficio,
  las fechas y el tipo se pueden dejar vacíos.
- Las tres autorizaciones principales tienen **"+ Agregar otro registro"**, para quien tiene más
  de una (por otros materiales o por otra planta). Con uno solo entregado ya cuenta.
- **"Materiales que ampara"**: diez casillas con los materiales del catálogo. Los materiales de
  la empresa son la suma de todos sus registros.
- **"Revisar antes de enviar"**: una lista de lo que falta subir, lo que vence en los próximos
  tres meses y los documentos cuyo nombre no coincide con la razón social. La propia pantalla
  aclara que es una lista de verificación, no una revisión.
- **"Enviar a revisión"** se activa solo cuando están todos los obligatorios **de las dos
  pantallas**. Cada pantalla avisa si en la otra queda algo pendiente.

### Para los tres roles (en Mi expediente)

| Documento | Tipo | Campos |
|---|---|---|
| Constancia de Situación Fiscal | **Obligatorio** | Archivo |
| Identificación oficial del representante legal o del titular | **Obligatorio** | Archivo |
| Acta constitutiva | Recomendado | Archivo. **Solo aparece a personas morales** (RFC de 12) |
| Opinión de cumplimiento del SAT | Recomendado | Archivo |

### Generador y comprador (en Mi expediente)

| Documento | Tipo | Campos |
|---|---|---|
| Autorización de impacto ambiental | **Obligatorio** | Tipo (Informe preventivo / Manifestación de impacto ambiental) · Autoridad que la emitió (SMA / SEMARNAT) · Número de oficio · Archivo |

Al transportista no se le pide.

### Generador (en Mi registro de generador)

| Documento | Tipo | Campos |
|---|---|---|
| Registro como generador de residuos de manejo especial | **Obligatorio** · admite varios | Número de oficio · Fecha de emisión · Materiales que ampara · Archivo |
| Registro del plan de manejo | **Obligatorio** | Número de oficio · Fecha de emisión · Archivo |
| Caracterización de laboratorio | Recomendado | Archivo |

**Total de obligatorios del generador: 5.**

### Comprador (en Mi autorización SMA)

| Documento | Tipo | Campos |
|---|---|---|
| Autorización de acopio, reciclado o tratamiento | **Obligatorio** · admite varios | Tipo (Acopio y/o almacenamiento / Reciclado y/o co-procesamiento / Tratamiento) · Número de oficio · Fecha de emisión · Vigencia · Materiales que ampara · Archivo |
| ISO 14001 o Industria Limpia | Recomendado | Archivo |

**Total de obligatorios del comprador: 4.**

### Transportista (en Mi autorización de transporte)

| Documento | Tipo | Campos |
|---|---|---|
| Autorización de recolección y transporte en Coahuila | **Obligatorio** · admite varios | Número de oficio · Fecha de emisión · Vigencia · Materiales que ampara · Archivo |
| Vehículos registrados | **Obligatorio** | Un texto con el tipo y las placas de cada vehículo, uno por renglón. **Sin archivo** |
| Póliza de seguro | **Obligatorio** | Vigencia · Archivo |
| Permiso federal de autotransporte | Recomendado | Archivo |

**Total de obligatorios del transportista: 5.**

> ⚠️ **No coincide con el documento de cambios** (sí con el plan de trabajo, que explica cada
> cambio):
>
> - **Registro de generador sin vigencia.** El documento de cambios la pide; el plan la quitó
>   porque ese registro no vence, se actualiza cada tres años.
> - **El plan de manejo** es obligatorio y no aparece en el documento de cambios.
> - **"Materiales que ampara"** y **"Agregar otro registro"** no están en el documento de
>   cambios. Los añadió el plan tras revisar el reglamento de Coahuila.
> - **Los tipos de autorización del comprador** están escritos distinto: el documento dice
>   "acopio / reciclaje y co-procesamiento / tratamiento"; la pantalla usa la redacción de la
>   SMA.
> - **La caracterización de laboratorio**: el documento de cambios la pone también en la ficha
>   del residuo al publicar. Hoy solo está en el expediente.
> - **La generación o el consumo anual** (en toneladas) que el documento de cambios pide para
>   calcular el Score **no se pregunta en ninguna pantalla**.

---

## 5. Los campos de la ficha técnica al publicar

Primero el generador elige entre dos botones: **Residuo sin procesar** o **Residuo procesado y
limpio**. Eso abre la ficha:

| Campo | ¿Obligatorio? | Cómo es |
|---|---|---|
| Material | Sí | Lista cerrada de 10: Acero, Hierro, HMS (metales ferrosos) · Cobre, Aluminio (no ferrosos) · PET, HDPE #2, PP #5 (plásticos) · Tarimas, Cartón (empaque industrial). "Si tu material no está, no se puede publicar aquí." |
| Descripción | Sí | Texto. Ejemplo: "rebaba de maquinado de acero 1018" |
| Cantidad del lote | Sí | Número + unidad (kilogramos o toneladas). "El lote se vende completo." |
| Precio por unidad | Sí | Pesos por kilo o por tonelada. **Mientras se escribe**, muestra la cuenta completa y lo que pagará el comprador con la comisión del 3% |
| Periodicidad | Sí | Lote único · Semanal · Mensual · Otra |
| Nivel de procesamiento | Sí | Sin procesar · Separado · Compactado o empacado · Triturado |
| Condición | Sí | Limpio · Con impurezas |
| ¿Qué impurezas trae? | Sí, si eligió "Con impurezas" | Texto. Solo aparece en ese caso |
| Humedad aproximada (%) | No | Solo aparece para PET, HDPE, PP y cartón |
| Ubicación de la planta | Sí | Solo Torreón (fase 1), ya seleccionado |
| Fotos | Sí, mínimo 2 | Dice cuántas van seleccionadas |
| Declaración | Sí | Casilla: "Declaro que este material no es un residuo peligroso y no está contaminado con sustancias peligrosas." |

**Materiales que su registro no ampara:** si el generador ya marcó sus materiales en el
expediente, los demás salen **apagados** en la lista con "no amparado por tu registro". Si no
ha marcado ninguno, no se apaga nada.

> 🔒 Igual que los estados: esto se frena **en pantalla**, no en la base de datos.

**Clave del catálogo de la SMA:** cada publicación guarda **"PENDIENTE-SMA"**, un texto
provisional, y así se ve en el detalle. Las claves oficiales no se han capturado.

> ⚠️ **No coincide con el documento de cambios**: pide un campo opcional de **caracterización de
> laboratorio** en la ficha, que da la insignia "material caracterizado". En la ficha no existe
> (ver sección 4 y sección 7).

---

## 6. Qué ve y qué puede hacer cada rol

### El comprador

**Explorar residuos**
- Una lista de todo lo publicado que sigue disponible, con dos filtros de texto libre: tipo de
  residuo y ubicación.
- Cada tarjeta muestra: material, **empresa que publica**, si está sin procesar o procesado,
  precio con el total del lote y la comisión (ejemplo: *"$4,000/t · Lote de 10 t: $40,000 +
  comisión EcoConnect 3% ($1,200)"*), cantidad, ubicación, periodicidad, procesamiento,
  condición, descripción, fotos y si el generador tiene registro para ese material.
- Botones: **Ver detalles** y **Contactar generador**.

**Detalle de un residuo**
- Todo lo de la tarjeta más las impurezas, la humedad, la clave del catálogo y el estado de la
  publicación.
- Si **su propia autorización no ampara ese material**, un aviso arriba: *"Tu autorización no
  ampara este material"*.
- **Contactar**: abre una conversación **dentro de la plataforma**. Nadie ve el correo de nadie.
- **Guardar en mis intereses.**

**Mis intereses**: la lista de residuos y servicios guardados, con **Ver** y **Eliminar**.

**Servicios de transporte**: un directorio de los transportistas, con filtros de texto (tipo de
transporte y zona). Cada tarjeta muestra tipo de transporte, empresa, capacidad, zona,
residuos que transporta, disponibilidad, fotos y la insignia de documentación (sección 7). Desde
el detalle puede **contactar** y **guardar en intereses**.

**Mi autorización SMA**: su parte del expediente (sección 4).

**Pago de una operación**: 🎭 pantalla de ejemplo (ver sección 8).

**Lo que no puede hacer:** solicitar un lote, cerrar una compra, pagar de verdad, pedir
cotizaciones de transporte ni ver "mis operaciones". Hoy todo termina en la conversación.

### El transportista

**Publicar servicio de transporte** (solo con la cuenta verificada):

| Campo | ¿Obligatorio? |
|---|---|
| Tipo de transporte | Sí (texto libre) |
| Capacidad de carga | Sí (texto libre) |
| Tipos de residuos que puedes transportar | Sí (texto libre, no la lista del catálogo) |
| Zona de cobertura | Sí |
| Disponibilidad o frecuencia | Sí |
| Descripción adicional | No |
| Fotos del vehículo | No |

No lleva precio: cada traslado se acordaría aparte.

**Ver mis servicios**: cada servicio con su insignia de documentación, sus datos y su estado
(activo o inactivo). Botones:
- **Cambiar estado** (activo ↔ inactivo) y **Eliminar**: funcionan.
- **Mensajes**: ve y contesta lo que le escribieron los compradores.
- **Editar**: ⚠️ **no hace nada**.

**Mi autorización de transporte**: su parte del expediente (sección 4).

**Lo que no puede hacer:** ver solicitudes de traslado ni mandar cotizaciones. Los compradores
lo encuentran en el directorio y le escriben.

### El generador (para completar el cuadro)

Publica residuos (sección 5). En **Mis residuos publicados** ve cada lote como lo ve el
comprador, con comisión incluida, y puede **marcarlo como vendido o disponible** y **leer y
contestar mensajes**. El botón **Editar** ⚠️ solo muestra un aviso de "luego lo conectamos".
También tiene **Mi registro de generador** y el **Manifiesto** 🎭 de ejemplo.

---

## 7. Las insignias y dónde aparecen

| Insignia | Dónde | Cuándo sale |
|---|---|---|
| **Cuenta: [estado]** | Perfil propio (Mi cuenta) | Siempre. En verde si está verificada, en gris si no |
| **Registrado en padrón SMA** / en gris **"Padrón SMA: sin cotejar"** | Perfil propio | Verde cuando el equipo puso la cuenta en "verificado" |
| **Sin procesar** / **Procesado y limpio** | Tarjetas de residuos (explorar y mis residuos) | Según el botón que eligió el generador |
| **"El generador tiene registro para este material"** / **"Este material no aparece en el registro del generador"** | Explorar residuos y detalle del residuo (comprador) | Según los materiales que el generador marcó en su expediente. Si no ha marcado ninguno, no sale nada |
| **"Amparado por tu registro"** / **"Tu registro no ampara este material"** / **"Marca este material en tu registro de generador"** | Mis residuos publicados (generador) | Lo mismo, visto por el propio generador |
| **Documentación completa / parcial / Sin documentación** · con el detalle "Autorización ✓ · Vehículos ✓ · Seguro ✓" | Servicios de transporte (comprador) | Según lo que el transportista subió a su expediente. Es por empresa: todos sus servicios muestran lo mismo |
| **Docs OK / Docs incompletos / Sin docs** | Ver mis servicios (transportista) | El mismo dato, visto por él |
| **Obligatorio / Recomendado / En revisión / Aprobado / Rechazado / Por confirmar** | Cada documento del expediente | "Por confirmar" marca lo que rellenó la lectura automática, hasta que la empresa lo toca |

Debajo de las insignias del perfil siempre dice: *"Documentos proporcionados por la empresa.
EcoConnect no certifica su veracidad."* En el perfil también aparece *"EcoConnect Score: se
calcula con tu primera operación"*, sin número.

> 🔒 **Ojo en el pitch:** las insignias de documentación del transportista y las de "registro
> para este material" miran **lo que la empresa subió y marcó**, no lo que el equipo aprobó ni
> si está vigente. Un transportista con los tres papeles subidos sale "Documentación completa"
> aunque nadie los haya revisado.

> ⚠️ **No coincide con el documento de cambios:**
>
> - **"Expediente completo" no aparece en ninguna parte.** El documento de cambios la pide, y la
>   propia pantalla del expediente la promete: *"Completarlos te da la insignia de expediente
>   completo"*. La cuenta que la decidiría existe por dentro, pero nadie la muestra.
> - **"Material caracterizado" no existe.** El texto de ayuda de la caracterización de
>   laboratorio la promete.
> - Las insignias van en el **"perfil público"** según el documento de cambios. Hoy **cada
>   empresa solo ve su propio perfil**: ninguna otra ve su estado ni su insignia de padrón. El
>   plan de trabajo lo anota como un cambio de seguridad pendiente, no de pantalla.

---

## 8. Lo que está simulado 🎭

Se ve completo, pero no pasa nada de verdad detrás.

| Qué | Qué se ve | Qué pasa de verdad |
|---|---|---|
| **Pago de una operación** (comprador) | Folio ECO-2026-0041. Desglose: lote de 10 t de acero a $4,000 = $40,000 · flete $6,500 · comisión 3% $1,200 · total $47,700. Una CLABE, los cuatro pasos del cobro y el botón **"Simular pago recibido"**, que marca todo como pagado y enciende el enlace al manifiesto | Nada. No hay cobro ni Stripe, y la CLABE no existe en ningún banco. La pantalla lo dice a la vista. Los datos son siempre los mismos, sea quien sea el que entra |
| **Manifiesto** (generador) | Vista previa con las 8 secciones del formato de la SMA, llena con la misma operación de ejemplo. Un campo para capturar el folio y tres casillas de firma (generador y transportista en la recolección, destinatario en la entrega) | No se genera ningún PDF, no se envía nada a firmar y las firmas no valen. El folio no se guarda: se pierde al recargar. La pantalla lo dice a la vista |
| **Lectura automática de documentos** (expediente y autorizaciones) | Al subir un archivo: "Leyendo documento…". En Mis autorizaciones rellena número de oficio, fecha, vigencia y materiales, marcados "Por confirmar". En Mi expediente solo dice si el nombre coincide con la razón social | Nadie lee el archivo. Devuelve **siempre los mismos datos de ejemplo** según el tipo de documento, suba lo que suba. El aviso de "el nombre no coincide" **solo sale si el archivo lleva "no-coincide" en el nombre**: sirve para enseñarlo en la demo |
| **Empresas de la operación de ejemplo** | Metales del Nazas, Recicladora Laguna Verde y Fletes del Norte | Son inventadas, a propósito |
| **Portada: "Impacto generado"** | 120 empresas, 8,500 residuos valorizados, 3,200 de CO₂ evitado, 250 intercambios | Son cifras proyectadas; la propia portada lo dice |
| **Portada: "Lo que dicen las empresas"** | Tres opiniones de un gerente, una directora y un coordinador | Son de ejemplo. No los dijo ningún cliente |

**La revisión de expedientes** tampoco existe como pantalla: el equipo cambia el estado de la
cuenta y de cada documento a mano, desde el panel de la base de datos.

**Una parte de "Revisar antes de enviar" sí es real:** la lista de documentos que faltan y la de
autorizaciones que vencen en los próximos tres meses salen de lo que la empresa guardó. Solo
lo del nombre depende de la lectura simulada.

> ⚠️ **No coincide el nombre del transportista de ejemplo.** En la pantalla de pago y en el
> manifiesto se llama **"Fletes del Norte S. de R.L."**, que sería una sociedad. La cuenta de
> ejemplo que se crea para el pitch se llama **"Fletes del Norte"** y es **persona física**
> (el plan de trabajo la hizo así para enseñar que no se le pide acta constitutiva). Si en el
> pitch se enseñan las dos, se nota.

> ⚠️ **El documento de cambios** dice que la modalidad del destinatario en el manifiesto es
> "siempre Almacenamiento". En la pantalla sale **"Reciclaje"**, porque ahora sale del tipo de
> autorización del comprador. Coincide con el plan de trabajo, que lo cambió así.

> ⚠️ **El plan de trabajo se contradice** sobre los nombres del menú: en un sitio dice "Pago de
> una operación (ejemplo)" y "Manifiesto (ejemplo)"; más abajo, que se quitó el paréntesis. En
> pantalla salen **sin** "(ejemplo)"; el aviso de que es una demostración está dentro de cada
> página.

---

## 9. Lo que todavía no existe

**La operación de compra completa:**
- Botón "Solicitar lote", aceptación del generador y compromiso de firmar el manifiesto.
- La pantalla "Mis operaciones" para los tres roles.
- Pago real con reparto automático (lote al generador, flete al transportista, 3% a EcoConnect).
- Manifiesto real en PDF, firmas electrónicas y subida del escaneo del original sellado.

**Transporte con cotizaciones:**
- Que el comprador pida transporte para su operación y compare cotizaciones.
- Que el transportista vea solicitudes abiertas y cotice.
- La regla de 24 horas para cotizar y la opción "usar mi propio transporte".

**Confianza y protección:**
- Abrir una disputa, el panel para resolverla y los reembolsos.
- El bloqueo del comprador que no firma a las 72 horas y el indicador "firma a tiempo".
- Calificaciones de 1 a 5 estrellas.
- Las insignias "Expediente completo" y "Material caracterizado" (ver sección 7).
- Que otras empresas vean tu estado y tus insignias en un perfil público.

**Score y reportes:**
- El EcoConnect Score calculado (hoy solo dice "se calcula con tu primera operación").
- La bitácora que se descarga y el reporte ESG.
- La pregunta de generación o consumo anual, que el Score necesitaría.

**Lo que tendría que pasar solo:**
- Que una cuenta pase sola a "vencida" o a "actualización pendiente" cuando toca.
- Que las publicaciones se pausen al vencer un permiso.
- Avisos por correo de cualquier tipo, incluidos los de mensajes nuevos: hoy hay que entrar a
  cada publicación para ver si alguien escribió.
- El aviso al generador a los 25 días sin el escaneo del manifiesto.

**Herramientas del equipo:**
- Un panel interno para revisar expedientes: hoy se hace a mano en la base de datos.
- La lectura real de documentos con inteligencia artificial.

**Que los bloqueos sean de verdad** (🔒):
- Que la base de datos impida publicar o contactar a una cuenta no verificada.
- Que impida publicar o solicitar un material que la autorización no ampara.

**Otros:**
- Operar con varios roles desde una misma cuenta (un selector "Operando como…").
- Editar un residuo o un servicio ya publicado.
- Las claves oficiales del catálogo de residuos de la SMA.
- Municipios fuera de Torreón.

> ⚠️ **La portada promete algunas de estas cosas** en los recuadros de cada rol:
> *"Solicitar propuestas a generadores"* y *"Trazabilidad para tus reportes ESG"* (comprador),
> *"Consulta, actualiza o marca como vendidos"* (generador; actualizar no funciona) y
> *"ajusta disponibilidad y actualiza zonas de cobertura"* (transportista; editar no
> funciona). Conviene saberlo si alguien pregunta en el pitch.
