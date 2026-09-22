// ==============================================================
// Tabla: expediente_documentos
// ==============================================================
// Los permisos ambientales de cada empresa, por rol
// (docs/cambios-plataforma.md §2). Aquí viven las dos mitades:
//
//   EL CATÁLOGO  qué documentos pide cada rol y cuáles son obligatorios.
//                Es lógica pura y por eso está en `data/` y no en la
//                página: se puede probar sin navegador (CLAUDE.md §5.3).
//
//   LAS QUERIES  leer, guardar y enviar a revisión.
//
// ⚠️ El estado de cada documento (`pendiente` / `aprobado` / `rechazado`)
// lo mueve el equipo desde el panel de Supabase, no esta capa. Las
// columnas están fuera del `grant update` (politicas.sql §8.2): una
// empresa que se aprueba sus propios papeles vacía la revisión.
// ==============================================================

import { supabaseClient } from "../core/supabase.js";
import { subirArchivos, urlFirmada } from "../core/almacenamiento.js";

const TABLA = "expediente_documentos";
export const BUCKET = "expedientes";

// Tipos de campo que sabe pintar la página. Cada documento declara los
// que necesita; así el catálogo manda y la pantalla obedece.
export const CAMPOS = Object.freeze({
  OFICIO: "numero_oficio",
  FECHA: "fecha",
  VIGENCIA: "vigencia",
  SUBTIPO: "subtipo",
  AUTORIDAD: "autoridad",
  NOTAS: "notas",
});

// --------------------------------------------------------------
// El catálogo de documentos
// --------------------------------------------------------------
// `roles: null` significa "todos". Un documento sin `obligatorio` es de
// los recomendados: no bloquea el envío, pero da la insignia de
// "expediente completo" (cambios-plataforma §3).

const DOCUMENTOS = Object.freeze([
  // ---------- Datos generales (todos los roles) ----------
  {
    id: "constancia_fiscal",
    bloque: "Datos generales",
    nombre: "Constancia de Situación Fiscal",
    roles: null, obligatorio: true, campos: [],
  },
  {
    id: "identificacion_representante",
    bloque: "Datos generales",
    nombre: "Identificación del representante legal",
    roles: null, obligatorio: true, campos: [],
  },

  // ---------- Impacto ambiental (generador y comprador) ----------
  {
    id: "impacto_ambiental",
    bloque: "Impacto ambiental",
    nombre: "Autorización de impacto ambiental",
    roles: ["proveedor", "comprador"], obligatorio: true,
    campos: [CAMPOS.SUBTIPO, CAMPOS.AUTORIDAD, CAMPOS.OFICIO],
    subtipos: ["Informe preventivo", "Manifestación de impacto ambiental"],
    autoridades: ["SMA", "SEMARNAT"],
    // Este no se coteja contra ningún padrón: no existe uno público
    // (documento maestro §20). Solo se pre-verifica que esté y se lea.
    ayuda: "Solo se comprueba que esté cargada y legible: no hay padrón público que cotejar.",
  },

  // ---------- Generador ----------
  {
    id: "registro_generador",
    bloque: "Registro de generador",
    nombre: "Registro como generador de residuos de manejo especial",
    roles: ["proveedor"], obligatorio: true,
    campos: [CAMPOS.OFICIO, CAMPOS.FECHA, CAMPOS.VIGENCIA],
    ayuda: "Se coteja contra el padrón público de la SMA: razón social, número de oficio y vigencia.",
  },

  // ---------- Comprador ----------
  {
    id: "autorizacion_sma",
    bloque: "Autorización SMA",
    nombre: "Autorización de acopio, reciclaje o tratamiento",
    roles: ["comprador"], obligatorio: true,
    campos: [CAMPOS.SUBTIPO, CAMPOS.OFICIO, CAMPOS.FECHA, CAMPOS.VIGENCIA],
    subtipos: ["Acopio", "Reciclaje y co-procesamiento", "Tratamiento"],
    ayuda: "Se coteja contra el padrón público de la SMA.",
  },

  // ---------- Transportista ----------
  {
    id: "autorizacion_transporte",
    bloque: "Autorización de transporte",
    nombre: "Autorización de recolección y transporte en Coahuila",
    roles: ["logistica"], obligatorio: true,
    campos: [CAMPOS.OFICIO, CAMPOS.FECHA, CAMPOS.VIGENCIA],
    ayuda: "Se coteja contra el padrón público de la SMA.",
  },
  {
    id: "vehiculos",
    bloque: "Autorización de transporte",
    nombre: "Vehículos registrados",
    roles: ["logistica"], obligatorio: true,
    campos: [CAMPOS.NOTAS],
    // Un campo de texto y no una lista de vehículos: decisión D-14.
    // Los datos que acaban en el manifiesto son tipo y placas, y en la
    // fase 1 la operación es asistida.
    ayuda: "Escribe el tipo y las placas de cada vehículo, uno por renglón.",
    sinArchivo: true,
  },
  {
    id: "poliza_seguro",
    bloque: "Autorización de transporte",
    nombre: "Póliza de seguro",
    roles: ["logistica"], obligatorio: true,
    campos: [CAMPOS.VIGENCIA],
  },

  // ---------- Recomendados ----------
  {
    id: "acta_constitutiva",
    bloque: "Recomendados",
    nombre: "Acta constitutiva",
    roles: null, obligatorio: false, campos: [],
  },
  {
    id: "opinion_sat",
    bloque: "Recomendados",
    nombre: "Opinión de cumplimiento del SAT",
    roles: null, obligatorio: false, campos: [],
  },
  {
    id: "caracterizacion_laboratorio",
    bloque: "Recomendados",
    nombre: "Caracterización de laboratorio",
    roles: ["proveedor"], obligatorio: false, campos: [],
    ayuda: "Demuestra que el material no es peligroso. Da la insignia de material caracterizado.",
  },
  {
    id: "certificacion_ambiental",
    bloque: "Recomendados",
    nombre: "ISO 14001 o Industria Limpia",
    roles: ["comprador"], obligatorio: false, campos: [],
  },
  {
    id: "permiso_federal",
    bloque: "Recomendados",
    nombre: "Permiso federal de autotransporte",
    roles: ["logistica"], obligatorio: false, campos: [],
  },
]);

