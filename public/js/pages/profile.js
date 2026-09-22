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

  // "Mi rol" en singular contradecía la lista de tipos de empresa de
  // más abajo, que puede traer tres. Se dice cuál manda —el que decide
  // menú y permisos— y cuáles se registraron además.
  const tipo = el("profile-company-type");
  if (tipo) {
    const principal = etiquetaRol(perfil?.company_type);
    const otros = (perfil?.roles || [])
      .filter((rol) => rol !== perfil?.company_type)
      .map(etiquetaRol)
      .filter((etiqueta) => etiqueta !== "—");
    tipo.textContent = otros.length
      ? `Rol principal: ${principal} · También registrada como: ${otros.join(", ")}`
      : `Rol principal: ${principal}`;
  }

  const comercial = el("profile-trade-name");
  if (comercial) comercial.textContent = perfil?.nombre_comercial || "—";

  const rfc = el("profile-rfc");
  if (rfc) rfc.textContent = perfil?.rfc || "—";

  // Los roles marcados al registrarse. El menú solo usa el principal
  // (D-3), pero aquí se ven todos: es la única pantalla donde se puede
  // comprobar que el dato se guardó completo.
  const roles = el("profile-roles");
  if (roles) {
    const lista = (perfil?.roles || []).map(etiquetaRol).filter((x) => x !== "—");
    roles.textContent = lista.length ? lista.join(" · ") : "—";
  }

  const correo = el("profile-email");
  if (correo) correo.textContent = perfil?.email || usuario.email || "—";

  const ubicacion = el("profile-location");
  if (ubicacion) ubicacion.textContent = perfil?.location || "No especificada";

  const desde = el("profile-member-since");
  if (desde && perfil?.created_at) {
    desde.textContent = `Miembro Eco Connect desde: ${new Date(perfil.created_at).getFullYear()}`;
  }

  // El Score todavía no se calcula (docs/plan-de-trabajo.md, bloque 3):
  // hasta entonces se dice qué lo activa, no un número inventado.
  const score = el("profile-certification");
  if (score) score.textContent = "EcoConnect Score: se calcula con tu primera operación";

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
