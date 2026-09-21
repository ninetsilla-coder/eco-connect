// Hook INVERSO al de tests/ayudas/cargador.js.
//
// Aquel sustituye la URL de esm.sh por un doble para que las pruebas
// no toquen la red. Este hace lo contrario: resuelve los imports por
// HTTP de verdad, para poder cargar los modulos reales —los del
// servidor local y los del CDN— como lo haria el navegador.
//
// Es la unica forma de comprobar un bump de supabase-js (CLAUDE.md §7)
// y de ejecutar una pagina entera fuera del navegador.

const cache = new Map();
const esRemoto = (u) => u?.startsWith("http://") || u?.startsWith("https://");

export async function resolve(especificador, contexto, siguiente) {
  if (esRemoto(especificador)) {
    return { url: especificador, shortCircuit: true };
  }

  // Un import relativo dentro de un modulo remoto sigue siendo remoto.
  if (esRemoto(contexto.parentURL)) {
    return {
      url: new URL(especificador, contexto.parentURL).href,
      shortCircuit: true,
    };
  }

  return siguiente(especificador, contexto);
}

export async function load(url, contexto, siguiente) {
  if (!esRemoto(url)) return siguiente(url, contexto);

  if (!cache.has(url)) {
    const r = await fetch(url, { redirect: "follow" });
    if (!r.ok) throw new Error(`No se pudo bajar ${url}: HTTP ${r.status}`);
    cache.set(url, await r.text());
  }

  return { format: "module", shortCircuit: true, source: cache.get(url) };
}
