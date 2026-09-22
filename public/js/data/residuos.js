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

// Comisión de EcoConnect: 3% del valor del lote, la paga el comprador
// (documento maestro §12). Vive aquí porque es un dato del negocio, no
// una decoración: si algún día cambia, cambia en un solo sitio.
export const COMISION = 0.03;

const DINERO = new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN", maximumFractionDigits: 0,
});

const numero = (valor) => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// Precio unitario × cantidad, más la comisión. Devuelve null si a la
// publicación le falta alguno de los dos: las anteriores al 2026-09-22
// no tienen precio, y es mejor no enseñar nada que enseñar "$0".
export function totalesDeLote(residuo) {
  const precio = numero(residuo?.precio);
  const cantidad = numero(residuo?.cantidad_lote);
  if (!precio || !cantidad) return null;

  const lote = precio * cantidad;
  const comision = lote * COMISION;
  return { precio, cantidad, lote, comision, total: lote + comision };
}

// "$4,000/t · Lote de 10 t: $40,000 + comisión EcoConnect 3% ($1,200)"
export function textoPrecio(residuo) {
  const totales = totalesDeLote(residuo);
  if (!totales) return "";

  const unidad = residuo.unidad || "t";
  return `${DINERO.format(totales.precio)}/${unidad} · ` +
    `Lote de ${totales.cantidad} ${unidad}: ${DINERO.format(totales.lote)} ` +
    `+ comisión EcoConnect ${COMISION * 100}% (${DINERO.format(totales.comision)})`;
}

// La cantidad como se lee. Las publicaciones nuevas traen número y
// unidad separados; las viejas, una sola cadena de texto libre
// ("500 kg por mes"), que se devuelve tal cual.
export function textoCantidad(residuo) {
  const cantidad = numero(residuo?.cantidad_lote);
  if (cantidad) return `${cantidad} ${residuo.unidad || ""}`.trim();
  return residuo?.cantidad || "";
}

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
      // `tipo` guarda el NOMBRE del material del catálogo, no texto
      // libre. Se conserva la columna a propósito: la búsqueda del
      // comprador y las publicaciones anteriores al 2026-09-22 cuelgan
      // de ella.
      tipo: datos.tipo || null,
      material_clave: datos.materialClave || null,
      categoria: datos.categoria,
      // `cantidad` (texto) se sigue escribiendo con la versión legible
      // de las dos columnas nuevas. Es un dato repetido y se asume: hay
      // pantallas y filas viejas que solo entienden esta columna, y
      // dejarla vacía las dejaría en blanco sin dar ningún error.
      cantidad: datos.cantidadTexto || null,
      cantidad_lote: datos.cantidadLote ?? null,
      unidad: datos.unidad || null,
      precio: datos.precio ?? null,
      ubicacion: datos.ubicacion || null,
      frecuencia: datos.frecuencia || null,
      nivel_procesamiento: datos.nivelProcesamiento || null,
      estado_residuo: datos.estadoResiduo || null,
      condicion_detalle: datos.condicionDetalle || null,
      humedad: datos.humedad ?? null,
      descripcion: datos.descripcion || null,
      // Sin la declaración no se publica: es la tercera capa contra los
      // residuos peligrosos (documento maestro §04).
      declaracion_no_peligroso: datos.declaracion === true,
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
