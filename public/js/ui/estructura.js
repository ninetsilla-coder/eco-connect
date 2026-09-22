// ==============================================================
// Estructura compartida: cabecera y pie
// ==============================================================
// El markup del header y el footer estaba copiado en los 13 HTML.
// Doce copias eran idénticas byte a byte y la decimotercera
// (profile.html) se había arreglado sola, así que las otras doce
// arrastraban sus fallos:
//
//   · Los anclajes del menú se escribían "#quienes-somos", que solo
//     resuelve dentro de index.html. En las otras once páginas esos
//     cuatro links no hacían nada.
//   · Ocho páginas no tenían footer, así que montarAnioFooter() no
//     encontraba su #year.
//   · Solo profile.html enlazaba CONTACTO.
//
// Aquí vive una sola versión, la correcta. Este archivo es el QUÉ se
// pinta; ui/navbar.js es el CÓMO se comporta.
//
// ⚠️ Sobre innerHTML y CLAUDE.md §4.4: la regla prohíbe **interpolar
// datos** en HTML, que es como entró el XSS de las tarjetas. Estas dos
// plantillas son constantes literales, sin una sola interpolación: no
// hay dato de usuario que pueda entrar. estructura.test.js lo verifica
// para que siga siendo cierto. Si alguna vez hiciera falta un valor
// variable, se pinta con textContent después de insertarlas, nunca
// dentro del texto de la plantilla.
// ==============================================================

// ==============================================================
// Contrato con ui/navbar.js
// ==============================================================
// El markup y el comportamiento están en archivos distintos, así que
// estos identificadores son la junta entre ambos. navbar.js los busca
// por getElementById; si uno se renombra aquí y allí no, el cableado
// deja de funcionar en silencio.
//
// `estructura.test.js` compara esta lista contra lo que navbar.js
// consulta de verdad, en los dos sentidos: sobra o falta, avisa.
export const IDS = Object.freeze({
  navegacion: "nav-links",
  hamburguesa: "hamburger-btn",
  menuResiduos: "menu-residuos",
  dropdownResiduos: "dropdown-residuos",
  login: "login-button",
  logout: "logout-button",
  cuenta: "account-label",
  expediente: "expediente-link",
  anio: "year",
});

// Los links del dropdown llevan data-role: navbar.js los muestra u
// oculta según el rol. Es solo presentación — quién puede escribir de
// verdad lo deciden las políticas RLS (CONTRATO-RLS.md).
export const HEADER = `
  <header class="navbar">
    <div class="container navbar-content">
      <div class="logo-text">
        <span class="logo-eco">Eco</span><span class="logo-connect">Connect</span>
      </div>

      <button class="hamburger" id="hamburger-btn" aria-label="Abrir menú">
        ☰
      </button>

      <nav class="nav-links" id="nav-links">
        <a href="index.html#quienes-somos">CONÓCENOS</a>
        <a href="index.html#impacto">IMPACTO</a>

        <div class="nav-item dropdown" id="menu-residuos">
          <a href="index.html#demo-residuos" class="nav-link">RESIDUOS ▾</a>
          <div class="dropdown-menu" id="dropdown-residuos">
            <a href="publicar-residuos.html" data-role="proveedor">Publica tus residuos disponibles</a>
            <a href="mis-residuos.html" data-role="proveedor">Mis residuos publicados</a>
            <a href="manifiesto.html" data-role="proveedor">Manifiesto</a>

            <a href="publicar-servicio-transporte.html" data-role="logistica">Publicar servicio de transporte</a>
            <a href="mis-servicios-transporte.html" data-role="logistica">Ver mis servicios</a>
            <a href="transporte-responsable.html" data-role="logistica">Cumple con transporte responsable</a>

            <a href="comprador-explorar-residuos.html" data-role="comprador">Explorar residuos</a>
            <a href="comprador-mis-intereses.html" data-role="comprador">Mis intereses</a>
            <a href="comprador-servicios-transporte.html" data-role="comprador">Servicios de transporte</a>
            <a href="pago.html" data-role="comprador">Pago de una operación</a>
          </div>
        </div>

        <a href="index.html#beneficios">BENEFICIOS</a>
        <a href="index.html#faq">FAQ</a>
        <a href="index.html#contacto">CONTACTO</a>
      </nav>

      <div class="navbar-auth">
        <button id="login-button" class="btn btn-primary">Login / Registrarse</button>
        <!-- El expediente es de la empresa, no de un rol: vive junto a
             "Mi cuenta" y no dentro del menú de residuos, donde solo lo
             encontraban los generadores. -->
        <a href="expediente.html" id="expediente-link" class="navbar-account" style="display: none;">Mi expediente</a>
        <span id="account-label" class="navbar-account" style="display: none;">Mi cuenta</span>
        <button id="logout-button" class="btn btn-outline" style="display: none;">Cerrar sesión</button>
      </div>
    </div>
  </header>
`;

// El año lo rellena navbar.js: una constante aquí envejecería sola.
export const FOOTER = `
  <footer class="footer">
    <div class="container footer-content">
      <p>© <span id="year"></span> Eco Connect. Tu aliado en economía circular.</p>
    </div>
  </footer>
`;

// Inserta cabecera y pie si no están ya.
//
// El estado inicial que pintan los botones es el de visitante anónimo
// (login visible, cuenta y logout ocultos) porque es el caso más
// frecuente: así la mayoría de las cargas no parpadea. En cuanto se
// resuelve la sesión, aplicarSesionEnNavbar() corrige lo que haga falta.
//
// Es idempotente: si una página ya trae su header en el HTML, se
// respeta. Así se puede migrar de una en una sin duplicar el navbar.
export function montarEstructura() {
  if (!document.querySelector("header.navbar")) {
    document.body.insertAdjacentHTML("afterbegin", HEADER);
  }

  if (!document.querySelector("footer.footer")) {
    document.body.insertAdjacentHTML("beforeend", FOOTER);
  }
}
