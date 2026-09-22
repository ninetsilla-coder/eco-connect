// ==============================================================
// Página: comprador-servicios-transporte.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { buscarActivos } from "../data/transporte.js";
import {
  listarResumenDeEmpresas, agruparResumen, resumirTransporte,
} from "../data/expediente.js";
import { nombresDeEmpresas } from "../data/mensajes.js";
import { obtenerSesion } from "../core/sesion.js";
import { crearAvisoEstado, bloquearSiNoOpera } from "../ui/estado-cuenta.js";

montarNavbar();

// Igual que al explorar residuos: ver el directorio no depende del
// estado, contactar sí (cambios-plataforma §3).
let estadoCuenta = null;

(async () => {
  const sesion = await obtenerSesion();
  if (!sesion?.usuario) return;

  estadoCuenta = sesion.estado;
  const aviso = crearAvisoEstado(estadoCuenta, { accion: "contactar a los transportistas" });
  if (aviso) document.querySelector("main")?.prepend(aviso);
})();

const lista = document.getElementById("servicios-list");
const estadoLista = document.getElementById("servicios-status");
const vacio = document.getElementById("servicios-empty");
const filtroTipo = document.getElementById("filtro-tipo-transporte");
const filtroZona = document.getElementById("filtro-zona");
const botonFiltros = document.getElementById("btn-aplicar-filtros");

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

function crearTarjeta(servicio, empresa) {
  const tarjeta = document.createElement("article");
  tarjeta.className = "servicio-item";

  const cabecera = document.createElement("div");
  cabecera.className = "servicio-header";

  const titulo = document.createElement("div");
  titulo.className = "servicio-title";
  titulo.textContent = servicio.tipo_transporte || "Servicio de transporte";

  // Sin quién publica, dos servicios del mismo tipo son indistinguibles.
  if (empresa) {
    const quien = document.createElement("span");
    quien.className = "servicio-empresa";
    quien.textContent = empresa;
    titulo.append(document.createElement("br"), quien);
  }

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
  // Por EMPRESA, no por servicio: la autorización de transporte es de
  // quien la tramitó, no de cada anuncio que publique.
  insigniaDocs.dataset.empresaId = servicio.user_id;
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

  // Igual que en explorar residuos: el hilo vive en el detalle, y
  // `contactar=1` hace que se abra al llegar.
  const botonContacto = document.createElement("button");
  botonContacto.className = "btn-primary";
  botonContacto.textContent = "Contactar transportista";
  botonContacto.addEventListener("click", () => {
    window.location.href =
      `comprador-detalle-servicio-transporte.html?id=${servicio.id}&contactar=1`;
  });

  bloquearSiNoOpera(botonContacto, estadoCuenta, { accion: "contactar" });

  acciones.append(botonVer, botonContacto);
  tarjeta.appendChild(acciones);

  return tarjeta;
}

async function pintarBadgesDocumentacion() {
  const insignias = document.querySelectorAll(".badge-doc-transporte");
  if (!insignias.length) return;

  const ids = Array.from(insignias).map((b) => b.dataset.empresaId);

  try {
    const mapa = agruparResumen(await listarResumenDeEmpresas(ids));

    insignias.forEach((insignia) => {
      const fila = mapa[insignia.dataset.empresaId];
      const { detalle, completo, alguno } = resumirTransporte(fila);

      insignia.classList.remove("ok", "parcial", "sin");

      if (!alguno) {
        insignia.textContent = `Sin documentación · ${detalle}`;
        insignia.classList.add("sin");
      } else if (completo) {
        insignia.textContent = `Documentación completa · ${detalle}`;
        insignia.classList.add("ok");
      } else {
        insignia.textContent = `Documentación parcial · ${detalle}`;
        insignia.classList.add("parcial");
      }
    });
  } catch (err) {
    // Si esto falla, los badges se quedarían en "Cargando documentación..."
    // para siempre. Mejor decir que no se sabe que mentir por omisión.
    console.error("Error cargando documentación de transporte:", err);
    insignias.forEach((insignia) => {
      insignia.classList.remove("ok", "parcial", "sin");
      insignia.textContent = "No se pudo consultar la documentación";
    });
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

    const empresas = await nombresDeEmpresas(
      servicios.map((s) => s.user_id)
    ).catch(() => ({}));

    if (lista) {
      lista.innerHTML = "";
      servicios.forEach((servicio) =>
        lista.appendChild(crearTarjeta(servicio, empresas[servicio.user_id]))
      );
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
