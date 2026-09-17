// ==============================================================
// Página: mis-servicios-transporte.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import {
  listarMisServicios,
  cambiarEstadoServicio,
  eliminarServicio,
  ESTADO_ACTIVO,
  ESTADO_INACTIVO,
} from "../data/transporte.js";
import { listarCumplimientoDeUsuario } from "../data/cumplimiento.js";

montarNavbar();

const contenedor = document.getElementById("servicios-transporte-list");
const estadoLista = document.getElementById("status-mis-servicios");

function mostrarEstado(texto, clase = "") {
  if (!estadoLista) return;
  estadoLista.textContent = texto;
  estadoLista.className = clase ? `form-status ${clase}` : "form-status";
}

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1) : "";
}

function dato(etiqueta, valor) {
  const p = document.createElement("p");
  const fuerte = document.createElement("strong");
  fuerte.textContent = `${etiqueta}: `;
  p.append(fuerte, document.createTextNode(valor ?? "—"));
  return p;
}

// Se construye con nodos en vez de innerHTML: los valores vienen de la
// base y no deben interpretarse como HTML.
function crearTarjeta(servicio, tieneDocumentos) {
  const tarjeta = document.createElement("div");
  tarjeta.className = "waste-card";

  if (servicio.fotos_urls?.length) {
    const img = document.createElement("img");
    img.src = servicio.fotos_urls[0];
    img.alt = "Foto del vehículo";
    img.className = "servicio-foto";
    tarjeta.appendChild(img);
  }

  const cabecera = document.createElement("div");
  cabecera.className = "service-card-header";

  const titulo = document.createElement("h3");
  titulo.className = "waste-type";
  titulo.textContent = servicio.tipo_transporte ?? "Servicio sin nombre";

  const insignia = document.createElement("span");
  insignia.className = `badge ${tieneDocumentos ? "badge-success" : "badge-warning"}`;
  insignia.textContent = tieneDocumentos ? "Docs OK" : "Sin docs";

  cabecera.append(titulo, insignia);
  tarjeta.appendChild(cabecera);

  tarjeta.append(
    dato("Capacidad", servicio.capacidad_carga),
    dato("Zona de cobertura", servicio.zona_cobertura),
    dato("Residuos", servicio.tipos_residuos),
    dato("Disponibilidad", servicio.disponibilidad)
  );

  if (servicio.descripcion) {
    const descripcion = document.createElement("p");
    descripcion.textContent = servicio.descripcion;
    tarjeta.appendChild(descripcion);
  }

  const lineaEstado = document.createElement("p");
  const etiquetaEstado = document.createElement("strong");
  etiquetaEstado.textContent = "Estado: ";
  const valorEstado = document.createElement("span");
  valorEstado.className = "estado-text";
  valorEstado.dataset.estado = servicio.estado;
  valorEstado.textContent = capitalizar(servicio.estado);
  lineaEstado.append(etiquetaEstado, valorEstado);
  tarjeta.appendChild(lineaEstado);

  const acciones = document.createElement("div");
  acciones.className = "card-actions";

  [
    { clase: "btn-editar", texto: "Editar" },
    { clase: "btn-estado", texto: "Cambiar estado" },
    { clase: "btn-eliminar", texto: "Eliminar", extra: "btn-danger" },
  ].forEach(({ clase, texto, extra }) => {
    const boton = document.createElement("button");
    boton.className = `btn ${extra ?? "btn-outline"} btn-sm ${clase}`;
    boton.dataset.id = servicio.id;
    boton.textContent = texto;
    acciones.appendChild(boton);
  });

  tarjeta.appendChild(acciones);
  return tarjeta;
}

// ==============================================================
// Arranque
// ==============================================================

if (contenedor) {
  mostrarEstado("Cargando tus servicios...");

  const { usuario } = await obtenerSesion();

  if (!usuario) {
    mostrarEstado("Debes iniciar sesión para ver tus servicios.", "error");
  } else {
    try {
      const servicios = await listarMisServicios(usuario.id);
      servicios.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      if (!servicios.length) {
        contenedor.innerHTML = "";
        const vacio = document.createElement("p");
        vacio.textContent = "No has publicado servicios de transporte todavía.";
        contenedor.appendChild(vacio);
        mostrarEstado("");
      } else {
        let conDocumentos = new Set();
        try {
          const cumplimientos = await listarCumplimientoDeUsuario(usuario.id);
          conDocumentos = new Set(cumplimientos.map((c) => c.servicio_id));
        } catch (err) {
          console.error("Error obteniendo cumplimientos:", err);
        }

        contenedor.innerHTML = "";
        servicios.forEach((servicio) => {
          contenedor.appendChild(crearTarjeta(servicio, conDocumentos.has(servicio.id)));
        });
        mostrarEstado("");
      }

      // ---------- Acciones ----------
      contenedor.addEventListener("click", async (evento) => {
        const boton = evento.target;
        const id = boton.dataset?.id;
        if (!id) return;

        if (boton.classList.contains("btn-eliminar")) {
          if (!confirm("¿Eliminar este servicio?")) return;

          try {
            await eliminarServicio(id, usuario.id);
            boton.closest(".waste-card")?.remove();
          } catch (err) {
            console.error("Error eliminando servicio:", err);
            alert("No se pudo eliminar el servicio.");
          }
          return;
        }

        if (boton.classList.contains("btn-estado")) {
          const tarjeta = boton.closest(".waste-card");
          const span = tarjeta?.querySelector(".estado-text");
          if (!span) return;

          const actual = span.dataset.estado || ESTADO_INACTIVO;
          const nuevo = actual === ESTADO_ACTIVO ? ESTADO_INACTIVO : ESTADO_ACTIVO;

          try {
            const actualizado = await cambiarEstadoServicio(id, usuario.id, nuevo);
            if (!actualizado) throw new Error("La actualización no afectó ninguna fila");

            span.dataset.estado = actualizado.estado;
            span.textContent = capitalizar(actualizado.estado);
          } catch (err) {
            console.error("Error actualizando el estado:", err);
            alert("No se pudo actualizar el estado.");
          }
        }
      });
    } catch (err) {
      console.error("Error obteniendo servicios de transporte:", err);
      mostrarEstado("Ocurrió un error al cargar tus servicios.", "error");
    }
  }
}
