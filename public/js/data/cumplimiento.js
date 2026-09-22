// ==============================================================
// Tabla: residuos_gestion_ambiental   (SOLO LECTURA)
// ==============================================================
// Lo que queda de la documentación de cumplimiento anterior al
// expediente. Este módulo ya no escribe nada:
//
//   gestión ambiental        su página se borró el 2026-09-22 (D-5)
//   cumplimiento_transporte  su página se borró el mismo día, al
//                            terminar el bloque del transportista en el
//                            expediente
//
// Lo único que sobrevive es la LECTURA de lo que ya estaba guardado:
// `mis-residuos` sigue enseñando qué residuos tienen documentación de
// gestión. Las dos tablas, sus buckets y sus políticas siguen intactos
// —los datos no se tiran— hasta que se decida qué hacer con ellos.
// ==============================================================

import { supabaseClient } from "../core/supabase.js";

export const BUCKET_GESTION = "gestion-ambiental";

export const TIPOS_GESTION = ["documentacion", "condiciones", "practicas"];

// ==============================================================
// Gestión ambiental (proveedor)
// ==============================================================

export async function listarGestionDeUsuario(usuarioId) {
  const { data, error } = await supabaseClient
    .from("residuos_gestion_ambiental")
    .select("id, residuo_id, tipo, descripcion, fotos, created_at")
    .eq("user_id", usuarioId);

  if (error) throw error;
  return data ?? [];
}

export async function listarGestionDeResiduos(idsResiduos) {
  if (!idsResiduos?.length) return [];

  const { data, error } = await supabaseClient
    .from("residuos_gestion_ambiental")
    .select("id, residuo_id, tipo")
    .in("residuo_id", idsResiduos);

  if (error) throw error;
  return data ?? [];
}

// Devuelve { [residuoId]: Set<tipo> } para pintar los badges.
export function agruparPorResiduo(filas) {
  const mapa = {};
  filas.forEach(({ residuo_id, tipo }) => {
    (mapa[residuo_id] ??= new Set()).add(tipo);
  });
  return mapa;
}

// La escritura de gestión ambiental se fue con su página el
// 2026-09-22 (decisión D-5): el expediente la sustituye, porque pedía
// los mismos papeles a todos los roles en vez de los de cada uno.
//
// La tabla queda de SOLO LECTURA desde la aplicación: lo que ya se
// subió se sigue viendo en "Mis residuos", pero no se crean filas
// nuevas. Sus políticas de escritura siguen en politicas.sql §8 a
// propósito —los datos y el bucket no se tocan— y ahí seguirán hasta
// que se decida qué hacer con lo guardado.

