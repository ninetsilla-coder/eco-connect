// ==============================================================
// Navbar, dropdown por rol, hamburguesa y año del footer
// ==============================================================
// Esto estaba reimplementado en los 13 HTML. Ahora vive aquí: cambiar
// un link del menú vuelve a ser una sola edición.
// ==============================================================

import { alCambiarSesion, cerrarSesion } from "../core/sesion.js";
import { montarModalAuth } from "./auth-modal.js";

// Muestra/oculta los links del dropdown según el rol.
// ⚠️ Solo visual: el control real son las políticas RLS.
function aplicarRolEnDropdown(rol) {
  const dropdown = document.getElementById("dropdown-residuos");
  if (!dropdown) return;

  dropdown.querySelectorAll("a[data-role]").forEach((link) => {
    link.style.display = "none";
  });

  if (rol) {
    dropdown
      .querySelectorAll(`a[data-role="${rol}"]`)
      .forEach((link) => (link.style.display = "block"));
  }

  // Sin sesión el menú entero se oculta; con sesión manda el hover del CSS.
  const menu = document.getElementById("menu-residuos");
  const submenu = menu?.querySelector(".dropdown-menu");
  if (submenu) submenu.style.display = rol ? "" : "none";
}

function aplicarSesionEnNavbar({ usuario }) {
  const botonLogin = document.getElementById("login-button");
  const botonLogout = document.getElementById("logout-button");
  const etiquetaCuenta = document.getElementById("account-label");
  const haySesion = Boolean(usuario);

  if (botonLogin) botonLogin.style.display = haySesion ? "none" : "inline-block";
  if (botonLogout) botonLogout.style.display = haySesion ? "inline-block" : "none";
  if (etiquetaCuenta) {
    etiquetaCuenta.style.display = haySesion ? "inline-block" : "none";
    etiquetaCuenta.textContent = "Mi cuenta";
  }
}

function montarHamburguesa() {
  const boton = document.getElementById("hamburger-btn");
  const links = document.getElementById("nav-links");
  boton?.addEventListener("click", () => links?.classList.toggle("nav-open"));
}

function montarAnioFooter() {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
}

// Scroll suave para anchors internos, solo en el home.
function montarScrollSuave() {
  const esIndex =
    window.location.pathname === "/" ||
    window.location.pathname.endsWith("index.html");
  if (!esIndex) return;

  document.querySelectorAll(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href");
    if (!href?.startsWith("#")) return;

    link.addEventListener("click", (evento) => {
      const destino = document.getElementById(href.substring(1));
      if (!destino) return;

      evento.preventDefault();
      const navbar = document.querySelector(".navbar");
      const alto = navbar ? navbar.offsetHeight : 64;
      const y = destino.getBoundingClientRect().top + window.pageYOffset - alto;
      window.scrollTo({ top: y, behavior: "smooth" });
    });
  });
}

// Punto de entrada único: toda página migrada llama a esto.
// Devuelve el control del modal por si la página necesita abrirlo.
//
// Opciones:
//   cuentaClicable      false en profile.html, que ya ES la cuenta.
//   destinoTrasLogout   a dónde ir al cerrar sesión; null = quedarse.
export function montarNavbar({
  cuentaClicable = true,
  destinoTrasLogout = null,
} = {}) {
  const modal = montarModalAuth();

  document.getElementById("login-button")?.addEventListener("click", modal.abrir);

  document.getElementById("logout-button")?.addEventListener("click", async () => {
    await cerrarSesion();
    if (destinoTrasLogout) window.location.href = destinoTrasLogout;
  });

  const etiquetaCuenta = document.getElementById("account-label");
  if (etiquetaCuenta) {
    if (cuentaClicable) {
      etiquetaCuenta.addEventListener("click", () => {
        window.location.href = "profile.html";
      });
    } else {
      etiquetaCuenta.style.cursor = "default";
    }
  }

  montarHamburguesa();
  montarAnioFooter();
  montarScrollSuave();

  // Se ejecuta ya con el estado actual y en cada cambio de sesión.
  alCambiarSesion((estado) => {
    aplicarSesionEnNavbar(estado);
    aplicarRolEnDropdown(estado.rol);
  });

  return modal;
}
