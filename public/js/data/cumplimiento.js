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

// La escritura de gestión ambiental se fue con su página el
// 2026-09-22 (decisión D-5): el expediente la sustituye, porque pedía
// los mismos papeles a todos los roles en vez de los de cada uno.
//
// La tabla queda de SOLO LECTURA desde la aplicación: lo que ya se
// subió se sigue viendo en "Mis residuos", pero no se crean filas
// nuevas. Sus políticas de escritura siguen en politicas.sql §8 a
// propósito —los datos y el bucket no se tocan— y ahí seguirán hasta
// que se decida qué hacer con lo guardado.

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

// Lo que el transportista ya registró para un servicio suyo, con las
// rutas de los archivos. `cumplimiento_propio` lo limita a su dueño; el
// filtro por user_id es defensa en profundidad.
//
// Devuelve el historial completo, del más reciente al más antiguo: cada
// envío del formulario añade una fila en vez de actualizar la anterior.
export async function listarCumplimientoDeServicio(usuarioId, servicioId) {
  const { data, error } = await supabaseClient
    .from("cumplimiento_transporte")
    .select(
      "id, created_at, permisos_urls, certificaciones_urls, seguros_urls, " +
        "practicas_manejo, practicas_regulaciones, practicas_procedimientos"
    )
    .eq("user_id", usuarioId)
    .eq("servicio_id", servicioId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ==============================================================
// Lectura de archivos
// ==============================================================
// Acepta rutas nuevas y URLs completas de filas antiguas: durante la
// transición conviven las dos formas en la misma columna.
//
// Con los buckets ya privados, `referenciar()` firma cada valor y la
// URL caduca. Se piden al pintar, no se guardan.

export async function urlsDeDocumentos(bucket, valores) {
  if (!valores?.length) return [];
  const urls = await Promise.all(valores.map((v) => referenciar(bucket, v)));
  return urls.filter(Boolean);
}

// Los tres grupos de un registro de transporte, listos para pintar.
// Devuelve [{ titulo, urls }, ...] — la forma que espera
// ui/documentos.js, que no sabe nada de Storage ni de esta tabla.
export async function documentosDeCumplimiento(registro) {
  const grupos = [
    ["Permisos", registro?.permisos_urls],
    ["Certificaciones", registro?.certificaciones_urls],
    ["Seguros", registro?.seguros_urls],
  ];

  return Promise.all(
    grupos.map(async ([titulo, valores]) => ({
      titulo,
      urls: await urlsDeDocumentos(BUCKET_TRANSPORTE, valores),
    }))
  );
}
