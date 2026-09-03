// ==============================================================
// Tabla: servicios_transporte
// ==============================================================

import { supabaseClient } from "../core/supabase.js";
import { subirArchivos, urlPublica } from "../core/almacenamiento.js";

const BUCKET = "fotos-transporte";

export const ESTADO_ACTIVO = "activo";
export const ESTADO_INACTIVO = "inactivo";

export async function listarActivos() {
  const { data, error } = await supabaseClient
    .from("servicios_transporte")
    .select("*")
    .eq("estado", ESTADO_ACTIVO);

  if (error) throw error;
  return data ?? [];
}

// Catálogo con filtros opcionales de texto.
export async function buscarActivos({ tipo, zona } = {}) {
  let consulta = supabaseClient
    .from("servicios_transporte")
    .select("*")
    .eq("estado", ESTADO_ACTIVO);

  if (tipo) consulta = consulta.ilike("tipo_transporte", `%${tipo}%`);
  if (zona) consulta = consulta.ilike("zona_cobertura", `%${zona}%`);

  const { data, error } = await consulta.order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function listarMisServicios(usuarioId) {
  const { data, error } = await supabaseClient
    .from("servicios_transporte")
    .select("*")
    .eq("user_id", usuarioId);

  if (error) throw error;
  return data ?? [];
}

export async function listarMisServiciosResumidos(usuarioId) {
  const { data, error } = await supabaseClient
    .from("servicios_transporte")
    .select("id, tipo_transporte, zona_cobertura")
    .eq("user_id", usuarioId);

  if (error) throw error;
  return data ?? [];
}

export async function obtenerServicio(id) {
  const { data, error } = await supabaseClient
    .from("servicios_transporte")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Una foto que falle no aborta la publicación: se registra y se sigue.
export async function subirFotosVehiculo(usuarioId, archivos) {
  const urls = [];

  for (const archivo of Array.from(archivos ?? [])) {
    try {
      const [ruta] = await subirArchivos(BUCKET, usuarioId, [archivo]);
      urls.push(urlPublica(BUCKET, ruta));
    } catch (err) {
      console.error("Error subiendo foto del vehículo:", err);
    }
  }

  return urls;
}

export async function publicarServicio(usuarioId, datos, archivos) {
  const fotos = archivos?.length ? await subirFotosVehiculo(usuarioId, archivos) : [];

  const { data, error } = await supabaseClient
    .from("servicios_transporte")
    .insert([
      {
        user_id: usuarioId,
        tipo_transporte: datos.tipoTransporte,
        capacidad_carga: datos.capacidadCarga,
        tipos_residuos: datos.tiposResiduos,
        zona_cobertura: datos.zonaCobertura,
        disponibilidad: datos.disponibilidad,
        descripcion: datos.descripcion || null,
        estado: ESTADO_ACTIVO,
        fotos_urls: fotos.length ? fotos : null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// El .eq("user_id") es defensa en profundidad, NO el control de acceso.
// Lo que impide tocar servicios ajenos son las políticas
// servicios_actualiza y servicios_borra (politicas.sql §6).
export async function cambiarEstadoServicio(id, usuarioId, estado) {
  const { data, error } = await supabaseClient
    .from("servicios_transporte")
    .update({ estado })
    .eq("id", id)
    .eq("user_id", usuarioId)
    .select("estado")
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function eliminarServicio(id, usuarioId) {
  const { error } = await supabaseClient
    .from("servicios_transporte")
    .delete()
    .eq("id", id)
    .eq("user_id", usuarioId);

  if (error) throw error;
}

// ==============================================================
// transporte_documentacion (solo lectura)
// ==============================================================

export async function listarDocumentacion(idsServicios) {
  let consulta = supabaseClient
    .from("transporte_documentacion")
    .select("servicio_transporte_id, tipo");

  if (idsServicios?.length) {
    consulta = consulta.in("servicio_transporte_id", idsServicios);
  }

  const { data, error } = await consulta;
  if (error) throw error;
  return data ?? [];
}

// Devuelve { [servicioId]: Set<tipo> }.
export function agruparDocumentacion(filas) {
  const mapa = {};
  filas.forEach(({ servicio_transporte_id, tipo }) => {
    (mapa[servicio_transporte_id] ??= new Set()).add(tipo);
  });
  return mapa;
}
