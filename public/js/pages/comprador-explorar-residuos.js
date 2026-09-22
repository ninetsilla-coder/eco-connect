// ==============================================================
// Página: comprador-explorar-residuos.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { buscarDisponibles } from "../data/residuos.js";
import { nombresDeEmpresas } from "../data/mensajes.js";
import { crearTarjetaResiduo } from "../ui/residuo-card.js";

montarNavbar();

const lista = document.getElementById("lista-residuos");
const estadoLista = document.getElementById("status-explorar-residuos");
const vacio = document.getElementById("empty-state");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroUbicacion = document.getElementById("filtro-ubicacion");
const botonFiltros = document.getElementById("btn-aplicar-filtros");

// Sin "Estado venta": aquí solo se listan los disponibles.
const CAMPOS_META = [
  ["Cantidad", "cantidad"],
  ["Ubicación", "ubicacion"],
  ["Frecuencia", "frecuencia"],
  ["Estado", "estado_residuo"],
];

function mostrarEstado(texto) {
  if (!estadoLista) return;
  estadoLista.textContent = texto;
  estadoLista.className = "list-status";
}

function crearTarjeta(residuo, empresa) {
  const { item } = crearTarjetaResiduo(residuo, CAMPOS_META, { empresa });

  const acciones = document.createElement("div");
  acciones.className = "residuo-actions";

  const botonDetalle = document.createElement("button");
  botonDetalle.className = "btn-secondary";
  botonDetalle.textContent = "Ver detalles";
  botonDetalle.addEventListener("click", () => {
    window.location.href = `comprador-detalle-residuo.html?id=${residuo.id}`;
  });

  // La conversación vive en el detalle, no en la tarjeta: repetir el
  // hilo en cada resultado de una lista sería ilegible y obligaría a
  // cargar los mensajes de todos los residuos al abrir la página.
  // `contactar=1` hace que el detalle abra el hilo al llegar.
  const botonContacto = document.createElement("button");
  botonContacto.className = "btn-primary";
  botonContacto.textContent = "Contactar generador";
  botonContacto.addEventListener("click", () => {
    window.location.href = `comprador-detalle-residuo.html?id=${residuo.id}&contactar=1`;
  });

  acciones.append(botonDetalle, botonContacto);
  item.appendChild(acciones);

  return item;
}

async function cargarResiduos() {
  mostrarEstado("Cargando residuos disponibles...");
  if (vacio) vacio.style.display = "none";

  try {
    const residuos = await buscarDisponibles({
      tipo: filtroTipo?.value.trim(),
      ubicacion: filtroUbicacion?.value.trim(),
    });

    if (!residuos.length) {
      if (lista) lista.innerHTML = "";
      if (vacio) vacio.style.display = "block";
      mostrarEstado("");
      return;
    }

    mostrarEstado(`Mostrando ${residuos.length} residuo(s) disponible(s).`);

    // El .catch es la red de seguridad: si la vista no responde, el
    // catálogo se pinta sin el nombre de quien publica en vez de
    // quedarse vacío.
    const empresas = await nombresDeEmpresas(
      residuos.map((r) => r.user_id)
    ).catch(() => ({}));

    if (lista) {
      lista.innerHTML = "";
      residuos.forEach((residuo) =>
        lista.appendChild(crearTarjeta(residuo, empresas[residuo.user_id]))
      );
    }
  } catch (err) {
    console.error("Error cargando residuos:", err);
    mostrarEstado("Ocurrió un error al cargar los residuos.");
  }
}

await cargarResiduos();

botonFiltros?.addEventListener("click", (evento) => {
  evento.preventDefault();
  cargarResiduos();
});
