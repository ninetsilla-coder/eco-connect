// ==============================================================
// Una pantalla del expediente
// ==============================================================
// El expediente vive en dos páginas —"Mi expediente" y "Mis
// autorizaciones"— que dibujan exactamente lo mismo con documentos
// distintos. Este módulo es ese dibujo, para que no acaben siendo dos
// copias que se separan con cada arreglo.
//
// `ui` no conoce a `data` (CLAUDE.md §4.1), así que todo lo que sabe de
// la base entra por parámetros: el catálogo, las filas guardadas y las
// funciones de guardar y de firmar un archivo. Es el mismo trato que
// tiene `montarConversacion()`.
//
// Todo se arma con createElement y textContent: los valores vienen de
// la base y no se interpolan en HTML (§4.4).
// ==============================================================

import { etiquetaRevision, puedeOperar } from "./estado-cuenta.js";

// "Ya puedes operar" y "te falta un documento obligatorio" se leían
// juntos y se contradecían. Pueden ser ciertos los dos a la vez, y no
// por un fallo: una cuenta verificada en marzo se encuentra en abril
// con documentos que el catálogo no pedía entonces. Pasa cada vez que
// el expediente crece —pasó al añadir el plan de manejo—, así que el
// texto tiene que distinguir las dos situaciones:
//
//   cuenta verificada  lo pendiente NO bloquea; es ponerse al día
//   cuenta sin operar  lo pendiente es justo lo que falta para empezar
export function textoPendientes(cantidad, operando) {
  const documentos = cantidad === 1 ? "1 documento obligatorio" : `${cantidad} documentos obligatorios`;

  if (operando) {
    return {
      titulo: "Tienes documentos por completar",
      detalle: `Tu cuenta está verificada y puedes seguir operando. Hay ${documentos} que se añadieron después: complétalos para mantener tu expediente al día.`,
      intro: "Tu cuenta ya está verificada. Estos documentos se añadieron después:",
    };
  }

  return {
    titulo: "Te falta completar tu expediente",
    detalle: `Tienes ${documentos} pendiente${cantidad === 1 ? "" : "s"} antes de poder enviarlo a revisión.`,
    intro: "Te faltan estos documentos obligatorios:",
  };
}

// Qué es cada bloque, en términos de la empresa que lo llena. Están
// aquí y no en cada página porque los dos lados del expediente usan los
// mismos textos y no deben poder divergir.
export const SUBTITULOS = Object.freeze({
  "Datos generales": "Los pide cualquier empresa, sea cual sea su rol.",
  "Impacto ambiental": "Requisito para publicar o comprar residuos. Al transportista no se le pide.",
  "Registro de generador": "Tu registro ante la SMA, el plan de manejo y, si la tienes, la caracterización del material.",
  "Autorización SMA": "La autorización que te permite recibir residuos de manejo especial.",
  "Autorización de transporte": "Tu autorización de recolección y transporte, y los vehículos que la amparan.",
  "Recomendados": "No son obligatorios. Completarlos te da la insignia de expediente completo.",
});

function crearEtiqueta(texto, clase) {
  const span = document.createElement("span");
  span.className = `etiqueta ${clase}`;
  span.textContent = texto;
  return span;
}

// Las casillas de "materiales que ampara". Ocupan el ancho completo:
// son diez y no caben en una columna de la rejilla.
function crearCampoMateriales(doc, guardado, materiales) {
  const envoltorio = document.createElement("fieldset");
  envoltorio.className = "campo-materiales";
  envoltorio.style.gridColumn = "1 / -1";

  const titulo = document.createElement("legend");
  titulo.textContent = "Materiales que ampara";
  envoltorio.appendChild(titulo);

  const ayuda = document.createElement("small");
  ayuda.className = "form-hint";
  ayuda.textContent =
    "Las autorizaciones de la SMA son por residuo: marca solo los que aparecen en el documento.";
  envoltorio.appendChild(ayuda);

  const rejilla = document.createElement("div");
  rejilla.className = "materiales-rejilla";

  const marcados = new Set(guardado?.materiales ?? []);

  materiales.forEach((material) => {
    const etiqueta = document.createElement("label");
    etiqueta.className = "material-opcion";

    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.className = "material-casilla";
    casilla.value = material.id;
    casilla.checked = marcados.has(material.id);

    const texto = document.createElement("span");
    texto.textContent = material.nombre;

    etiqueta.append(casilla, texto);
    rejilla.appendChild(etiqueta);
  });

  envoltorio.appendChild(rejilla);
  return envoltorio;
}

