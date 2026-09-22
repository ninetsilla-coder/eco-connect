// ==============================================================
// Modal de autenticación
// ==============================================================
// Antes este markup vivía solo en index.html, pero todas las páginas
// tienen el botón #login-button. En las otras, script.js protegía
// con `if (loginButton && authModal)` y el botón no hacía NADA: quien
// aterrizaba sin sesión en una página interna no podía entrar.
//
// Ahora el módulo inyecta el modal donde falte, así que el botón
// funciona en todas. Desde el 2026-09-22 falta en todas: index.html
// tenía su propia copia del formulario y había que mantener los dos
// lados iguales a mano — con tres campos nuevos, era cuestión de
// tiempo que divergieran y que registrarse desde la portada guardara
// datos distintos que registrarse desde dentro.
// ==============================================================

import { supabaseClient } from "../core/supabase.js";

// El orden manda: la primera casilla marcada de esta lista es el rol
// principal, el que decide el menú y —sobre todo— el que leen las
// políticas de la base. Ver decisión D-3 de docs/plan-de-trabajo.md.
const ORDEN_ROLES = ["proveedor", "comprador", "logistica"];

// 3 letras (persona moral) o 4 (persona física), 6 de fecha y 3 de
// homoclave. Solo comprueba la forma: que el RFC exista de verdad lo
// dirá el cotejo del expediente, no una expresión regular.
const RFC_VALIDO = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;

function normalizarRfc(valor) {
  return (valor || "").toUpperCase().replace(/[\s-]/g, "");
}

const MARKUP = `
<div id="auth-modal" class="auth-modal" style="display: none;">
  <div class="auth-modal-backdrop"></div>
  <div class="auth-modal-content">
    <button id="auth-modal-close" class="auth-modal-close">&times;</button>

    <div class="auth-tabs">
      <button id="tab-signup" class="auth-tab auth-tab-active">Crear cuenta</button>
      <button id="tab-login" class="auth-tab">Iniciar sesión</button>
    </div>

    <form id="signup-form" class="auth-form">
      <h3>Crear cuenta</h3>
      <div class="form-group">
        <label for="signup-company">Razón social *</label>
        <input type="text" id="signup-company" required autocomplete="organization" placeholder="Ej. Eco Industrias del Norte S.A. de C.V." />
        <small class="form-hint">Escríbela exactamente como aparece en tus permisos ambientales.</small>
      </div>
      <div class="form-group">
        <label for="signup-trade-name">Nombre comercial</label>
        <input type="text" id="signup-trade-name" placeholder="Cómo te conocen tus clientes" />
      </div>
      <div class="form-group">
        <label for="signup-rfc">RFC *</label>
        <input type="text" id="signup-rfc" required maxlength="13" autocapitalize="characters" placeholder="Ej. EIN240115AB9" />
        <small class="form-hint">12 caracteres si es persona moral, 13 si es persona física.</small>
      </div>
      <div class="form-group">
        <label for="signup-email">Correo empresarial *</label>
        <input type="email" id="signup-email" required autocomplete="email" placeholder="nombre@empresa.com" />
      </div>
      <fieldset class="form-group signup-roles">
        <legend>Tipo de empresa *</legend>
        <label class="signup-role-opcion"><input type="checkbox" class="signup-role" value="proveedor" /> Generador de residuos</label>
        <label class="signup-role-opcion"><input type="checkbox" class="signup-role" value="comprador" /> Comprador industrial</label>
        <label class="signup-role-opcion"><input type="checkbox" class="signup-role" value="logistica" /> Transportista</label>
        <small class="form-hint">Puedes elegir más de uno.</small>
        <p id="signup-role-aviso" class="form-hint"></p>
      </fieldset>
      <div class="form-group">
        <label for="signup-password">Contraseña *</label>
        <input type="password" id="signup-password" required minlength="6" autocomplete="new-password" placeholder="Mínimo 6 caracteres" />
      </div>
      <p class="auth-helper-text">
        Después de crear tu cuenta te pediremos tus permisos ambientales. Podrás explorar la plataforma mientras los revisamos.
      </p>
      <button type="submit" class="btn btn-primary full-width">Crear cuenta</button>
      <p id="signup-status" class="form-status" role="status" aria-live="polite"></p>
    </form>

    <form id="login-form" class="auth-form" style="display: none;">
      <h3>Iniciar sesión</h3>
      <div class="form-group">
        <label for="login-email">Correo electrónico *</label>
        <input type="email" id="login-email" required placeholder="nombre@empresa.com" />
      </div>
      <div class="form-group">
        <label for="login-password">Contraseña *</label>
        <input type="password" id="login-password" required />
      </div>
      <button type="submit" class="btn btn-primary full-width">Entrar</button>
      <p id="login-status" class="form-status"></p>
    </form>
  </div>
</div>`;

