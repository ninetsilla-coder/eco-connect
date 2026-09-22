// ==============================================================
// Estado de la cuenta
// ==============================================================
// Qué puede hacer una empresa según su estado
// (docs/cambios-plataforma.md §3).
//
// ⚠️ Lo que se prueba aquí es EXPERIENCIA DE USUARIO, no seguridad. El
// botón apagado no impide nada: quien llame a la API directamente
// publica igual, porque las políticas de la base todavía no comprueban
// el estado (D-15, CLAUDE.md §7). Estas pruebas fijan que el aviso sea
// correcto, no que el control exista.
//
// Aun así importan dos cosas:
//
//   1. QUE SOLO `verificado` OPERE. Si un estado nuevo entra por
//      descuido en la lista de los que sí pueden, el prototipo enseña
//      un permiso que la empresa no tiene.
//   2. QUE UN ESTADO DESCONOCIDO NO ABRA LA PUERTA. Un valor raro en la
//      base —o una cuenta vieja sin estado— tiene que caer del lado que
//      pide papeles, nunca del que los da por buenos.
// ==============================================================

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { montarDom, desmontarDom } from "./ayudas/dom.js";
import {
  ESTADOS, infoEstado, puedeOperar, crearAvisoEstado, bloquearSiNoOpera,
} from "../public/js/ui/estado-cuenta.js";

describe("quién puede operar", () => {
  test("solo una cuenta verificada", () => {
    assert.equal(puedeOperar("verificado"), true);

    ["pendiente", "en_revision", "rechazado", "vencido", "actualizacion_pendiente"]
      .forEach((estado) => {
        assert.equal(puedeOperar(estado), false, estado);
      });
  });

  // El registro de generador no vence: se actualiza cada tres años. A
  // un generador no se le puede decir que perdió un permiso que sigue
  // teniendo, así que tiene su propio estado.
  test("un generador no vence, tiene actualización pendiente", () => {
    assert.match(infoEstado("actualizacion_pendiente").titulo, /Actualización/);
    assert.match(infoEstado("actualizacion_pendiente").detalle, /tres años/);
    assert.notEqual(
      infoEstado("actualizacion_pendiente").titulo,
      infoEstado("vencido").titulo,
    );
  });

  // El caso que más fácil se cuela: una cuenta anterior al 2026-09-22
  // sin estado, o un valor escrito a mano en el panel con una errata.
  test("un estado desconocido, nulo o con errata no opera", () => {
    [null, undefined, "", "verificada", "VERIFICADO", "otro"].forEach((estado) => {
      assert.equal(puedeOperar(estado), false, String(estado));
    });
  });

  test("un estado desconocido se explica como pendiente", () => {
    assert.equal(infoEstado("lo-que-sea").titulo, ESTADOS.pendiente.titulo);
  });

  test("cada estado tiene título y detalle escritos", () => {
    Object.entries(ESTADOS).forEach(([nombre, info]) => {
      assert.ok(info.titulo?.length > 0, nombre);
      assert.ok(info.detalle?.length > 0, nombre);
    });
  });
});

describe("el aviso en pantalla", () => {
  beforeEach(montarDom);
  afterEach(desmontarDom);

  test("una cuenta verificada no ve ningún aviso", () => {
    assert.equal(crearAvisoEstado("verificado"), null);
  });

  test("una cuenta pendiente ve qué le falta y cómo arreglarlo", () => {
    const aviso = crearAvisoEstado("pendiente", { accion: "publicar residuos" });

    assert.match(aviso.textContent, /Expediente pendiente/);
    assert.match(aviso.textContent, /no puedes publicar residuos/);
    assert.equal(aviso.querySelector("a").getAttribute("href"), "expediente.html");
  });

  // El texto del estado viene de nuestro catálogo, pero el patrón de
  // §4.4 se sostiene igual: nada se construye interpolando HTML.
  test("el aviso se arma con nodos, no con marcado", () => {
    const aviso = crearAvisoEstado("vencido", { accion: "<b>operar</b>" });
    assert.equal(aviso.querySelectorAll("b").length, 0);
    assert.match(aviso.textContent, /<b>operar<\/b>/);
  });
});

describe("los botones apagados", () => {
  beforeEach(montarDom);
  afterEach(desmontarDom);

  const boton = () => {
    const b = document.createElement("button");
    b.textContent = "Contactar generador";
    return b;
  };

  test("una cuenta verificada no pierde ningún botón", () => {
    const b = boton();
    assert.equal(bloquearSiNoOpera(b, "verificado"), false);
    assert.equal(b.disabled, false);
  });

  test("una cuenta pendiente lo encuentra apagado", () => {
    const b = boton();
    assert.equal(bloquearSiNoOpera(b, "pendiente", { accion: "contactar" }), true);
    assert.equal(b.disabled, true);
  });

  // Un botón gris y mudo no explica nada, y menos a quien usa un lector
  // de pantalla: el motivo tiene que viajar con él.
  test("el botón apagado dice por qué, también para un lector de pantalla", () => {
    const b = boton();
    bloquearSiNoOpera(b, "en_revision", { accion: "contactar" });

    assert.match(b.title, /En revisión/);
    assert.match(b.getAttribute("aria-label"), /Contactar generador/);
    assert.match(b.getAttribute("aria-label"), /expediente/);
  });

  test("sin botón no revienta", () => {
    assert.equal(bloquearSiNoOpera(null, "pendiente"), false);
  });
});
