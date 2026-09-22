// ==============================================================
// Promesas que el sitio no puede hacer
// ==============================================================
// El modelo cambió en septiembre de 2026: EcoConnect **no certifica**
// a nadie ni verifica documentos. Coteja números de autorización
// contra el padrón público de la SMA y publica el EcoConnect Score
// (docs/documento-maestro.md §03 y §06, docs/cambios-plataforma.md §11).
//
// Esto no es preferencia de redacción. La cláusula de deslinde del
// documento maestro §06 —"EcoConnect no valida la autenticidad ni el
// contenido de dicha documentación"— se cae si una página del sitio
// promete lo contrario, y quien escriba la próxima sección de la
// portada no va a tener ese documento delante.
//
// Por eso vive aquí y no en una nota: una promesa legal la defiende
// mejor una prueba que un recordatorio.
//
// No toca la red: todo se lee del disco.
// ==============================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const RAIZ = new URL("../", import.meta.url);
const PUBLICO = new URL("public/", RAIZ);

// Todo lo que acaba llegando al navegador: las páginas y sus módulos.
// Las rutas llegan relativas a public/ y con la barra del sistema, así
// que se normalizan antes de convertirlas en URL.
const ARCHIVOS = readdirSync(PUBLICO, { recursive: true })
  .filter((ruta) => ruta.endsWith(".html") || ruta.endsWith(".js"))
  .map((ruta) => ruta.split(/[\\/]/).join("/"))
  .sort()
  .map((ruta) => ({ nombre: ruta, url: new URL(ruta, PUBLICO) }));

// Cada patrón con el motivo por el que no se puede escribir, para que
// el mensaje del fallo explique qué poner en su lugar.
const PROHIBIDAS = [
  {
    patron: /certificaci[oó]n\s+eco\s*-?\s*connect/i,
    motivo:
      'EcoConnect no certifica a nadie. El indicador se llama "EcoConnect Score".',
  },
  {
    patron: /proveedor(?:es)?\s+verificad[oa]s?/i,
    motivo:
      "No se verifica a ningún proveedor: se cotejan sus permisos con el padrón público de la SMA.",
  },
  {
    patron: /recicladores?\s+certificad[oa]s?/i,
    motivo:
      "Las empresas están autorizadas por la SMA; EcoConnect no las certifica.",
  },
];

describe("promesas prohibidas en el sitio", () => {
  for (const { patron, motivo } of PROHIBIDAS) {
    test(`ninguna página dice ${patron.source}`, () => {
      const culpables = [];

      for (const { nombre, url } of ARCHIVOS) {
        const lineas = readFileSync(url, "utf8").split(/\r?\n/);
        lineas.forEach((linea, indice) => {
          if (patron.test(linea)) culpables.push(`${nombre}:${indice + 1}`);
        });
      }

      assert.deepEqual(culpables, [], `${motivo}\nAparece en: ${culpables.join(", ")}`);
    });
  }

  // Control positivo. Las tres pruebas de arriba comprueban que algo NO
  // aparece, así que pasarían todas si la lista de archivos estuviera
  // vacía por un error de rutas — y el sitio quedaría sin vigilancia
  // sin que nadie lo notara. Es la misma trampa que los controles
  // positivos de herramientas/verificar-politicas.mjs.
  test("se están leyendo de verdad las páginas del sitio", () => {
    assert.ok(
      ARCHIVOS.some((a) => a.nombre === "index.html"),
      "no se encontró index.html: las prohibiciones de arriba no están mirando nada",
    );
    assert.ok(ARCHIVOS.length > 20, `solo se leyeron ${ARCHIVOS.length} archivos`);
  });
});