// `sufijo` distingue los controles de un registro de los del siguiente:
// con dos registros de generador en la misma página, dos campos con el
// mismo id harían que la etiqueta apuntara siempre al primero.
function crearCampo(doc, clave, guardado, sufijo, { campos, materiales }) {
  if (clave === campos.MATERIALES) return crearCampoMateriales(doc, guardado, materiales);

  const envoltorio = document.createElement("div");
  const etiqueta = document.createElement("label");
  const id = `${doc.id}-${sufijo}-${clave}`;
  etiqueta.setAttribute("for", id);

  let control;

  if (clave === campos.SUBTIPO || clave === campos.AUTORIDAD) {
    etiqueta.textContent = clave === campos.SUBTIPO ? "Tipo" : "Autoridad que la emitió";
    control = document.createElement("select");
    const opciones = clave === campos.SUBTIPO ? doc.subtipos : doc.autoridades;
    const vacia = document.createElement("option");
    vacia.value = "";
    vacia.textContent = "Selecciona una opción";
    control.appendChild(vacia);
    (opciones ?? []).forEach((texto) => {
      const opcion = document.createElement("option");
      opcion.value = texto;
      opcion.textContent = texto;
      control.appendChild(opcion);
    });
  } else if (clave === campos.NOTAS) {
    etiqueta.textContent = "Vehículos (tipo y placas)";
    control = document.createElement("textarea");
  } else if (clave === campos.FECHA || clave === campos.VIGENCIA) {
    etiqueta.textContent = clave === campos.FECHA ? "Fecha de emisión" : "Vigencia";
    control = document.createElement("input");
    control.type = "date";
  } else {
    etiqueta.textContent = "Número de oficio";
    control = document.createElement("input");
    control.type = "text";
  }

  control.id = id;
  control.dataset.campo = clave;
  if (guardado?.[clave]) control.value = guardado[clave];

  envoltorio.append(etiqueta, control);
  return envoltorio;
}

// Marca un control como prellenado por la lectura del PDF. La marca se
// va en cuanto la empresa lo toca: a partir de ahí el dato es suyo.
function marcarPorConfirmar(control, etiqueta) {
  control.classList.add("campo-por-confirmar");

  if (etiqueta && !etiqueta.querySelector(".chip-por-confirmar")) {
    const chip = document.createElement("span");
    chip.className = "chip-por-confirmar";
    chip.textContent = "Por confirmar";
    etiqueta.appendChild(chip);
  }

  const soltar = () => {
    control.classList.remove("campo-por-confirmar");
    etiqueta?.querySelector(".chip-por-confirmar")?.remove();
  };

  control.addEventListener("input", soltar, { once: true });
  control.addEventListener("change", soltar, { once: true });
}

