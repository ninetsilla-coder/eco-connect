// ==============================================================
// Página: gestion-ambiental.html
// ==============================================================
// Guarda historial: cada envío añade un registro nuevo, no actualiza
// el anterior.
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { listarMiosResumidos } from "../data/residuos.js";
import { listarGestionDeUsuario, registrarGestion, TIPOS_GESTION } from "../data/cumplimiento.js";

montarNavbar();

const tarjetas = document.querySelectorAll(".gestion-card");
const titulo = document.getElementById("form-title");
const subtitulo = document.getElementById("form-subtitle");
const formulario = document.getElementById("form-gestion");
const selectorResiduo = document.getElementById("residuo-id");
const campoDescripcion = document.getElementById("descripcion-gestion");
const campoArchivos = document.getElementById("fotos-gestion");
const estadoFormulario = document.getElementById("form-status");

const TEXTOS = {
  documentacion: {
    titulo: "Documentación ambiental",
    subtitulo:
      "Adjunta permisos, licencias o certificaciones que demuestren que tu gestión del residuo cumple con normativas ambientales.",
  },
  condiciones: {
    titulo: "Condiciones del residuo",
    subtitulo:
      "Describe el estado físico del material (limpio, mezclado, compactado), si requiere temperatura controlada o condiciones especiales de transporte.",
  },
  practicas: {
    titulo: "Prácticas de manejo",
    subtitulo:
      "Explica cómo separas, almacenas y preparas el residuo dentro de tu planta para asegurar un manejo responsable.",
  },
};

const CATEGORIAS = { sin_procesar: "Sin procesar", procesado: "Procesado" };

let tipoSeleccionado = "documentacion";
let historial = {}; // { residuoId: { documentacion: [], condiciones: [], practicas: [] } }

function mostrarEstado(texto, clase = "") {
  if (!estadoFormulario) return;
  estadoFormulario.textContent = texto;
  estadoFormulario.className = clase ? `form-status ${clase}` : "form-status";
}

function ocultarFormulario() {
  if (formulario) formulario.style.display = "none";
}

// ==============================================================
// Resumen de lo último registrado
// ==============================================================

const resumen = document.createElement("div");
resumen.id = "resumen-previo";
resumen.style.marginBottom = "12px";
resumen.style.fontSize = "0.85rem";
resumen.style.color = "#4b5563";
formulario?.insertBefore(resumen, formulario.querySelector(".form-row"));

function cajaVacia(residuoId) {
  historial[residuoId] ??= Object.fromEntries(TIPOS_GESTION.map((t) => [t, []]));
  return historial[residuoId];
}

// Se construye con nodos, no con innerHTML: la descripción viene de la
// base y no debe interpretarse como HTML.
function mostrarResumen() {
  resumen.innerHTML = "";

  const registros = historial[selectorResiduo?.value]?.[tipoSeleccionado];
  if (!registros?.length) return;

  const ultimo = registros[registros.length - 1];

  const encabezado = document.createElement("strong");
  encabezado.textContent = `Último registro para ${TEXTOS[tipoSeleccionado].titulo}:`;
  resumen.append(encabezado, document.createElement("br"));

  if (ultimo.descripcion) {
    const em = document.createElement("em");
    em.textContent = ultimo.descripcion;
    resumen.append(em, document.createElement("br"));
  }

  if (Array.isArray(ultimo.fotos) && ultimo.fotos.length) {
    const conteo = document.createElement("span");
    conteo.textContent = `Fotos cargadas: ${ultimo.fotos.length}`;
    resumen.append(conteo, document.createElement("br"));
  }

  const nota = document.createElement("span");
  nota.style.color = "#9ca3af";
  nota.textContent =
    "(Al guardar, se agregará un nuevo registro a tu historial de gestión ambiental.)";
  resumen.appendChild(nota);
}

// ==============================================================
// Arranque
// ==============================================================

const { usuario } = await obtenerSesion();

if (!usuario) {
  mostrarEstado("Debes iniciar sesión para registrar tu gestión ambiental.", "error");
  ocultarFormulario();
} else {
  try {
    const residuos = await listarMiosResumidos(usuario.id);

    if (!residuos.length) {
      mostrarEstado(
        "Primero necesitas publicar algún residuo para poder registrar gestión ambiental.",
        "error"
      );
      ocultarFormulario();
    } else {
      residuos.forEach((r) => {
        const opcion = document.createElement("option");
        opcion.value = r.id;
        const categoria = CATEGORIAS[r.categoria] ?? "Sin categoría";
        const ubicacion = r.ubicacion ? ` · ${r.ubicacion}` : "";
        opcion.textContent = `${r.tipo || "Residuo sin nombre"} · ${categoria}${ubicacion}`;
        selectorResiduo?.appendChild(opcion);
      });

      const previos = await listarGestionDeUsuario(usuario.id);
      previos
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
        .forEach((g) => {
          const caja = cajaVacia(g.residuo_id);
          caja[g.tipo]?.push(g);
        });

      mostrarResumen();
    }
  } catch (err) {
    console.error("Error cargando la página de gestión ambiental:", err);
    mostrarEstado("No se pudieron cargar tus residuos. Intenta más tarde.", "error");
  }
}

// ==============================================================
// Interacción
// ==============================================================

tarjetas.forEach((tarjeta) => {
  tarjeta.addEventListener("click", () => {
    tarjetas.forEach((t) => t.classList.remove("active"));
    tarjeta.classList.add("active");

    tipoSeleccionado = tarjeta.getAttribute("data-tipo");
    if (titulo) titulo.textContent = TEXTOS[tipoSeleccionado].titulo;
    if (subtitulo) subtitulo.textContent = TEXTOS[tipoSeleccionado].subtitulo;

    mostrarEstado("");
    mostrarResumen();
  });
});

selectorResiduo?.addEventListener("change", mostrarResumen);

formulario?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarEstado("");

  if (!usuario) return;

  const residuoId = selectorResiduo?.value;
  if (!residuoId) {
    mostrarEstado("Selecciona el residuo al que aplica esta gestión.", "error");
    return;
  }

  const boton = formulario.querySelector("button[type='submit']");
  if (boton) boton.disabled = true;
  mostrarEstado("Guardando gestión ambiental...");

  try {
    const registro = await registrarGestion(
      usuario.id,
      {
        residuoId,
        tipo: tipoSeleccionado,
        descripcion: campoDescripcion?.value.trim(),
      },
      campoArchivos?.files
    );

    cajaVacia(residuoId)[tipoSeleccionado].push(registro);

    mostrarEstado("Gestión ambiental guardada correctamente.", "success");
    if (campoDescripcion) campoDescripcion.value = "";
    if (campoArchivos) campoArchivos.value = "";
    mostrarResumen();
  } catch (err) {
    console.error("Error guardando gestión ambiental:", err);
    mostrarEstado("No se pudo guardar la gestión ambiental. Intenta otra vez.", "error");
  } finally {
    if (boton) boton.disabled = false;
  }
});
