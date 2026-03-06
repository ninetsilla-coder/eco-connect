// Configuración de Supabase
const SUPABASE_URL = "https://afutqmvovdkqyxopdcfo.supabase.co";
const SUPABASE_KEY = "sb_publishable_P7aBG_DaIGC2fKZR7UaQBw_wdI1BU3R";

// Cargar cliente de Supabase desde CDN
const script = document.createElement("script");
script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";
script.onload = initSupabase;
document.head.appendChild(script);

let supabaseClient = null;

function initSupabase() {
  // Crear cliente
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // Inicializar eventos cuando todo esté listo
  setupForm();
  setupYear();
}

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
      const { data, error } = await supabaseClient
        .from("empresas_registro")
        .insert([
          {
            empresa: empresa,
            correo: correo,
            mensaje: mensaje || null
          }
        ]);

      if (error) {
        console.error(error);
        statusEl.textContent =
          "Ocurrió un error al enviar tu información. Intenta de nuevo.";
        statusEl.classList.add("error");
        return;
      }

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

function setupYear() {
  const yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}
// Ajustar scroll para que las secciones no queden tapadas por la navbar
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-links a[href^='#']");

  navLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.getAttribute("href").substring(1);
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const navbarHeight = document.querySelector(".navbar").offsetHeight || 64;
      const rect = targetEl.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const targetY = rect.top + scrollTop - navbarHeight;

      window.scrollTo({
        top: targetY,
        behavior: "smooth",
      });
    });
  });
});
