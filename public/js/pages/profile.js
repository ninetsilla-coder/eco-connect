// ==============================================================
// Página: profile.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { requiereSesion, invalidarSesion } from "../core/sesion.js";
import { obtenerPerfil, actualizarPerfil, subirLogo, etiquetaRol } from "../data/perfiles.js";

montarNavbar({ cuentaClicable: false, destinoTrasLogout: "index.html" });

const el = (id) => document.getElementById(id);

const modal = el("edit-profile-modal");
const estadoEdicion = el("edit-profile-status");
const campoUbicacion = el("edit-location");
const campoLogo = el("edit-logo");

function mostrarEstado(texto, clase = "") {
  if (!estadoEdicion) return;
  estadoEdicion.textContent = texto;
  estadoEdicion.className = clase ? `form-status ${clase}` : "form-status";
}

function abrirModal() {
  if (modal) modal.style.display = "block";
}

function cerrarModal() {
  if (modal) modal.style.display = "none";
  mostrarEstado("");
}

function pintarLogo(url) {
  const contenedor = el("profile-logo");
  if (!contenedor || !url) return;

  const img = document.createElement("img");
  img.src = url;
  img.alt = "Logo de la empresa";
  contenedor.innerHTML = "";
  contenedor.appendChild(img);
}

function pintar(perfil, usuario) {
  const nombre = el("profile-company-name");
  if (nombre) nombre.textContent = perfil?.company_name || "Sin nombre";

  const tipo = el("profile-company-type");
  if (tipo) tipo.textContent = `Mi rol en EcoConnect: ${etiquetaRol(perfil?.company_type)}`;

  const correo = el("profile-email");
  if (correo) correo.textContent = perfil?.email || usuario.email || "—";

  const ubicacion = el("profile-location");
  if (ubicacion) ubicacion.textContent = perfil?.location || "No especificada";

  const desde = el("profile-member-since");
  if (desde && perfil?.created_at) {
    desde.textContent = `Miembro Eco Connect desde: ${new Date(perfil.created_at).getFullYear()}`;
  }

  const certificacion = el("profile-certification");
  if (certificacion) certificacion.textContent = "Certificación: No verificado";

  if (campoUbicacion) campoUbicacion.value = perfil?.location || "";

  pintarLogo(perfil?.logo_url);
}

// ==============================================================
// Arranque
// ==============================================================

const estado = await requiereSesion("index.html");
if (estado) {
  try {
    const perfil = await obtenerPerfil(estado.usuario.id);
    pintar(perfil, estado.usuario);
  } catch (err) {
    console.error("Error cargando perfil:", err);
  }
}

el("edit-profile-button")?.addEventListener("click", abrirModal);
el("edit-profile-close")?.addEventListener("click", cerrarModal);
modal?.addEventListener("click", (evento) => {
  if (evento.target === modal) cerrarModal();
});

el("save-profile-button")?.addEventListener("click", async () => {
  if (!estado?.usuario) return;

  mostrarEstado("Guardando...");
  const ubicacion = campoUbicacion?.value.trim() || null;
  const archivo = campoLogo?.files?.[0];

  try {
    let logoUrl = null;
    if (archivo) {
      logoUrl = await subirLogo(estado.usuario.id, archivo);
    }

    await actualizarPerfil(estado.usuario.id, { location: ubicacion, logo_url: logoUrl });

    // El perfil cacheado quedó viejo; la próxima lectura lo recarga.
    invalidarSesion();

    mostrarEstado("Perfil actualizado correctamente.", "success");

    const etiquetaUbicacion = el("profile-location");
    if (etiquetaUbicacion) etiquetaUbicacion.textContent = ubicacion || "No especificada";
    if (logoUrl) pintarLogo(logoUrl);

    setTimeout(cerrarModal, 1000);
  } catch (err) {
    console.error("Error guardando el perfil:", err);
    mostrarEstado("No se pudo guardar el perfil. Intenta de nuevo.", "error");
  }
});
