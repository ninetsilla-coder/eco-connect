// ==============================================================
// Página: comprador-detalle-residuo.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { obtenerResiduo, textoPrecio, textoCantidad } from "../data/residuos.js";
import {
  etiqueta, PERIODICIDADES, CONDICIONES, NIVELES_PROCESAMIENTO,
} from "../data/materiales.js";
import { existeInteres, guardarInteres, TIPO_RESIDUO } from "../data/intereses.js";
import {
  listarMensajesDePublicacion,
  enviarMensaje,
  marcarLeidos,
  nombresDeEmpresas,
} from "../data/mensajes.js";
import { crearGaleria, crearMeta, crearDescripcion, crearTitulo } from "../ui/detalle.js";
import { montarConversacion } from "../ui/conversacion.js";
import { crearAvisoEstado, bloquearSiNoOpera, puedeOperar } from "../ui/estado-cuenta.js";

montarNavbar();

// Contactar y guardar interés son operar (cambios-plataforma §3); ver
// la publicación, no. Aviso, no control: ver CLAUDE.md §7.
(async () => {
  const sesion = await obtenerSesion();
  if (!sesion?.usuario) return;

  const aviso = crearAvisoEstado(sesion.estado, { accion: "contactar ni guardar intereses" });
  if (aviso) document.querySelector("main")?.prepend(aviso);

  ["btn-contactar", "btn-guardar-interes"].forEach((id) => {
    bloquearSiNoOpera(document.getElementById(id), sesion.estado, { accion: "contactar" });
  });
})();

const estadoPagina = document.getElementById("status-detalle-residuo");
const layout = document.getElementById("detalle-layout");
const principal = document.getElementById("detalle-main");
const botonContactar = document.getElementById("btn-contactar");
const botonGuardar = document.getElementById("btn-guardar-interes");
const mensajeInteres = document.getElementById("mensaje-interes");

const CATEGORIAS = {
  sin_procesar: "Sin procesar",
  procesado: "Procesado y limpio",
};

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

function pintar(residuo, empresa) {
  principal.innerHTML = "";

  const galeria = crearGaleria(residuo.fotos, "Foto del residuo");
  if (galeria) principal.appendChild(galeria);

  principal.appendChild(crearTitulo(residuo.tipo || "Residuo sin nombre"));

  principal.appendChild(
    crearMeta([
      // Quién publica va primero: dos residuos del mismo material se
      // ven idénticos sin esto, y se acaba escribiendo a la empresa
      // equivocada.
      ["Publica", empresa],
      ["Categoría", CATEGORIAS[residuo.categoria] ?? residuo.categoria],
      ["Precio", textoPrecio(residuo)],
      ["Cantidad del lote", textoCantidad(residuo)],
      ["Ubicación", residuo.ubicacion],
      ["Periodicidad", etiqueta(PERIODICIDADES, residuo.frecuencia)],
      ["Nivel de procesamiento", etiqueta(NIVELES_PROCESAMIENTO, residuo.nivel_procesamiento)],
      ["Condición", etiqueta(CONDICIONES, residuo.estado_residuo)],
      ["Impurezas", residuo.condicion_detalle],
      ["Humedad", residuo.humedad != null ? `${residuo.humedad}%` : ""],
      ["Clave del catálogo", residuo.material_clave],
      ["Estado de publicación", residuo.estado],
    ])
  );

  const descripcion = crearDescripcion(residuo.descripcion);
  if (descripcion) principal.appendChild(descripcion);
}

// ==============================================================
// Arranque
// ==============================================================

const parametros = new URLSearchParams(window.location.search);
const residuoId = parametros.get("id");

if (!residuoId) {
  mostrarEstado("No se encontró el residuo solicitado.", "error");
} else {
  mostrarEstado("Cargando detalles del residuo...");

  try {
    const residuo = await obtenerResiduo(residuoId);

    if (!residuo) {
      mostrarEstado("No se encontró el residuo.", "error");
    } else {
      const empresas = await nombresDeEmpresas([residuo.user_id]).catch(() => ({}));
      const empresa = empresas[residuo.user_id];

      pintar(residuo, empresa);
      if (layout) layout.style.display = "grid";
      mostrarEstado("");

      // ---------- Conversación con el proveedor ----------
      // Antes este botón solo decía "versión futura". El contacto es el
      // motivo de existir de un marketplace, así que abre el hilo con
      // quien publicó. Ningún correo cambia de manos: se conversa
      // dentro de la app (politicas.sql §7.1).
      const panelMensajes = document.createElement("div");
      panelMensajes.id = "conversacion-residuo";
      principal.appendChild(panelMensajes);

      let conversacionAbierta = false;

      botonContactar?.addEventListener("click", async () => {
        if (conversacionAbierta) {
          panelMensajes.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }

        const { usuario, estado } = await obtenerSesion();
        if (!usuario) {
          mostrarMensaje("Debes iniciar sesión para contactar al generador.", "error");
          return;
        }
        if (!puedeOperar(estado)) {
          mostrarMensaje(
            "Tu cuenta todavía no está verificada. Completa tu expediente para contactar.",
            "error",
          );
          return;
        }
        if (usuario.id === residuo.user_id) {
          mostrarMensaje("Este residuo es tuyo: verás los mensajes en Mis residuos.");
          return;
        }

        conversacionAbierta = true;
        botonContactar.disabled = true;
        mostrarMensaje("");

        await montarConversacion(panelMensajes, {
          usuarioId: usuario.id,
          nombre: empresa,
          // Con el nombre de la empresa delante, dos hilos sobre el
          // mismo material dejan de confundirse.
          titulo: empresa
            ? `Conversación con ${empresa} · ${residuo.tipo || "residuo"}`
            : `Conversación sobre ${residuo.tipo || "este residuo"}`,
          cargar: async () => {
            const mensajes = await listarMensajesDePublicacion({ residuoId: residuo.id });
            const sinLeer = mensajes
              .filter((m) => m.destinatario_id === usuario.id && !m.leido_at)
              .map((m) => m.id);
            if (sinLeer.length) await marcarLeidos(sinLeer, usuario.id).catch(() => {});
            return mensajes;
          },
          enviar: (texto) =>
            enviarMensaje(usuario.id, {
              residuoId: residuo.id,
              destinatarioId: residuo.user_id,
              cuerpo: texto,
            }),
        });

        botonContactar.disabled = false;
        panelMensajes.scrollIntoView({ behavior: "smooth", block: "start" });
      });

      // Quien llega desde "Contactar generador" en la lista ya decidió
      // que quiere escribir: se le abre el hilo sin un clic de más.
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

          if (await existeInteres(usuario.id, TIPO_RESIDUO, residuo.id)) {
            mostrarMensaje("Este residuo ya está en tus intereses.", "success");
            return;
          }

          await guardarInteres(usuario.id, TIPO_RESIDUO, residuo.id);
          mostrarMensaje("Residuo guardado en tus intereses.", "success");
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
    console.error("Error cargando residuo:", err);
    mostrarEstado("Ocurrió un error al cargar el residuo.", "error");
  }
}
