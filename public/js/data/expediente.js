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
  MATERIALES: "materiales",
});

// --------------------------------------------------------------
// El catálogo de documentos
// --------------------------------------------------------------
// `roles: null` significa "todos". Un documento sin `obligatorio` es de
// los recomendados: no bloquea el envío, pero da la insignia de
// "expediente completo" (cambios-plataforma §3).
//
// El expediente tiene DOS NIVELES, y la diferencia no es de orden:
//
//   empresa        Se llenan una vez y valen para cualquier rol. Una
//                  constancia fiscal es de la empresa, no del generador.
//   autorizaciones Lo que la SMA autoriza, y se autoriza POR
//                  ESTABLECIMIENTO: una empresa con tres plantas tiene
//                  tres registros. Por eso llevan `varios: true` y la
//                  base les permite repetirse.
//
// Los materiales que ampara la empresa son la SUMA de todos sus
// registros, no los del último que subió.

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
    ayuda: "Sube tu autorización de impacto ambiental vigente.",
    // Cómo lo revisa el equipo: solo pre-verificación —que esté
    // cargada, sea legible y la razón social coincida—. No hay padrón
    // público de impacto ambiental que cotejar (maestro §20).
  },

  // ---------- Generador ----------
  {
    id: "registro_generador",
    bloque: "Registro de generador",
    nombre: "Registro como generador de residuos de manejo especial",
    roles: ["proveedor"], obligatorio: true,
    // Sin VIGENCIA a propósito: el registro de generador NO vence. Se
    // actualiza cada tres años (documento maestro §20).
    campos: [CAMPOS.OFICIO, CAMPOS.FECHA, CAMPOS.MATERIALES],
    renovacion: "actualiza3",
    varios: true,
    ayuda: "Marca los materiales que aparecen en tu autorización.",
    // Cómo lo revisa el equipo: razón social y número de oficio se
    // cotejan contra el padrón público de la SMA. Los materiales NO
    // están en el padrón; se leen del PDF.
  },
  {
    id: "plan_manejo",
    bloque: "Registro de generador",
    nombre: "Registro del plan de manejo",
    roles: ["proveedor"], obligatorio: true,
    campos: [CAMPOS.OFICIO, CAMPOS.FECHA],
    renovacion: "actualiza3",
    ayuda: "Sube el registro de tu plan de manejo ante la SMA.",
    // Obligatorio para todos: en la fase 1 solo entran grandes
    // generadores, que deben tenerlo.
  },

  // ---------- Comprador ----------
  {
    id: "autorizacion_sma",
    bloque: "Autorización SMA",
    nombre: "Autorización de acopio, reciclado o tratamiento",
    roles: ["comprador"], obligatorio: true,
    campos: [CAMPOS.SUBTIPO, CAMPOS.OFICIO, CAMPOS.FECHA, CAMPOS.VIGENCIA, CAMPOS.MATERIALES],
    // Las tres modalidades tal como las nombra la SMA.
    subtipos: [
      "Acopio y/o almacenamiento",
      "Reciclado y/o co-procesamiento",
      "Tratamiento",
    ],
    renovacion: "2años",
    varios: true,
    ayuda: "Marca los materiales que aparecen en tu autorización. Recuerda que se refrenda cada dos años.",
    // Cómo lo revisa el equipo: oficio y vigencia contra el padrón de
    // la SMA; los materiales, leyendo el PDF.
  },

  // ---------- Transportista ----------
  {
    id: "autorizacion_transporte",
    bloque: "Autorización de transporte",
    nombre: "Autorización de recolección y transporte en Coahuila",
    roles: ["logistica"], obligatorio: true,
    campos: [CAMPOS.OFICIO, CAMPOS.FECHA, CAMPOS.VIGENCIA, CAMPOS.MATERIALES],
    renovacion: "2años",
    varios: true,
    ayuda: "Marca los materiales que puedes transportar según tu autorización. Se refrenda cada dos años.",
    // Cómo lo revisa el equipo: oficio y vigencia contra el padrón de
    // la SMA; los materiales, leyendo el PDF.
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
  // NOTA sobre los textos de `ayuda`: son instrucciones para la
  // EMPRESA que sube el documento, no apuntes para quien lo revisa.
  // Lo segundo va en comentarios como los de arriba y en
  // docs/plan-de-trabajo.md. En pantalla, "se coteja contra el padrón"
  // no le dice a nadie qué tiene que hacer, y además promete una
  // revisión que el usuario no controla.
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
    ayuda: "Si tienes un análisis de laboratorio de tu material, súbelo: da la insignia de material caracterizado.",
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

// --------------------------------------------------------------
// Qué materiales tiene autorizados una empresa
// --------------------------------------------------------------
// Las autorizaciones de la SMA son POR RESIDUO: una recicladora
// autorizada para PET no puede recibir cobre. Por eso cada autorización
// declara qué materiales ampara, y de ahí salen las tres reglas del
// Reglamento de la Ley de Residuos de Coahuila:
//
//   generador      publica solo lo que está en su registro
//   comprador      solicita solo lo que su autorización cubre
//   transportista  ve solo solicitudes de lo que cubre
//
// ⚠️ EN EL PROTOTIPO ESTO ES UN AVISO, NO UN CONTROL. La base no
// comprueba nada todavía: es la misma pieza pendiente que D-15, y
// conviene cerrarlas juntas.
//
// Devuelve null cuando la empresa aún no ha declarado materiales en
// ninguna autorización. Null no es "no ampara nada": es "todavía no se
// sabe", y quien lo use no debe bloquear con esa respuesta.
export function materialesAmparados(guardados = []) {
  const declarados = guardados
    .filter((fila) => Array.isArray(fila.materiales) && fila.materiales.length)
    .flatMap((fila) => fila.materiales);

  return declarados.length ? [...new Set(declarados)] : null;
}

export function amparaMaterial(guardados, materialId) {
  const amparados = materialesAmparados(guardados);
  if (!amparados || !materialId) return true; // sin datos no se bloquea
  return amparados.includes(materialId);
}

export function documentosDeRol(rol) {
  return DOCUMENTOS.filter((doc) => doc.roles === null || doc.roles.includes(rol));
}

// A qué nivel pertenece cada bloque. Se deduce del bloque y no se
// repite documento por documento: así no puede quedar un documento de
// "Datos generales" clasificado como autorización por un descuido.
const NIVEL_DE_BLOQUE = {
  "Datos generales": "empresa",
  "Impacto ambiental": "empresa",
  "Registro de generador": "autorizaciones",
  "Autorización SMA": "autorizaciones",
  "Autorización de transporte": "autorizaciones",
  "Recomendados": "recomendados",
};

export const NIVELES = Object.freeze([
  {
    id: "empresa",
    titulo: "Documentos de la empresa",
    descripcion: "Se llenan una sola vez y valen para todos tus roles.",
  },
  {
    id: "autorizaciones",
    titulo: "Autorizaciones",
    descripcion: "La SMA autoriza por establecimiento: si tienes varias plantas, agrega un registro por cada una.",
  },
  {
    id: "recomendados",
    titulo: "Recomendados",
    descripcion: "No son obligatorios. Completarlos te da la insignia de expediente completo.",
  },
]);

export function nivelDeDocumento(doc) {
  return NIVEL_DE_BLOQUE[doc.bloque] ?? "empresa";
}

// Qué documentos admiten varios registros. Se declara documento por
// documento y no por bloque, porque no coinciden: el plan de manejo
// está en el bloque del registro de generador y no es una autorización
// de la SMA. Una prueba lo destapó al pedir lo contrario.
export function admiteVarios(doc) {
  return doc?.varios === true;
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

// Los bloques repartidos en los dos niveles, para pintarlos en orden.
export function nivelesDeRol(rol) {
  const bloques = bloquesDeRol(rol);
  return NIVELES
    .map((nivel) => ({
      ...nivel,
      bloques: bloques.filter((b) => NIVEL_DE_BLOQUE[b.nombre] === nivel.id),
    }))
    .filter((nivel) => nivel.bloques.length > 0);
}

// Un documento cuenta como entregado si tiene archivo, o si es de los
// que no llevan archivo (los vehículos) y tiene texto.
function entregado(doc, guardado) {
  if (!guardado) return false;
  return doc.sinArchivo ? Boolean(guardado.notas) : Boolean(guardado.archivo_ruta);
}

// Todas las filas guardadas de un mismo documento. Los de la empresa
// tienen una; las autorizaciones, una por establecimiento.
export function filasDe(guardados = [], docId) {
  return guardados.filter((fila) => fila.tipo_documento === docId);
}

// Con varios registros basta UNO entregado para que el documento
// cuente: una empresa con dos plantas que solo ha subido el registro de
// la primera ya puede operar con esa.
export function faltantes(rol, guardados = []) {
  return documentosDeRol(rol)
    .filter((doc) => doc.obligatorio &&
      !filasDe(guardados, doc.id).some((fila) => entregado(doc, fila)))
    .map((doc) => doc.id);
}

export function puedeEnviarse(rol, guardados = []) {
  return documentosDeRol(rol).length > 0 && faltantes(rol, guardados).length === 0;
}

// La insignia de "expediente completo": además de los obligatorios,
// todos los recomendados de su rol (cambios-plataforma §3).
export function expedienteCompleto(rol, guardados = []) {
  return documentosDeRol(rol)
    .every((doc) => filasDe(guardados, doc.id).some((fila) => entregado(doc, fila)));
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

// Guarda un documento. Con `filaId` actualiza ESA fila; sin él, crea
// una nueva.
//
// Antes esto era un upsert por (user_id, tipo_documento), que valía
// cuando cada documento era único. Desde que las autorizaciones admiten
// varios registros, el tipo ya no identifica una fila: dos registros de
// generador comparten tipo y son documentos distintos. La identidad
// pasa a ser el id de la fila.
//
// Lo que impide duplicar la constancia fiscal sigue siendo el índice
// único de politicas.sql §8.2, que ahora excluye a las tres
// autorizaciones.
export async function guardarDocumento(usuarioId, doc, valores, archivo, filaId = null) {
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
    materiales: valores.materiales?.length ? valores.materiales : null,
    updated_at: new Date().toISOString(),
  };

  // Sin archivo nuevo no se pisa el que ya estaba: quien solo corrige
  // el número de oficio no debería perder el PDF.
  if (ruta) fila.archivo_ruta = ruta;

  const consulta = filaId
    // El .eq("user_id") es defensa en profundidad, no el control: lo
    // que impide tocar la fila de otra empresa es `expediente_actualiza`.
    ? supabaseClient.from(TABLA).update(fila).eq("id", filaId).eq("user_id", usuarioId)
    : supabaseClient.from(TABLA).insert(fila);

  const { data, error } = await consulta.select().single();

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
