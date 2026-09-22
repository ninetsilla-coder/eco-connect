// ==============================================================
// Ficha técnica del residuo
// ==============================================================
// Dos invariantes que no se ven fallar hasta que es tarde:
//
//   1. El DINERO. El comprador decide con el total que le enseñamos, y
//      ahí entra la comisión del 3% (documento maestro §12). Un cero de
//      más en ese cálculo es una operación mal cerrada, no un defecto
//      visual.
//
//   2. EL CATÁLOGO CERRADO. Es la primera de las tres capas que impiden
//      publicar un residuo peligroso (§04). Si un material se cuela en
//      la lista sin estar acordado, la capa deja de existir.
//
// Y la convivencia con lo viejo: las publicaciones anteriores al
// 2026-09-22 no tienen precio ni cantidad numérica. Tienen que seguir
// leyéndose, no desaparecer ni mostrar "$0".
// ==============================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { COMISION, totalesDeLote, textoPrecio, textoCantidad } from "../public/js/data/residuos.js";
import {
  MATERIALES, MUNICIPIOS, buscarMaterial, pideHumedad, etiqueta, PERIODICIDADES,
} from "../public/js/data/materiales.js";

describe("totales del lote", () => {
  test("multiplica precio por cantidad y suma la comisión", () => {
    const totales = totalesDeLote({ precio: 4000, cantidad_lote: 10 });

    assert.equal(totales.lote, 40000);
    assert.equal(totales.comision, 1200);
    assert.equal(totales.total, 41200);
  });

  test("la comisión es del 3%", () => {
    assert.equal(COMISION, 0.03);
  });

  // El ejemplo del documento maestro §08, entero. Si alguien cambia la
  // comisión "de paso", esta prueba dice exactamente qué se rompió.
  test("reproduce el ejemplo del documento maestro", () => {
    const texto = textoPrecio({ precio: 4000, cantidad_lote: 10, unidad: "t" });

    assert.match(texto, /\$4,000\/t/);
    assert.match(texto, /Lote de 10 t/);
    assert.match(texto, /\$40,000/);
    assert.match(texto, /3%/);
    assert.match(texto, /\$1,200/);
  });

  test("una publicación sin precio no inventa un total", () => {
    assert.equal(totalesDeLote({ cantidad_lote: 10 }), null);
    assert.equal(totalesDeLote({ precio: 4000 }), null);
    assert.equal(totalesDeLote({ precio: 0, cantidad_lote: 10 }), null);
    assert.equal(textoPrecio({ cantidad_lote: 10 }), "");
  });

  // PostgREST puede devolver los numéricos como cadena. Multiplicar
  // cadenas en JavaScript da resultados silenciosamente absurdos.
  test("acepta números que llegan como texto", () => {
    assert.equal(totalesDeLote({ precio: "4000", cantidad_lote: "10" }).lote, 40000);
  });
});

describe("cantidad legible", () => {
  test("une número y unidad en las publicaciones nuevas", () => {
    assert.equal(textoCantidad({ cantidad_lote: 10, unidad: "t" }), "10 t");
  });

  test("las publicaciones viejas conservan su texto libre", () => {
    assert.equal(textoCantidad({ cantidad: "500 kg por mes" }), "500 kg por mes");
  });

  test("sin ninguno de los dos no devuelve basura", () => {
    assert.equal(textoCantidad({}), "");
  });
});

describe("catálogo de materiales", () => {
  test("son los diez acordados, ni uno más", () => {
    assert.deepEqual(
      MATERIALES.map((m) => m.id),
      ["acero", "hierro", "hms", "cobre", "aluminio", "pet", "hdpe", "pp", "tarimas", "carton"],
    );
  });

  test("no se puede publicar algo que no está en el catálogo", () => {
    assert.equal(buscarMaterial("aceite-usado"), null);
    assert.equal(buscarMaterial("baterias"), null);
  });

  // La humedad cambia el peso que se paga, y solo importa donde el
  // material absorbe agua.
  test("la humedad se pide en cartón y plásticos, en los metales no", () => {
    assert.equal(pideHumedad("carton"), true);
    assert.equal(pideHumedad("pet"), true);
    assert.equal(pideHumedad("acero"), false);
    assert.equal(pideHumedad("cobre"), false);
  });

  test("el catálogo no se puede modificar en caliente", () => {
    assert.throws(() => MATERIALES.push({ id: "aceite" }));
  });

  // La fase 1 opera solo en Torreón y solo con permisos de Coahuila
  // (maestro §01 y §18). Un municipio de Durango en esta lista dejaría
  // publicar desde un marco legal que la plataforma no tiene cargado.
  test("en la fase 1 solo se publica desde Torreón", () => {
    assert.deepEqual(MUNICIPIOS, ["Torreón"]);
  });
});

describe("etiquetas de las listas", () => {
  test("traduce el identificador guardado", () => {
    assert.equal(etiqueta(PERIODICIDADES, "lote_unico"), "Lote único");
  });

  // Las publicaciones viejas guardaron `unica` y `constante`, que ya no
  // están en la lista. Devolver el valor crudo es feo; perderlo, peor.
  test("un valor viejo se muestra tal cual en vez de desaparecer", () => {
    assert.equal(etiqueta(PERIODICIDADES, "constante"), "constante");
    assert.equal(etiqueta(PERIODICIDADES, null), "");
  });
});
