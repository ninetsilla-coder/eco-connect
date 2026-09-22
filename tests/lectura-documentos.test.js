// ==============================================================
// Lectura asistida de documentos
// ==============================================================
// La IA lee el PDF y prellena. Lo que estas pruebas fijan no es que
// acierte —hoy está simulada— sino los límites que no debe cruzar
// cuando sea real:
//
//   1. NO APRUEBA NADA. Devuelve datos y avisos; el veredicto es del
//      equipo. Si algún día devolviera "aprobado", dejaría de ser una
//      ayuda de captura y la cláusula de deslinde del maestro §06
//      pasaría a ser falsa.
//   2. NO PISA lo que la empresa ya escribió.
//   3. Todo lo que rellena queda POR CONFIRMAR hasta que ella lo toca.
//
// Y las vigencias, que no necesitan IA: salen de las fechas ya
// capturadas y son la mitad honesta de la revisión previa.
// ==============================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { leerDocumento, LEYENDA_LECTURA } from "../public/js/data/lectura-documentos.js";
import { vigenciasPorVencer, MESES_AVISO_VIGENCIA } from "../public/js/data/expediente.js";

const archivo = (name) => ({ name });

describe("lo que devuelve la lectura", () => {
  test("prellena los campos del documento y sus materiales", async () => {
    const lectura = await leerDocumento({ id: "autorizacion_sma" }, archivo("auth.pdf"));

    assert.equal(lectura.legible, true);
    assert.equal(lectura.campos.numero_oficio, "SMA-RC-2025-0317");
    assert.equal(lectura.campos.vigencia, "2027-03-14");
    assert.deepEqual(lectura.materiales, ["pet", "hdpe"]);
  });

  // El límite que no se cruza: la lectura no emite veredictos. Si esta
  // prueba falla, alguien convirtió una ayuda de captura en una
  // revisión automática.
  test("nunca aprueba ni rechaza nada", async () => {
    const lectura = await leerDocumento({ id: "autorizacion_sma" }, archivo("auth.pdf"));

    assert.equal(lectura.aprobado, undefined);
    assert.equal(lectura.estado, undefined);
    assert.equal(lectura.veredicto, undefined);
    assert.ok(!("valido" in lectura));
  });

  test("un documento sin ejemplo no inventa campos", async () => {
    const lectura = await leerDocumento({ id: "constancia_fiscal" }, archivo("csf.pdf"));

    assert.deepEqual(lectura.campos, {});
    assert.deepEqual(lectura.materiales, []);
    assert.equal(lectura.legible, true);
  });

  test("avisa cuando el nombre no coincide con la razón social", async () => {
    const igual = await leerDocumento({ id: "constancia_fiscal" }, archivo("csf.pdf"), {
      razonSocial: "Metales del Nazas S.A. de C.V.",
    });
    const distinto = await leerDocumento({ id: "constancia_fiscal" }, archivo("no-coincide.pdf"));

    assert.equal(igual.coincide, true);
    assert.equal(distinto.coincide, false);
  });

  // La leyenda acompaña a todo lo que sale de aquí. No es relleno
  // legal: lo prellenado es una lectura, no un dato verificado.
  test("la leyenda dice que es automática y que EcoConnect no valida", () => {
    assert.match(LEYENDA_LECTURA, /autom[áa]tica/i);
    assert.match(LEYENDA_LECTURA, /verifica/i);
    assert.match(LEYENDA_LECTURA, /no valida la autenticidad/i);
  });
});

describe("autorizaciones por vencer", () => {
  const HOY = new Date("2026-09-22T12:00:00");

  test("avisa de las que vencen dentro del plazo", () => {
    const avisos = vigenciasPorVencer(
      [{ id: "a", tipo_documento: "autorizacion_sma", vigencia: "2026-11-30" }],
      { hoy: HOY },
    );

    assert.equal(avisos.length, 1);
    assert.equal(avisos[0].vencida, false);
    assert.match(avisos[0].nombre, /Autorización/);
  });

  // Tres meses: lo que tarda un refrendo. Avisar el día que vence no
  // sirve de nada.
  test("el plazo son tres meses", () => {
    assert.equal(MESES_AVISO_VIGENCIA, 3);

    const lejos = vigenciasPorVencer(
      [{ id: "a", tipo_documento: "autorizacion_sma", vigencia: "2027-06-01" }],
      { hoy: HOY },
    );

    assert.deepEqual(lejos, []);
  });

  test("una vencida se marca como tal, no como próxima a vencer", () => {
    const avisos = vigenciasPorVencer(
      [{ id: "a", tipo_documento: "poliza_seguro", vigencia: "2026-01-15" }],
      { hoy: HOY },
    );

    assert.equal(avisos[0].vencida, true);
  });

  // El registro de generador no vence (maestro §20), así que nunca
  // guarda vigencia y no puede aparecer aquí.
  test("un documento sin vigencia no genera aviso", () => {
    const avisos = vigenciasPorVencer(
      [{ id: "a", tipo_documento: "registro_generador", vigencia: null }],
      { hoy: HOY },
    );

    assert.deepEqual(avisos, []);
  });

  test("las más urgentes salen primero", () => {
    const avisos = vigenciasPorVencer([
      { id: "a", tipo_documento: "autorizacion_sma", vigencia: "2026-11-30" },
      { id: "b", tipo_documento: "poliza_seguro", vigencia: "2026-10-01" },
    ], { hoy: HOY });

    assert.deepEqual(avisos.map((a) => a.id), ["b", "a"]);
  });
});