function estado(el, texto, clase = "") {
  if (!el) return;
  el.textContent = texto;
  el.className = clase ? `form-status ${clase}` : "form-status";
}

function limpiarCampos(ids) {
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document
    .querySelectorAll(".signup-role")
    .forEach((casilla) => { casilla.checked = false; });
}

// Las casillas marcadas, en el orden de ORDEN_ROLES y no en el que las
// haya ido pulsando el usuario: el rol principal tiene que salir igual
// siempre, porque de él cuelga lo que la base deja hacer.
function rolesMarcados() {
  const marcados = [...document.querySelectorAll(".signup-role")]
    .filter((casilla) => casilla.checked)
    .map((casilla) => casilla.value);
  return ORDEN_ROLES.filter((rol) => marcados.includes(rol));
}

export function montarModalAuth() {
  if (!document.getElementById("auth-modal")) {
    document.body.insertAdjacentHTML("beforeend", MARKUP);
  }

  const modal = document.getElementById("auth-modal");
  const cerrar = document.getElementById("auth-modal-close");
  const tabSignup = document.getElementById("tab-signup");
  const tabLogin = document.getElementById("tab-login");
  const formSignup = document.getElementById("signup-form");
  const formLogin = document.getElementById("login-form");
  const estadoSignup = document.getElementById("signup-status");
  const estadoLogin = document.getElementById("login-status");

  const CAMPOS = [
    "signup-company", "signup-trade-name", "signup-rfc", "signup-email",
    "signup-password", "login-email", "login-password",
  ];

  // Con varias casillas marcadas, el menú solo puede mostrar uno de los
  // roles (D-3). Decirlo aquí evita que alguien marque tres y se
  // extrañe al entrar de ver un solo submenú.
  const avisoRol = document.getElementById("signup-role-aviso");

  function actualizarAvisoRol() {
    if (!avisoRol) return;
    const roles = rolesMarcados();
    if (roles.length < 2) {
      avisoRol.textContent = "";
      return;
    }
    // La etiqueta se lee del propio <label>, no de una copia: si algún
    // día cambia el nombre del rol, este aviso cambia con él.
    const casilla = document.querySelector(`.signup-role[value="${roles[0]}"]`);
    const nombre = casilla?.closest("label")?.textContent.trim();
    avisoRol.textContent = nombre ? `Verás el menú de ${nombre}.` : "";
  }

  document
    .querySelectorAll(".signup-role")
    .forEach((casilla) => casilla.addEventListener("change", actualizarAvisoRol));

  function mostrarPestana(cual) {
    const esSignup = cual === "signup";
    tabSignup?.classList.toggle("auth-tab-active", esSignup);
    tabLogin?.classList.toggle("auth-tab-active", !esSignup);
    if (formSignup) formSignup.style.display = esSignup ? "block" : "none";
    if (formLogin) formLogin.style.display = esSignup ? "none" : "block";
  }

  function abrir() {
    limpiarCampos(CAMPOS);
    estado(estadoSignup, "");
    estado(estadoLogin, "");
    if (modal) modal.style.display = "block";
    mostrarPestana("signup");
  }

  function cerrarModal() {
    if (modal) modal.style.display = "none";
    estado(estadoSignup, "");
    estado(estadoLogin, "");
  }

  cerrar?.addEventListener("click", cerrarModal);
  modal?.addEventListener("click", (e) => {
    if (e.target === modal) cerrarModal();
  });

  // El fondo oscuro es un elemento aparte que tapa al contenedor, así
  // que el clic de arriba nunca llegaba a dispararse: la × era la ÚNICA
  // salida. Importa desde que el cuadro se desplaza por dentro, porque
  // la × se va hacia arriba al bajar por el formulario.
  modal?.querySelector(".auth-modal-backdrop")
    ?.addEventListener("click", cerrarModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal?.style.display === "block") cerrarModal();
  });
  tabSignup?.addEventListener("click", () => mostrarPestana("signup"));
  tabLogin?.addEventListener("click", () => mostrarPestana("login"));

  // ---------- Registro ----------
  // El perfil lo crea el trigger crear_perfil() desde raw_user_meta_data
  // (supabase/politicas.sql §2), en la misma transacción que el usuario.
  //
  // Antes, script.js:404 hacía un .update() sobre profiles justo después
  // del signUp, asumiendo que la fila ya existía. Si el trigger no había
  // corrido, el update afectaba 0 filas SIN devolver error y la cuenta
  // quedaba sin company_type — es decir, sin rol.
  //
  // ⚠️ Requiere la sección 2 de politicas.sql aplicada.
  formSignup?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    estado(estadoSignup, "Creando cuenta...");

    const empresa = document.getElementById("signup-company")?.value.trim();
    const nombreComercial = document.getElementById("signup-trade-name")?.value.trim();
    const rfc = normalizarRfc(document.getElementById("signup-rfc")?.value);
    const correo = document.getElementById("signup-email")?.value.trim();
    const password = document.getElementById("signup-password")?.value.trim();
    const roles = rolesMarcados();

    if (!empresa || !correo || !rfc || !password) {
      estado(estadoSignup, "Completa todos los campos obligatorios.", "error");
      return;
    }
    if (!roles.length) {
      estado(estadoSignup, "Elige al menos un tipo de empresa.", "error");
      return;
    }
    if (!RFC_VALIDO.test(rfc)) {
      estado(estadoSignup, "El RFC debe tener 12 caracteres (persona moral) o 13 (persona física).", "error");
      return;
    }

    // Preguntar antes de intentar el alta. El índice único de
    // politicas.sql §1.4 ya impide el duplicado, pero lo rechaza el
    // motor y al navegador le llega "Database error saving new user",
    // que no le dice nada a quien se está registrando.
    //
    // Si la función todavía no existe en el proyecto, NO se bloquea el
    // registro: se sigue, y el índice hace su trabajo. Una comprobación
    // de cortesía no puede ser la que impida crear cuentas.
    try {
      const { data: libre, error: fallo } = await supabaseClient
        .rpc("rfc_disponible", { rfc_consultado: rfc });
      if (!fallo && libre === false) {
        estado(estadoSignup, "Ese RFC ya está registrado. Si es tu empresa, inicia sesión.", "error");
        return;
      }
      if (fallo) console.warn("No se pudo comprobar el RFC:", fallo);
    } catch (err) {
      console.warn("No se pudo comprobar el RFC:", err);
    }

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email: correo,
        password,
        options: {
          data: {
            company_name: empresa,
            nombre_comercial: nombreComercial || null,
            rfc,
            // El principal decide menú y permisos; `roles` es el dato
            // completo, para cuando los roles múltiples sean de verdad.
            company_type: roles[0],
            roles,
          },
        },
      });

      if (error) {
        console.error("Error en registro:", error);
        // El alta falla dentro del trigger, así que un RFC repetido que
        // se haya colado entre la comprobación de arriba y este insert
        // llega como un error de base de datos sin detalle. Traducirlo
        // es lo único que se puede hacer desde aquí.
        const texto = (error.message || "").toLowerCase();
        const pareceRfc = texto.includes("database error") ||
          texto.includes("duplicate") || texto.includes("rfc");
        estado(
          estadoSignup,
          pareceRfc
            ? "No pudimos crear la cuenta. Revisa que el RFC no esté ya registrado."
            : error.message || "No se pudo crear la cuenta.",
          "error",
        );
        return;
      }
      if (!data.user) {
        estado(estadoSignup, "Cuenta creada, pero no se pudo obtener el usuario.", "error");
        return;
      }

      estado(estadoSignup, "Cuenta creada. Ya puedes iniciar sesión.", "success");
      limpiarCampos(CAMPOS);
      setTimeout(cerrarModal, 1500);
    } catch (err) {
      console.error(err);
      estado(estadoSignup, "Ocurrió un error inesperado. Intenta más tarde.", "error");
    }
  });

  // ---------- Login ----------
  formLogin?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    estado(estadoLogin, "Iniciando sesión...");

    const correo = document.getElementById("login-email")?.value.trim();
    const password = document.getElementById("login-password")?.value.trim();

    if (!correo || !password) {
      estado(estadoLogin, "Completa correo y contraseña.", "error");
      return;
    }

    try {
      const { error } = await supabaseClient.auth.signInWithPassword({
        email: correo,
        password,
      });

      if (error) {
        console.error("Error en login:", error);
        estado(estadoLogin, "Credenciales inválidas o error al iniciar sesión.", "error");
        return;
      }

      estado(estadoLogin, "Sesión iniciada correctamente.", "success");
      limpiarCampos(["login-email", "login-password"]);
      setTimeout(cerrarModal, 800);
    } catch (err) {
      console.error(err);
      estado(estadoLogin, "Ocurrió un error inesperado. Intenta más tarde.", "error");
    }
  });

  return { abrir, cerrar: cerrarModal };
}
