// ==============================================================
// Sesión y perfil — resueltos UNA sola vez  (CLAUDE.md §4.3)
// ==============================================================
// Antes, script.js consultaba profiles dos veces por carga (una para
// los "paths" del home y otra para el dropdown), y repetía ambas en
// cada evento de auth. Aquí se resuelve una vez y se cachea.
//
// Estado que expone:
//   { session, usuario, perfil, rol }
// con rol = perfil.company_type, o null si no hay sesión.
// ==============================================================

import { supabaseClient } from "./supabase.js";

const VACIO = { session: null, usuario: null, perfil: null, rol: null, estado: null };

let cache = null;
let enCurso = null;
let listenerInstalado = false;
const suscriptores = new Set();

async function cargar() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) console.error("Error obteniendo la sesión:", error);

  const session = data?.session ?? null;
  if (!session?.user) return VACIO;

  const { data: perfil, error: errorPerfil } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .maybeSingle();

  if (errorPerfil) console.error("Error obteniendo el perfil:", errorPerfil);

  return {
    session,
    usuario: session.user,
    perfil: perfil ?? null,
    rol: perfil?.company_type ?? null,
    // Las cuentas anteriores al 2026-09-22 no tienen estado. Se asume
    // `pendiente` y no `verificado`: si algo falla, que falle hacia el
    // lado que pide papeles, no hacia el que los da por buenos.
    estado: perfil ? (perfil.estado ?? "pendiente") : null,
  };
}

// Varias llamadas simultáneas comparten una sola consulta.
export async function obtenerSesion() {
  if (cache) return cache;
  if (!enCurso) {
    enCurso = cargar()
      .then((estado) => {
        cache = estado;
        return estado;
      })
      .finally(() => {
        enCurso = null;
      });
  }
  return enCurso;
}

export function invalidarSesion() {
  cache = null;
}

// Un único onAuthStateChange para toda la app; los módulos se
// enganchan aquí en vez de registrar su propio listener.
export function alCambiarSesion(callback) {
  suscriptores.add(callback);

  if (!listenerInstalado) {
    listenerInstalado = true;
    supabaseClient.auth.onAuthStateChange(async () => {
      invalidarSesion();
      const estado = await obtenerSesion();
      suscriptores.forEach((cb) => cb(estado));
    });
  }

  obtenerSesion().then((estado) => callback(estado));
  return () => suscriptores.delete(callback);
}

export async function cerrarSesion() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) console.error("Error al cerrar sesión:", error);
  invalidarSesion();
}

// ==============================================================
// Guardas de navegación
// ==============================================================
// ⚠️ Esto es EXPERIENCIA DE USUARIO, no seguridad. Evita que alguien
// aterrice en una página que no le sirve; no impide nada. Quien tenga
// la consola abierta puede llamar a la API igual. El control real son
// las políticas RLS (CONTRATO-RLS.md).

export async function requiereSesion(destino = "index.html") {
  const estado = await obtenerSesion();
  if (!estado.usuario) {
    window.location.href = destino;
    return null;
  }

  // La comprobación al cargar no basta: la sesión puede terminarse DESPUÉS
  // —al cerrarla aquí, al cerrarla en otra pestaña, al caducar— y quien
  // llamó a esta función se quedaría en una página que ya no le
  // corresponde, viéndola como si siguiera dentro.
  //
  // No es una guarda de seguridad: los datos ya no cargarían igualmente,
  // porque las políticas RLS los niegan sin sesión. Es no dejar a nadie
  // delante de una pantalla que miente.
  vigilarSalida(destino);

  return estado;
}

// Una sola vigilancia por página, aunque se llame a requiereSesion
// varias veces.
let vigilando = false;

function vigilarSalida(destino) {
  if (vigilando) return;
  vigilando = true;

  alCambiarSesion((nuevo) => {
    if (!nuevo.usuario) window.location.href = destino;
  });
}

export async function requiereRol(rolEsperado, destino = "index.html") {
  const estado = await requiereSesion(destino);
  if (!estado) return null;
  if (estado.rol !== rolEsperado) {
    window.location.href = destino;
    return null;
  }
  return estado;
}
