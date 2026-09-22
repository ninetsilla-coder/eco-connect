// ==============================================================
// ui/documentos.js y la lectura de documentos de cumplimiento
// ==============================================================
// Durante meses los permisos, licencias y seguros se subían y no se
// mostraban en ningún sitio: `urlsDeDocumentos()` existía sin que la
// llamara nadie. Estas pruebas fijan la pantalla que cierra ese hueco.
// ==============================================================

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { montarDom } from "./ayudas/dom.js";
import { reiniciar, registro, programar, ultimaConsulta } from "./dobles/supabase.js";

montarDom();

const { crearListaDocumentos, crearBloqueDocumentos } = await import(
  "../public/js/ui/documentos.js"
);
const { listarCumplimientoDeServicio, documentosDeCumplimiento, BUCKET_TRANSPORTE } =
  await import("../public/js/data/cumplimiento.js");

beforeEach(reiniciar);

describe("lista de documentos", () => {
  const URLS = [
    "https://fake.supabase.co/firmada/docs-transporte/u-1/a.pdf?exp=3600",
    "https://fake.supabase.co/firmada/docs-transporte/u-1/b.png?exp=3600",
  ];

  test("pinta un enlace por documento", () => {
    const bloque = crearListaDocumentos(URLS);
    assert.equal(bloque.querySelectorAll("a").length, 2);
  });

  test("cada enlace apunta a su URL firmada", () => {
    const enlaces = [...crearListaDocumentos(URLS).querySelectorAll("a")];
    assert.deepEqual(enlaces.map((a) => a.getAttribute("href")), URLS);
  });

  // Sin rel="noopener", la pestaña que se abre puede manipular la
  // nuestra por window.opener.
  test("los enlaces se abren aislados de esta pestaña", () => {
    const enlace = crearListaDocumentos(URLS).querySelector("a");

    assert.equal(enlace.getAttribute("target"), "_blank");
    assert.match(enlace.getAttribute("rel"), /noopener/);
  });

  test("la etiqueta lleva la posición y la extensión, no el UUID", () => {
    const enlaces = [...crearListaDocumentos(URLS).querySelectorAll("a")];

    assert.equal(enlaces[0].textContent, "Documento 1 (.pdf)");
    assert.equal(enlaces[1].textContent, "Documento 2 (.png)");
  });

  test("sin documentos lo dice en vez de dejar un hueco", () => {
    const bloque = crearListaDocumentos([]);

    assert.equal(bloque.querySelectorAll("a").length, 0);
    assert.equal(bloque.textContent, "Sin archivos.");
  });

  test("un valor nulo no rompe la pantalla", () => {
    assert.equal(crearListaDocumentos(null).querySelectorAll("a").length, 0);
    assert.equal(crearListaDocumentos(undefined).querySelectorAll("a").length, 0);
  });

  test("el título se pinta como texto", () => {
    const bloque = crearListaDocumentos(URLS, { titulo: "Permisos" });
    assert.equal(bloque.querySelector("strong").textContent, "Permisos");
  });

  // La URL viene firmada por Supabase, pero el módulo no la interpreta
  // como marcado en ningún caso.
  test("una URL con HTML no se convierte en elementos", () => {
    const bloque = crearListaDocumentos(['<img src=x onerror="alert(1)">']);

    assert.equal(bloque.querySelectorAll("img").length, 0);
    assert.equal(bloque.querySelectorAll("a").length, 1);
  });
});

describe("bloque con varios grupos", () => {
  test("pinta un grupo por categoría, incluso los vacíos", () => {
    const bloque = crearBloqueDocumentos([
      { titulo: "Permisos", urls: ["https://x/a.pdf"] },
      { titulo: "Certificaciones", urls: [] },
      { titulo: "Seguros", urls: [] },
    ]);

    assert.equal(bloque.querySelectorAll(".documentos-grupo").length, 3);
    assert.equal(bloque.querySelectorAll("a").length, 1);
    // Un grupo vacío que desaparece haría pensar que no existe esa
    // categoría; se muestra para que se vea qué falta.
    assert.match(bloque.textContent, /Certificaciones/);
  });
});

describe("listarCumplimientoDeServicio", () => {
  test("filtra por el servicio y por el usuario", async () => {
    await listarCumplimientoDeServicio("u-1", "s-9");

    const consulta = ultimaConsulta();
    assert.equal(consulta.tabla, "cumplimiento_transporte");
    assert.ok(
      consulta.filtros.some(([op, c, v]) => op === "eq" && c === "user_id" && v === "u-1"),
      "falta el filtro de propiedad"
    );
    assert.ok(
      consulta.filtros.some(([op, c, v]) => op === "eq" && c === "servicio_id" && v === "s-9")
    );
  });

  test("pide el historial del más reciente al más antiguo", async () => {
    await listarCumplimientoDeServicio("u-1", "s-9");
    assert.equal(ultimaConsulta().orden.ascending, false);
  });
});

describe("documentosDeCumplimiento", () => {
  test("devuelve los tres grupos en orden", async () => {
    const grupos = await documentosDeCumplimiento({
      permisos_urls: ["u-1/s-9/permisos/a.pdf"],
      certificaciones_urls: null,
      seguros_urls: ["u-1/s-9/seguros/b.pdf"],
    });

    assert.deepEqual(grupos.map((g) => g.titulo), [
      "Permisos",
      "Certificaciones",
      "Seguros",
    ]);
  });

  // docs-transporte es privado: una URL pública ya no resolvería.
  test("las rutas se firman, no se sirven en claro", async () => {
    const [permisos] = await documentosDeCumplimiento({
      permisos_urls: ["u-1/s-9/permisos/a.pdf"],
    });

    assert.equal(permisos.urls.length, 1);
    assert.match(permisos.urls[0], /\/firmada\//);
    assert.equal(BUCKET_TRANSPORTE, "docs-transporte");
  });

  test("un registro sin archivos devuelve los grupos vacíos, no falla", async () => {
    const grupos = await documentosDeCumplimiento({});
    assert.deepEqual(grupos.map((g) => g.urls.length), [0, 0, 0]);
  });

  test("un registro inexistente tampoco rompe", async () => {
    const grupos = await documentosDeCumplimiento(undefined);
    assert.equal(grupos.length, 3);
  });
});
