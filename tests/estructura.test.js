// ==============================================================
// ui/estructura.js — cabecera y pie compartidos
// ==============================================================
// El markup vivía copiado en los 13 HTML. Doce copias eran idénticas y
// la decimotercera se había corregido sola, así que las doce restantes
// arrastraban tres fallos que nadie veía porque estaban repetidos:
// anclajes que solo resolvían en index.html, ocho páginas sin footer y
// un link CONTACTO que existía en una sola.
//
// Estas pruebas fijan las tres correcciones y, sobre todo, impiden que
// el markup vuelva a los HTML: una sola copia no puede divergir.
// ==============================================================

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { montarDom, desmontarDom } from "./ayudas/dom.js";
import { HEADER, FOOTER, IDS, montarEstructura } from "../public/js/ui/estructura.js";

const RAIZ = new URL("../", import.meta.url);
const leer = (url) => readFileSync(url, "utf8");

const PAGINAS = readdirSync(new URL("public/", RAIZ))
  .filter((n) => n.endsWith(".html"))
  .sort();

// ==============================================================
// 1. Una sola copia
// ==============================================================

describe("el markup no vuelve a los HTML", () => {
  test("ninguna página trae su propio header", () => {
    const culpables = PAGINAS.filter((p) =>
      /<header[^>]*class="[^"]*navbar/i.test(leer(new URL(`public/${p}`, RAIZ)))
    );

    assert.deepEqual(
      culpables,
      [],
      `estas páginas volvieron a copiar el header: ${culpables.join(", ")}`
    );
  });

  test("ninguna página trae su propio footer", () => {
    const culpables = PAGINAS.filter((p) =>
      /<footer/i.test(leer(new URL(`public/${p}`, RAIZ)))
    );

    assert.deepEqual(culpables, [], `footers copiados en: ${culpables.join(", ")}`);
  });

  // El número no es decoración: si una página desaparece sin querer,
  // las demás comprobaciones de este archivo la dejan de vigilar en
  // silencio y nadie se entera. 13 → 14 con `expediente.html`, → 16 con
  // `pago.html` y `manifiesto.html`, y → 15 al borrar
  // `gestion-ambiental.html`, que el expediente sustituye (D-5). Todo
  // el 2026-09-22. Cambiarlo es deliberado, nunca un efecto secundario.
  test("las 15 páginas siguen existiendo", () => {
    assert.equal(PAGINAS.length, 15);
  });

  // Antes el header estaba escrito en el HTML, así que una página que
  // se olvidara de montarNavbar() seguía teniendo cabecera. Ahora no:
  // sin esa llamada, la página sale sin menú y sin pie. Por eso esto
  // pasa a ser un invariante y no una costumbre.
  test("toda página llama a montarNavbar, o se queda sin cabecera", () => {
    const sinLlamada = PAGINAS.map((p) => p.replace(/\.html$/, ".js")).filter(
      (js) => !leer(new URL(`public/js/pages/${js}`, RAIZ)).includes("montarNavbar")
    );

    assert.deepEqual(
      sinLlamada,
      [],
      `estas páginas se quedarían sin cabecera ni pie: ${sinLlamada.join(", ")}`
    );
  });
});

// ==============================================================
// 2. El contrato de identificadores con ui/navbar.js
// ==============================================================
// Markup y comportamiento están en archivos distintos: estructura.js
// crea los elementos y navbar.js los busca por id. Si uno se renombra
// y el otro no, el cableado deja de funcionar sin lanzar ningún error.
// Esto compara los dos lados.

describe("contrato de identificadores con navbar.js", () => {
  const navbar = leer(new URL("public/js/ui/navbar.js", RAIZ));

  // Todos los getElementById("...") que navbar.js ejecuta de verdad.
  const CONSULTADOS = [
    ...new Set(
      [...navbar.matchAll(/getElementById\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1])
    ),
  ].sort();

  const marcado = HEADER + FOOTER;
  const estaEnElMarcado = (id) => new RegExp(`id="${id}"`).test(marcado);

  test("navbar.js consulta algún identificador", () => {
    assert.ok(CONSULTADOS.length > 0, "¿cambió la forma de buscar elementos?");
  });

  test("todo id que navbar.js busca existe en el marcado", () => {
    const ausentes = CONSULTADOS.filter((id) => !estaEnElMarcado(id));
    assert.deepEqual(
      ausentes,
      [],
      `navbar.js busca ids que estructura.js no crea: ${ausentes.join(", ")}`
    );
  });

  test("todo id declarado en IDS existe en el marcado", () => {
    const ausentes = Object.values(IDS).filter((id) => !estaEnElMarcado(id));
    assert.deepEqual(ausentes, [], `IDS declara ids inexistentes: ${ausentes.join(", ")}`);
  });

  // IDS es la documentación del contrato. Si navbar.js empieza a usar
  // un id que no está declarado, la lista deja de servir para nada.
  test("IDS cubre todo lo que navbar.js consulta", () => {
    const declarados = new Set(Object.values(IDS));
    const sinDeclarar = CONSULTADOS.filter((id) => !declarados.has(id));
    assert.deepEqual(
      sinDeclarar,
      [],
      `añade estos ids a IDS en estructura.js: ${sinDeclarar.join(", ")}`
    );
  });
});

