// ==============================================================
// Página: index.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { alCambiarSesion } from "../core/sesion.js";
import { registrarEmpresa } from "../data/contacto.js";

montarNavbar();

// ==============================================================
// Bloque de residuos según rol
// ==============================================================

const PATHS = {
  comprador: "path-comprador",
  proveedor: "path-proveedor",
  logistica: "path-logistica",
};

function aplicarPaths(rol) {
  const ids = ["path-generico", ...Object.values(PATHS)];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = "none";
  });

  const visible = document.getElementById(PATHS[rol] ?? "path-generico");
  if (visible) visible.style.display = "grid";
}

alCambiarSesion(({ usuario, rol }) => {
  aplicarPaths(rol);

  const hero = document.getElementById("marketplace-hero");
  if (hero) hero.style.display = usuario ? "flex" : "none";
});

// ==============================================================
// Formulario de empresas
// ==============================================================

const formulario = document.getElementById("empresa-form");
const estadoFormulario = document.getElementById("form-status");

function mostrarEstado(texto, clase = "") {
  if (!estadoFormulario) return;
  estadoFormulario.textContent = texto;
  estadoFormulario.className = clase ? `form-status ${clase}` : "form-status";
}

formulario?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarEstado("Enviando información...");

  const empresa = document.getElementById("empresa").value.trim();
  const correo = document.getElementById("correo").value.trim();
  const mensaje = document.getElementById("mensaje").value.trim();

  if (!empresa || !correo) {
    mostrarEstado("Por favor, completa los campos obligatorios.", "error");
    return;
  }

  try {
    await registrarEmpresa({ empresa, correo, mensaje });
    formulario.reset();
    mostrarEstado(
      "¡Gracias! Tu información se envió correctamente. Nos pondremos en contacto contigo pronto.",
      "success"
    );
  } catch (err) {
    console.error(err);
    mostrarEstado(
      "Ocurrió un error al enviar tu información. Intenta de nuevo.",
      "error"
    );
  }
});

// ==============================================================
// Contadores de la sección IMPACTO
// ==============================================================

const contadores = document.querySelectorAll("#impacto .metric-value");
let yaCorrieron = false;

function animar(el) {
  const objetivo = Number(el.getAttribute("data-target"));
  const duracion = 1500;
  const inicio = performance.now();

  const paso = (ahora) => {
    const avance = Math.min((ahora - inicio) / duracion, 1);
    el.textContent = Math.floor(objetivo * avance).toLocaleString("es-MX");
    if (avance < 1) requestAnimationFrame(paso);
  };

  requestAnimationFrame(paso);
}

function arrancarContadores() {
  if (yaCorrieron) return;
  yaCorrieron = true;
  contadores.forEach(animar);
}

const seccionImpacto = document.querySelector("#impacto");
if (seccionImpacto) {
  new IntersectionObserver(
    (entradas) => {
      entradas.forEach((entrada) => {
        if (entrada.isIntersecting) arrancarContadores();
      });
    },
    { threshold: 0.4 }
  ).observe(seccionImpacto);
}

// El scroll suave del navbar tarda en anclar la sección.
document
  .querySelector('a[href="#impacto"]')
  ?.addEventListener("click", () => setTimeout(arrancarContadores, 400));
