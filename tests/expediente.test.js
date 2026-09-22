// ==============================================================
// Expediente por rol
// ==============================================================
// Lo que se fija aquí es el catálogo de documentos, no la pantalla:
// qué le pide EcoConnect a cada rol y cuándo se considera completo.
//
// Importa porque de esa lista cuelga el botón "Enviar a revisión", y
// ese botón mueve el estado de la cuenta. Un obligatorio que se caiga
// del catálogo por descuido deja pasar a revisión un expediente
// incompleto, y el equipo lo descubre con la empresa ya esperando.
//
// El estado de cada documento (`aprobado` / `rechazado`) no se prueba
// aquí: lo escribe el equipo en el panel y el navegador no puede
// tocarlo (politicas.sql §8.2).
// ==============================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  documentosDeRol, bloquesDeRol, faltantes, puedeEnviarse, expedienteCompleto,
  materialesAmparados, amparaMaterial, admiteVarios, filasDe,
  bloquesDePantalla, documentosDePantalla, faltantesPorPantalla,
} from "../public/js/data/expediente.js";
import { textoPendientes } from "../public/js/ui/expediente-pantalla.js";

// Un expediente con todos los obligatorios del rol entregados.
function completarObligatorios(rol) {
  return documentosDeRol(rol)
    .filter((doc) => doc.obligatorio)
    .map((doc) => ({
      tipo_documento: doc.id,
      archivo_ruta: doc.sinArchivo ? null : `u/${doc.id}.pdf`,
      notas: doc.sinArchivo ? "Torton, placas AB-123-CD" : null,
    }));
}

describe("qué documentos pide cada rol", () => {
  test("los tres roles piden los datos generales", () => {
    ["proveedor", "comprador", "logistica"].forEach((rol) => {
      const ids = documentosDeRol(rol).map((d) => d.id);
      assert.ok(ids.includes("constancia_fiscal"), rol);
      assert.ok(ids.includes("identificacion_representante"), rol);
    });
  });

  // Cada rol tiene su autorización y NO la de los otros. Es la razón de
  // ser del expediente: la documentación genérica que reemplaza pedía
  // lo mismo a todos.
  test("cada rol pide su propia autorización y no la ajena", () => {
    const generador = documentosDeRol("proveedor").map((d) => d.id);
    const comprador = documentosDeRol("comprador").map((d) => d.id);
    const transportista = documentosDeRol("logistica").map((d) => d.id);

    assert.ok(generador.includes("registro_generador"));
    assert.ok(!generador.includes("autorizacion_sma"));
    assert.ok(!generador.includes("autorizacion_transporte"));

    assert.ok(comprador.includes("autorizacion_sma"));
    assert.ok(!comprador.includes("registro_generador"));

    assert.ok(transportista.includes("autorizacion_transporte"));
    assert.ok(transportista.includes("vehiculos"));
    assert.ok(transportista.includes("poliza_seguro"));
  });

  // El impacto ambiental lo piden generador y comprador, no el
  // transportista (cambios-plataforma §2).
  test("el impacto ambiental no se le pide al transportista", () => {
    assert.ok(documentosDeRol("proveedor").some((d) => d.id === "impacto_ambiental"));
    assert.ok(documentosDeRol("comprador").some((d) => d.id === "impacto_ambiental"));
    assert.ok(!documentosDeRol("logistica").some((d) => d.id === "impacto_ambiental"));
  });

  test("los bloques salen agrupados y sin repetirse", () => {
    const nombres = bloquesDeRol("logistica").map((b) => b.nombre);
    assert.deepEqual(nombres, [...new Set(nombres)]);
    assert.ok(nombres.includes("Datos generales"));
    assert.ok(nombres.includes("Autorización de transporte"));
    assert.ok(nombres.includes("Recomendados"));
  });
});

