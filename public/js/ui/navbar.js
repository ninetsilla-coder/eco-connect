// ==============================================================
// Comportamiento de la cabecera y el pie
// ==============================================================
// Aquí vive el CÓMO se comporta la estructura: login, cierre de
// sesión, rol en el dropdown, hamburguesa, año y scroll suave.
//
// El QUÉ se pinta está en ui/estructura.js. Los dos archivos se unen
// por los identificadores de `IDS`, que este módulo consulta con
// getElementById; dependencias.test.js comprueba que ninguno de los
// dos lados se quede atrás.
// ==============================================================

import { alCambiarSesion, cerrarSesion } from "../core/sesion.js";
import { montarModalAuth } from "./auth-modal.js";
import { montarEstructura } from "./estructura.js";

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
  const enlaceExpediente = document.getElementById("expediente-link");
  const haySesion = Boolean(usuario);

  if (botonLogin) botonLogin.style.display = haySesion ? "none" : "inline-block";
  if (botonLogout) botonLogout.style.display = haySesion ? "inline-block" : "none";
  if (enlaceExpediente) enlaceExpediente.style.display = haySesion ? "inline-block" : "none";
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
//
// Los links del menú apuntan a "index.html#seccion", no a "#seccion":
// la forma corta solo resuelve estando ya en index.html, y por eso en
// las otras doce páginas no hacían nada. Al estar en el home las dos
// formas señalan aquí mismo, así que se aceptan ambas.
function idDeAncla(href) {
  if (!href) return null;
  const almohadilla = href.indexOf("#");
  if (almohadilla === -1) return null;

  const ruta = href.slice(0, almohadilla);
  if (ruta && ruta !== "index.html" && ruta !== "/") return null;

  return href.slice(almohadilla + 1) || null;
}

function montarScrollSuave() {
  const esIndex =
    window.location.pathname === "/" ||
    window.location.pathname.endsWith("index.html");
  if (!esIndex) return;

  document.querySelectorAll(".nav-links a").forEach((link) => {
    const id = idDeAncla(link.getAttribute("href"));
    if (!id) return;

    link.addEventListener("click", (evento) => {
      const destino = document.getElementById(id);
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
  // Primero el markup: todo lo de abajo lo busca por id.
  montarEstructura();

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
