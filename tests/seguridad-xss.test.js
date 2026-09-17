// ==============================================================
// Regresión de XSS almacenado
// ==============================================================
// Antes de la migración, las listas y los detalles se construían así:
//
//   meta.innerHTML += `<span>Cantidad: ${r.cantidad}</span>`
//
// En comprador-explorar-residuos y en las páginas de detalle, esos
// campos vienen de publicaciones de OTRAS empresas. Bastaba con
// publicar un residuo con HTML en un campo para ejecutar código en el
// navegador de cada comprador que lo abriera.
//
// Estas pruebas fijan la corrección: el contenido de la base entra como
// TEXTO, nunca como marcado.
// ==============================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { montarDom } from "./ayudas/dom.js";

montarDom();

const { crearTarjetaResiduo } = await import("../public/js/ui/residuo-card.js");
const { crearMeta, crearDescripcion, crearTitulo, crearGaleria } = await import(
  "../public/js/ui/detalle.js"
);

const CARGA = '<img src=x onerror="window.pwned=1">';
const CAMPOS = [
  ["Cantidad", "cantidad"],
  ["Ubicación", "ubicacion"],
];

describe("tarjeta de residuo", () => {
  test("el HTML de un campo no se convierte en elementos", () => {
    const { item } = crearTarjetaResiduo(
      { tipo: "Chatarra", cantidad: CARGA, categoria: "procesado" },
      CAMPOS
    );

    assert.equal(item.querySelectorAll("img").length, 0);
    assert.ok(item.textContent.includes(CARGA), "debe verse como texto literal");
  });

  test("el HTML del título tampoco se interpreta", () => {
    const { item } = crearTarjetaResiduo({ tipo: CARGA }, CAMPOS);

    assert.equal(item.querySelectorAll("img").length, 0);
    assert.equal(item.querySelector(".residuo-title").textContent, CARGA);
  });

  test("el HTML de la descripción tampoco se interpreta", () => {
    const { item } = crearTarjetaResiduo({ tipo: "X", descripcion: CARGA }, CAMPOS);

    assert.equal(item.querySelectorAll("img").length, 0);
    assert.equal(item.querySelector(".residuo-descripcion").textContent, CARGA);
  });

  test("los campos vacíos se omiten en vez de pintarse a medias", () => {
    const { meta } = crearTarjetaResiduo({ tipo: "X", cantidad: "3 t" }, CAMPOS);

    assert.equal(meta.children.length, 1);
    assert.equal(meta.textContent, "Cantidad: 3 t");
  });
});

describe("bloques de detalle", () => {
  test("crearMeta escapa el valor", () => {
    const meta = crearMeta([["Cantidad", CARGA]]);

    assert.equal(meta.querySelectorAll("img").length, 0);
    assert.ok(meta.textContent.includes(CARGA));
  });

  test("crearMeta conserva la etiqueta en negrita", () => {
    const meta = crearMeta([["Cantidad", "3 t"]]);

    assert.equal(meta.querySelector("strong").textContent, "Cantidad: ");
    assert.equal(meta.textContent, "Cantidad: 3 t");
  });

  test("crearDescripcion y crearTitulo escapan", () => {
    assert.equal(crearDescripcion(CARGA).querySelectorAll("img").length, 0);
    assert.equal(crearTitulo(CARGA).querySelectorAll("img").length, 0);
    assert.equal(crearTitulo(CARGA).textContent, CARGA);
  });

  test("una descripción vacía no produce nodo", () => {
    assert.equal(crearDescripcion(""), null);
    assert.equal(crearDescripcion(null), null);
  });

  test("la galería sin fotos no produce nodo", () => {
    assert.equal(crearGaleria([], "alt"), null);
    assert.equal(crearGaleria(null, "alt"), null);
  });

  // El src de una imagen sigue viniendo de la base. No es ejecución de
  // HTML, pero conviene saber que se pinta tal cual.
  test("la galería pinta una imagen por URL", () => {
    const galeria = crearGaleria(["a.png", "b.png"], "Foto");
    assert.equal(galeria.querySelectorAll("img").length, 2);
  });
});