describe("cuándo se puede enviar a revisión", () => {
  test("un expediente vacío no se puede enviar", () => {
    assert.equal(puedeEnviarse("proveedor", []), false);
    assert.ok(faltantes("proveedor", []).length > 0);
  });

  test("con todos los obligatorios, sí", () => {
    ["proveedor", "comprador", "logistica"].forEach((rol) => {
      assert.deepEqual(faltantes(rol, completarObligatorios(rol)), [], rol);
      assert.equal(puedeEnviarse(rol, completarObligatorios(rol)), true, rol);
    });
  });

  // Los recomendados no bloquean: son los que dan la insignia.
  test("los recomendados no impiden enviar", () => {
    const guardados = completarObligatorios("comprador");
    assert.equal(puedeEnviarse("comprador", guardados), true);
    assert.equal(expedienteCompleto("comprador", guardados), false);
  });

  // Una fila guardada sin archivo NO cuenta como entregada. Pasaba si
  // alguien guardaba solo el número de oficio: la fila existe, el
  // documento no.
  test("una fila sin archivo no cuenta como documento entregado", () => {
    const aMedias = completarObligatorios("proveedor").map((doc) => ({
      ...doc,
      archivo_ruta: doc.tipo_documento === "registro_generador" ? null : doc.archivo_ruta,
    }));

    assert.deepEqual(faltantes("proveedor", aMedias), ["registro_generador"]);
    assert.equal(puedeEnviarse("proveedor", aMedias), false);
  });

  // Los vehículos son el único obligatorio sin archivo: se entregan
  // escribiéndolos (decisión D-14). Sin texto, tampoco cuentan.
  test("los vehículos cuentan por su texto, no por un archivo", () => {
    const sinTexto = completarObligatorios("logistica").map((doc) => ({
      ...doc,
      notas: doc.tipo_documento === "vehiculos" ? "" : doc.notas,
    }));

    assert.deepEqual(faltantes("logistica", sinTexto), ["vehiculos"]);
  });

  test("con todo, obligatorio y recomendado, el expediente está completo", () => {
    const todos = documentosDeRol("proveedor").map((doc) => ({
      tipo_documento: doc.id,
      archivo_ruta: doc.sinArchivo ? null : `u/${doc.id}.pdf`,
      notas: doc.sinArchivo ? "Torton" : null,
    }));

    assert.equal(expedienteCompleto("proveedor", todos), true);
  });

  // Un rol desconocido no debe dar un expediente "completo" por estar
  // vacío: sin documentos que pedir, no hay nada que enviar.
  test("un rol sin catálogo no se puede enviar", () => {
    assert.equal(puedeEnviarse("otro", []), false);
  });

  // El plan de manejo es obligatorio: en la fase 1 solo entran grandes
  // generadores, y todos deben tenerlo (Reglamento de Coahuila).
  test("el plan de manejo es obligatorio para el generador", () => {
    const plan = documentosDeRol("proveedor").find((d) => d.id === "plan_manejo");
    assert.ok(plan, "no está en el catálogo del generador");
    assert.equal(plan.obligatorio, true);
    assert.ok(!documentosDeRol("comprador").some((d) => d.id === "plan_manejo"));
  });

  // El registro de generador NO vence: se actualiza cada tres años. Por
  // eso no pide fecha de vigencia, a diferencia de las autorizaciones.
  test("el registro de generador no pide vigencia; las autorizaciones sí", () => {
    const registro = documentosDeRol("proveedor").find((d) => d.id === "registro_generador");
    const autorizacion = documentosDeRol("comprador").find((d) => d.id === "autorizacion_sma");

    assert.ok(!registro.campos.includes("vigencia"));
    assert.equal(registro.renovacion, "actualiza3");
    assert.ok(autorizacion.campos.includes("vigencia"));
    assert.equal(autorizacion.renovacion, "2años");
  });
});

