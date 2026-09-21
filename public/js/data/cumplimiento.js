// ==============================================================
// Tablas: residuos_gestion_ambiental y cumplimiento_transporte
// ==============================================================
// Documentación de cumplimiento. Sus buckets son los únicos que deben
// ser privados: guardan permisos y licencias, no fotos de catálogo.
// ==============================================================

import { supabaseClient } from "../core/supabase.js";
import { subirArchivos, referenciar } from "../core/almacenamiento.js";

export const BUCKET_GESTION = "gestion-ambiental";
export const BUCKET_TRANSPORTE = "docs-transporte";

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

export async function registrarGestion(usuarioId, { residuoId, tipo, descripcion }, archivos) {
  // Se guardan RUTAS, no URLs: el bucket pasará a privado y las URLs
  // públicas dejarían de resolver. referenciar() las firma al pintar.
  const fotos = archivos?.length
    ? await subirArchivos(BUCKET_GESTION, usuarioId, archivos, { subcarpeta: `${residuoId}/${tipo}` })
    : null;

  const { data, error } = await supabaseClient
    .from("residuos_gestion_ambiental")
    .insert({
      user_id: usuarioId,
      residuo_id: residuoId,
      tipo,
      descripcion: descripcion || null,
      fotos: fotos?.length ? fotos : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==============================================================
// Cumplimiento de transporte (logística)
// ==============================================================

// La lectura de "qué documentación tiene cada servicio" NO vive aquí:
// está en data/transporte.js, contra la vista transporte_cumplimiento_resumen
// (politicas.sql §8.1). Esta tabla guarda las rutas de los documentos y
// `cumplimiento_propio` la restringe a su dueño, así que un comprador
// nunca podrá leerla — ni debe.

// Sube un grupo de archivos a su carpeta. Un archivo que falle no
// aborta el resto: se registra y se sigue, como hacía la página.
export async function subirGrupoTransporte(usuarioId, servicioId, carpeta, entrada) {
  const archivos = Array.from(entrada?.files ?? []);
  const rutas = [];

  for (const archivo of archivos) {
    try {
      const [ruta] = await subirArchivos(BUCKET_TRANSPORTE, usuarioId, [archivo], {
        subcarpeta: `${servicioId}/${carpeta}`,
      });
      rutas.push(ruta);
    } catch (err) {
      console.error(`Error subiendo archivo (${carpeta}):`, err);
    }
  }

  return rutas;
}

// Se guardan RUTAS, no URLs públicas: docs-transporte pasará a privado
// y las URLs dejarían de resolver. urlsDeDocumentos() las firma al leer.
export async function registrarCumplimiento(usuarioId, datos) {
  const { data, error } = await supabaseClient
    .from("cumplimiento_transporte")
    .insert([
      {
        user_id: usuarioId,
        servicio_id: datos.servicioId,
        permisos_urls: datos.permisos?.length ? datos.permisos : null,
        certificaciones_urls: datos.certificaciones?.length ? datos.certificaciones : null,
        seguros_urls: datos.seguros?.length ? datos.seguros : null,
        practicas_manejo: datos.manejo || null,
        practicas_regulaciones: datos.regulaciones || null,
        practicas_procedimientos: datos.procedimientos || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==============================================================
// Lectura de archivos
// ==============================================================
// Acepta rutas nuevas y URLs completas de filas antiguas: durante la
// transición conviven las dos formas en la misma columna.

export async function urlsDeDocumentos(bucket, valores) {
  if (!valores?.length) return [];
  const urls = await Promise.all(valores.map((v) => referenciar(bucket, v)));
  return urls.filter(Boolean);
}
