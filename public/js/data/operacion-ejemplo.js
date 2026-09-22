// ==============================================================
// Operación de ejemplo (SIMULADA)
// ==============================================================
// SIMULADO: la versión real lee una fila de la tabla `operaciones`
// (tarea 8 del plan), creada cuando un comprador solicita un lote. Esta
// no existe en ninguna base: son datos fijos para que las pantallas de
// pago y manifiesto se puedan enseñar en el pitch.
//
// Las empresas son INVENTADAS (decisión D-9). No se usan nombres de
// empresas reales ni del padrón de la SMA, ni siquiera como ejemplo:
// una captura de pantalla circulando con el nombre de alguien que nunca
// aceptó salir ahí es un problema, no una demo.
//
// Los datos cuadran con el ejemplo del documento maestro §08: lote de
// 10 t de chatarra ferrosa a $4,000/t.
// ==============================================================

export const OPERACION = Object.freeze({
  folio: "ECO-2026-0041",

  generador: Object.freeze({
    razonSocial: "Metales del Nazas S.A. de C.V.",
    rfc: "MNA240115AB9",
    municipio: "Torreón, Coahuila",
    telefono: "871 000 0000",
    registroGenerador: "SMA-RG-2025-0142",
  }),

  comprador: Object.freeze({
    razonSocial: "Recicladora Laguna Verde S.A. de C.V.",
    rfc: "RLV230920XY1",
    municipio: "Torreón, Coahuila",
    autorizacion: "SMA-RC-2025-0317",
    // La modalidad del manifiesto sale del TIPO de autorización que
    // tenga el destinatario, no es siempre "Almacenamiento": una
    // recicladora recibe para reciclar. Es un supuesto —no se encontró
    // el formato oficial— y está anotado como tal en el maestro §20.
    tipoAutorizacion: "Reciclado y/o co-procesamiento",
  }),

  transportista: Object.freeze({
    razonSocial: "Fletes del Norte S. de R.L.",
    autorizacion: "SMA-TR-2025-0088",
    vehiculo: "Torton",
    placas: "AB-123-CD",
  }),

  residuo: Object.freeze({
    material: "Acero",
    clave: "PENDIENTE-SMA",
    descripcion: "Rebaba de maquinado de acero 1018",
    cantidad: 10,
    unidad: "t",
    precio: 4000,
  }),

  flete: 6500,

  // Las firmas del manifiesto, en el orden en que ocurren
  // (cambios-plataforma §7). `hecha` se mueve en pantalla al simular.
  firmas: Object.freeze([
    { id: "generador", seccion: "Sección 4", quien: "Generador", cuando: "En la recolección" },
    { id: "transportista", seccion: "Sección 6", quien: "Transportista", cuando: "En la recolección" },
    { id: "comprador", seccion: "Sección 8", quien: "Destinatario", cuando: "En la entrega" },
  ]),
});

// El desglose del pago. Recibe la comisión en vez de importarla de
// `data/residuos.js`: §4.1 no deja que dos módulos de `data/` se
// importen entre sí, y la página, que ve a los dos, se la pasa. Así el
// número sigue saliendo de una sola constante y no de una copia.
export function desglose(comision, operacion = OPERACION) {
  const lote = operacion.residuo.precio * operacion.residuo.cantidad;
  const importeComision = lote * comision;
  return {
    lote,
    flete: operacion.flete,
    comision: importeComision,
    total: lote + operacion.flete + importeComision,
  };
}

// La modalidad que se anota en la sección 8 del manifiesto. Sale del
// tipo de autorización del destinatario: acopio → Almacenamiento,
// reciclado → Reciclaje, tratamiento → Tratamiento.
export function modalidadDestinatario(operacion = OPERACION) {
  const tipo = operacion.comprador.tipoAutorizacion ?? "";
  if (tipo.startsWith("Acopio")) return "Almacenamiento";
  if (tipo.startsWith("Reciclado")) return "Reciclaje";
  if (tipo.startsWith("Tratamiento")) return "Tratamiento";
  return "—";
}

// SIMULADO: la CLABE real la devuelve Stripe al crear el cobro
// (cambios-plataforma §6). Esta es de ejemplo y no existe en ningún
// banco. Se marca como tal en la pantalla, a la vista.
export const CLABE_EJEMPLO = "646180111812345678";