// Pinta el resultado de la lectura: en las autorizaciones prellena; en
// los documentos de la empresa solo comprueba el nombre.
function pintarLectura(aviso, rejilla, doc, lectura, opciones) {
  aviso.className = "lectura-aviso";

  if (!lectura?.legible) {
    aviso.classList.add("mal");
    aviso.textContent = "No se pudo leer el archivo. Sube un PDF legible.";
    return;
  }

  let prellenados = 0;

  // En "Mi expediente" la lectura solo comprueba: no prellena. Es una
  // decisión de pantalla, no de documento — el impacto ambiental tiene
  // número de oficio y ahí tampoco se rellena.
  const campos = opciones.prellenar ? (lectura.campos ?? {}) : {};
  const materiales = opciones.prellenar ? (lectura.materiales ?? []) : [];

  Object.entries(campos).forEach(([clave, valor]) => {
    const control = rejilla.querySelector(`[data-campo="${clave}"]`);
    // No se pisa lo que la empresa ya escribió: lo suyo manda sobre
    // una lectura automática.
    if (!control || control.value) return;

    control.value = valor;
    marcarPorConfirmar(control, rejilla.querySelector(`label[for="${control.id}"]`));
    prellenados += 1;
  });

  materiales.forEach((id) => {
    const casilla = rejilla.querySelector(`.material-casilla[value="${id}"]`);
    if (!casilla || casilla.checked) return;

    casilla.checked = true;
    casilla.closest("label")?.classList.add("material-por-confirmar");
    casilla.addEventListener(
      "change",
      () => casilla.closest("label")?.classList.remove("material-por-confirmar"),
      { once: true },
    );
    prellenados += 1;
  });

  const partes = [];

  if (!lectura.coincide) {
    aviso.classList.add("mal");
    partes.push("El nombre del documento no coincide con tu razón social. Revísalo antes de enviar.");
    opciones.alDetectarNombre?.(doc, false);
  } else {
    aviso.classList.add("bien");
    partes.push(prellenados
      ? "Documento legible. Revisa los datos que rellenamos por ti."
      : "Documento legible. El nombre coincide con tu razón social.");
    opciones.alDetectarNombre?.(doc, true);
  }

  partes.push(opciones.leyendaLectura ?? "");
  aviso.textContent = partes.filter(Boolean).join(" ");
}

