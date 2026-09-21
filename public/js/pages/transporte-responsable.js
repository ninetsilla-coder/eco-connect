// ==============================================================
// Página: transporte-responsable.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { listarMisServiciosResumidos } from "../data/transporte.js";
import {
  registrarCumplimiento,
  subirGrupoTransporte,
  listarCumplimientoDeServicio,
  documentosDeCumplimiento,
} from "../data/cumplimiento.js";
import { crearBloqueDocumentos } from "../ui/documentos.js";

montarNavbar();

const formulario = document.getElementById("form-transporte-responsable");
const estadoFormulario = document.getElementById("status-transporte-responsable");
const selectorServicio = document.getElementById("servicio-transporte-select");

const entradaPermisos = document.getElementById("docs-permisos");
const entradaCertificaciones = document.getElementById("docs-certificaciones");
const entradaSeguros = document.getElementById("docs-seguros");

const textoManejo = document.getElementById("practicas-manejo");
const textoRegulaciones = document.getElementById("practicas-regulaciones");
const textoProcedimientos = document.getElementById("practicas-procedimientos");

function mostrarEstado(texto, clase = "") {
  if (!estadoFormulario) return;
  estadoFormulario.textContent = texto;
  estadoFormulario.className = clase ? `form-status ${clase}` : "form-status";
}

// ==============================================================
// Lo ya registrado para el servicio elegido
// ==============================================================
// Antes esta pantalla solo recibía archivos: se subían permisos,
// licencias y seguros y no había forma de comprobar qué había quedado
// guardado, ni de detectar que faltaba uno. Ahora el formulario enseña
// el último registro del servicio seleccionado.
//
// Los enlaces van firmados y caducan: docs-transporte es privado.

const yaRegistrado = document.createElement("div");
yaRegistrado.id = "cumplimiento-actual";
yaRegistrado.style.margin = "12px 0";
yaRegistrado.style.fontSize = "0.85rem";
formulario?.prepend(yaRegistrado);

// Mismo guardia que en gestión ambiental: firmar es una ida a la red y
// el usuario puede cambiar de servicio mientras tanto. Sin esto, una
// respuesta vieja pintaría los documentos de otro servicio.
let turno = 0;

async function mostrarCumplimientoActual() {
  const mio = ++turno;
  yaRegistrado.innerHTML = "";

  const servicioId = selectorServicio?.value;
  if (!usuario || !servicioId) return;

  try {
    const registros = await listarCumplimientoDeServicio(usuario.id, servicioId);
    if (mio !== turno) return;

    if (!registros.length) {
      const vacio = document.createElement("em");
      vacio.textContent = "Todavía no has registrado documentación para este servicio.";
      yaRegistrado.appendChild(vacio);
      return;
    }

    const ultimo = registros[0];
    const grupos = await documentosDeCumplimiento(ultimo);
    if (mio !== turno) return;

    const titulo = document.createElement("strong");
    const fecha = ultimo.created_at
      ? new Date(ultimo.created_at).toLocaleDateString("es-MX")
      : null;
    titulo.textContent = fecha
      ? `Último registro (${fecha}) · ${registros.length} en total:`
      : `Último registro · ${registros.length} en total:`;

    yaRegistrado.append(titulo, crearBloqueDocumentos(grupos));
  } catch (err) {
    if (mio !== turno) return;
    console.error("Error cargando el cumplimiento del servicio:", err);

    const aviso = document.createElement("em");
    aviso.textContent = "No se pudo consultar la documentación ya registrada.";
    yaRegistrado.appendChild(aviso);
  }
}

// ==============================================================
// Arranque
// ==============================================================

const { usuario } = await obtenerSesion();

if (!usuario) {
  mostrarEstado("Debes iniciar sesión para usar esta sección.", "error");
} else if (selectorServicio) {
  try {
    const servicios = await listarMisServiciosResumidos(usuario.id);

    if (servicios.length) {
      servicios.forEach((servicio) => {
        const opcion = document.createElement("option");
        opcion.value = servicio.id;
        opcion.textContent = `${servicio.tipo_transporte} – ${servicio.zona_cobertura}`;
        selectorServicio.appendChild(opcion);
      });
      selectorServicio.addEventListener("change", mostrarCumplimientoActual);
      await mostrarCumplimientoActual();
    } else {
      const opcion = document.createElement("option");
      opcion.value = "";
      opcion.textContent = "No tienes servicios publicados aún.";
      selectorServicio.appendChild(opcion);
      selectorServicio.disabled = true;
    }
  } catch (err) {
    console.error("Error obteniendo servicios para el selector:", err);
    mostrarEstado("No se pudieron cargar tus servicios.", "error");
  }
}

// ==============================================================
// Envío
// ==============================================================

formulario?.addEventListener("submit", async (evento) => {
  evento.preventDefault();

  if (!usuario) {
    mostrarEstado("Debes iniciar sesión para usar esta sección.", "error");
    return;
  }

  const servicioId = selectorServicio?.value;
  if (!servicioId) {
    mostrarEstado("Selecciona primero un servicio de transporte.", "error");
    return;
  }

  mostrarEstado("Guardando documentación...");

  try {
    const [permisos, certificaciones, seguros] = await Promise.all([
      subirGrupoTransporte(usuario.id, servicioId, "permisos", entradaPermisos),
      subirGrupoTransporte(usuario.id, servicioId, "certificaciones", entradaCertificaciones),
      subirGrupoTransporte(usuario.id, servicioId, "seguros", entradaSeguros),
    ]);

    await registrarCumplimiento(usuario.id, {
      servicioId,
      permisos,
      certificaciones,
      seguros,
      manejo: textoManejo?.value.trim(),
      regulaciones: textoRegulaciones?.value.trim(),
      procedimientos: textoProcedimientos?.value.trim(),
    });

    formulario.reset();

    // El reset vacía también el selector. Antes se dejaba así, y el
    // usuario acababa de subir documentos sin ver ninguna confirmación
    // de qué había quedado guardado. Se recupera el servicio y se
    // repinta el panel: ahí está la prueba de que llegó.
    if (selectorServicio) selectorServicio.value = servicioId;
    mostrarEstado("Documentación guardada correctamente para ese servicio.", "success");
    await mostrarCumplimientoActual();
  } catch (err) {
    console.error("Error guardando cumplimiento de transporte:", err);
    mostrarEstado(
      "Ocurrió un error al guardar la información. Intenta de nuevo.",
      "error"
    );
  }
});
