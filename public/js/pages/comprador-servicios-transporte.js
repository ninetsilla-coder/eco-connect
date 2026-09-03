// ==============================================================
// Página: comprador-servicios-transporte.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import {
  buscarActivos,
  listarDocumentacion,
  agruparDocumentacion,
} from "../data/transporte.js";

montarNavbar();

const lista = document.getElementById("servicios-list");
const estadoLista = document.getElementById("servicios-status");
const vacio = document.getElementById("servicios-empty");
const filtroTipo = document.getElementById("filtro-tipo-transporte");
const filtroZona = document.getElementById("filtro-zona");
const botonFiltros = document.getElementById("btn-aplicar-filtros");

const DOCUMENTOS = [
  ["Permiso", "permiso"],
  ["Licencia", "licencia"],
  ["Bitácora", "bitacora"],
];

function mostrarEstado(texto) {
  if (estadoLista) estadoLista.textContent = texto;
}

// Con nodos, no con innerHTML: estos servicios los publican otras
// empresas y sus campos no deben interpretarse como HTML.
function crearMeta(servicio) {
  const meta = document.createElement("div");
  meta.className = "servicio-meta";

  [
    ["Capacidad", servicio.capacidad_carga],
    ["Zona", servicio.zona_cobertura],
    ["Residuos", servicio.tipos_residuos],
    ["Disponibilidad", servicio.disponibilidad],
  ].forEach(([etiqueta, valor]) => {
    if (!valor) return;
    const span = document.createElement("span");
    span.textContent = `${etiqueta}: ${valor}`;
    meta.appendChild(span);
  });

  return meta;
}

function crearTarjeta(servicio) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "servicio-item";

  const cabecera = document.createElement("div");
  cabecera.className = "servicio-header";

  const titulo = document.createElement("div");
  titulo.className = "servicio-title";
  titulo.textContent = servicio.tipo_transporte || "Servicio de transporte";

  const insignia = document.createElement("span");
  insignia.className = "servicio-badge";
  insignia.textContent = "Logística";

  cabecera.append(titulo, insignia);

  const descripcion = document.createElement("p");
  descripcion.className = "servicio-descripcion";
  descripcion.textContent = servicio.descripcion || "Sin descripción adicional.";

  tarjeta.append(cabecera, crearMeta(servicio), descripcion);

  if (Array.isArray(servicio.fotos_urls) && servicio.fotos_urls.length) {
    const fotos = document.createElement("div");
    fotos.className = "servicio-fotos";
    servicio.fotos_urls.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = "Foto del vehículo";
      fotos.appendChild(img);
    });
    tarjeta.appendChild(fotos);
  }

  const insigniaDocs = document.createElement("span");
  insigniaDocs.className = "badge-doc-transporte";
  insigniaDocs.dataset.servicioId = servicio.id;
  insigniaDocs.textContent = "Cargando documentación...";
  tarjeta.appendChild(insigniaDocs);

  const acciones = document.createElement("div");
  acciones.className = "servicio-actions";

  const botonVer = document.createElement("button");
  botonVer.className = "btn-secondary";
  botonVer.textContent = "Ver servicio";
  botonVer.addEventListener("click", () => {
    window.location.href = `comprador-detalle-servicio-transporte.html?id=${servicio.id}`;
  });

  const botonContacto = document.createElement("button");
  botonContacto.className = "btn-primary";
  botonContacto.textContent = "Contactar proveedor logístico";
  botonContacto.addEventListener("click", () => {
    alert("Aquí irá la acción para contactar al proveedor logístico (versión futura).");
  });

  acciones.append(botonVer, botonContacto);
  tarjeta.appendChild(acciones);

  return tarjeta;
}

async function pintarBadgesDocumentacion() {
  const insignias = document.querySelectorAll(".badge-doc-transporte");
  if (!insignias.length) return;

  const ids = Array.from(insignias).map((b) => b.dataset.servicioId);

  try {
    const mapa = agruparDocumentacion(await listarDocumentacion(ids));

    insignias.forEach((insignia) => {
      const tipos = mapa[insignia.dataset.servicioId];
      const presentes = DOCUMENTOS.map(([, clave]) => tipos?.has(clave) ?? false);
      const resumen = DOCUMENTOS.map(
        ([etiqueta], i) => `${etiqueta} ${presentes[i] ? "✓" : "✗"}`
      ).join(" · ");

      insignia.classList.remove("ok", "parcial", "sin");

      if (!tipos) {
        insignia.textContent = `Sin documentación · ${resumen}`;
        insignia.classList.add("sin");
      } else if (presentes.every(Boolean)) {
        insignia.textContent = `Documentación completa · ${resumen}`;
        insignia.classList.add("ok");
      } else {
        insignia.textContent = `Documentación parcial · ${resumen}`;
        insignia.classList.add("parcial");
      }
    });
  } catch (err) {
    console.error("Error cargando documentación de transporte:", err);
  }
}

async function cargarServicios() {
  mostrarEstado("Cargando servicios de transporte disponibles...");
  if (vacio) vacio.style.display = "none";

  try {
    const servicios = await buscarActivos({
      tipo: filtroTipo?.value.trim(),
      zona: filtroZona?.value.trim(),
    });

    if (!servicios.length) {
      if (lista) lista.innerHTML = "";
      if (vacio) vacio.style.display = "block";
      mostrarEstado("");
      return;
    }

    mostrarEstado(
      `Mostrando ${servicios.length} servicio(s) de transporte disponible(s).`
    );

    if (lista) {
      lista.innerHTML = "";
      servicios.forEach((servicio) => lista.appendChild(crearTarjeta(servicio)));
    }

    // Antes esto solo corría al cargar la página: al aplicar un filtro
    // las tarjetas se repintaban y sus badges se quedaban colgados en
    // "Cargando documentación..." para siempre.
    await pintarBadgesDocumentacion();
  } catch (err) {
    console.error("Error cargando servicios de transporte:", err);
    mostrarEstado("Ocurrió un error al cargar los servicios de transporte.");
  }
}

await cargarServicios();

botonFiltros?.addEventListener("click", (evento) => {
  evento.preventDefault();
  cargarServicios();
});