// ==============================================================
// 3. Las plantillas no interpolan nada
// ==============================================================
// CLAUDE.md §4.4 prohíbe construir HTML interpolando datos, que es por
// donde entró el XSS de las tarjetas. montarEstructura() usa
// insertAdjacentHTML, y eso solo es seguro mientras las plantillas
// sean literales fijos. En cuanto alguien meta un ${} aquí, deja de
// serlo — y esta prueba lo dirá.

describe("las plantillas son constantes, no plantillas con datos", () => {
  const fuente = leer(new URL("public/js/ui/estructura.js", RAIZ));

  // Se mira SOLO lo que hay entre acentos graves. Leer el archivo
  // entero daría un falso positivo con cualquier comentario que
  // mencione la sintaxis, como el de aquí arriba.
  const plantillas = [...fuente.matchAll(/`([^`]*)`/g)].map((m) => m[1]);

  test("hay plantillas que revisar", () => {
    assert.ok(plantillas.length >= 2, `se esperaban al menos HEADER y FOOTER, hay ${plantillas.length}`);
  });

  test("ninguna plantilla interpola un valor", () => {
    const interpolaciones = plantillas.flatMap((p) =>
      [...p.matchAll(/\$\{[^}]*\}/g)].map((m) => m[0])
    );

    assert.deepEqual(
      interpolaciones,
      [],
      `una plantilla de estructura.js interpola ${interpolaciones.join(", ")}; se inserta con insertAdjacentHTML, así que eso es una vía de XSS`
    );
  });
});

// ==============================================================
// 4. Los anclajes del menú
// ==============================================================
// Regresión concreta: doce páginas escribían href="#quienes-somos",
// que solo resuelve estando ya en index.html. En las otras once, esos
// links no hacían absolutamente nada.

describe("anclajes del menú", () => {
  const anclas = [...HEADER.matchAll(/href="([^"]*#[^"]*)"/g)].map((m) => m[1]);

  test("el menú tiene anclajes que revisar", () => {
    assert.ok(anclas.length >= 4, `solo se encontraron ${anclas.length} anclajes`);
  });

  test("ningún anclaje usa la forma corta, que solo funciona en el home", () => {
    const cortos = anclas.filter((href) => href.startsWith("#"));
    assert.deepEqual(
      cortos,
      [],
      `estos anclajes solo funcionarían dentro de index.html: ${cortos.join(", ")}`
    );
  });

  test("todos apuntan a una sección de index.html", () => {
    anclas.forEach((href) => {
      assert.match(href, /^index\.html#[a-z-]+$/, `anclaje con forma inesperada: ${href}`);
    });
  });

  // Los destinos tienen que existir de verdad en el home.
  test("cada sección enlazada existe en index.html", () => {
    const index = leer(new URL("public/index.html", RAIZ));
    const rotos = anclas
      .map((href) => href.split("#")[1])
      .filter((id) => !new RegExp(`id="${id}"`).test(index));

    assert.deepEqual(rotos, [], `el menú enlaza secciones que no existen: ${rotos.join(", ")}`);
  });
});

// ==============================================================
// 5. montarEstructura()
// ==============================================================

describe("montarEstructura", () => {
  beforeEach(() => montarDom());
  afterEach(desmontarDom);

  test("inserta cabecera y pie en un documento vacío", () => {
    montarEstructura();

    assert.ok(document.querySelector("header.navbar"), "falta la cabecera");
    assert.ok(document.querySelector("footer.footer"), "falta el pie");
  });

  test("la cabecera va al principio y el pie al final", () => {
    document.body.innerHTML = "<main>contenido</main>";
    montarEstructura();

    const hijos = [...document.body.children].map((el) => el.tagName.toLowerCase());
    assert.equal(hijos[0], "header");
    assert.equal(hijos.at(-1), "footer");
  });

  // Permite migrar página a página sin que aparezcan dos navbars.
  test("no duplica nada si la página ya tiene cabecera y pie", () => {
    montarEstructura();
    montarEstructura();

    assert.equal(document.querySelectorAll("header.navbar").length, 1);
    assert.equal(document.querySelectorAll("footer.footer").length, 1);
  });

  test("crea los elementos que navbar.js necesita cablear", () => {
    montarEstructura();

    Object.entries(IDS).forEach(([nombre, id]) => {
      assert.ok(document.getElementById(id), `falta ${nombre} (#${id})`);
    });
  });

  test("el dropdown trae links para los tres roles", () => {
    montarEstructura();

    ["proveedor", "comprador", "logistica"].forEach((rol) => {
      const links = document.querySelectorAll(`#dropdown-residuos a[data-role="${rol}"]`);
      assert.ok(links.length > 0, `el dropdown no tiene links para ${rol}`);
    });
  });

  // Sin sesión, lo que se ve es el botón de login. Si el estado inicial
  // fuera el contrario, cada carga anónima parpadearía mostrando "Mi
  // cuenta" antes de corregirse.
  test("el estado inicial es el de visitante anónimo", () => {
    montarEstructura();

    assert.notEqual(document.getElementById(IDS.login).style.display, "none");
    assert.equal(document.getElementById(IDS.cuenta).style.display, "none");
    assert.equal(document.getElementById(IDS.logout).style.display, "none");
  });

  test("el año del pie queda vacío para que lo rellene navbar.js", () => {
    montarEstructura();
    assert.equal(document.getElementById(IDS.anio).textContent, "");
  });
});