// Un REGISTRO de un documento. Los de la empresa tienen uno; las
// autorizaciones, uno por establecimiento. `clave` identifica el nodo
// para poder repintar solo este registro al guardarlo, sin tocar lo que
// el usuario esté escribiendo en los demás.
export function crearRegistro(doc, guardado, opciones, indice = null, clave = null) {
  const { campos: CAMPOS, estadoCuenta, admiteVarios, alGuardar, obtenerUrl } = opciones;

  const caja = document.createElement("div");
  caja.className = "documento";
  caja.dataset.registro = clave ?? guardado?.id ?? doc.id;

  // ---------- Cabecera: nombre, si es obligatorio y su veredicto ----------
  const cabecera = document.createElement("div");
  cabecera.className = "documento-cabecera";

  const titulo = document.createElement("h4");
  // Con varios registros, el nombre del documento ya lo dice el bloque:
  // aquí toca distinguir de qué establecimiento es cada uno.
  titulo.textContent = admiteVarios(doc) && indice !== null
    ? `Registro ${indice + 1}`
    : doc.nombre;
  cabecera.appendChild(titulo);

  if (!admiteVarios(doc) || indice === 0) {
    cabecera.appendChild(doc.obligatorio
      ? crearEtiqueta("Obligatorio", "etiqueta-obligatorio")
      : crearEtiqueta("Recomendado", "etiqueta-opcional"));
  }

  // Solo si el documento existe: uno que aún no se ha guardado no tiene
  // veredicto que enseñar.
  if (guardado) {
    const revision = etiquetaRevision(guardado.estado, estadoCuenta);
    if (revision) {
      const [texto, clase] = revision;
      cabecera.appendChild(crearEtiqueta(texto, `etiqueta-${clase}`));
    }
  }

  caja.appendChild(cabecera);

  if (doc.ayuda) {
    const ayuda = document.createElement("p");
    ayuda.className = "form-hint";
    ayuda.textContent = doc.ayuda;
    caja.appendChild(ayuda);
  }

  // El motivo del rechazo lo escribe el equipo y el usuario tiene que
  // verlo: sin él, "Rechazado" no le dice qué corregir.
  if (guardado?.estado === "rechazado" && guardado.motivo_rechazo) {
    const motivo = document.createElement("p");
    motivo.className = "documento-estado error";
    motivo.textContent = `Motivo: ${guardado.motivo_rechazo}`;
    caja.appendChild(motivo);
  }

  // ---------- Campos ----------
  const sufijo = caja.dataset.registro;
  const rejilla = document.createElement("div");
  rejilla.className = "documento-campos";
  doc.campos.forEach((c) => rejilla.appendChild(crearCampo(doc, c, guardado, sufijo, opciones)));

  let entradaArchivo = null;
  if (!doc.sinArchivo) {
    const envoltorio = document.createElement("div");
    const etiqueta = document.createElement("label");
    etiqueta.setAttribute("for", `${doc.id}-${sufijo}-archivo`);
    etiqueta.textContent = guardado?.archivo_ruta ? "Reemplazar PDF" : "Archivo PDF";
    entradaArchivo = document.createElement("input");
    entradaArchivo.type = "file";
    entradaArchivo.id = `${doc.id}-${sufijo}-archivo`;
    entradaArchivo.accept = ".pdf,image/*";
    envoltorio.append(etiqueta, entradaArchivo);
    rejilla.appendChild(envoltorio);
  }

  caja.appendChild(rejilla);

  // ---------- Lectura asistida ----------
  // La IA lee el PDF y prellena. No decide nada: lo que rellena queda
  // marcado "Por confirmar" hasta que la empresa lo toca, y nada se
  // guarda hasta que le da a Guardar.
  const avisoLectura = document.createElement("p");
  avisoLectura.className = "lectura-aviso";
  caja.appendChild(avisoLectura);

  if (entradaArchivo && opciones.leerDocumento) {
    entradaArchivo.addEventListener("change", async () => {
      const archivo = entradaArchivo.files?.[0];
      if (!archivo) return;

      avisoLectura.className = "lectura-aviso leyendo";
      avisoLectura.textContent = "Leyendo documento...";

      let lectura;
      try {
        lectura = await opciones.leerDocumento(doc, archivo);
      } catch (err) {
        console.warn("No se pudo leer el documento:", err);
        avisoLectura.className = "lectura-aviso";
        avisoLectura.textContent = "";
        return;
      }

      pintarLectura(avisoLectura, rejilla, doc, lectura, opciones);
    });
  }

  // ---------- Acciones ----------
  const acciones = document.createElement("div");
  acciones.className = "documento-acciones";

  const boton = document.createElement("button");
  boton.type = "button";
  boton.className = "btn-secondary";
  boton.textContent = "Guardar";
  acciones.appendChild(boton);

  const estado = document.createElement("span");
  estado.className = "documento-estado";
  acciones.appendChild(estado);

  // El archivo vive en un bucket privado: el enlace se firma al pedirlo
  // y caduca. Por eso se genera aquí y no se guarda en la base.
  if (guardado?.archivo_ruta) {
    const enlace = document.createElement("a");
    enlace.className = "enlace-archivo";
    enlace.textContent = "Ver el archivo cargado";
    enlace.target = "_blank";
    enlace.rel = "noopener";
    enlace.href = "#";
    enlace.addEventListener("click", async (evento) => {
      evento.preventDefault();
      const url = await obtenerUrl(guardado.archivo_ruta);
      if (url) window.open(url, "_blank", "noopener");
      else estado.textContent = "No se pudo abrir el archivo.";
    });
    acciones.appendChild(enlace);
  }

  caja.appendChild(acciones);

  boton.addEventListener("click", async () => {
    estado.className = "documento-estado";
    estado.textContent = "Guardando...";
    boton.disabled = true;

    const valores = {};
    rejilla.querySelectorAll("[data-campo]").forEach((control) => {
      valores[control.dataset.campo] = control.value.trim();
    });

    valores.materiales = [...rejilla.querySelectorAll(".material-casilla")]
      .filter((casilla) => casilla.checked)
      .map((casilla) => casilla.value);

    const archivo = entradaArchivo?.files?.[0] ?? null;

    // Un documento sin archivo y sin nada escrito no es un documento.
    if (!archivo && !guardado?.archivo_ruta && !doc.sinArchivo) {
      estado.className = "documento-estado error";
      estado.textContent = "Falta el archivo.";
      boton.disabled = false;
      return;
    }
    if (doc.sinArchivo && !valores[CAMPOS.NOTAS]) {
      estado.className = "documento-estado error";
      estado.textContent = "Escribe al menos un vehículo.";
      boton.disabled = false;
      return;
    }
    // Una autorización sin materiales no sirve para nada: es justo el
    // dato que decide qué puede publicar o comprar esta empresa.
    if (doc.campos.includes(CAMPOS.MATERIALES) && !valores.materiales.length) {
      estado.className = "documento-estado error";
      estado.textContent = "Marca al menos un material de los que ampara el documento.";
      boton.disabled = false;
      return;
    }

    try {
      // El mensaje de éxito lo pone quien guarda, sobre el registro ya
      // repintado: este nodo deja de estar en la página.
      await alGuardar(doc, valores, archivo, guardado?.id ?? null, caja.dataset.registro);
    } catch (err) {
      console.error("Error guardando el documento:", err);
      estado.className = "documento-estado error";
      // El motivo, no un "intenta de nuevo": las causas reales aquí son
      // que falte la tabla, que falte el bucket o que el archivo pese
      // demasiado, y en las tres reintentar no arregla nada.
      estado.textContent = `No se pudo guardar: ${err?.message || "error desconocido"}`;
    } finally {
      boton.disabled = false;
    }
  });

  return caja;
}

