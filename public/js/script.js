// ==============================
// Conexión a Supabase
// ==============================

// La conexión a Supabase vive en js/supabase.js, que se carga antes
// que este archivo. Desde aquí solo se usa la variable supabaseClient.
// ==============================
// Manejo de sesión y navbar
// ==============================

const loginButton = document.getElementById("login-button");
const logoutButton = document.getElementById("logout-button");
const accountLabel = document.getElementById("account-label");

function updateNavbarForSession(session) {
  if (session && session.user) {
    if (loginButton) loginButton.style.display = "none";
    if (accountLabel) {
      accountLabel.style.display = "inline-block";
      accountLabel.textContent = "Mi cuenta";
    }
    if (logoutButton) logoutButton.style.display = "inline-block";
  } else {
    if (loginButton) loginButton.style.display = "inline-block";
    if (accountLabel) accountLabel.style.display = "none";
    if (logoutButton) logoutButton.style.display = "none";
  }
}

// ==============================
// Paths de residuos según rol
// ==============================

async function updateResiduosPathsForSession(session) {
  const pathGenerico = document.getElementById("path-generico");
  const pathComprador = document.getElementById("path-comprador");
  const pathProveedor = document.getElementById("path-proveedor");
  const pathLogistica = document.getElementById("path-logistica");

  if (pathGenerico) pathGenerico.style.display = "none";
  if (pathComprador) pathComprador.style.display = "none";
  if (pathProveedor) pathProveedor.style.display = "none";
  if (pathLogistica) pathLogistica.style.display = "none";

  if (!session || !session.user) {
    if (pathGenerico) pathGenerico.style.display = "grid";
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("company_type")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Error obteniendo perfil:", error);
    if (pathGenerico) pathGenerico.style.display = "grid";
    return;
  }

  const tipo = data?.company_type;

  if (tipo === "comprador" && pathComprador) {
    pathComprador.style.display = "grid";
  } else if (tipo === "proveedor" && pathProveedor) {
    pathProveedor.style.display = "grid";
  } else if (tipo === "logistica" && pathLogistica) {
    pathLogistica.style.display = "grid";
  } else {
    if (pathGenerico) pathGenerico.style.display = "grid";
  }
}

// ==============================
// Dropdown RESIDUOS según rol
// ==============================

async function updateResiduosDropdownForSession(session) {
  const dropdownMenu = document.getElementById("dropdown-residuos");
  if (!dropdownMenu) return;

  const allLinks = dropdownMenu.querySelectorAll("a[data-role]");
  allLinks.forEach((link) => {
    link.style.display = "none";
  });

  if (!session || !session.user) {
    return;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("company_type")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    console.error("Error obteniendo perfil para dropdown:", error);
    return;
  }

  const tipo = data?.company_type;
  if (!tipo) return;

  const linksForRole = dropdownMenu.querySelectorAll(`a[data-role="${tipo}"]`);
  linksForRole.forEach((link) => {
    link.style.display = "block";
  });
}

// ==============================
// Sesión inicial
// ==============================

supabaseClient.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error("Error obteniendo sesión inicial:", error);
  }
  const session = data?.session || null;

  updateNavbarForSession(session);

  const marketplaceHero = document.getElementById("marketplace-hero");
  if (marketplaceHero) {
    marketplaceHero.style.display = session ? "flex" : "none";
  }

  updateResiduosPathsForSession(session);
  updateResiduosDropdownForSession(session);

  // Mostrar / ocultar dropdown global según login
  const menuResiduos = document.getElementById("menu-residuos");
  const dropdownMenu = menuResiduos?.querySelector(".dropdown-menu");
  if (dropdownMenu) {
    if (session && session.user) {
      dropdownMenu.style.display = "";       // hover CSS manda
    } else {
      dropdownMenu.style.display = "none";   // oculto completo sin sesión
    }
  }
});

// ==============================
// Escuchar cambios de auth
// ==============================

