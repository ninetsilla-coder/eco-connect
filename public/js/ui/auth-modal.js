// ==============================================================
// Modal de autenticación
// ==============================================================
// Antes este markup vivía solo en index.html, pero las 13 páginas
// tienen el botón #login-button. En las otras 12, script.js protegía
// con `if (loginButton && authModal)` y el botón no hacía NADA: quien
// aterrizaba sin sesión en una página interna no podía entrar.
//
// Ahora el módulo inyecta el modal donde falte, así que el botón
// funciona en todas. index.html conserva el suyo en el HTML y se
// reutiliza tal cual.
// ==============================================================

import { supabaseClient } from "../core/supabase.js";

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
        <label for="signup-company">Nombre de la empresa *</label>
        <input type="text" id="signup-company" required placeholder="Ej. Eco Industrias del Norte" />
      </div>
      <div class="form-group">
        <label for="signup-email">Correo empresarial *</label>
        <input type="email" id="signup-email" required placeholder="nombre@empresa.com" />
      </div>
      <div class="form-group">
        <label for="signup-company-type">Tipo de empresa *</label>
        <select id="signup-company-type" required>
          <option value="">Selecciona una opción</option>
          <option value="comprador">Comprador industrial</option>
          <option value="proveedor">Proveedor de residuos</option>
          <option value="logistica">Proveedor de transporte y logística</option>
        </select>
      </div>
      <div class="form-group">
        <label for="signup-password">Contraseña *</label>
        <input type="password" id="signup-password" required placeholder="Mínimo 6 caracteres" />
      </div>
      <p class="auth-helper-text">
        Usaremos este acceso para tu cuenta de Eco Connect. Puedes cambiar tu información más adelante.
      </p>
      <button type="submit" class="btn btn-primary full-width">Crear cuenta</button>
      <p id="signup-status" class="form-status"></p>
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
    "signup-company", "signup-company-type", "signup-email",
    "signup-password", "login-email", "login-password",
  ];

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
    const correo = document.getElementById("signup-email")?.value.trim();
    const tipo = document.getElementById("signup-company-type")?.value.trim();
    const password = document.getElementById("signup-password")?.value.trim();

    if (!empresa || !correo || !tipo || !password) {
      estado(estadoSignup, "Completa todos los campos obligatorios.", "error");
      return;
    }

    try {
      const { data, error } = await supabaseClient.auth.signUp({
        email: correo,
        password,
        options: { data: { company_name: empresa, company_type: tipo } },
      });

      if (error) {
        console.error("Error en registro:", error);
        estado(estadoSignup, error.message || "No se pudo crear la cuenta.", "error");
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
