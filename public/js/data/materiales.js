// ==============================================================
// Catálogo de materiales
// ==============================================================
// El material dejó de ser texto libre. Es la primera de las tres capas
// que impiden publicar un residuo peligroso (documento maestro §04):
// lo que no está en esta lista no se puede publicar. Las otras dos son
// la lista explícita de los términos y condiciones y la declaración que
// firma el generador al publicar.
//
// Vive en el código y no en una tabla (decisión D-8 de
// docs/plan-de-trabajo.md): son diez y cambian poco, así que no compensa
// una tabla con sus políticas. El día que haya que editarlos sin
// programar, esto se muda a `materiales` y este archivo pasa a leerla.
//
// ⚠️ Las CLAVES son provisionales. Las de verdad salen del Catálogo de
// Residuos de Manejo Especial de la SMA y están sin capturar
// (CLAUDE.md §0.1). El manifiesto las necesita de verdad, así que antes
// de la tarea 10 hay que sustituirlas — no vale publicar con estas.
// ==============================================================

export const CLAVE_PENDIENTE = "PENDIENTE-SMA";

// `humedad: true` en cartón y plásticos: son los únicos donde el agua
// cambia el peso que se paga, así que el campo solo aparece para ellos.
export const MATERIALES = Object.freeze([
  { id: "acero",    nombre: "Acero",      categoria: "Metales ferrosos",     humedad: false },
  { id: "hierro",   nombre: "Hierro",     categoria: "Metales ferrosos",     humedad: false },
  { id: "hms",      nombre: "HMS",        categoria: "Metales ferrosos",     humedad: false },
  { id: "cobre",    nombre: "Cobre",      categoria: "Metales no ferrosos",  humedad: false },
  { id: "aluminio", nombre: "Aluminio",   categoria: "Metales no ferrosos",  humedad: false },
  { id: "pet",      nombre: "PET",        categoria: "Plásticos",            humedad: true  },
  { id: "hdpe",     nombre: "HDPE #2",    categoria: "Plásticos",            humedad: true  },
  { id: "pp",       nombre: "PP #5",      categoria: "Plásticos",            humedad: true  },
  { id: "tarimas",  nombre: "Tarimas",    categoria: "Empaque industrial",   humedad: false },
  { id: "carton",   nombre: "Cartón",     categoria: "Empaque industrial",   humedad: true  },
]);

export function buscarMaterial(id) {
  return MATERIALES.find((material) => material.id === id) ?? null;
}

export function pideHumedad(id) {
  return buscarMaterial(id)?.humedad === true;
}

// Las publicaciones guardan el NOMBRE del material en `tipo`, no su
// identificador. Para cruzarlas con los materiales que ampara una
// autorización hace falta el camino de vuelta.
export function idPorNombre(nombre) {
  if (!nombre) return null;
  const buscado = String(nombre).trim().toLowerCase();
  return MATERIALES.find((m) => m.nombre.toLowerCase() === buscado)?.id ?? null;
}

// Fase 1: SOLO Torreón (documento maestro §01 y §18). No es una lista a
// medio llenar: la fase 1 opera únicamente con permisos de Coahuila y
// con empresas de Torreón, y el municipio acaba en el manifiesto.
//
// Gómez Palacio y Lerdo entran en la fase 2, cuando se revisen los
// requisitos de Durango (§18). Añadirlos antes dejaría publicar desde
// municipios cuyo marco legal todavía no está cargado.
export const MUNICIPIOS = Object.freeze(["Torreón"]);

export const UNIDADES = Object.freeze([
  { id: "kg", nombre: "kilogramos (kg)" },
  { id: "t",  nombre: "toneladas (t)" },
]);

export const PERIODICIDADES = Object.freeze([
  { id: "lote_unico", nombre: "Lote único" },
  { id: "semanal",    nombre: "Semanal" },
  { id: "mensual",    nombre: "Mensual" },
  { id: "otra",       nombre: "Otra" },
]);

export const NIVELES_PROCESAMIENTO = Object.freeze([
  { id: "sin_procesar", nombre: "Sin procesar" },
  { id: "separado",     nombre: "Separado" },
  { id: "compactado",   nombre: "Compactado o empacado" },
  { id: "triturado",    nombre: "Triturado" },
]);

export const CONDICIONES = Object.freeze([
  { id: "limpio",         nombre: "Limpio" },
  { id: "con-impurezas",  nombre: "Con impurezas" },
]);

// Etiqueta legible de cualquiera de las listas de arriba. Los valores
// viejos (`unica`, `constante`, `seco`…) no están en las listas nuevas,
// así que se devuelven tal cual en vez de perderse: hay publicaciones
// anteriores al 2026-09-22 que los usan.
export function etiqueta(lista, id) {
  if (!id) return "";
  return lista.find((opcion) => opcion.id === id)?.nombre ?? id;
}