// Pinta los bloques de una pantalla con todos sus registros.
export function montarPantallaExpediente(contenedor, opciones) {
  const { bloques, subtitulos = {}, filasDe, admiteVarios } = opciones;
  if (!contenedor) return;

  contenedor.textContent = "";
  // Contador para dar clave a los registros que aún no existen en la
  // base: uno nuevo no tiene id hasta que se guarda.
  let nuevos = 0;

  bloques.forEach((bloque) => {
    const caja = document.createElement("section");
    caja.className = "bloque";

    const nombre = document.createElement("h3");
    nombre.textContent = bloque.nombre;
    caja.appendChild(nombre);

    if (subtitulos[bloque.nombre]) {
      const sub = document.createElement("p");
      sub.className = "bloque-sub";
      sub.textContent = subtitulos[bloque.nombre];
      caja.appendChild(sub);
    }

    bloque.documentos.forEach((doc) => {
      const grupo = document.createElement("div");
      grupo.className = "documento-grupo";
      grupo.dataset.documento = doc.id;

      const lista = document.createElement("div");
      const filas = filasDe(doc.id);

      if (filas.length) {
        filas.forEach((fila, indice) => {
          lista.appendChild(crearRegistro(doc, fila, opciones, indice, fila.id));
        });
      } else {
        lista.appendChild(crearRegistro(doc, null, opciones, 0, `nuevo-${nuevos++}`));
      }

      grupo.appendChild(lista);

      // La SMA autoriza por establecimiento: una empresa con tres
      // plantas tiene tres registros, cada uno con sus materiales.
      if (admiteVarios(doc)) {
        const agregar = document.createElement("button");
        agregar.type = "button";
        agregar.className = "btn-secondary btn-agregar-registro";
        agregar.textContent = "+ Agregar otro registro";
        agregar.addEventListener("click", () => {
          const indice = lista.querySelectorAll(".documento").length;
          lista.appendChild(crearRegistro(doc, null, opciones, indice, `nuevo-${nuevos++}`));
        });
        grupo.appendChild(agregar);
      }

      caja.appendChild(grupo);
    });

    contenedor.appendChild(caja);
  });
}

