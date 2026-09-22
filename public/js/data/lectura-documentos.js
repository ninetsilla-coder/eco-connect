// ==============================================================
// Lectura asistida de documentos (SIMULADA)
// ==============================================================
// SIMULADO: aquí no lee nada nadie. Devuelve datos de ejemplo
// preparados después de una espera corta, para poder enseñar la
// pantalla (CLAUDE.md §0.1).
//
// QUÉ HACE FALTA PARA QUE SEA REAL (tarea 17 del plan):
//
//   1. Una función nueva en `api/` que reciba el PDF, lo mande a un
//      modelo con la llave secreta y devuelva los campos.
//   2. Esa llave vive en las variables de entorno de Vercel y NO puede
//      estar aquí: `public/` se sirve tal cual al navegador (§6.3), y
//      una llave de IA a la vista la gasta cualquiera a costa de
//      EcoConnect.
//   3. Sería la SEGUNDA función serverless del proyecto, cuando
//      CLAUDE.md §9 da por hecho que hay una. Choca con C-6 del plan y
//      es una decisión a tomar a propósito, no de paso.
//
// LO QUE NO CAMBIA al hacerla real: la IA prellena y avisa. No aprueba
// ni rechaza nada — eso es del equipo—. Si algún día decidiera, dejaría
// de ser una ayuda de captura y pasaría a ser una revisión automática,
// con todo lo que implica la cláusula de deslinde del maestro §06.
// ==============================================================

// Esta frase acompaña a todo lo que salga de aquí. No es un aviso legal
// de relleno: lo que se prellena es una lectura de un PDF, no un dato
// verificado, y quien lo confirma es la empresa.
export const LEYENDA_LECTURA =
  "Lectura automática del documento que subiste. Verifica que los datos sean correctos. " +
  "EcoConnect no valida la autenticidad de tu documentación.";

// Cuánto "tarda" en leer. Suficiente para que se vea el aviso de
// "Leyendo documento...", poco para no aburrir en una demo.
const ESPERA_MS = 1400;

// SIMULADO: los campos que devolvería el modelo por cada tipo de
// documento. Son siempre los mismos, suba lo que suba: en el pitch
// conviene decirlo en voz alta, y la leyenda lo cubre por escrito.
const EJEMPLOS = {
  registro_generador: {
    numero_oficio: "SMA-RG-2025-0142",
    fecha: "2025-02-10",
    materiales: ["acero", "hierro", "hms"],
  },
  autorizacion_sma: {
    numero_oficio: "SMA-RC-2025-0317",
    fecha: "2025-03-14",
    vigencia: "2027-03-14",
    materiales: ["pet", "hdpe"],
  },
  autorizacion_transporte: {
    numero_oficio: "SMA-TR-2025-0088",
    fecha: "2025-01-20",
    vigencia: "2027-01-20",
    materiales: ["acero", "pet", "carton"],
  },
  poliza_seguro: {
    vigencia: "2026-12-31",
  },
  impacto_ambiental: {
    numero_oficio: "SMA-IA-2024-0451",
  },
  plan_manejo: {
    numero_oficio: "SMA-PM-2025-0233",
    fecha: "2025-02-10",
  },
};

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

// Lee un documento y devuelve lo que encontró.
//
//   legible      si el archivo se pudo leer
//   coincide     si el nombre del documento es el de la cuenta
//   campos       lo que se prellena, para que la empresa lo confirme
//   materiales   ídem, para las autorizaciones
//
// SIMULADO: `coincide` es siempre true salvo que el archivo se llame
// con "no-coincide" en el nombre. Es la forma de enseñar el aviso de
// razón social distinta en una demo, a propósito y cuando se quiera.
// La versión real compara el nombre que venga del PDF.
export async function leerDocumento(doc, archivo, { razonSocial } = {}) {
  await esperar(ESPERA_MS);

  const nombreArchivo = (archivo?.name ?? "").toLowerCase();
  const coincide = !nombreArchivo.includes("no-coincide");

  const ejemplo = EJEMPLOS[doc?.id] ?? {};
  const { materiales = [], ...campos } = ejemplo;

  return {
    legible: true,
    coincide,
    razonSocialDetectada: coincide ? (razonSocial || "") : "COMERCIALIZADORA DEL NORTE S.A. DE C.V.",
    campos,
    materiales,
  };
}
