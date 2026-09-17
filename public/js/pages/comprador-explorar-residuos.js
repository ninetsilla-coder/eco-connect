// ==============================================================
// Página: comprador-explorar-residuos.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { buscarDisponibles } from "../data/residuos.js";
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

function crearTarjeta(residuo) {
  const { item } = crearTarjetaResiduo(residuo, CAMPOS_META);

  const acciones = document.createElement("div");
  acciones.className = "residuo-actions";

  const botonDetalle = document.createElement("button");
  botonDetalle.className = "btn-secondary";
  botonDetalle.textContent = "Ver detalles";
  botonDetalle.addEventListener("click", () => {
    window.location.href = `comprador-detalle-residuo.html?id=${residuo.id}`;
  });

  const botonContacto = document.createElement("button");
  botonContacto.className = "btn-primary";
  botonContacto.textContent = "Contactar proveedor";
  botonContacto.addEventListener("click", () => {
    alert("Aquí irá la acción para contactar al proveedor (versión futura).");
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
    if (lista) {
      lista.innerHTML = "";
      residuos.forEach((residuo) => lista.appendChild(crearTarjeta(residuo)));
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
