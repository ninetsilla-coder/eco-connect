// ==============================================================
// Página: transporte-responsable.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { listarMisServiciosResumidos } from "../data/transporte.js";
import { registrarCumplimiento, subirGrupoTransporte } from "../data/cumplimiento.js";

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
    if (selectorServicio) selectorServicio.value = "";
    mostrarEstado("Documentación guardada correctamente para ese servicio.", "success");
  } catch (err) {
    console.error("Error guardando cumplimiento de transporte:", err);
    mostrarEstado(
      "Ocurrió un error al guardar la información. Intenta de nuevo.",
      "error"
    );
  }
});