supabaseClient.auth.onAuthStateChange((event, session) => {
  console.log("Auth event:", event);
  updateNavbarForSession(session);

  const marketplaceHero = document.getElementById("marketplace-hero");
  if (marketplaceHero) {
    marketplaceHero.style.display = session ? "flex" : "none";
  }

  updateResiduosPathsForSession(session);
  updateResiduosDropdownForSession(session);

  const menuResiduos = document.getElementById("menu-residuos");
  const dropdownMenu = menuResiduos?.querySelector(".dropdown-menu");
  if (dropdownMenu) {
    if (session && session.user) {
      dropdownMenu.style.display = "";
    } else {
      dropdownMenu.style.display = "none";
    }
  }
});

// ==============================
// Formulario de empresas
// ==============================

function setupForm() {
  const form = document.getElementById("empresa-form");
  const statusEl = document.getElementById("form-status");

  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    statusEl.textContent = "Enviando información...";
    statusEl.className = "form-status";

    const empresa = document.getElementById("empresa").value.trim();
    const correo = document.getElementById("correo").value.trim();
    const mensaje = document.getElementById("mensaje").value.trim();

    if (!empresa || !correo) {
      statusEl.textContent = "Por favor, completa los campos obligatorios.";
      statusEl.classList.add("error");
      return;
    }

    try {
      const { error } = await supabaseClient
        .from("empresas_registro")
        .insert([
          {
            empresa: empresa,
            correo: correo,
            mensaje: mensaje || null,
          },
        ]);

      if (error) {
        console.error(error);
        statusEl.textContent =
          "Ocurrió un error al enviar tu información. Intenta de nuevo.";
        statusEl.classList.add("error");
        return;
      }

      // Avisar por correo. Si esto falla no pasa nada grave:
      // el mensaje ya quedó guardado en la tabla empresas_registro.
      fetch("/api/contacto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empresa, correo, mensaje }),
      }).catch((err) => console.error("No se pudo enviar la notificación:", err));

      form.reset();
      statusEl.textContent =
        "¡Gracias! Tu información se envió correctamente. Nos pondremos en contacto contigo pronto.";
      statusEl.classList.add("success");
    } catch (err) {
      console.error(err);
      statusEl.textContent =
        "Ocurrió un error inesperado. Intenta nuevamente en unos minutos.";
      statusEl.classList.add("error");
    }
  });
}

// ==============================
// Año en el footer
// ==============================

function setupYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

// ==============================
// DOMContentLoaded: lógica de UI
// ==============================

