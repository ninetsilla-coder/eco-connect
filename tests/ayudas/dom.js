// ==============================================================
// DOM para pruebas
// ==============================================================
// jsdom es la ÚNICA dependencia del proyecto, y solo de desarrollo.
// Se justifica por las pruebas de regresión de XSS: sin un DOM real no
// se puede comprobar que un campo con HTML se queda en texto plano.
// ==============================================================

import { JSDOM } from "jsdom";

// Monta un documento vacío y publica document/window como globales,
// que es lo que esperan los módulos de ui/.
export function montarDom(html = "<!doctype html><html><body></body></html>") {
  const dom = new JSDOM(html);
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  return dom;
}

export function desmontarDom() {
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.HTMLElement;
}