// El expediente vive en dos pantallas, y la frontera no es estética: lo
// de la empresa se llena una vez y vale para cualquier rol; lo que
// autoriza la SMA depende del rol y se repite por establecimiento.
describe("las dos pantallas del expediente", () => {
  const nombresDeBloques = (rol, pantalla) =>
    bloquesDePantalla(rol, pantalla).map((b) => b.nombre);

  test("los datos generales los piden los tres roles", () => {
    ["proveedor", "comprador", "logistica"].forEach((rol) => {
      assert.ok(nombresDeBloques(rol, "empresa").includes("Datos generales"), rol);
    });
  });

  // El impacto ambiental es requisito para publicar o comprar, así que
  // va con los documentos de la empresa; al transportista no se le pide.
  test("el impacto ambiental está en Mi expediente, y no para el transportista", () => {
    assert.ok(nombresDeBloques("proveedor", "empresa").includes("Impacto ambiental"));
    assert.ok(nombresDeBloques("comprador", "empresa").includes("Impacto ambiental"));
    assert.ok(!nombresDeBloques("logistica", "empresa").includes("Impacto ambiental"));
    assert.ok(!nombresDeBloques("logistica", "autorizaciones").includes("Impacto ambiental"));
  });

  test("cada rol ve solo su autorización en la segunda pantalla", () => {
    assert.deepEqual(nombresDeBloques("proveedor", "autorizaciones"), ["Registro de generador"]);
    assert.deepEqual(nombresDeBloques("comprador", "autorizaciones"), ["Autorización SMA"]);
    assert.deepEqual(nombresDeBloques("logistica", "autorizaciones"), ["Autorización de transporte"]);
  });

  // La caracterización de laboratorio es del MATERIAL, no de la
  // empresa, así que acompaña al registro de generador. Los
  // recomendados que sí son de la empresa se quedan arriba.
  test("los recomendados van con lo que acompañan", () => {
    const conAutorizacion = documentosDePantalla("proveedor", "autorizaciones").map((d) => d.id);
    const deEmpresa = documentosDePantalla("proveedor", "empresa").map((d) => d.id);

    assert.ok(conAutorizacion.includes("caracterizacion_laboratorio"));
    assert.ok(deEmpresa.includes("acta_constitutiva"));
    assert.ok(deEmpresa.includes("opinion_sat"));
    assert.ok(!deEmpresa.includes("caracterizacion_laboratorio"));

    assert.ok(documentosDePantalla("comprador", "autorizaciones")
      .map((d) => d.id).includes("certificacion_ambiental"));
    assert.ok(documentosDePantalla("logistica", "autorizaciones")
      .map((d) => d.id).includes("permiso_federal"));
  });

  // El botón de enviar cuenta las dos pantallas. Sin decir en cuál está
  // cada pendiente, quien lo lee lo busca en la que tiene delante.
  test("lo que falta se reparte diciendo en qué pantalla está", () => {
    const grupos = faltantesPorPantalla("proveedor", []);
    const empresa = grupos.find((g) => g.id === "empresa");
    const autorizaciones = grupos.find((g) => g.id === "autorizaciones");

    assert.ok(empresa.documentos.some((d) => d.id === "constancia_fiscal"));
    assert.ok(autorizaciones.documentos.some((d) => d.id === "registro_generador"));
    assert.equal(empresa.pagina, "expediente.html");
    assert.equal(autorizaciones.pagina, "autorizaciones.html");
  });

  test("con el expediente completo no falta nada en ninguna pantalla", () => {
    const grupos = faltantesPorPantalla("comprador", completarObligatorios("comprador"));
    grupos.forEach((g) => assert.deepEqual(g.documentos, [], g.id));
  });

  // Solo las autorizaciones admiten varios registros. Duplicar una
  // constancia fiscal no significa nada; duplicar un registro de
  // generador significa una planta más.
  test("solo las autorizaciones admiten varios registros", () => {
    const porId = (id) => documentosDeRol("proveedor").find((d) => d.id === id)
      ?? documentosDeRol("comprador").find((d) => d.id === id)
      ?? documentosDeRol("logistica").find((d) => d.id === id);

    ["registro_generador", "autorizacion_sma", "autorizacion_transporte"]
      .forEach((id) => assert.equal(admiteVarios(porId(id)), true, id));

    ["constancia_fiscal", "impacto_ambiental", "plan_manejo", "acta_constitutiva"]
      .forEach((id) => assert.equal(admiteVarios(porId(id)), false, id));
  });

  test("filasDe devuelve todos los registros de un documento", () => {
    const expediente = [
      { id: "a", tipo_documento: "registro_generador" },
      { id: "b", tipo_documento: "registro_generador" },
      { id: "c", tipo_documento: "constancia_fiscal" },
    ];

    assert.equal(filasDe(expediente, "registro_generador").length, 2);
    assert.equal(filasDe(expediente, "plan_manejo").length, 0);
  });

  // Con dos plantas, basta una entregada para poder operar con esa.
  // Exigir las dos bloquearía a quien está dando de alta la segunda.
  test("un registro entregado basta aunque haya otro a medias", () => {
    const guardados = [
      ...completarObligatorios("proveedor"),
      { tipo_documento: "registro_generador", archivo_ruta: null },
    ];

    assert.deepEqual(faltantes("proveedor", guardados), []);
  });
});

