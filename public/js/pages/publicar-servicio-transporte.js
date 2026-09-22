// ==============================================================
// Página: publicar-servicio-transporte.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { obtenerSesion } from "../core/sesion.js";
import { publicarServicio } from "../data/transporte.js";
import { crearAvisoEstado, bloquearSiNoOpera, puedeOperar } from "../ui/estado-cuenta.js";

montarNavbar();

const formulario = document.getElementById("form-servicio-transporte");
const estadoFormulario = document.getElementById("status-servicio-transporte");
const campoFotos = document.getElementById("fotos-vehiculo");

function mostrarEstado(texto, clase = "") {
  if (!estadoFormulario) return;
  estadoFormulario.textContent = texto;
  estadoFormulario.className = clase ? `form-status ${clase}` : "form-status";
}

// Solo las cuentas verificadas ofrecen transporte (cambios-plataforma
// §3). Aviso, no control: ver ui/estado-cuenta.js y CLAUDE.md §7.
(async () => {
  const sesion = await obtenerSesion();
  if (!sesion?.usuario) return;

  const aviso = crearAvisoEstado(sesion.estado, { accion: "ofrecer transporte" });
  if (aviso) document.querySelector("main")?.prepend(aviso);

  bloquearSiNoOpera(
    formulario?.querySelector("button[type='submit']"),
    sesion.estado,
    { accion: "ofrecer transporte" },
  );
})();

formulario?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarEstado("Publicando servicio...");

  const { usuario, estado } = await obtenerSesion();
  if (!usuario) {
    mostrarEstado("Debes iniciar sesión para publicar un servicio.", "error");
    return;
  }
  if (!puedeOperar(estado)) {
    mostrarEstado(
      "Tu cuenta todavía no está verificada. Completa tu expediente para ofrecer transporte.",
      "error",
    );
    return;
  }

  const valor = (id) => document.getElementById(id)?.value.trim() ?? "";

  const datos = {
    tipoTransporte: valor("tipo-transporte"),
    capacidadCarga: valor("capacidad-carga"),
    tiposResiduos: valor("tipos-residuos"),
    zonaCobertura: valor("zona-cobertura"),
    disponibilidad: valor("disponibilidad"),
    descripcion: valor("descripcion"),
  };

  const obligatorios = [
    datos.tipoTransporte,
    datos.capacidadCarga,
    datos.tiposResiduos,
    datos.zonaCobertura,
    datos.disponibilidad,
  ];

  if (obligatorios.some((v) => !v)) {
    mostrarEstado("Completa todos los campos obligatorios.", "error");
    return;
  }

  try {
    await publicarServicio(usuario.id, datos, campoFotos?.files);
    formulario.reset();
    mostrarEstado("Servicio publicado correctamente.", "success");
  } catch (err) {
    console.error("Error publicando el servicio de transporte:", err);
    mostrarEstado(
      "Ocurrió un error al publicar el servicio. Intenta de nuevo.",
      "error"
    );
  }
});