document.addEventListener("DOMContentLoaded", async () => {
  setupForm();
  setupYear();

  const authModal = document.getElementById("auth-modal");
  const authModalClose = document.getElementById("auth-modal-close");
  const tabSignup = document.getElementById("tab-signup");
  const tabLogin = document.getElementById("tab-login");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const signupStatus = document.getElementById("signup-status");
  const loginStatus = document.getElementById("login-status");

  // Modal auth
  if (loginButton && authModal) {
    loginButton.addEventListener("click", () => {
      const signupCompanyInput = document.getElementById("signup-company");
      const signupCompanyTypeSelect = document.getElementById("signup-company-type");
      const signupEmailInput = document.getElementById("signup-email");
      const signupPasswordInput = document.getElementById("signup-password");
      const loginEmailInput = document.getElementById("login-email");
      const loginPasswordInput = document.getElementById("login-password");

      if (signupCompanyInput) signupCompanyInput.value = "";
      if (signupCompanyTypeSelect) signupCompanyTypeSelect.value = "";
      if (signupEmailInput) signupEmailInput.value = "";
      if (signupPasswordInput) signupPasswordInput.value = "";
      if (loginEmailInput) loginEmailInput.value = "";
      if (loginPasswordInput) loginPasswordInput.value = "";

      if (signupStatus) {
        signupStatus.textContent = "";
        signupStatus.className = "form-status";
      }
      if (loginStatus) {
        loginStatus.textContent = "";
        loginStatus.className = "form-status";
      }

      authModal.style.display = "block";
      setAuthTab("signup");
    });
  }

  function closeAuthModal() {
    if (authModal) {
      authModal.style.display = "none";
    }
    if (signupStatus) {
      signupStatus.textContent = "";
      signupStatus.className = "form-status";
    }
    if (loginStatus) {
      loginStatus.textContent = "";
      loginStatus.className = "form-status";
    }
  }

  if (authModalClose) {
    authModalClose.addEventListener("click", closeAuthModal);
  }

  if (authModal) {
    authModal.addEventListener("click", (event) => {
      if (event.target === authModal) {
        closeAuthModal();
      }
    });
  }

  function setAuthTab(tab) {
    if (tab === "signup") {
      if (tabSignup) tabSignup.classList.add("auth-tab-active");
      if (tabLogin) tabLogin.classList.remove("auth-tab-active");
      if (signupForm) signupForm.style.display = "block";
      if (loginForm) loginForm.style.display = "none";
    } else {
      if (tabLogin) tabLogin.classList.add("auth-tab-active");
      if (tabSignup) tabSignup.classList.remove("auth-tab-active");
      if (signupForm) signupForm.style.display = "none";
      if (loginForm) loginForm.style.display = "block";
    }
  }

  if (tabSignup) {
    tabSignup.addEventListener("click", () => setAuthTab("signup"));
  }
  if (tabLogin) {
    tabLogin.addEventListener("click", () => setAuthTab("login"));
  }

  // Registro
  if (signupForm) {
    signupForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (signupStatus) {
        signupStatus.textContent = "Creando cuenta...";
        signupStatus.className = "form-status";
      }

      const companyName = document.getElementById("signup-company")?.value.trim();
      const email = document.getElementById("signup-email")?.value.trim();
      const companyType = document.getElementById("signup-company-type")?.value.trim();
      const password = document.getElementById("signup-password")?.value.trim();

      if (!companyName || !email || !companyType || !password) {
        if (signupStatus) {
          signupStatus.textContent = "Completa todos los campos obligatorios.";
          signupStatus.classList.add("error");
        }
        return;
      }

      try {
        const { data, error } = await supabaseClient.auth.signUp({
          email: email,
          password: password,
          options: {
            data: {
              company_name: companyName,
              company_type: companyType,
            },
          },
        });

        if (error) {
          console.error("Error en registro:", error);
          if (signupStatus) {
            signupStatus.textContent =
              error.message || "No se pudo crear la cuenta.";
            signupStatus.classList.add("error");
          }
          return;
        }

        const user = data.user;
        if (!user) {
          if (signupStatus) {
            signupStatus.textContent =
              "Cuenta creada, pero no se pudo obtener el usuario.";
            signupStatus.classList.add("error");
          }
          return;
        }

        // El perfil YA está creado a estas alturas.
        //
        // El signUp de arriba manda company_name y company_type en
        // options.data, y el trigger crear_perfil() los copia a la tabla
        // profiles en la misma transacción que crea el usuario
        // (supabase/politicas.sql §2). No hay nada que guardar aquí.
        //
        // Aquí había un .update() sobre profiles que repetía esos dos
        // campos. Tenía dos problemas:
        //
        // 1. Era una carrera. Asumía que la fila ya existía; si el
        //    trigger no había corrido todavía, el update afectaba 0
        //    filas SIN devolver error y la cuenta se quedaba sin rol.
        //
        // 2. Desde que se aplicó la cláusula C3 del contrato de
        //    seguridad —revoke update on profiles, grant solo sobre
        //    (location, logo_url, updated_at)— ese update ya no puede
        //    funcionar nunca: company_type es inmutable desde el
        //    cliente a propósito, porque si no, cualquiera se cambia de
        //    rol enviando {company_type:"logistica"}. El resultado era
        //    "Cuenta creada, pero hubo un problema guardando el perfil"
        //    en cada alta, con la cuenta creada correctamente.
        //
        // Ver CONTRATO-RLS.md, cláusula C3.

        if (signupStatus) {
          signupStatus.textContent =
            "Cuenta creada. Ya puedes iniciar sesión.";
          signupStatus.classList.add("success");
        }

        const signupCompanyInput = document.getElementById("signup-company");
        const signupCompanyTypeSelect = document.getElementById("signup-company-type");
        const signupEmailInput = document.getElementById("signup-email");
        const signupPasswordInput = document.getElementById("signup-password");

        if (signupCompanyInput) signupCompanyInput.value = "";
        if (signupCompanyTypeSelect) signupCompanyTypeSelect.value = "";
        if (signupEmailInput) signupEmailInput.value = "";
        if (signupPasswordInput) signupPasswordInput.value = "";

        setTimeout(() => {
          closeAuthModal();
        }, 1500);
      } catch (err) {
        console.error(err);
        if (signupStatus) {
          signupStatus.textContent =
            "Ocurrió un error inesperado. Intenta más tarde.";
          signupStatus.classList.add("error");
        }
      }
    });
  }

  // Login
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (loginStatus) {
        loginStatus.textContent = "Iniciando sesión...";
        loginStatus.className = "form-status";
      }

      const email = document.getElementById("login-email")?.value.trim();
      const password = document.getElementById("login-password")?.value.trim();

      if (!email || !password) {
        if (loginStatus) {
          loginStatus.textContent = "Completa correo y contraseña.";
          loginStatus.classList.add("error");
        }
        return;
      }

      try {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: email,
          password: password,
        });

        if (error) {
          console.error("Error en login:", error);
          if (loginStatus) {
            loginStatus.textContent =
              "Credenciales inválidas o error al iniciar sesión.";
            loginStatus.classList.add("error");
          }
          return;
        }

        if (loginStatus) {
          loginStatus.textContent = "Sesión iniciada correctamente.";
          loginStatus.classList.add("success");
        }

        const loginEmailInput = document.getElementById("login-email");
        const loginPasswordInput = document.getElementById("login-password");
        if (loginEmailInput) loginEmailInput.value = "";
        if (loginPasswordInput) loginPasswordInput.value = "";

        setTimeout(() => {
          closeAuthModal();
        }, 800);
      } catch (err) {
        console.error(err);
        if (loginStatus) {
          loginStatus.textContent =
            "Ocurrió un error inesperado. Intenta más tarde.";
          loginStatus.classList.add("error");
        }
      }
    });
  }

  // Logout
  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      try {
        await supabaseClient.auth.signOut();
      } catch (err) {
        console.error("Error al cerrar sesión:", err);
      }
    });
  }

  // Scroll suave solo en index y para anchors internos (#...)
