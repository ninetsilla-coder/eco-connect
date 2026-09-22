// ==============================================================
// Página: expediente.html
// ==============================================================
// Pinta los bloques del rol de la empresa y guarda cada documento por
// separado. Todo con createElement y textContent: los valores vienen de
// la base y no se interpolan en HTML (CLAUDE.md §4.4).
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { requiereSesion, invalidarSesion } from "../core/sesion.js";
import {
  nivelesDeRol, listarMiExpediente, guardarDocumento, urlDeDocumento,
  enviarARevision, faltantes, puedeEnviarse, documentosDeRol,
  filasDe, admiteVarios, CAMPOS,
} from "../data/expediente.js";
import { MATERIALES } from "../data/materiales.js";
import { infoEstado } from "../ui/estado-cuenta.js";

montarNavbar();

const contenedorBloques = document.getElementById("bloques");
const estadoPagina = document.getElementById("status-expediente");
const cajaEnvio = document.getElementById("envio");
const listaFaltantes = document.getElementById("envio-faltantes");
const botonEnviar = document.getElementById("btn-enviar");
const estadoEnvio = document.getElementById("status-envio");

// Cada bloque dice para qué sirve, en términos de la empresa. Los de
// arriba son de la empresa entera —los mismos para cualquier rol—, así
// que no pueden decir "documentos que pedimos a un generador".
const SUBTITULOS = {
  "Datos generales": "Los pide cualquier empresa, sea cual sea su rol. Se llenan una sola vez.",
  "Impacto ambiental": "Los pide cualquier empresa que genere o reciba residuos. Se llenan una sola vez.",
  "Registro de generador": "Tu registro ante la SMA y el plan de manejo de tus residuos.",
  "Autorización SMA": "La autorización que te permite recibir residuos de manejo especial.",
  "Autorización de transporte": "Tu autorización de recolección y transporte, y los vehículos que la amparan.",
  "Recomendados": "No son obligatorios. Completarlos te da la insignia de expediente completo.",
};

function mostrarEstado(elemento, texto, clase = "") {
  if (!elemento) return;
  elemento.textContent = texto;
  elemento.className = clase ? `form-status ${clase}` : "form-status";
}

function pintarEstadoCuenta(perfil) {
  const info = infoEstado(perfil?.estado || "pendiente");

  const titulo = document.getElementById("estado-titulo");
  const detalle = document.getElementById("estado-detalle");
  if (titulo) titulo.textContent = info.titulo;
  if (detalle) detalle.textContent = info.detalle;
}

// --------------------------------------------------------------
// Un documento
// --------------------------------------------------------------

