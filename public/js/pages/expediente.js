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
  bloquesDeRol, listarMiExpediente, guardarDocumento, urlDeDocumento,
  enviarARevision, faltantes, puedeEnviarse, documentosDeRol, CAMPOS,
} from "../data/expediente.js";
import { etiquetaRol } from "../data/perfiles.js";
import { infoEstado } from "../ui/estado-cuenta.js";

montarNavbar();

const contenedorBloques = document.getElementById("bloques");
const estadoPagina = document.getElementById("status-expediente");
const cajaEnvio = document.getElementById("envio");
const listaFaltantes = document.getElementById("envio-faltantes");
const botonEnviar = document.getElementById("btn-enviar");
const estadoEnvio = document.getElementById("status-envio");

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

function crearCampo(doc, clave, guardado) {
  const envoltorio = document.createElement("div");
  const etiqueta = document.createElement("label");
  const id = `${doc.id}-${clave}`;
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

function crearDocumento(doc, guardado, alGuardar) {
  const caja = document.createElement("div");
  caja.className = "documento";
  // Marca para poder repintar SOLO este documento al guardarlo, sin
  // tocar lo que el usuario esté escribiendo en los demás.
  caja.dataset.tipo = doc.id;

  // ---------- Cabecera: nombre, si es obligatorio y su veredicto ----------
  const cabecera = document.createElement("div");
  cabecera.className = "documento-cabecera";

  const titulo = document.createElement("h3");
  titulo.textContent = doc.nombre;
  cabecera.appendChild(titulo);

  cabecera.appendChild(doc.obligatorio
    ? crearEtiqueta("Obligatorio", "etiqueta-obligatorio")
    : crearEtiqueta("Recomendado", "etiqueta-opcional"));

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
  const campos = document.createElement("div");
  campos.className = "documento-campos";
  doc.campos.forEach((clave) => campos.appendChild(crearCampo(doc, clave, guardado)));

  let entradaArchivo = null;
  if (!doc.sinArchivo) {
    const envoltorio = document.createElement("div");
    const etiqueta = document.createElement("label");
    etiqueta.setAttribute("for", `${doc.id}-archivo`);
    etiqueta.textContent = guardado?.archivo_ruta ? "Reemplazar PDF" : "Archivo PDF";
    entradaArchivo = document.createElement("input");
    entradaArchivo.type = "file";
    entradaArchivo.id = `${doc.id}-archivo`;
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

    try {
      // El mensaje de éxito lo pone alGuardar sobre el documento ya
      // repintado: este nodo deja de estar en la página.
      await alGuardar(doc, valores, archivo);
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

  function repintar() {
    if (!contenedorBloques) return;
    contenedorBloques.textContent = "";
    const porTipo = new Map(guardados.map((g) => [g.tipo_documento, g]));

    bloquesDeRol(rol).forEach((bloque) => {
      const caja = document.createElement("section");
      caja.className = "bloque";

      const titulo = document.createElement("h2");
      titulo.textContent = bloque.nombre;
      caja.appendChild(titulo);

      const sub = document.createElement("p");
      sub.className = "bloque-sub";
      sub.textContent = bloque.nombre === "Recomendados"
        ? `No son obligatorios. Completarlos te da la insignia de expediente completo.`
        : `Documentos que EcoConnect pide a ${etiquetaRol(rol)}.`;
      caja.appendChild(sub);

      bloque.documentos.forEach((doc) => {
        caja.appendChild(crearDocumento(doc, porTipo.get(doc.id), alGuardar));
      });

      contenedorBloques.appendChild(caja);
    });

    pintarFaltantes(rol, guardados);
    if (cajaEnvio) cajaEnvio.style.display = "block";
    if (botonEnviar) botonEnviar.disabled = !puedeEnviarse(rol, guardados);
  }

  async function alGuardar(doc, valores, archivo) {
    const fila = await guardarDocumento(sesion.usuario.id, doc, valores, archivo);
    guardados = guardados.filter((g) => g.tipo_documento !== doc.id).concat(fila);

    pintarFaltantes(rol, guardados);
    if (botonEnviar) botonEnviar.disabled = !puedeEnviarse(rol, guardados);

    // Se repinta SOLO este documento, no la página entera: así aparecen
    // al momento su etiqueta de estado y el enlace al archivo, sin
    // borrar lo que el usuario esté escribiendo en otro bloque. Antes
    // había que recargar para verlo, y guardar parecía no hacer nada.
    const anterior = contenedorBloques?.querySelector(`[data-tipo="${doc.id}"]`);
    if (!anterior) return;

    const nuevo = crearDocumento(doc, fila, alGuardar);
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
