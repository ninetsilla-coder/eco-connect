// ==============================================================
// Storage: subida de archivos
// ==============================================================
// CONVENCIÓN OBLIGATORIA: toda ruta empieza por `${usuarioId}/`.
// Es lo que hace posible la política per-usuario de storage.objects
// (supabase/politicas.sql §11). Ninguna subida debe saltársela.
// ==============================================================

import { supabaseClient } from "./supabase.js";

// Documentación regulatoria: no debe ser legible por URL adivinada.
export const BUCKETS_PRIVADOS = new Set(["gestion-ambiental", "docs-transporte"]);

export function esPrivado(bucket) {
  return BUCKETS_PRIVADOS.has(bucket);
}

// Sube varios archivos y devuelve sus rutas (no URLs).
// La ruta es lo que conviene guardar en la base: sobrevive a que el
// bucket cambie de público a privado. Para pintar, usar referenciar().
export async function subirArchivos(bucket, usuarioId, archivos, { subcarpeta = "" } = {}) {
  const rutas = [];

  for (const archivo of Array.from(archivos ?? [])) {
    const extension = archivo.name.split(".").pop();
    const prefijo = subcarpeta ? `${usuarioId}/${subcarpeta}` : `${usuarioId}`;
    const ruta = `${prefijo}/${crypto.randomUUID()}.${extension}`;

    const { error } = await supabaseClient.storage
      .from(bucket)
      .upload(ruta, archivo, { cacheControl: "3600", upsert: false });

    if (error) {
      console.error(`Error subiendo a ${bucket}:`, error);
      throw error;
    }
    rutas.push(ruta);
  }

  return rutas;
}

export function urlPublica(bucket, ruta) {
  return supabaseClient.storage.from(bucket).getPublicUrl(ruta).data.publicUrl;
}

export async function urlFirmada(bucket, ruta, segundos = 3600) {
  const { data, error } = await supabaseClient.storage
    .from(bucket)
    .createSignedUrl(ruta, segundos);

  if (error) {
    console.error(`Error firmando ${bucket}/${ruta}:`, error);
    return null;
  }
  return data.signedUrl;
}

// Convierte lo guardado en la base a algo pintable.
// Acepta rutas nuevas y URLs completas de filas antiguas: durante la
// transición conviven las dos formas en las mismas columnas.
export async function referenciar(bucket, valor) {
  if (!valor) return null;

  const esUrlCompleta = valor.startsWith("http");

  if (!esPrivado(bucket)) {
    return esUrlCompleta ? valor : urlPublica(bucket, valor);
  }

  // Bucket privado: de una URL antigua se recupera la ruta para firmarla.
  const ruta = esUrlCompleta ? valor.split(`/${bucket}/`).pop() : valor;
  return urlFirmada(bucket, ruta);
}
