// ==============================================================
// Tabla: profiles
// ==============================================================

import { supabaseClient } from "../core/supabase.js";
import { subirArchivos, urlPublica } from "../core/almacenamiento.js";

const BUCKET_LOGOS = "company-logos";

// Los identificadores internos (`proveedor`, `logistica`) no cambian:
// de ellos cuelgan mi_rol() y las cinco políticas de escritura del
// CONTRATO-RLS. Aquí solo se traduce a lo que lee el usuario, que es
// el vocabulario de docs/documento-maestro.md §05.
export const ETIQUETAS_ROL = {
  comprador: "Comprador industrial",
  proveedor: "Generador de residuos",
  logistica: "Transportista",
};

export function etiquetaRol(rol) {
  return ETIQUETAS_ROL[rol] ?? "—";
}

export async function obtenerPerfil(usuarioId) {
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", usuarioId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Solo location y logo_url son escribibles desde el navegador.
//
// company_type NO se puede tocar aquí: politicas.sql §4 revoca el
// UPDATE general sobre profiles y concede solo esas columnas. Sin ese
// permiso a nivel de columna, cualquiera se cambiaría de rol enviando
// {company_type:'logistica'} — RLS por sí sola no filtra columnas.
export async function actualizarPerfil(usuarioId, { location, logo_url }) {
  const cambios = { location: location ?? null, updated_at: new Date().toISOString() };
  if (logo_url) cambios.logo_url = logo_url;

  const { error } = await supabaseClient
    .from("profiles")
    .update(cambios)
    .eq("id", usuarioId);

  if (error) throw error;
}

export async function subirLogo(usuarioId, archivo) {
  const [ruta] = await subirArchivos(BUCKET_LOGOS, usuarioId, [archivo]);
  return urlPublica(BUCKET_LOGOS, ruta);
}
