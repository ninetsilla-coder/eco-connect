// ==============================================================
// Estabilidad de dependencias
// ==============================================================
// Eco Connect no tiene bundler ni linter (CLAUDE.md §1-§2), así que
// nada impide que un import se escriba mal y el fallo aparezca meses
// después en el navegador de un usuario. Estas pruebas ocupan ese
// hueco: fijan las dos mitades del grafo de dependencias.
//
//   EXTERNAS  lo que el navegador descarga de terceros. El riesgo es
//             que una versión flote y un cambio ajeno rompa el sitio
//             sin que nadie toque el repositorio.
//
//   INTERNAS  quién importa a quién dentro de public/js. El riesgo es
//             que la arquitectura de §4.1 se erosione import a import
//             hasta volver a la maraña que la migración deshizo.
//
// No tocan la red: todo se lee del disco.
// ==============================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const RAIZ = new URL("../", import.meta.url);
const JS = new URL("public/js/", RAIZ);

const leer = (url) => readFileSync(url, "utf8");

// Todos los módulos bajo public/js, como rutas "capa/archivo.js".
const MODULOS = readdirSync(JS, { recursive: true, withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".js"))
  .map((e) => `${e.parentPath.split(/[\\/]/).pop()}/${e.name}`)
  .sort();

const PAGINAS_HTML = readdirSync(new URL("public/", RAIZ))
  .filter((n) => n.endsWith(".html"))
  .sort();

const fuente = (modulo) => leer(new URL(modulo, JS));

// Devuelve los especificadores de todos los `from "..."` de un módulo.
function importesDe(modulo) {
  const especificadores = [];
  const patron = /\bfrom\s+["']([^"']+)["']/g;
  let coincidencia;
  while ((coincidencia = patron.exec(fuente(modulo))) !== null) {
    especificadores.push(coincidencia[1]);
  }
  return especificadores;
}

// "pages/mis-residuos.js" + "../data/residuos.js" -> "data/residuos.js"
function resolver(modulo, especificador) {
  const capa = modulo.split("/")[0];
  if (especificador.startsWith("./")) return `${capa}/${especificador.slice(2)}`;
  if (especificador.startsWith("../")) return especificador.slice(3);
  return null; // externo
}

const IMPORTES_INTERNOS = Object.fromEntries(
  MODULOS.map((m) => [
    m,
    importesDe(m)
      .map((e) => resolver(m, e))
      .filter(Boolean),
  ])
);

// ==============================================================
// 1. Dependencias externas
// ==============================================================

describe("dependencias externas", () => {
  const IMPORTES_HTTP = MODULOS.flatMap((m) =>
    importesDe(m)
      .filter((e) => e.startsWith("http"))
      .map((especificador) => ({ modulo: m, especificador }))
  );

  // El CDN se fija a propósito: cambiarlo en silencio también rompe el
  // hook de resolución de las pruebas (ayudas/cargador.js), que casa
  // contra este prefijo.
  const CDN_PERMITIDO = "https://esm.sh/";

  test("hay al menos un import por CDN que revisar", () => {
    assert.ok(IMPORTES_HTTP.length > 0, "¿desapareció el cliente de Supabase?");
  });

  test("todo import por CDN sale del CDN acordado", () => {
    IMPORTES_HTTP.forEach(({ modulo, especificador }) => {
      assert.ok(
        especificador.startsWith(CDN_PERMITIDO),
        `${modulo} importa de un CDN no acordado: ${especificador}`
      );
    });
  });

  // El corazón de la parte externa. Con `@2` flotante, esm.sh sirve la
  // última 2.x: una publicación de Supabase puede romper el sitio sin
  // que nadie haya tocado el repositorio. Subir la versión debe ser un
  // commit deliberado, y esta prueba lo obliga.
  test("todo import por CDN fija una versión exacta", () => {
    IMPORTES_HTTP.forEach(({ modulo, especificador }) => {
      const resto = especificador.slice(CDN_PERMITIDO.length);
      const arroba = resto.lastIndexOf("@");

      assert.ok(arroba > 0, `${modulo} importa sin versión: ${especificador}`);

      const version = resto.slice(arroba + 1).split(/[/?]/)[0];
      assert.match(
        version,
        /^\d+\.\d+\.\d+$/,
        `${modulo} no fija una versión exacta (${version}): ${especificador}`
      );
    });
  });

  // Si alguien mueve el import a otro paquete o CDN, el hook deja de
  // interceptarlo y las pruebas de core/ y data/ fallan al cargar con
  // un error de red confuso. Mejor fallar aquí, diciendo por qué.
  test("el hook de pruebas intercepta el import real", () => {
    const cargador = leer(new URL("ayudas/cargador.js", import.meta.url));

    IMPORTES_HTTP.forEach(({ especificador }) => {
      const sinVersion = especificador.slice(0, especificador.lastIndexOf("@"));
      assert.ok(
        cargador.includes(sinVersion),
        `ayudas/cargador.js no intercepta ${sinVersion}; actualízalo o las pruebas no podrán cargar los módulos`
      );
    });
  });
});

