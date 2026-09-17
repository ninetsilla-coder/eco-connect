// ==============================================================
// Tabla: residuos_publicados
// ==============================================================
// Antes estas consultas estaban repartidas en 6 archivos, cada una con
// su propio .select(). Aquí hay un solo punto de cambio.
// ==============================================================

import { supabaseClient } from "../core/supabase.js";
import { subirArchivos, urlPublica } from "../core/almacenamiento.js";

const BUCKET = "residuos-fotos";

export const ESTADO_DISPONIBLE = "disponible";

// Catálogo público. La política residuos_catalogo replica este filtro
// en el servidor; el .eq de aquí es solo para no traer de más.
export async function listarDisponibles() {
  const { data, error } = await supabaseClient
    .from("residuos_publicados")
    .select("*")
    .eq("estado", ESTADO_DISPONIBLE);

  if (error) throw error;
  return data ?? [];
}

// Búsqueda del catálogo con filtros opcionales de texto.
export async function buscarDisponibles({ tipo, ubicacion } = {}) {
  let consulta = supabaseClient
    .from("residuos_publicados")
    .select("*")
    .eq("estado", ESTADO_DISPONIBLE);

  if (tipo) consulta = consulta.ilike("tipo", `%${tipo}%`);
  if (ubicacion) consulta = consulta.ilike("ubicacion", `%${ubicacion}%`);

  const { data, error } = await consulta.order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listarMios(usuarioId) {
  const { data, error } = await supabaseClient
    .from("residuos_publicados")
    .select("*")
    .eq("user_id", usuarioId);

  if (error) throw error;
  return data ?? [];
}

export async function obtenerResiduo(id) {
  const { data, error } = await supabaseClient
    .from("residuos_publicados")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Para los selectores de gestión ambiental.
export async function listarMiosResumidos(usuarioId) {
  const { data, error } = await supabaseClient
    .from("residuos_publicados")
    .select("id, tipo, ubicacion, categoria")
    .eq("user_id", usuarioId);

  if (error) throw error;
  return data ?? [];
}

export async function subirFotos(usuarioId, archivos) {
  const rutas = await subirArchivos(BUCKET, usuarioId, archivos);
  return rutas.map((ruta) => urlPublica(BUCKET, ruta));
}

export async function publicarResiduo(usuarioId, datos, archivos) {
  const fotos = archivos?.length ? await subirFotos(usuarioId, archivos) : null;

  const { data, error } = await supabaseClient
    .from("residuos_publicados")
    .insert({
      user_id: usuarioId,
      // profiles.id es el mismo uuid que auth.users.id, así que la
      // consulta a profiles que había aquí era un viaje de más.
      company_id: usuarioId,
      tipo: datos.tipo || null,
      categoria: datos.categoria,
      cantidad: datos.cantidad || null,
      ubicacion: datos.ubicacion || null,
      frecuencia: datos.frecuencia || null,
      estado_residuo: datos.estadoResiduo || null,
      descripcion: datos.descripcion || null,
      fotos: fotos?.length ? fotos : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// El .eq("user_id") es defensa en profundidad, NO el control de acceso:
// quien ataque no usa esta página. Lo que de verdad impide tocar filas
// ajenas es la política residuos_actualiza (politicas.sql §5).
export async function cambiarEstadoResiduo(id, usuarioId, estado) {
  const { data, error } = await supabaseClient
    .from("residuos_publicados")
    .update({ estado })
    .eq("id", id)
    .eq("user_id", usuarioId)
    .select("estado")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function eliminarResiduo(id, usuarioId) {
  const { error } = await supabaseClient
    .from("residuos_publicados")
    .delete()
    .eq("id", id)
    .eq("user_id", usuarioId);

  if (error) throw error;
}
