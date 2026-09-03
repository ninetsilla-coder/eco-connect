// ==============================================================
// Página: comprador-detalle-residuo.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { obtenerResiduo } from "../data/residuos.js";
import { existeInteres, guardarInteres, TIPO_RESIDUO } from "../data/intereses.js";
import { crearGaleria, crearMeta, crearDescripcion, crearTitulo } from "../ui/detalle.js";

montarNavbar();

const estadoPagina = document.getElementById("status-detalle-residuo");
const layout = document.getElementById("detalle-layout");
const principal = document.getElementById("detalle-main");
const botonContactar = document.getElementById("btn-contactar");
const botonGuardar = document.getElementById("btn-guardar-interes");
const mensajeInteres = document.getElementById("mensaje-interes");

const CATEGORIAS = {
  sin_procesar: "Sin procesar",
  procesado: "Procesado y limpio",
};

function mostrarEstado(texto, clase = "") {
  if (!estadoPagina) return;
  estadoPagina.textContent = texto;
  estadoPagina.className = clase ? `form-status ${clase}` : "form-status";
}

function mostrarMensaje(texto, tipo = "") {
  if (!mensajeInteres) return;
  mensajeInteres.textContent = texto;
  mensajeInteres.className = tipo ? `form-status ${tipo}` : "form-status";
}

function pintar(residuo) {
  principal.innerHTML = "";

  const galeria = crearGaleria(residuo.fotos, "Foto del residuo");
  if (galeria) principal.appendChild(galeria);

  principal.appendChild(crearTitulo(residuo.tipo || "Residuo sin nombre"));

  principal.appendChild(
    crearMeta([
      ["Categoría", CATEGORIAS[residuo.categoria] ?? residuo.categoria],
      ["Cantidad", residuo.cantidad],
      ["Ubicación", residuo.ubicacion],
      ["Frecuencia", residuo.frecuencia],
      ["Estado del residuo", residuo.estado_residuo],
      ["Estado de publicación", residuo.estado],
    ])
  );

  const descripcion = crearDescripcion(residuo.descripcion);
  if (descripcion) principal.appendChild(descripcion);
}

// ==============================================================
// Arranque
// ==============================================================

const residuoId = new URLSearchParams(window.location.search).get("id");

if (!residuoId) {
  mostrarEstado("No se encontró el residuo solicitado.", "error");
} else {
  mostrarEstado("Cargando detalles del residuo...");

  try {
    const residuo = await obtenerResiduo(residuoId);

    if (!residuo) {
      mostrarEstado("No se encontró el residuo.", "error");
    } else {
      pintar(residuo);
      if (layout) layout.style.display = "grid";
      mostrarEstado("");

      botonContactar?.addEventListener("click", () => {
        mostrarMensaje("Aquí irá la acción para contactar al proveedor (versión futura).");
      });

      botonGuardar?.addEventListener("click", async () => {
        const textoPrevio = botonGuardar.textContent;
        botonGuardar.disabled = true;
        botonGuardar.textContent = "Guardando...";
        mostrarMensaje("");

        try {
          const { usuario } = await obtenerSesion();
          if (!usuario) {
            mostrarMensaje(
              "Debes iniciar sesión como comprador para guardar intereses.",
              "error"
            );
            return;
          }

          if (await existeInteres(usuario.id, TIPO_RESIDUO, residuo.id)) {
            mostrarMensaje("Este residuo ya está en tus intereses.", "success");
            return;
          }

          await guardarInteres(usuario.id, TIPO_RESIDUO, residuo.id);
          mostrarMensaje("Residuo guardado en tus intereses.", "success");
        } catch (err) {
          console.error("Error guardando interés:", err);
          mostrarMensaje("No se pudo guardar en tus intereses. Intenta de nuevo.", "error");
        } finally {
          botonGuardar.disabled = false;
          botonGuardar.textContent = textoPrevio;
        }
      });
    }
  } catch (err) {
    console.error("Error cargando residuo:", err);
    mostrarEstado("Ocurrió un error al cargar el residuo.", "error");
  }
}
