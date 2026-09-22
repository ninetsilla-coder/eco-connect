// ==============================================================
// Tabla: intereses
// ==============================================================
// Un interés apunta a un residuo O a un servicio de transporte, según
// la columna `tipo`. La otra referencia va en null.
// ==============================================================

import { supabaseClient } from "../core/supabase.js";

export const TIPO_RESIDUO = "residuo";
export const TIPO_TRANSPORTE = "transporte";

const COLUMNA = {
  [TIPO_RESIDUO]: "residuo_id",
  [TIPO_TRANSPORTE]: "servicio_transporte_id",
};

export async function listarMisIntereses(usuarioId) {
  const { data, error } = await supabaseClient
    .from("intereses")
    .select(`
      id,
      created_at,
      tipo,
      residuo:residuos_publicados (
        id, tipo, categoria, cantidad, ubicacion, frecuencia,
        estado_residuo, descripcion, fotos, estado
      ),
      servicio:servicios_transporte (
        id, tipo_transporte, capacidad_carga, zona_cobertura,
        tipos_residuos, disponibilidad, descripcion, fotos_urls, estado
      )
    `)
    .eq("user_id", usuarioId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function existeInteres(usuarioId, tipo, referenciaId) {
  const { data, error } = await supabaseClient
    .from("intereses")
    .select("id")
    .eq("user_id", usuarioId)
    .eq("tipo", tipo)
    .eq(COLUMNA[tipo], referenciaId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export async function guardarInteres(usuarioId, tipo, referenciaId) {
  const { error } = await supabaseClient.from("intereses").insert({
    user_id: usuarioId,
    tipo,
    residuo_id: tipo === TIPO_RESIDUO ? referenciaId : null,
    servicio_transporte_id: tipo === TIPO_TRANSPORTE ? referenciaId : null,
  });

  if (error) throw error;
}

// El .eq("user_id") es defensa en profundidad, NO el control de acceso:
// lo que impide borrar intereses ajenos es la política intereses_borra
// (politicas.sql §7).
export async function eliminarInteres(id, usuarioId) {
  const { error } = await supabaseClient
    .from("intereses")
    .delete()
    .eq("id", id)
    .eq("user_id", usuarioId);

  if (error) throw error;
}
