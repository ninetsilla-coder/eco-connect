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

const VACIO = { session: null, usuario: null, perfil: null, rol: null };

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
  return estado;
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