// ==============================================================
// 6. Integración con ui/navbar.js
// ==============================================================
// Las secciones anteriores prueban las dos mitades por separado. Esta
// comprueba que encajan: una página que solo llama a montarNavbar()
// termina con la cabecera puesta Y funcionando. Es el recorrido que
// hacen las 13 páginas al cargar.

describe("integración: montarNavbar monta y cablea la estructura", () => {
  let montarNavbar;
  let invalidarSesion;

  // montarNavbar() se suscribe a la sesión, y esa suscripción resuelve
  // en una microtarea posterior. Sin esperarla, la prueba termina, el
  // DOM se desmonta y la respuesta llega a un document que ya no
  // existe. Esto le da el turno que le falta.
  const asentar = () => new Promise((resolver) => setTimeout(resolver, 0));

  beforeEach(async () => {
    montarDom();
    ({ montarNavbar } = await import("../public/js/ui/navbar.js"));
    ({ invalidarSesion } = await import("../public/js/core/sesion.js"));
    invalidarSesion();
  });

  afterEach(desmontarDom);

  test("una página sin nada de markup acaba con cabecera y pie", async () => {
    document.body.innerHTML = "<main>contenido</main>";
    montarNavbar();

    await asentar();

    assert.ok(document.querySelector("header.navbar"), "no se montó la cabecera");
    assert.ok(document.querySelector("footer.footer"), "no se montó el pie");
  });

  test("el año del pie queda relleno", async () => {
    montarNavbar();

    await asentar();
    assert.equal(
      document.getElementById(IDS.anio).textContent,
      String(new Date().getFullYear())
    );
  });

  // Este es el defecto que la migración ya había corregido una vez:
  // el botón existía en las 13 páginas pero solo estaba cableado en
  // index.html. Ahora que el botón lo crea estructura.js, conviene
  // fijar que sigue cableado.
  test("el botón de login abre el modal", async () => {
    montarNavbar();

    await asentar();

    const boton = document.getElementById(IDS.login);
    assert.ok(boton, "no existe el botón de login");

    boton.click();
    assert.ok(
      document.querySelector(".auth-modal, #auth-modal, [class*='modal']"),
      "pulsar login no abrió ningún modal"
    );
  });

  test("la hamburguesa despliega el menú", async () => {
    montarNavbar();

    await asentar();

    const boton = document.getElementById(IDS.hamburguesa);
    const menu = document.getElementById(IDS.navegacion);

    assert.equal(menu.classList.contains("nav-open"), false);
    boton.click();
    assert.ok(menu.classList.contains("nav-open"), "la hamburguesa no abrió el menú");
  });
});