// ==============================================================
// 2. Recursos externos de los HTML
// ==============================================================

describe("recursos externos de las páginas", () => {
  const HOSTS_PERMITIDOS = [
    "fonts.googleapis.com",
    "fonts.gstatic.com",
  ];

  const urlsExternasDe = (html) => [
    ...leer(new URL(`public/${html}`, RAIZ)).matchAll(/(?:href|src)="(https?:\/\/[^"]+)"/g),
  ].map((m) => m[1]);

  test("ninguna página carga recursos de un host no acordado", () => {
    PAGINAS_HTML.forEach((html) => {
      urlsExternasDe(html).forEach((url) => {
        const host = new URL(url).host;
        assert.ok(
          HOSTS_PERMITIDOS.includes(host),
          `${html} carga de ${host}, que no está en la lista acordada`
        );
      });
    });
  });

  // Trece páginas que piden subconjuntos distintos de fuentes se ven
  // distintas entre sí. La declaración tiene que ser una sola.
  test("todas las páginas piden exactamente la misma hoja de fuentes", () => {
    const hojas = PAGINAS_HTML.map(
      (html) => urlsExternasDe(html).find((u) => u.includes("fonts.googleapis.com/css2")) ?? null
    );

    assert.equal(hojas.filter(Boolean).length, PAGINAS_HTML.length, "alguna página no pide fuentes");
    assert.equal(new Set(hojas).size, 1, `hay ${new Set(hojas).size} variantes de la hoja de fuentes`);
  });
});

// ==============================================================
// 3. Fuentes: que lo declarado en CSS tenga quien lo sirva
// ==============================================================
// Un `font-family` que nadie descarga no da error: cae al fallback y
// el sitio se ve mal sin avisar. Es exactamente lo que pasó con
// "Cy Grotesk Key" (CLAUDE.md §7), y con dos grafías distintas.

