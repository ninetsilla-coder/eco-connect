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
  materialesAmparados, amparaMaterial, nivelesDeRol, admiteVarios, filasDe,
} from "../public/js/data/expediente.js";

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

// El expediente tiene dos niveles, y la diferencia no es de orden: lo
// de la empresa se llena una vez y vale para cualquier rol; lo que
// autoriza la SMA se repite por establecimiento.
describe("los dos niveles del expediente", () => {
  test("los documentos de la empresa no dependen del rol", () => {
    ["proveedor", "comprador", "logistica"].forEach((rol) => {
      const empresa = nivelesDeRol(rol).find((n) => n.id === "empresa");
      const nombres = empresa.bloques.map((b) => b.nombre);
      assert.ok(nombres.includes("Datos generales"), rol);
    });
  });

  test("cada rol ve sus autorizaciones en el segundo nivel", () => {
    const bloques = (rol) =>
      nivelesDeRol(rol).find((n) => n.id === "autorizaciones").bloques.map((b) => b.nombre);

    assert.deepEqual(bloques("proveedor"), ["Registro de generador"]);
    assert.deepEqual(bloques("comprador"), ["Autorización SMA"]);
    assert.deepEqual(bloques("logistica"), ["Autorización de transporte"]);
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
