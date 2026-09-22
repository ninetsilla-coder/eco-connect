// ==============================================================
// Página: comprador-explorar-residuos.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { buscarDisponibles, textoPrecio, textoCantidad } from "../data/residuos.js";
import {
  etiqueta, idPorNombre, PERIODICIDADES, CONDICIONES, NIVELES_PROCESAMIENTO,
} from "../data/materiales.js";
import {
  listarResumenDeEmpresas, agruparResumen, estadoAmparo,
} from "../data/expediente.js";
import { nombresDeEmpresas } from "../data/mensajes.js";
import { obtenerSesion } from "../core/sesion.js";
import { crearTarjetaResiduo } from "../ui/residuo-card.js";
import { crearAvisoEstado, bloquearSiNoOpera } from "../ui/estado-cuenta.js";

montarNavbar();

// Explorar el catálogo no depende del estado de la cuenta; contactar
// sí (cambios-plataforma §3). Se guarda aquí porque las tarjetas se
// pintan después, y cada una trae su botón.
let estadoCuenta = null;

(async () => {
  const sesion = await obtenerSesion();
  if (!sesion?.usuario) return;

  estadoCuenta = sesion.estado;
  const aviso = crearAvisoEstado(estadoCuenta, { accion: "contactar a los generadores" });
  if (aviso) document.querySelector("main")?.prepend(aviso);
})();

// La fila tal como se lee. Se arma aquí y no en `data/` porque mezcla
// dos módulos de esa capa y §4.1 no deja que se importen entre ellos;
// tampoco en `ui/`, que no conoce a `data/`. Las páginas son el único
// sitio donde las dos mitades se pueden juntar.
function vistaDeResiduo(residuo) {
  return {
    ...residuo,
    precio_texto: textoPrecio(residuo),
    cantidad: textoCantidad(residuo),
    frecuencia: etiqueta(PERIODICIDADES, residuo.frecuencia),
    estado_residuo: etiqueta(CONDICIONES, residuo.estado_residuo),
    nivel_procesamiento: etiqueta(NIVELES_PROCESAMIENTO, residuo.nivel_procesamiento),
  };
}

const lista = document.getElementById("lista-residuos");
const estadoLista = document.getElementById("status-explorar-residuos");
const vacio = document.getElementById("empty-state");
const filtroTipo = document.getElementById("filtro-tipo");
const filtroUbicacion = document.getElementById("filtro-ubicacion");
const botonFiltros = document.getElementById("btn-aplicar-filtros");

// Sin "Estado venta": aquí solo se listan los disponibles.
// "Precio" va primero: es lo que decide si el comprador sigue leyendo.
// Las publicaciones anteriores al 2026-09-22 no tienen precio y la
// tarjeta omite los campos vacíos, así que no sale una línea a medias.
const CAMPOS_META = [
  ["Precio", "precio_texto"],
  ["Cantidad", "cantidad"],
  ["Ubicación", "ubicacion"],
  ["Periodicidad", "frecuencia"],
  ["Procesamiento", "nivel_procesamiento"],
  ["Condición", "estado_residuo"],
];

function mostrarEstado(texto) {
  if (!estadoLista) return;
  estadoLista.textContent = texto;
  estadoLista.className = "list-status";
}

function crearTarjeta(residuo, empresa) {
  const { item } = crearTarjetaResiduo(vistaDeResiduo(residuo), CAMPOS_META, { empresa });

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

  bloquearSiNoOpera(botonContacto, estadoCuenta, { accion: "contactar" });

  // Si el generador tiene registro para ESTE material. Tener papeles no
  // basta: las autorizaciones de la SMA son por residuo, y comprarle un
  // lote a quien no lo tiene amparado deja al comprador con un
  // manifiesto que no cuadra.
  const amparo = document.createElement("span");
  amparo.className = "badge-amparo";
  amparo.dataset.empresaId = residuo.user_id;
  amparo.dataset.material = idPorNombre(residuo.tipo) ?? "";
  item.appendChild(amparo);

  acciones.append(botonDetalle, botonContacto);
  item.appendChild(acciones);

  return item;
}

// Si la empresa que publica tiene su registro para ese material.
//
// Cuando no lo sabemos —todavía no declaró materiales— la insignia se
// queda vacía. Un "no se sabe" pintado como advertencia acusaría a
// empresas que solo llegaron antes que el campo.
async function pintarAmparos(idsEmpresas) {
  const insignias = document.querySelectorAll(".badge-amparo");
  if (!insignias.length) return;

  let mapa = {};
  try {
    mapa = agruparResumen(await listarResumenDeEmpresas(idsEmpresas));
  } catch (err) {
    console.warn("No se pudo comprobar el registro de los generadores:", err);
    return;
  }

  insignias.forEach((insignia) => {
    const estado = estadoAmparo(mapa[insignia.dataset.empresaId], insignia.dataset.material);

    if (estado === "amparado") {
      insignia.textContent = "El generador tiene registro para este material";
      insignia.classList.add("ok");
    } else if (estado === "no-amparado") {
      insignia.textContent = "Este material no aparece en el registro del generador";
      insignia.classList.add("sin");
    }
  });
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
      await pintarAmparos(residuos.map((r) => r.user_id));
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
