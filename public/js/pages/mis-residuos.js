// ==============================================================
// Página: mis-residuos.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { listarMios, cambiarEstadoResiduo } from "../data/residuos.js";
import { listarGestionDeResiduos, agruparPorResiduo } from "../data/cumplimiento.js";
import { crearTarjetaResiduo, pintarMeta } from "../ui/residuo-card.js";

montarNavbar();

const contenedor = document.getElementById("residuos-list");
const estadoLista = document.getElementById("list-status");
const vacio = document.getElementById("empty-state");

const CAMPOS_META = [
  ["Cantidad", "cantidad"],
  ["Ubicación", "ubicacion"],
  ["Frecuencia", "frecuencia"],
  ["Estado", "estado_residuo"],
  ["Estado venta", "estado"],
];

function textoBotonEstado(residuo) {
  return residuo.estado === "vendido" ? "Marcar como disponible" : "Marcar como vendido";
}

function crearTarjeta(residuo, usuarioId) {
  const { item, meta } = crearTarjetaResiduo(residuo, CAMPOS_META);

  // ---------- Acciones ----------
  const acciones = document.createElement("div");
  acciones.className = "residuo-actions";

  const izquierda = document.createElement("div");
  izquierda.className = "residuo-actions-left";

  const badgeGestion = document.createElement("span");
  badgeGestion.className = "badge-gestion";
  badgeGestion.dataset.residuoId = residuo.id;
  badgeGestion.textContent = "Cargando gestión ambiental...";

  const enlaceGestion = document.createElement("a");
  enlaceGestion.href = "gestion-ambiental.html";
  enlaceGestion.textContent = "Gestionar";

  izquierda.append(badgeGestion, enlaceGestion);

  const botonEditar = document.createElement("button");
  botonEditar.className = "btn-secondary";
  botonEditar.textContent = "Editar";
  botonEditar.addEventListener("click", () => {
    alert("Aquí luego conectamos un formulario de edición 😊");
  });

  const botonEstado = document.createElement("button");
  botonEstado.className = "btn-primary";
  botonEstado.textContent = textoBotonEstado(residuo);

  botonEstado.addEventListener("click", async () => {
    const nuevoEstado = residuo.estado === "vendido" ? "disponible" : "vendido";
    const textoPrevio = botonEstado.textContent;
    botonEstado.disabled = true;
    botonEstado.textContent = "Actualizando...";

    try {
      const actualizado = await cambiarEstadoResiduo(residuo.id, usuarioId, nuevoEstado);
      if (!actualizado) throw new Error("La actualización no afectó ninguna fila");

      residuo.estado = actualizado.estado;
      botonEstado.textContent = textoBotonEstado(residuo);
      pintarMeta(meta, residuo, CAMPOS_META);
    } catch (err) {
      console.error("Error actualizando estado:", err);
      botonEstado.textContent = textoPrevio;
      alert("No se pudo actualizar el estado. Intenta otra vez.");
    } finally {
      botonEstado.disabled = false;
    }
  });

  acciones.append(izquierda, botonEditar, botonEstado);
  item.appendChild(acciones);

  return item;
}

async function pintarBadgesGestion(residuos) {
  try {
    const filas = await listarGestionDeResiduos(residuos.map((r) => r.id));
    const mapa = agruparPorResiduo(filas);

    document.querySelectorAll(".badge-gestion").forEach((badge) => {
      const tipos = mapa[badge.dataset.residuoId];
      const doc = tipos?.has("documentacion") ?? false;
      const cond = tipos?.has("condiciones") ?? false;
      const prac = tipos?.has("practicas") ?? false;
      const marca = (v) => (v ? "✓" : "✗");
      const resumen = `Doc ${marca(doc)} · Cond ${marca(cond)} · Prác ${marca(prac)}`;

      if (!tipos) {
        badge.textContent = `Sin gestión ambiental · ${resumen}`;
        badge.classList.add("sin");
      } else if (doc && cond && prac) {
        badge.textContent = `Gestión ambiental completa · ${resumen}`;
        badge.classList.add("ok");
      } else {
        badge.textContent = `Gestión ambiental parcial · ${resumen}`;
        badge.classList.add("parcial");
      }
    });
  } catch (err) {
    console.error("Error cargando gestión ambiental:", err);
  }
}

// ==============================================================
// Arranque
// ==============================================================

if (estadoLista) estadoLista.textContent = "Cargando tus residuos publicados...";

const { usuario } = await obtenerSesion();

if (!usuario) {
  if (estadoLista) {
    estadoLista.textContent = "Debes iniciar sesión para ver tus residuos publicados.";
  }
} else {
  try {
    const residuos = await listarMios(usuario.id);
    residuos.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!residuos.length) {
      if (estadoLista) estadoLista.textContent = "";
      if (vacio) vacio.style.display = "block";
    } else {
      if (estadoLista) {
        estadoLista.textContent = `Mostrando ${residuos.length} residuo(s) publicado(s).`;
      }
      contenedor.innerHTML = "";
      residuos.forEach((r) => contenedor.appendChild(crearTarjeta(r, usuario.id)));
      await pintarBadgesGestion(residuos);
    }
  } catch (err) {
    console.error(err);
    if (estadoLista) {
      estadoLista.textContent = "Ocurrió un error inesperado al cargar tus residuos.";
    }
  }
}
