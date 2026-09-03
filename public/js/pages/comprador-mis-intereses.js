// ==============================================================
// Página: comprador-mis-intereses.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import {
  listarMisIntereses,
  eliminarInteres,
  TIPO_RESIDUO,
  TIPO_TRANSPORTE,
} from "../data/intereses.js";

montarNavbar();

const lista = document.getElementById("intereses-list");
const estadoLista = document.getElementById("intereses-status");
const vacio = document.getElementById("intereses-empty");

function mostrarEstado(texto, clase = "") {
  if (!estadoLista) return;
  estadoLista.textContent = texto;
  estadoLista.className = clase ? `form-status ${clase}` : "form-status";
}

// Cada tipo de interés se describe igual salvo por sus campos.
const PRESENTACION = {
  [TIPO_RESIDUO]: {
    insignia: "Residuo",
    boton: "Ver residuo",
    destino: "comprador-detalle-residuo.html",
    titulo: (r) => r.tipo || "Residuo sin nombre",
    fotos: (r) => r.fotos,
    textoFoto: "Foto del residuo",
    campos: (r) => [
      ["Cantidad", r.cantidad],
      ["Ubicación", r.ubicacion],
      ["Frecuencia", r.frecuencia],
      ["Estado", r.estado_residuo],
      ["Estado publicación", r.estado],
    ],
  },
  [TIPO_TRANSPORTE]: {
    insignia: "Transporte",
    boton: "Ver servicio",
    destino: "comprador-detalle-servicio-transporte.html",
    titulo: (s) => s.tipo_transporte || "Servicio de transporte",
    fotos: (s) => s.fotos_urls,
    textoFoto: "Foto del vehículo",
    campos: (s) => [
      ["Capacidad", s.capacidad_carga],
      ["Zona", s.zona_cobertura],
      ["Residuos", s.tipos_residuos],
      ["Disponibilidad", s.disponibilidad],
      ["Estado", s.estado],
    ],
  },
};

function actualizarConteo() {
  const restantes = lista?.querySelectorAll(".interes-item").length ?? 0;

  if (!restantes) {
    if (vacio) vacio.style.display = "block";
    mostrarEstado("");
  } else {
    mostrarEstado(`Mostrando ${restantes} elemento(s) en tus intereses.`);
  }
}

// Con nodos, no con innerHTML: son publicaciones de otras empresas.
function crearTarjeta(item, usuarioId) {
  const presentacion = PRESENTACION[item.tipo];
  const registro = item.tipo === TIPO_RESIDUO ? item.residuo : item.servicio;

  // El registro asociado pudo borrarse; ese interés se omite.
  if (!presentacion || !registro) return null;

  const tarjeta = document.createElement("article");
  tarjeta.className = "interes-item";
  tarjeta.dataset.interesId = item.id;

  const cabecera = document.createElement("div");
  cabecera.className = "interes-header";

  const titulo = document.createElement("div");
  titulo.className = "interes-title";
  titulo.textContent = presentacion.titulo(registro);

  const insignia = document.createElement("span");
  insignia.className = "interes-badge";
  insignia.textContent = presentacion.insignia;

  cabecera.append(titulo, insignia);

  const meta = document.createElement("div");
  meta.className = "interes-meta";
  presentacion.campos(registro).forEach(([etiqueta, valor]) => {
    if (!valor) return;
    const span = document.createElement("span");
    span.textContent = `${etiqueta}: ${valor}`;
    meta.appendChild(span);
  });

  const descripcion = document.createElement("p");
  descripcion.className = "interes-descripcion";
  descripcion.textContent = registro.descripcion || "Sin descripción adicional.";

  tarjeta.append(cabecera, meta, descripcion);

  const urlsFotos = presentacion.fotos(registro);
  if (Array.isArray(urlsFotos) && urlsFotos.length) {
    const fotos = document.createElement("div");
    fotos.className = "interes-fotos";
    urlsFotos.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = presentacion.textoFoto;
      fotos.appendChild(img);
    });
    tarjeta.appendChild(fotos);
  }

  const acciones = document.createElement("div");
  acciones.className = "interes-actions";

  const botonVer = document.createElement("button");
  botonVer.className = "btn-secondary";
  botonVer.textContent = presentacion.boton;
  botonVer.addEventListener("click", () => {
    window.location.href = `${presentacion.destino}?id=${registro.id}`;
  });

  const botonEliminar = document.createElement("button");
  botonEliminar.className = "btn-danger";
  botonEliminar.textContent = "Eliminar de mis intereses";
  botonEliminar.addEventListener("click", async () => {
    botonEliminar.disabled = true;

    try {
      await eliminarInteres(item.id, usuarioId);
      tarjeta.remove();
      actualizarConteo();
    } catch (err) {
      console.error("Error eliminando interés:", err);
      botonEliminar.disabled = false;
      alert("No se pudo eliminar de tus intereses. Intenta de nuevo.");
    }
  });

  acciones.append(botonVer, botonEliminar);
  tarjeta.appendChild(acciones);

  return tarjeta;
}

// ==============================================================
// Arranque
// ==============================================================

mostrarEstado("Cargando tus intereses...");

const { usuario } = await obtenerSesion();

if (!usuario) {
  mostrarEstado("Debes iniciar sesión como comprador para ver tus intereses.", "error");
} else {
  try {
    const intereses = await listarMisIntereses(usuario.id);

    if (!intereses.length) {
      if (lista) lista.innerHTML = "";
      if (vacio) vacio.style.display = "block";
      mostrarEstado("");
    } else {
      if (lista) {
        lista.innerHTML = "";
        intereses.forEach((item) => {
          const tarjeta = crearTarjeta(item, usuario.id);
          if (tarjeta) lista.appendChild(tarjeta);
        });
      }
      actualizarConteo();
    }
  } catch (err) {
    console.error("Error cargando intereses:", err);
    mostrarEstado("Ocurrió un error al cargar tus intereses.", "error");
  }
}