const navAnchors = document.querySelectorAll(".nav-links a");

navAnchors.forEach((link) => {
  const href = link.getAttribute("href");

  // Solo manejar links tipo "#impacto" cuando estamos en index
  const isInternalAnchor = href && href.startsWith("#");
  const isIndexPage = window.location.pathname.endsWith("index.html") ||
                      window.location.pathname === "/" ;

  if (isInternalAnchor && isIndexPage) {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = href.substring(1);
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const navbar = document.querySelector(".navbar");
      const navbarHeight = navbar ? navbar.offsetHeight : 64;
      const rect = targetEl.getBoundingClientRect();
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const targetY = rect.top + scrollTop - navbarHeight;

      window.scrollTo({
        top: targetY,
        behavior: "smooth",
      });
    });
  }
});

  // "Mi cuenta" → profile.html
  if (accountLabel) {
    accountLabel.addEventListener("click", () => {
      window.location.href = "profile.html";
    });
  }

 // === Hamburguesa ===
  const hamburgerBtn = document.getElementById("hamburger-btn");
  const navLinksContainer = document.getElementById("nav-links");

  if (hamburgerBtn && navLinksContainer) {
    hamburgerBtn.addEventListener("click", () => {
      navLinksContainer.classList.toggle("nav-open");
    });
  }
});
