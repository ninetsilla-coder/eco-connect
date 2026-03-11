// ==============================
// Conexión a Supabase
// ==============================
const SUPABASE_URL = "https://afutqmvovdkqyxopdcfo.supabase.co";
const SUPABASE_KEY = "sb_publishable_P7aBG_DaIGC2fKZR7UaQBw_wdI1BU3R";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Navbar
const logoutButton = document.getElementById("logout-button");
const accountLabel = document.getElementById("account-label");

// Campos de perfil
const companyNameEl = document.getElementById("profile-company-name");
const companyTypeEl = document.getElementById("profile-company-type");
const memberSinceEl = document.getElementById("profile-member-since");
const certificationEl = document.getElementById("profile-certification");
const locationEl = document.getElementById("profile-location");
const emailEl = document.getElementById("profile-email");

// Logo
const profileLogoEl = document.getElementById("profile-logo");
const profileLogoFallbackEl = document.getElementById("profile-logo-fallback");

// Modal edición
const editProfileButton = document.getElementById("edit-profile-button");
const editProfileModal = document.getElementById("edit-profile-modal");
const editProfileClose = document.getElementById("edit-profile-close");
const editLocationInput = document.getElementById("edit-location");
const editLogoInput = document.getElementById("edit-logo");
const saveProfileButton = document.getElementById("save-profile-button");
const editProfileStatus = document.getElementById("edit-profile-status");

function setupYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

function openEditModal() {
  if (editProfileModal) {
    editProfileModal.style.display = "block";
  }
}

function closeEditModal() {
  if (editProfileModal) {
    editProfileModal.style.display = "none";
  }
  if (editProfileStatus) {
    editProfileStatus.textContent = "";
    editProfileStatus.className = "form-status";
  }
}

// Cargar perfil desde Supabase
async function loadProfile() {
  const { data, error } = await supabaseClient.auth.getUser();
  if (error || !data.user) {
    window.location.href = "index.html";
    return;
  }

  const user = data.user;

  const { data: profile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Error cargando perfil:", profileError);
    return;
  }

  if (companyNameEl) companyNameEl.textContent = profile.company_name || "Sin nombre";

if (companyTypeEl) {
  let rolTexto = "Mi rol en EcoConnect: —";

  if (profile.company_type === "comprador") {
    rolTexto = "Mi rol en EcoConnect: Comprador industrial";
  } else if (profile.company_type === "proveedor") {
    rolTexto = "Mi rol en EcoConnect: Proveedor de residuos";
  } else if (profile.company_type === "logistica") {
    rolTexto = "Mi rol en EcoConnect: Proveedor de transporte y logística";
  }

  companyTypeEl.textContent = rolTexto;
}

  if (emailEl) emailEl.textContent = profile.email || user.email || "—";

  if (locationEl) {
    locationEl.textContent = profile.location || "No especificada";
  }

  if (memberSinceEl && profile.created_at) {
    const year = new Date(profile.created_at).getFullYear();
    memberSinceEl.textContent = `Miembro Eco Connect desde: ${year}`;
  }

  if (certificationEl) {
    certificationEl.textContent = "Certificación: No verificado";
  }

  if (editLocationInput) {
    editLocationInput.value = profile.location || "";
  }

  // Logo si existe
  if (profileLogoEl && profile.logo_url) {
    const img = document.createElement("img");
    img.src = profile.logo_url;
    img.alt = "Logo de la empresa";

    profileLogoEl.innerHTML = "";
    profileLogoEl.appendChild(img);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupYear();
  loadProfile();

  // === PERSONALIZAR DROPDOWN EN PROFILE ===
  supabaseClient.auth.getSession().then(async ({ data, error }) => {
    if (error || !data.session || !data.session.user) return;

    const dropdownMenu = document.getElementById("dropdown-residuos");
    if (!dropdownMenu) return;

    const allLinks = dropdownMenu.querySelectorAll("a[data-role]");
    allLinks.forEach((link) => {
      link.style.display = "none";
    });

    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("company_type")
      .eq("id", data.session.user.id)
      .maybeSingle();

    if (profileError || !profile?.company_type) return;

    const linksForRole = dropdownMenu.querySelectorAll(
      `a[data-role="${profile.company_type}"]`
    );
    linksForRole.forEach((link) => {
      link.style.display = "block";
    });
  });
  // === FIN DROPDOWN ===

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      window.location.href = "index.html";
    });
  }

  // "Mi cuenta" en profile.html no redirige
  if (accountLabel) {
    accountLabel.style.cursor = "default";
  }

  if (editProfileButton) {
    editProfileButton.addEventListener("click", openEditModal);
  }
  if (editProfileClose) {
    editProfileClose.addEventListener("click", closeEditModal);
  }
  if (editProfileModal) {
    editProfileModal.addEventListener("click", (event) => {
      if (event.target === editProfileModal) {
        closeEditModal();
      }
    });
  }

  if (saveProfileButton) {
    saveProfileButton.addEventListener("click", async () => {
      if (editProfileStatus) {
        editProfileStatus.textContent = "Guardando...";
        editProfileStatus.className = "form-status";
      }

      const { data, error } = await supabaseClient.auth.getUser();
      if (error || !data.user) {
        window.location.href = "index.html";
        return;
      }

      const user = data.user;
      const locationValue = editLocationInput?.value.trim() || null;

      let logoUrlToSave = null;

      const file = editLogoInput?.files && editLogoInput.files[0];
      if (file) {
        try {
          const fileExt = file.name.split(".").pop();
          const fileName = `${Date.now()}.${fileExt}`;
          const filePath = `${user.id}/${fileName}`;

          const { error: uploadError } = await supabaseClient.storage
            .from("company-logos")
            .upload(filePath, file);

          if (uploadError) {
            console.error("Error subiendo logo:", uploadError);
            if (editProfileStatus) {
              editProfileStatus.textContent =
                "No se pudo subir el logo. Intenta con otra imagen.";
              editProfileStatus.classList.add("error");
            }
            return;
          }

          const { data: publicUrlData } = supabaseClient.storage
            .from("company-logos")
            .getPublicUrl(filePath);

          logoUrlToSave = publicUrlData.publicUrl;
        } catch (uploadErr) {
          console.error("Error inesperado subiendo logo:", uploadErr);
          if (editProfileStatus) {
            editProfileStatus.textContent =
              "Ocurrió un error subiendo el logo.";
            editProfileStatus.classList.add("error");
          }
          return;
        }
      }

      const updatePayload = {
        location: locationValue,
        updated_at: new Date().toISOString(),
      };

      if (logoUrlToSave) {
        updatePayload.logo_url = logoUrlToSave;
      }

      const { error: updateError } = await supabaseClient
        .from("profiles")
        .update(updatePayload)
        .eq("id", user.id);

      if (updateError) {
        console.error("Error actualizando perfil:", updateError);
        if (editProfileStatus) {
          editProfileStatus.textContent =
            "No se pudo guardar el perfil. Intenta de nuevo.";
          editProfileStatus.classList.add("error");
        }
        return;
      }

      if (editProfileStatus) {
        editProfileStatus.textContent = "Perfil actualizado correctamente.";
        editProfileStatus.classList.add("success");
      }

      if (locationEl) {
        locationEl.textContent = locationValue || "No especificada";
      }

      if (logoUrlToSave && profileLogoEl) {
        const img = document.createElement("img");
        img.src = logoUrlToSave;
        img.alt = "Logo de la empresa";
        profileLogoEl.innerHTML = "";
        profileLogoEl.appendChild(img);
      }

      setTimeout(() => {
        closeEditModal();
      }, 1000);
    });
  }
});