// Sustituye un registro por su versión guardada, sin repintar la página
// entera: así aparecen al momento su etiqueta y el enlace al archivo sin
// borrar lo que se esté escribiendo en otro registro.
export function reemplazarRegistro(contenedor, doc, fila, opciones, clave) {
  const anterior = contenedor?.querySelector(`[data-registro="${clave}"]`);
  if (!anterior) return;

  const indice = [...anterior.parentElement.children].indexOf(anterior);
  const nuevo = crearRegistro(doc, fila, opciones, indice, fila.id);

  const aviso = nuevo.querySelector(".documento-estado");
  if (aviso) {
    aviso.className = "documento-estado success";
    aviso.textContent = "Guardado.";
  }

  anterior.replaceWith(nuevo);
}

// El aviso que lleva a la otra pantalla. Sin él, quien termina una cree
// que ya acabó: los obligatorios están repartidos entre las dos.
function crearAvisoOtraPantalla({ titulo, detalle, enlace, texto }) {
  const caja = document.createElement("div");
  caja.className = "aviso-estado";
  caja.setAttribute("role", "status");

  const fuerte = document.createElement("strong");
  fuerte.textContent = titulo;

  const parrafo = document.createElement("p");
  parrafo.textContent = detalle;

  const a = document.createElement("a");
  a.href = enlace;
  a.textContent = texto;

  caja.append(fuerte, parrafo, a);
  return caja;
}

// La revisión previa. Es una LISTA DE VERIFICACIÓN, no un dictamen:
// quien aprueba un expediente es el equipo. Se dice en la propia
// pantalla, no solo aquí.
//
// De sus tres apartados, dos no necesitan leer ningún PDF —lo que falta
// sale del catálogo y las vigencias de las fechas capturadas—. Solo el
// nombre de la empresa viene de la lectura, y por eso solo aparece de
// los documentos que se hayan subido en esta visita.
function crearRevisionPrevia({ grupos, vigencias, nombresDistintos, docsPorId }) {
  const panel = document.createElement("div");
  panel.className = "revision-previa";

  const titulo = document.createElement("h3");
  titulo.textContent = "Revisión previa";
  panel.appendChild(titulo);

  const apartado = (encabezado, elementos) => {
    if (!elementos.length) return;

    const h = document.createElement("p");
    h.className = "revision-apartado";
    h.textContent = encabezado;
    panel.appendChild(h);

    const lista = document.createElement("ul");
    elementos.forEach((texto) => {
      const li = document.createElement("li");
      li.textContent = texto;
      lista.appendChild(li);
    });
    panel.appendChild(lista);
  };

  apartado(
    "Te falta subir",
    grupos.flatMap((grupo) =>
      grupo.documentos.map((doc) => `${doc.nombre} — en ${grupo.titulo}`)),
  );

  apartado(
    "Vence pronto",
    vigencias.map((v) => {
      const fecha = v.fecha.toLocaleDateString("es-MX", {
        day: "numeric", month: "long", year: "numeric",
      });
      return v.vencida
        ? `${v.nombre} — venció el ${fecha}`
        : `${v.nombre} — vence el ${fecha}`;
    }),
  );

  apartado(
    "Revisa",
    nombresDistintos.map((id) =>
      `El nombre en "${docsPorId.get(id)?.nombre ?? id}" no coincide con tu razón social`),
  );

  if (panel.querySelectorAll("li").length === 0) {
    const listo = document.createElement("p");
    listo.textContent = "Todo listo para enviar.";
    panel.appendChild(listo);
  }

  const nota = document.createElement("p");
  nota.className = "revision-nota";
  nota.textContent =
    "Esto es una lista de verificación, no una revisión. Quien aprueba tu expediente " +
    "es el equipo de EcoConnect.";
  panel.appendChild(nota);

  return panel;
}

