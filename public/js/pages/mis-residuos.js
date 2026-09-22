// ==============================================================
// Página: mis-residuos.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import {
  listarMios, cambiarEstadoResiduo, textoPrecio, textoCantidad,
} from "../data/residuos.js";
import { etiqueta, idPorNombre, PERIODICIDADES, CONDICIONES } from "../data/materiales.js";
import {
  listarResumenDeEmpresas, agruparResumen, estadoAmparo,
} from "../data/expediente.js";
import {
  listarMensajesDePublicacion,
  enviarMensaje,
  marcarLeidos,
  nombresDeEmpresas,
  agruparEnConversaciones,
} from "../data/mensajes.js";
import { crearTarjetaResiduo, pintarMeta } from "../ui/residuo-card.js";
import { montarBandeja } from "../ui/conversacion.js";

montarNavbar();

const contenedor = document.getElementById("residuos-list");
const estadoLista = document.getElementById("list-status");
const vacio = document.getElementById("empty-state");

const CAMPOS_META = [
  ["Precio", "precio_texto"],
  ["Cantidad", "cantidad"],
  ["Ubicación", "ubicacion"],
  ["Periodicidad", "frecuencia"],
  ["Condición", "estado_residuo"],
  ["Estado venta", "estado"],
];

// Ver lo mismo que ve el comprador, comisión incluida. Ver el comentario
// de la función gemela en comprador-explorar-residuos.js: se arma en la
// página porque junta dos módulos de `data/`, que no se importan entre sí.
function vistaDeResiduo(residuo) {
  return {
    ...residuo,
    precio_texto: textoPrecio(residuo),
    cantidad: textoCantidad(residuo),
    frecuencia: etiqueta(PERIODICIDADES, residuo.frecuencia),
    estado_residuo: etiqueta(CONDICIONES, residuo.estado_residuo),
  };
}

function textoBotonEstado(residuo) {
  return residuo.estado === "vendido" ? "Marcar como disponible" : "Marcar como vendido";
}

function crearTarjeta(residuo, usuarioId) {
  const { item, meta } = crearTarjetaResiduo(vistaDeResiduo(residuo), CAMPOS_META);

  // ---------- Acciones ----------
  const acciones = document.createElement("div");
  acciones.className = "residuo-actions";

  const izquierda = document.createElement("div");
  izquierda.className = "residuo-actions-left";

  // Antes aquí había una insignia de "gestión ambiental" que leía la
  // pantalla borrada en el 2026-09-22, y un enlace a esa página que ya
  // no existe. Lo sustituye lo que de verdad importa de un residuo
  // publicado: si tu registro ampara ESE material. Tener papeles no
  // basta —las autorizaciones de la SMA son por residuo—, y un lote
  // publicado sin amparo es el que te deja expuesto ante la SMA.
  const badgeAmparo = document.createElement("span");
  badgeAmparo.className = "badge-gestion";
  badgeAmparo.dataset.material = idPorNombre(residuo.tipo) ?? "";
  badgeAmparo.textContent = "Comprobando tu registro...";

  izquierda.append(badgeAmparo);

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
      pintarMeta(meta, vistaDeResiduo(residuo), CAMPOS_META);
    } catch (err) {
      console.error("Error actualizando estado:", err);
      botonEstado.textContent = textoPrevio;
      alert("No se pudo actualizar el estado. Intenta otra vez.");
    } finally {
      botonEstado.disabled = false;
    }
  });

  // ---------- Mensajes de los compradores ----------
  // Sin esto el contacto sería de una sola dirección: los compradores
  // escribirían desde el detalle y nadie leería nunca.
  const bandeja = document.createElement("div");
  bandeja.className = "bandeja-mensajes";
  bandeja.style.display = "none";

  const botonMensajes = document.createElement("button");
  botonMensajes.className = "btn-secondary";
  botonMensajes.textContent = "Mensajes";

  botonMensajes.addEventListener("click", async () => {
    const abierta = bandeja.style.display !== "none";
    bandeja.style.display = abierta ? "none" : "block";
    if (abierta) return;

    botonMensajes.disabled = true;
    await montarBandeja(bandeja, {
      usuarioId,
      cargar: async () => {
        const mensajes = await listarMensajesDePublicacion({ residuoId: residuo.id });
        const conversaciones = agruparEnConversaciones(mensajes, usuarioId);
        const nombres = await nombresDeEmpresas(
          conversaciones.map((c) => c.interlocutorId)
        ).catch(() => ({}));

        const sinLeer = mensajes
          .filter((m) => m.destinatario_id === usuarioId && !m.leido_at)
          .map((m) => m.id);
        if (sinLeer.length) await marcarLeidos(sinLeer, usuarioId).catch(() => {});

        return { conversaciones, nombres };
      },
      enviar: (interlocutorId, texto) =>
        enviarMensaje(usuarioId, {
          residuoId: residuo.id,
          destinatarioId: interlocutorId,
          cuerpo: texto,
        }),
    });
    botonMensajes.disabled = false;
  });

  acciones.append(izquierda, botonMensajes, botonEditar, botonEstado);
  item.append(acciones, bandeja);

  return item;
}

// ¿Tu registro ampara el material de cada publicación? Se lee el propio
// expediente una sola vez: el amparo es de la empresa, no de cada lote.
async function pintarBadgesAmparo(usuarioId) {
  let resumen = null;

  try {
    resumen = agruparResumen(await listarResumenDeEmpresas([usuarioId]))[usuarioId];
  } catch (err) {
    // Sin esto los badges se quedaban en "Comprobando..." para siempre:
    // el mismo fallo silencioso que ya se corrigió en los de transporte.
    console.error("Error consultando tu registro:", err);
    document.querySelectorAll(".badge-gestion").forEach((badge) => {
      badge.textContent = "No se pudo comprobar tu registro";
    });
    return;
  }

  document.querySelectorAll(".badge-gestion").forEach((badge) => {
    const material = badge.dataset.material;
    const estado = estadoAmparo(resumen, material);

    badge.classList.remove("ok", "parcial", "sin");

    if (estado === "amparado") {
      badge.textContent = "Amparado por tu registro";
      badge.classList.add("ok");
    } else if (estado === "no-amparado") {
      // Publicar un material que tu registro no cubre es justo lo que
      // te deja expuesto ante la SMA. Se dice claro, no en gris.
      badge.textContent = "Tu registro no ampara este material";
      badge.classList.add("sin");
    } else {
      badge.textContent = "Marca este material en tu registro de generador";
      badge.classList.add("parcial");
    }
  });
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
      await pintarBadgesAmparo(usuario.id);
    }
  } catch (err) {
    console.error(err);
    if (estadoLista) {
      estadoLista.textContent = "Ocurrió un error inesperado al cargar tus residuos.";
    }
  }
}