export function documentosDeRol(rol) {
  return DOCUMENTOS.filter((doc) => doc.roles === null || doc.roles.includes(rol));
}

// Los documentos agrupados por bloque, en el orden del catálogo.
export function bloquesDeRol(rol) {
  const bloques = [];
  documentosDeRol(rol).forEach((doc) => {
    const existente = bloques.find((b) => b.nombre === doc.bloque);
    if (existente) existente.documentos.push(doc);
    else bloques.push({ nombre: doc.bloque, documentos: [doc] });
  });
  return bloques;
}

// Un documento cuenta como entregado si tiene archivo, o si es de los
// que no llevan archivo (los vehículos) y tiene texto.
function entregado(doc, guardado) {
  if (!guardado) return false;
  return doc.sinArchivo ? Boolean(guardado.notas) : Boolean(guardado.archivo_ruta);
}

export function faltantes(rol, guardados = []) {
  const porTipo = new Map(guardados.map((g) => [g.tipo_documento, g]));
  return documentosDeRol(rol)
    .filter((doc) => doc.obligatorio && !entregado(doc, porTipo.get(doc.id)))
    .map((doc) => doc.id);
}

export function puedeEnviarse(rol, guardados = []) {
  return documentosDeRol(rol).length > 0 && faltantes(rol, guardados).length === 0;
}

// La insignia de "expediente completo": además de los obligatorios,
// todos los recomendados de su rol (cambios-plataforma §3).
export function expedienteCompleto(rol, guardados = []) {
  const porTipo = new Map(guardados.map((g) => [g.tipo_documento, g]));
  return documentosDeRol(rol).every((doc) => entregado(doc, porTipo.get(doc.id)));
}

// --------------------------------------------------------------
// Consultas
// --------------------------------------------------------------

export async function listarMiExpediente(usuarioId) {
  const { data, error } = await supabaseClient
    .from(TABLA)
    .select("*")
    .eq("user_id", usuarioId);

  if (error) throw error;
  return data ?? [];
}

// Guarda un documento. `onConflict` sobre (user_id, tipo_documento)
// hace que volver a subir la constancia sustituya a la anterior en vez
// de acumular copias — el índice único de politicas.sql §8.2.
export async function guardarDocumento(usuarioId, doc, valores, archivo) {
  const ruta = archivo
    ? (await subirArchivos(BUCKET, usuarioId, [archivo], { subcarpeta: doc.id }))[0]
    : null;

  // `user_id` NO va en el payload, y es deliberado: al reenviar un
  // documento esto es un INSERT ... ON CONFLICT DO UPDATE, y el UPDATE
  // intentaría escribir todas las columnas que manda el cliente. La
  // columna de propiedad está fuera del `grant update` de §8.2 —como
  // debe estar—, así que incluirla hacía fallar cada guardado con un
  // "permission denied" que la página traducía a "no se pudo guardar".
  // En el INSERT lo rellena el `default auth.uid()` de la tabla.
  const fila = {
    bloque: doc.bloque,
    tipo_documento: doc.id,
    subtipo: valores.subtipo || null,
    autoridad: valores.autoridad || null,
    numero_oficio: valores.numero_oficio || null,
    fecha: valores.fecha || null,
    vigencia: valores.vigencia || null,
    notas: valores.notas || null,
    updated_at: new Date().toISOString(),
  };

  // Sin archivo nuevo no se pisa el que ya estaba: quien solo corrige
  // el número de oficio no debería perder el PDF.
  if (ruta) fila.archivo_ruta = ruta;

  const { data, error } = await supabaseClient
    .from(TABLA)
    .upsert(fila, { onConflict: "user_id,tipo_documento" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function urlDeDocumento(ruta) {
  return ruta ? urlFirmada(BUCKET, ruta) : Promise.resolve(null);
}

// El estado lo cambia la base, no el navegador: esta función solo pide
// el movimiento y devuelve el estado que quedó (politicas.sql §8.3).
export async function enviarARevision() {
  const { data, error } = await supabaseClient.rpc("enviar_expediente_a_revision");
  if (error) throw error;
  return data;
}
