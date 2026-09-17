// ==============================================================
// Página: comprador-detalle-servicio-transporte.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { obtenerServicio } from "../data/transporte.js";
import { existeInteres, guardarInteres, TIPO_TRANSPORTE } from "../data/intereses.js";
import { crearGaleria, crearMeta, crearDescripcion, crearTitulo } from "../ui/detalle.js";

montarNavbar();

const estadoPagina = document.getElementById("status-detalle-servicio");
const layout = document.getElementById("detalle-layout");
const principal = document.getElementById("detalle-main");
const botonContactar = document.getElementById("btn-contactar");
const botonGuardar = document.getElementById("btn-guardar-interes");
const mensajeInteres = document.getElementById("mensaje-interes-servicio");

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

function pintar(servicio) {
  principal.innerHTML = "";

  const galeria = crearGaleria(servicio.fotos_urls, "Foto del vehículo");
  if (galeria) principal.appendChild(galeria);

  principal.appendChild(crearTitulo(servicio.tipo_transporte || "Servicio de transporte"));

  principal.appendChild(
    crearMeta([
      ["Capacidad", servicio.capacidad_carga],
      ["Zona de cobertura", servicio.zona_cobertura],
      ["Residuos que transporta", servicio.tipos_residuos],
      ["Disponibilidad", servicio.disponibilidad],
      ["Estado", servicio.estado],
    ])
  );

  const descripcion = crearDescripcion(servicio.descripcion);
  if (descripcion) principal.appendChild(descripcion);
}

// ==============================================================
// Arranque
// ==============================================================

const servicioId = new URLSearchParams(window.location.search).get("id");

if (!servicioId) {
  mostrarEstado("No se encontró el servicio solicitado.", "error");
} else {
  mostrarEstado("Cargando detalles del servicio...");

  try {
    const servicio = await obtenerServicio(servicioId);

    if (!servicio) {
      mostrarEstado("No se encontró el servicio.", "error");
    } else {
      pintar(servicio);
      if (layout) layout.style.display = "grid";
      mostrarEstado("");

      botonContactar?.addEventListener("click", () => {
        mostrarMensaje(
          "Aquí irá la acción para contactar al proveedor logístico (versión futura)."
        );
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

          if (await existeInteres(usuario.id, TIPO_TRANSPORTE, servicio.id)) {
            mostrarMensaje("Este servicio ya está en tus intereses.", "success");
            return;
          }

          await guardarInteres(usuario.id, TIPO_TRANSPORTE, servicio.id);
          mostrarMensaje("Servicio guardado en tus intereses.", "success");
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
    console.error("Error cargando servicio de transporte:", err);
    mostrarEstado("Ocurrió un error al cargar el servicio.", "error");
  }
}