describe("fuentes declaradas en CSS", () => {
  // Familias que el navegador resuelve sin descargar nada.
  const DEL_SISTEMA = new Set([
    "system-ui", "sans-serif", "serif", "monospace", "cursive", "fantasy",
    "-apple-system", "blinkmacsystemfont", "segoe ui", "roboto", "helvetica",
    "arial", "inherit", "initial", "unset",
  ]);

  // Excepción declarada, no accidental: "Cy Grotesk Key" es una fuente
  // comercial que no está en Google Fonts y hoy no se sirve desde
  // ningún sitio. Hasta que se aloje en public/ o se sustituya, todas
  // esas reglas caen a system-ui. Está en CLAUDE.md §7 como pendiente.
  // Al sacarla de aquí, esta prueba dirá dónde se usa.
  const SIN_PROVEEDOR = new Set(["cy grotesk key"]);

  const css = leer(new URL("public/css/style.css", RAIZ));
  const hoja = leer(new URL(`public/${PAGINAS_HTML[0]}`, RAIZ)).match(
    /fonts\.googleapis\.com\/css2\?([^"]+)/
  )?.[1];

  // family=Anton&family=Poppins:wght@400;500 -> ["anton", "poppins"]
  const DESCARGADAS = new Set(
    [...(hoja ?? "").matchAll(/family=([^&:]+)/g)].map((m) =>
      decodeURIComponent(m[1]).replace(/\+/g, " ").toLowerCase()
    )
  );

  // Las familias declaradas en CSS, normalizadas: el nombre es
  // insensible a mayúsculas según la especificación, así que
  // "poppins" y "Poppins" son la misma fuente.
  const DECLARADAS = new Set(
    [...css.matchAll(/font-family:\s*([^;}]+)/g)].flatMap((m) =>
      m[1]
        .split(",")
        .map((f) => f.trim().replace(/^["']|["']$/g, "").toLowerCase())
        .filter(Boolean)
    )
  );

  test("la hoja de Google Fonts se pudo leer", () => {
    assert.ok(DESCARGADAS.size > 0, "no se encontró ninguna family= en el <link>");
  });

  test("toda fuente usada en CSS la sirve alguien, o está declarada como pendiente", () => {
    const huerfanas = [...DECLARADAS].filter(
      (f) => !DEL_SISTEMA.has(f) && !DESCARGADAS.has(f) && !SIN_PROVEEDOR.has(f)
    );

    assert.deepEqual(
      huerfanas,
      [],
      `estas familias no las descarga nadie y caerán al fallback: ${huerfanas.join(", ")}`
    );
  });

  // La grafía correcta es "Cy Grotesk Key". Escrita de dos formas, son
  // dos dependencias rotas en vez de una, y la que se arregle dejará
  // la otra atrás.
  test("cada fuente se escribe de una sola forma", () => {
    const erratas = [...DECLARADAS].filter((f) => f.includes("grotek"));
    assert.deepEqual(erratas, [], `grafías alternativas de Cy Grotesk Key: ${erratas.join(", ")}`);
  });
});

// ==============================================================
// 4. Dependencias internas: las capas de §4.1
// ==============================================================

describe("capas de public/js", () => {
  // De qué capas puede importar cada capa. Es §4.1 en forma ejecutable.
  //
  //   core   no conoce a nadie: es la base.
  //   data   solo habla con core. Nunca con ui ni con otra data.
  //   ui     pinta; no consulta. Por eso no puede importar data.
  //   pages  es el pegamento: puede usar las tres.
  const PERMITIDO = {
    core: ["core"],
    data: ["core"],
    ui: ["core", "ui"],
    pages: ["core", "data", "ui"],
  };

  test("las capas son exactamente las cuatro previstas", () => {
    const capas = [...new Set(MODULOS.map((m) => m.split("/")[0]))].sort();
    assert.deepEqual(capas, ["core", "data", "pages", "ui"]);
  });

  test("ningún módulo importa de una capa que tiene prohibida", () => {
    const violaciones = [];

    Object.entries(IMPORTES_INTERNOS).forEach(([modulo, destinos]) => {
      const capa = modulo.split("/")[0];
      destinos.forEach((destino) => {
        const capaDestino = destino.split("/")[0];
        if (!PERMITIDO[capa].includes(capaDestino)) {
          violaciones.push(`${modulo} -> ${destino}`);
        }
      });
    });

    assert.deepEqual(violaciones, [], `imports entre capas no permitidos:\n${violaciones.join("\n")}`);
  });

  // Si un módulo compartido importa de pages/, deja de ser compartido:
  // arrastra el DOM de una página concreta a todas las demás.
  test("nadie importa de pages/", () => {
    const culpables = Object.entries(IMPORTES_INTERNOS)
      .filter(([, destinos]) => destinos.some((d) => d.startsWith("pages/")))
      .map(([m]) => m);

    assert.deepEqual(culpables, []);
  });

  test("todo import interno apunta a un archivo que existe", () => {
    const rotos = Object.entries(IMPORTES_INTERNOS).flatMap(([modulo, destinos]) =>
      destinos.filter((d) => !MODULOS.includes(d)).map((d) => `${modulo} -> ${d}`)
    );

    assert.deepEqual(rotos, [], `imports a archivos inexistentes:\n${rotos.join("\n")}`);
  });

  // §4.2: toda query de una tabla vive en data/<tabla>.js. Eso es lo
  // que hace que añadir una columna sea UNA edición en vez de una
  // búsqueda por todo el repo.
  //
  // La regla estaba escrita pero no vigilada: el permiso pages -> core
  // deja que una página importe el cliente y escriba su propia
  // consulta. Nada la detendría, y la capa de datos se erosionaría una
  // query cada vez, que es justo de donde venía la migración.
  test("ninguna página puede llegar al cliente de Supabase", () => {
    const culpables = MODULOS.filter(
      (m) => m.startsWith("pages/") && IMPORTES_INTERNOS[m].includes("core/supabase.js")
    );

    assert.deepEqual(
      culpables,
      [],
      `estas páginas importan el cliente y podrían saltarse data/: ${culpables.join(", ")}`
    );
  });

  // Y la regla general, por si el cliente llega por otra vía.
  //
  // Solo se miran los `.from("tabla")` con literal: `.from(bucket)` es
  // Storage y `Array.from(...)` no tiene nada que ver. Si algún día se
  // llama a storage.from() con un literal, habrá que distinguirlos.
  test("las consultas a tablas solo viven en data/", () => {
    // Excepción declarada: core/sesion.js resuelve el perfil junto con
    // la sesión, y no puede importar data/ porque core no conoce a
    // nadie (§4.1). Es la única, y está aquí para que se vea.
    const EXCEPCIONES = { "core/sesion.js": ["profiles"] };

    const fuera = MODULOS.flatMap((modulo) =>
      [...fuente(modulo).matchAll(/\.from\(\s*["']([^"']+)["']/g)]
        .map((c) => c[1])
        .filter((tabla) => {
          if (modulo.startsWith("data/")) return false;
          return !EXCEPCIONES[modulo]?.includes(tabla);
        })
        .map((tabla) => `${modulo} consulta "${tabla}"`)
    );

    assert.deepEqual(fuera, [], `queries fuera de data/:\n${fuera.join("\n")}`);
  });

  // Un ciclo en módulos ES no revienta: deja una exportación en
  // `undefined` en tiempo de carga, y el error aparece lejos de su
  // causa. Más barato prohibirlos.
  test("el grafo de imports no tiene ciclos", () => {
    const estado = {};
    const ciclos = [];

    const visitar = (modulo, camino) => {
      if (estado[modulo] === "cerrado") return;
      if (estado[modulo] === "abierto") {
        ciclos.push([...camino.slice(camino.indexOf(modulo)), modulo].join(" -> "));
        return;
      }
      estado[modulo] = "abierto";
      (IMPORTES_INTERNOS[modulo] ?? []).forEach((d) => visitar(d, [...camino, modulo]));
      estado[modulo] = "cerrado";
    };

    MODULOS.forEach((m) => visitar(m, []));
    assert.deepEqual(ciclos, [], `ciclos detectados:\n${ciclos.join("\n")}`);
  });
});

// ==============================================================
// 5. La frontera HTML -> JS
// ==============================================================

describe("cada página carga su módulo", () => {
  const scriptsDe = (html) =>
    [...leer(new URL(`public/${html}`, RAIZ)).matchAll(/<script\b[^>]*>/g)].map((m) => m[0]);

  test("cada HTML carga exactamente un script, y es un módulo", () => {
    PAGINAS_HTML.forEach((html) => {
      const scripts = scriptsDe(html);
      assert.equal(scripts.length, 1, `${html} carga ${scripts.length} scripts, debe ser 1`);
      assert.match(scripts[0], /type="module"/, `${html} no lo carga como módulo`);
    });
  });

  test("el módulo que carga cada página es el de su mismo nombre", () => {
    PAGINAS_HTML.forEach((html) => {
      const esperado = `js/pages/${html.replace(/\.html$/, ".js")}`;
      assert.match(scriptsDe(html)[0], new RegExp(`src="${esperado}"`), `${html} debe cargar ${esperado}`);
    });
  });

  test("no sobra ni falta ningún módulo de página", () => {
    const enDisco = MODULOS.filter((m) => m.startsWith("pages/")).sort();
    const esperados = PAGINAS_HTML.map((h) => `pages/${h.replace(/\.html$/, ".js")}`).sort();
    assert.deepEqual(enDisco, esperados);
  });

  // Un módulo que ninguna página alcanza es código que nadie ejecuta
  // pero todos mantienen.
  test("todo módulo es alcanzable desde alguna página", () => {
    const alcanzados = new Set();
    const recorrer = (m) => {
      if (alcanzados.has(m)) return;
      alcanzados.add(m);
      (IMPORTES_INTERNOS[m] ?? []).forEach(recorrer);
    };

    MODULOS.filter((m) => m.startsWith("pages/")).forEach(recorrer);

    const huerfanos = MODULOS.filter((m) => !alcanzados.has(m));
    assert.deepEqual(huerfanos, [], `módulos que nadie importa: ${huerfanos.join(", ")}`);
  });
});