// "Ya puedes operar" y "te falta un documento obligatorio" se leían
// juntos y se contradecían. Pueden ser ciertos los dos: una cuenta
// verificada se encuentra con documentos que el catálogo no pedía
// cuando la revisaron. Pasó al añadir el plan de manejo, y volverá a
// pasar cada vez que el expediente crezca.
describe("cómo se anuncia lo que falta", () => {
  test("a una cuenta verificada no se le dice que le falta para operar", () => {
    const { titulo, detalle, intro } = textoPendientes(1, true);

    assert.doesNotMatch(titulo, /falta/i);
    assert.match(detalle, /puedes seguir operando/i);
    assert.match(intro, /ya está verificada/i);
  });

  test("a una cuenta sin verificar sí, porque es lo que la frena", () => {
    const { titulo, detalle } = textoPendientes(1, false);

    assert.match(titulo, /falta/i);
    assert.match(detalle, /antes de poder enviarlo/i);
  });

  // "1 documento(s) obligatorio(s) pendiente(s)" se lee como un error
  // del programa, no como una frase.
  test("el plural se escribe, no se sugiere con paréntesis", () => {
    assert.match(textoPendientes(1, false).detalle, /1 documento obligatorio pendiente\b/);
    assert.match(textoPendientes(3, false).detalle, /3 documentos obligatorios pendientes/);
    assert.doesNotMatch(textoPendientes(2, true).detalle, /\(s\)/);
  });
});

// Las autorizaciones de la SMA son por residuo: quien está autorizado
// para PET no puede recibir cobre. De aquí salen las tres reglas del
// Reglamento de la Ley de Residuos de Coahuila.
describe("materiales que ampara cada empresa", () => {
  test("junta los materiales de todas sus autorizaciones, sin repetir", () => {
    const expediente = [
      { tipo_documento: "registro_generador", materiales: ["acero", "pet"] },
      { tipo_documento: "autorizacion_sma", materiales: ["pet", "carton"] },
    ];

    assert.deepEqual(materialesAmparados(expediente).sort(), ["acero", "carton", "pet"]);
  });

  test("ampara lo declarado y nada más", () => {
    const expediente = [{ tipo_documento: "autorizacion_sma", materiales: ["pet"] }];

    assert.equal(amparaMaterial(expediente, "pet"), true);
    assert.equal(amparaMaterial(expediente, "cobre"), false);
  });

  // El caso que decide si esto es usable: una empresa que todavía no ha
  // declarado materiales NO está "autorizada para nada". Si se tratara
  // así, nadie podría publicar ni comprar hasta llenar el expediente, y
  // el sitio quedaría muerto para todas las cuentas anteriores.
  test("sin materiales declarados no se bloquea nada", () => {
    assert.equal(materialesAmparados([]), null);
    assert.equal(materialesAmparados([{ tipo_documento: "constancia_fiscal" }]), null);
    assert.equal(amparaMaterial([], "cobre"), true);
  });

  test("sin material que comprobar tampoco se bloquea", () => {
    const expediente = [{ tipo_documento: "autorizacion_sma", materiales: ["pet"] }];
    assert.equal(amparaMaterial(expediente, null), true);
  });
});