// --------------------------------------------------------------
// La pantalla entera
// --------------------------------------------------------------
// Las dos páginas del expediente se diferencian en UNA palabra —cuál de
// las dos pantallas pintan— y en nada más. Por eso el recorrido
// completo vive aquí y cada página es una conexión de cables.
//
// No está en `pages/` por dos reglas que fija dependencias.test.js:
// ningún módulo puede importar de `pages/`, y cada archivo de `pages/`
// tiene que tener su HTML. Un módulo compartido entre dos páginas no
// puede vivir ahí, y como `ui` no conoce a `data`, todo lo que toca la
// base entra por `datos`.
export async function montarExpediente({ pantallaId, subtitulos, campos, materiales, datos }) {
  const contenedorBloques = document.getElementById("bloques");
  const estadoPagina = document.getElementById("status-expediente");
  const cajaEnvio = document.getElementById("envio");
  const listaFaltantes = document.getElementById("envio-faltantes");
  const botonEnviar = document.getElementById("btn-enviar");
  const estadoEnvio = document.getElementById("status-envio");
  const cajaAvisoOtra = document.getElementById("aviso-otra-pantalla");
  const tituloEstado = document.getElementById("estado-titulo");
  const detalleEstado = document.getElementById("estado-detalle");

  const mostrar = (elemento, texto, clase = "") => {
    if (!elemento) return;
    elemento.textContent = texto;
    elemento.className = clase ? `form-status ${clase}` : "form-status";
  };

  const sesion = await datos.requiereSesion();
  if (!sesion) return;

  const rol = sesion.rol;
  // El RFC decide si se le piden documentos de persona moral. Viene con
  // la sesión —`core/sesion.js` trae el perfil entero—, así que no hace
  // falta ninguna consulta extra.
  const rfc = sesion.perfil?.rfc;
  let estadoCuenta = sesion.perfil?.estado || "pendiente";

  const pintarEstadoCuenta = () => {
    const info = datos.infoEstado(estadoCuenta);
    if (tituloEstado) tituloEstado.textContent = info.titulo;
    if (detalleEstado) detalleEstado.textContent = info.detalle;
  };
  pintarEstadoCuenta();

  if (!rol) {
    mostrar(estadoPagina, "Tu cuenta no tiene un tipo de empresa asignado. Escríbenos para corregirlo.", "error");
    return;
  }

  mostrar(estadoPagina, "Cargando tu expediente...");

  let guardados = [];
  try {
    guardados = await datos.listar(sesion.usuario.id);
  } catch (err) {
    console.error("Error cargando el expediente:", err);
    mostrar(estadoPagina, "No se pudo cargar tu expediente. Recarga la página.", "error");
    return;
  }

  mostrar(estadoPagina, "");

  // Qué documentos salieron con un nombre distinto al de la cuenta.
  // Solo de esta visita: la lectura no se guarda en ningún sitio.
  const nombresDistintos = new Set();

  const opciones = {
    bloques: datos.bloques(rol, pantallaId, rfc),
    leyendaLectura: datos.leyendaLectura,
    prellenar: pantallaId === "autorizaciones",
    leerDocumento: datos.leerDocumento
      ? (doc, archivo) => datos.leerDocumento(doc, archivo, {
        razonSocial: sesion.perfil?.company_name,
      })
      : null,
    alDetectarNombre: (doc, coincide) => {
      if (coincide) nombresDistintos.delete(doc.id);
      else nombresDistintos.add(doc.id);
    },
    subtitulos,
    campos,
    materiales,
    estadoCuenta,
    admiteVarios: datos.admiteVarios,
    filasDe: (docId) => datos.filasDe(guardados, docId),
    obtenerUrl: datos.obtenerUrl,
    alGuardar: async (doc, valores, archivo, filaId, clave) => {
      const fila = await datos.guardar(sesion.usuario.id, doc, valores, archivo, filaId);
      guardados = guardados.filter((g) => g.id !== fila.id).concat(fila);
      pintarPendientes();
      reemplazarRegistro(contenedorBloques, doc, fila, opciones, clave);
    },
  };

  // Lo que falta, en LAS DOS pantallas: quien termina una no ha
  // terminado el expediente, y sin decirle dónde está lo pendiente se
  // queda buscándolo en la pantalla equivocada.
  function pintarPendientes() {
    const grupos = datos.faltantesPorPantalla(rol, guardados, rfc);
    const operando = puedeOperar(estadoCuenta);
    const cuantos = grupos.reduce((suma, g) => suma + g.documentos.length, 0);
    const textos = textoPendientes(cuantos, operando);

    if (listaFaltantes) {
      listaFaltantes.textContent = "";
      const pendientes = grupos.filter((g) => g.documentos.length);

      if (!pendientes.length) {
        const listo = document.createElement("p");
        listo.textContent = "Ya tienes todos los documentos obligatorios de tu rol.";
        listaFaltantes.appendChild(listo);
      } else {
        const intro = document.createElement("p");
        intro.textContent = textos.intro;
        listaFaltantes.appendChild(intro);

        pendientes.forEach((grupo) => {
          const nombre = document.createElement("p");
          nombre.className = "faltantes-pantalla";
          nombre.textContent = `En ${grupo.titulo}:`;
          listaFaltantes.appendChild(nombre);

          const lista = document.createElement("ul");
          grupo.documentos.forEach((doc) => {
            const elemento = document.createElement("li");
            elemento.textContent = doc.nombre;
            lista.appendChild(elemento);
          });
          listaFaltantes.appendChild(lista);
        });
      }
    }

    if (botonEnviar) botonEnviar.disabled = !datos.puedeEnviarse(rol, guardados, rfc);

    if (cajaAvisoOtra) {
      cajaAvisoOtra.textContent = "";
      const otra = grupos.find((g) => g.id !== pantallaId && g.documentos.length);
      if (otra) {
        const suyos = textoPendientes(otra.documentos.length, operando);
        cajaAvisoOtra.appendChild(crearAvisoOtraPantalla({
          titulo: operando
            ? suyos.titulo
            : (otra.id === "autorizaciones"
              ? "Te falta completar tus autorizaciones"
              : "Te faltan documentos de tu empresa"),
          detalle: `${suyos.detalle} Están en ${otra.titulo}.`,
          enlace: otra.pagina,
          texto: `Ir a ${otra.titulo}`,
        }));
      }
    }
  }

  montarPantallaExpediente(contenedorBloques, opciones);
  pintarPendientes();
  if (cajaEnvio) cajaEnvio.style.display = "block";

  // ---------- Revisar antes de enviar ----------
  const botonRevisar = document.getElementById("btn-revisar");
  const panelRevision = document.getElementById("revision-panel");

  botonRevisar?.addEventListener("click", () => {
    if (!panelRevision) return;

    // Se abre y se cierra ahí mismo, sin ventana: la lista se lee con
    // el expediente delante, que es donde hay que corregir.
    if (panelRevision.firstChild) {
      panelRevision.textContent = "";
      botonRevisar.textContent = "Revisar antes de enviar";
      return;
    }

    panelRevision.appendChild(crearRevisionPrevia({
      grupos: datos.faltantesPorPantalla(rol, guardados, rfc)
        .filter((g) => g.documentos.length),
      vigencias: datos.vigenciasPorVencer(guardados),
      nombresDistintos: [...nombresDistintos],
      docsPorId: new Map(datos.documentosDeRol(rol, rfc).map((d) => [d.id, d])),
    }));
    botonRevisar.textContent = "Ocultar la revisión";
  });

  botonEnviar?.addEventListener("click", async () => {
    mostrar(estadoEnvio, "Enviando...");
    botonEnviar.disabled = true;
    try {
      estadoCuenta = await datos.enviar();
      // La sesión cachea el perfil, y el estado acaba de cambiar en la
      // base: sin invalidar, el resto del sitio vería el viejo.
      datos.invalidarSesion();
      pintarEstadoCuenta();

      mostrar(
        estadoEnvio,
        estadoCuenta === "en_revision"
          ? "Expediente enviado. Te avisamos en 24 a 48 horas."
          : `Tu cuenta está en estado "${datos.infoEstado(estadoCuenta).titulo}".`,
        "success",
      );
    } catch (err) {
      console.error("Error enviando a revisión:", err);
      mostrar(estadoEnvio, "No se pudo enviar. Intenta de nuevo.", "error");
      botonEnviar.disabled = false;
    }
  });
}
