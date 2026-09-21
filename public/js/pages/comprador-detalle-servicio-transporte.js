// ==============================================================
// Página: comprador-detalle-servicio-transporte.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { obtenerServicio } from "../data/transporte.js";
import { existeInteres, guardarInteres, TIPO_TRANSPORTE } from "../data/intereses.js";
import {
  listarMensajesDePublicacion,
  enviarMensaje,
  marcarLeidos,
  nombresDeEmpresas,
} from "../data/mensajes.js";
import { crearGaleria, crearMeta, crearDescripcion, crearTitulo } from "../ui/detalle.js";
import { montarConversacion } from "../ui/conversacion.js";

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

function pintar(servicio, empresa) {
  principal.innerHTML = "";

  const galeria = crearGaleria(servicio.fotos_urls, "Foto del vehículo");
  if (galeria) principal.appendChild(galeria);

  principal.appendChild(crearTitulo(servicio.tipo_transporte || "Servicio de transporte"));

  principal.appendChild(
    crearMeta([
      ["Publica", empresa],
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

const parametros = new URLSearchParams(window.location.search);
const servicioId = parametros.get("id");

if (!servicioId) {
  mostrarEstado("No se encontró el servicio solicitado.", "error");
} else {
  mostrarEstado("Cargando detalles del servicio...");

  try {
    const servicio = await obtenerServicio(servicioId);

    if (!servicio) {
      mostrarEstado("No se encontró el servicio.", "error");
    } else {
      const empresas = await nombresDeEmpresas([servicio.user_id]).catch(() => ({}));
      const empresa = empresas[servicio.user_id];

      pintar(servicio, empresa);
      if (layout) layout.style.display = "grid";
      mostrarEstado("");

      // ---------- Conversación con el proveedor logístico ----------
      // Mismo modelo que en el detalle de residuo: el hilo vive dentro
      // de la app y ningún correo cruza entre empresas (§7.1).
      const panelMensajes = document.createElement("div");
      panelMensajes.id = "conversacion-servicio";
      principal.appendChild(panelMensajes);

      let conversacionAbierta = false;

      botonContactar?.addEventListener("click", async () => {
        if (conversacionAbierta) {
          panelMensajes.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const { usuario } = await obtenerSesion();
        if (!usuario) {
          mostrarMensaje("Debes iniciar sesión para contactar al proveedor.", "error");
          return;
        }
        if (usuario.id === servicio.user_id) {
          mostrarMensaje("Este servicio es tuyo: verás los mensajes en Mis servicios.");
          return;
        }

        conversacionAbierta = true;
        botonContactar.disabled = true;
        mostrarMensaje("");

        await montarConversacion(panelMensajes, {
          usuarioId: usuario.id,
          nombre: empresa,
          titulo: empresa
            ? `Conversación con ${empresa} · ${servicio.tipo_transporte || "servicio"}`
            : `Conversación sobre ${servicio.tipo_transporte || "este servicio"}`,
          cargar: async () => {
            const mensajes = await listarMensajesDePublicacion({ servicioId: servicio.id });
            const sinLeer = mensajes
              .filter((m) => m.destinatario_id === usuario.id && !m.leido_at)
              .map((m) => m.id);
            if (sinLeer.length) await marcarLeidos(sinLeer, usuario.id).catch(() => {});
            return mensajes;
          },
          enviar: (texto) =>
            enviarMensaje(usuario.id, {
              servicioId: servicio.id,
              destinatarioId: servicio.user_id,
              cuerpo: texto,
            }),
        });

        botonContactar.disabled = false;
        panelMensajes.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      // Quien llega desde "Contactar proveedor logístico" en la lista
      // ya decidió que quiere escribir: se le abre el hilo directamente.
      if (parametros.get("contactar") === "1") botonContactar?.click();

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
