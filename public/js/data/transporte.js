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
// Documentación de cumplimiento: qué tiene cada servicio
// ==============================================================
// Lee la vista transporte_cumplimiento_resumen (politicas.sql §8.1),
// no la tabla. La tabla guarda las rutas de permisos, licencias y
// seguros —documentación regulatoria ajena— y `cumplimiento_propio`
// la restringe a su dueño. La vista devuelve solo tres booleanos por
// servicio, que es lo único que necesita un badge.
//
// Antes esto leía `transporte_documentacion`, una tabla en la que no
// escribe nadie: el formulario de transporte responsable guarda en
// cumplimiento_transporte. Los badges del comprador salían siempre en
// "Sin documentación" por mucho que el transportista subiera sus
// papeles. Esa tabla queda sellada en politicas.sql §9.

export const TIPOS_DOCUMENTO = [
  ["Permisos", "tiene_permisos"],
  ["Certificaciones", "tiene_certificaciones"],
  ["Seguros", "tiene_seguros"],
];

export async function listarCumplimientoDeServicios(idsServicios) {
  if (!idsServicios?.length) return [];

  const { data, error } = await supabaseClient
    .from("transporte_cumplimiento_resumen")
    .select("servicio_id, tiene_permisos, tiene_certificaciones, tiene_seguros")
    .in("servicio_id", idsServicios);

  if (error) throw error;
  return data ?? [];
}

// Devuelve { [servicioId]: { tiene_permisos, ... } }.
export function agruparCumplimiento(filas) {
  const mapa = {};
  filas.forEach((fila) => {
    mapa[fila.servicio_id] = fila;
  });
  return mapa;
}

// Resume una fila de la vista para pintarla.
//
// `null` significa "este servicio no tiene ninguna fila": distinto de
// tenerla con los tres campos en false, que no debería ocurrir pero se
// trata igual. Un servicio sin documentación NO es un servicio con
// documentación incompleta, y el badge lo dice distinto.
export function resumirCumplimiento(fila) {
  const presentes = TIPOS_DOCUMENTO.map(([, clave]) => Boolean(fila?.[clave]));

  return {
    presentes,
    detalle: TIPOS_DOCUMENTO.map(
      ([etiqueta], i) => `${etiqueta} ${presentes[i] ? "✓" : "✗"}`
    ).join(" · "),
    completo: presentes.every(Boolean),
    alguno: presentes.some(Boolean),
  };
}
