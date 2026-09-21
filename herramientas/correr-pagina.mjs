// Ejecuta una pagina real: su HTML en jsdom, sus modulos de verdad y
// Supabase de verdad. Lo mas cerca de un navegador que se puede llegar
// sin uno.
import { register } from "node:module";
import { JSDOM } from "jsdom";

register("./hook-red.mjs", import.meta.url);

const PAGINA = process.argv[2] ?? "comprador-explorar-residuos";
const BASE = "http://localhost:3000";

const html = await (await fetch(`${BASE}/${PAGINA}.html`)).text();

const dom = new JSDOM(html, {
  url: `${BASE}/${PAGINA}.html`,
  pretendToBeVisual: true,
});

globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
// navigator en Node 24 es de solo lectura; se define por descriptor.
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator,
  configurable: true,
});
globalThis.localStorage = dom.window.localStorage;
globalThis.CustomEvent = dom.window.CustomEvent;

const errores = [];
dom.window.addEventListener("error", (e) => errores.push(e.message));
process.on("unhandledRejection", (r) => errores.push(`rechazo sin capturar: ${r}`));

console.log(`Ejecutando ${PAGINA}.html ...\n`);

try {
  await import(`${BASE.replace("http://", "http://")}/js/pages/${PAGINA}.js`);
} catch (err) {
  console.log("EXCEPCION AL CARGAR EL MODULO:");
  console.log(`  ${err.message}`);
  if (err.stack) console.log(err.stack.split("\n").slice(1, 4).join("\n"));
  process.exit(1);
}

// Dar tiempo a las consultas.
await new Promise((r) => setTimeout(r, 6000));

const doc = dom.window.document;
const cuerpo = doc.body.textContent.replace(/\s+/g, " ").trim();

console.log(`cabecera inyectada : ${Boolean(doc.querySelector(".navbar"))}`);
console.log(`pie inyectado      : ${Boolean(doc.querySelector("footer"))}`);
console.log(`tarjetas de residuo: ${doc.querySelectorAll(".residuo-item").length}`);
console.log(`botones Contactar  : ${[...doc.querySelectorAll("button")].filter((b) => /Contactar/.test(b.textContent)).length}`);

const estado = doc.getElementById("status-explorar-residuos");
console.log(`mensaje de estado  : ${estado ? JSON.stringify(estado.textContent) : "(sin elemento)"}`);

if (errores.length) {
  console.log(`\nERRORES (${errores.length}):`);
  errores.forEach((e) => console.log(`  ${e}`));
} else {
  console.log("\nSin errores en tiempo de ejecucion.");
}

console.log(`\nTexto visible (primeros 220): ${cuerpo.slice(0, 220)}`);
process.exit(0);