// Las casillas de "materiales que ampara". Ocupan el ancho completo:
// son diez y no caben en una columna de la rejilla.
function crearCampoMateriales(doc, guardado) {
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

  MATERIALES.forEach((material) => {
    const etiqueta = document.createElement("label");
    etiqueta.className = "material-opcion";

    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.className = "material-casilla";
    casilla.value = material.id;
    casilla.checked = marcados.has(material.id);
    casilla.dataset.campoMaterial = doc.id;

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
function crearCampo(doc, clave, guardado, sufijo) {
  if (clave === CAMPOS.MATERIALES) return crearCampoMateriales(doc, guardado);

  const envoltorio = document.createElement("div");
  const etiqueta = document.createElement("label");
  const id = `${doc.id}-${sufijo}-${clave}`;
  etiqueta.setAttribute("for", id);

  let control;

  if (clave === CAMPOS.SUBTIPO || clave === CAMPOS.AUTORIDAD) {
    etiqueta.textContent = clave === CAMPOS.SUBTIPO ? "Tipo" : "Autoridad que la emitió";
    control = document.createElement("select");
    const opciones = clave === CAMPOS.SUBTIPO ? doc.subtipos : doc.autoridades;
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
  } else if (clave === CAMPOS.NOTAS) {
    etiqueta.textContent = "Vehículos (tipo y placas)";
    control = document.createElement("textarea");
  } else if (clave === CAMPOS.FECHA || clave === CAMPOS.VIGENCIA) {
    etiqueta.textContent = clave === CAMPOS.FECHA ? "Fecha de emisión" : "Vigencia";
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

function crearEtiqueta(texto, clase) {
  const span = document.createElement("span");
  span.className = `etiqueta ${clase}`;
  span.textContent = texto;
  return span;
}

// Un REGISTRO de un documento. Los de la empresa tienen uno; las
// autorizaciones, uno por establecimiento. `clave` identifica el nodo
// para poder repintar solo este registro al guardarlo, sin tocar lo que
// el usuario esté escribiendo en los demás.
function crearDocumento(doc, guardado, alGuardar, indice = null, clave = null) {
  const caja = document.createElement("div");
  caja.className = "documento";
  caja.dataset.registro = clave ?? guardado?.id ?? doc.id;

  // ---------- Cabecera: nombre, si es obligatorio y su veredicto ----------
  const cabecera = document.createElement("div");
  cabecera.className = "documento-cabecera";

  const titulo = document.createElement("h3");
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

  if (guardado?.estado) {
    const estados = {
      aprobado: ["Aprobado", "etiqueta-aprobado"],
      rechazado: ["Rechazado", "etiqueta-rechazado"],
      pendiente: ["En espera de revisión", "etiqueta-pendiente"],
    };
    const [texto, clase] = estados[guardado.estado] ?? estados.pendiente;
    cabecera.appendChild(crearEtiqueta(texto, clase));
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
  const campos = document.createElement("div");
  campos.className = "documento-campos";
  doc.campos.forEach((c) => campos.appendChild(crearCampo(doc, c, guardado, sufijo)));

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
    campos.appendChild(envoltorio);
  }

  caja.appendChild(campos);

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
      const url = await urlDeDocumento(guardado.archivo_ruta);
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
    campos.querySelectorAll("[data-campo]").forEach((control) => {
      valores[control.dataset.campo] = control.value.trim();
    });

    valores.materiales = [...campos.querySelectorAll(".material-casilla")]
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
      // El mensaje de éxito lo pone alGuardar sobre el registro ya
      // repintado: este nodo deja de estar en la página.
      await alGuardar(doc, valores, archivo, guardado?.id ?? null, caja.dataset.registro);
    } catch (err) {
      console.error("Error guardando el documento:", err);
      estado.className = "documento-estado error";
      // El motivo, no un "intenta de nuevo": las causas reales aquí son
      // que falte la tabla, que falte el bucket o que el archivo pese
      // demasiado, y en las tres reintentar no arregla nada. Es el
      // defecto de los `catch` mudos que CLAUDE.md §7 viene cerrando.
      estado.textContent = `No se pudo guardar: ${err?.message || "error desconocido"}`;
    } finally {
      boton.disabled = false;
    }
  });

  return caja;
}

// --------------------------------------------------------------
// La página
// --------------------------------------------------------------

function pintarFaltantes(rol, guardados) {
  if (!listaFaltantes) return;
  listaFaltantes.textContent = "";

  const pendientes = faltantes(rol, guardados);
  if (!pendientes.length) {
    const listo = document.createElement("p");
    listo.textContent = "Ya tienes todos los documentos obligatorios de tu rol.";
    listaFaltantes.appendChild(listo);
    return;
  }

  const intro = document.createElement("p");
  intro.textContent = "Te faltan estos documentos obligatorios:";
  listaFaltantes.appendChild(intro);

  const lista = document.createElement("ul");
  const porId = new Map(documentosDeRol(rol).map((doc) => [doc.id, doc]));
  pendientes.forEach((id) => {
    const elemento = document.createElement("li");
    elemento.textContent = porId.get(id)?.nombre ?? id;
    lista.appendChild(elemento);
  });
  listaFaltantes.appendChild(lista);
}

async function iniciar() {
  const sesion = await requiereSesion("index.html");
  if (!sesion) return;

  const rol = sesion.rol;
  pintarEstadoCuenta(sesion.perfil);

  if (!rol) {
    mostrarEstado(estadoPagina, "Tu cuenta no tiene un tipo de empresa asignado. Escríbenos para corregirlo.", "error");
    return;
  }

  mostrarEstado(estadoPagina, "Cargando tu expediente...");

  let guardados = [];
  try {
    guardados = await listarMiExpediente(sesion.usuario.id);
  } catch (err) {
    console.error("Error cargando el expediente:", err);
    mostrarEstado(estadoPagina, "No se pudo cargar tu expediente. Recarga la página.", "error");
    return;
  }

  mostrarEstado(estadoPagina, "");

  // Contador para dar clave a los registros que todavía no existen en
  // la base. Un registro nuevo no tiene id hasta que se guarda.
  let nuevos = 0;

  // Todos los registros de un documento. Sin ninguno guardado se pinta
  // uno vacío: si no, un documento nuevo no tendría dónde escribirse.
  function crearDocumentoConRegistros(doc) {
    const caja = document.createElement("div");
    caja.className = "documento-grupo";
    caja.dataset.documento = doc.id;

    const filas = filasDe(guardados, doc.id);
    const lista = document.createElement("div");

    if (filas.length) {
      filas.forEach((fila, indice) => {
        lista.appendChild(crearDocumento(doc, fila, alGuardar, indice, fila.id));
      });
    } else {
      lista.appendChild(crearDocumento(doc, null, alGuardar, 0, `nuevo-${nuevos++}`));
    }

    caja.appendChild(lista);

    // La SMA autoriza por establecimiento: una empresa con tres plantas
    // tiene tres registros, cada uno con sus materiales.
    if (admiteVarios(doc)) {
      const agregar = document.createElement("button");
      agregar.type = "button";
      agregar.className = "btn-secondary btn-agregar-registro";
      agregar.textContent = "+ Agregar otro registro";
      agregar.addEventListener("click", () => {
        const indice = lista.querySelectorAll(".documento").length;
        lista.appendChild(
          crearDocumento(doc, null, alGuardar, indice, `nuevo-${nuevos++}`),
        );
      });
      caja.appendChild(agregar);
    }

    return caja;
  }

  function repintar() {
    if (!contenedorBloques) return;
    contenedorBloques.textContent = "";

    nivelesDeRol(rol).forEach((nivel) => {
      const seccion = document.createElement("section");
      seccion.className = "nivel";

      const titulo = document.createElement("h2");
      titulo.className = "nivel-titulo";
      titulo.textContent = nivel.titulo;

      const descripcion = document.createElement("p");
      descripcion.className = "nivel-sub";
      descripcion.textContent = nivel.descripcion;

      seccion.append(titulo, descripcion);

      nivel.bloques.forEach((bloque) => {
        const caja = document.createElement("div");
        caja.className = "bloque";

        const nombre = document.createElement("h3");
        nombre.textContent = bloque.nombre;
        caja.appendChild(nombre);

        const sub = document.createElement("p");
        sub.className = "bloque-sub";
        sub.textContent = SUBTITULOS[bloque.nombre] ?? "";
        caja.appendChild(sub);

        bloque.documentos.forEach((doc) => {
          caja.appendChild(crearDocumentoConRegistros(doc));
        });

        seccion.appendChild(caja);
      });

      contenedorBloques.appendChild(seccion);
    });

    pintarFaltantes(rol, guardados);
    if (cajaEnvio) cajaEnvio.style.display = "block";
    if (botonEnviar) botonEnviar.disabled = !puedeEnviarse(rol, guardados);
  }

  async function alGuardar(doc, valores, archivo, filaId, clave) {
    const fila = await guardarDocumento(sesion.usuario.id, doc, valores, archivo, filaId);
    guardados = guardados.filter((g) => g.id !== fila.id).concat(fila);

    pintarFaltantes(rol, guardados);
    if (botonEnviar) botonEnviar.disabled = !puedeEnviarse(rol, guardados);

    // Se repinta SOLO este registro, no la página entera: así aparecen
    // al momento su etiqueta de estado y el enlace al archivo, sin
    // borrar lo que el usuario esté escribiendo en otro registro. Antes
    // había que recargar para verlo, y guardar parecía no hacer nada.
    const anterior = contenedorBloques?.querySelector(`[data-registro="${clave}"]`);
    if (!anterior) return;

    const indice = [...anterior.parentElement.children].indexOf(anterior);
    const nuevo = crearDocumento(doc, fila, alGuardar, indice, fila.id);
    const aviso = nuevo.querySelector(".documento-estado");
    if (aviso) {
      aviso.className = "documento-estado success";
      aviso.textContent = "Guardado.";
    }
    anterior.replaceWith(nuevo);
  }

  repintar();

  botonEnviar?.addEventListener("click", async () => {
    mostrarEstado(estadoEnvio, "Enviando...");
    botonEnviar.disabled = true;
    try {
      const estadoNuevo = await enviarARevision();
      // La sesión cachea el perfil, y el estado acaba de cambiar en la
      // base: sin invalidar, el resto del sitio seguiría viendo el viejo.
      invalidarSesion();
      pintarEstadoCuenta({ estado: estadoNuevo });
      mostrarEstado(
        estadoEnvio,
        estadoNuevo === "en_revision"
          ? "Expediente enviado. Te avisamos en 24 a 48 horas."
          : `Tu cuenta está en estado "${estadoNuevo}".`,
        "success",
      );
    } catch (err) {
      console.error("Error enviando a revisión:", err);
      mostrarEstado(estadoEnvio, "No se pudo enviar. Intenta de nuevo.", "error");
      botonEnviar.disabled = false;
    }
  });
}

iniciar();
