// ==============================================================
// Hook de resolución para las pruebas
// ==============================================================
// public/js/core/supabase.js importa el cliente desde una URL:
//
//   import { createClient } from "https://esm.sh/@supabase/supabase-js@2.116.0";
//
// Eso funciona en el navegador, pero Node NO resuelve imports por HTTP
// (la bandera --experimental-network-imports se eliminó). Sin este hook,
// cualquier prueba que toque un módulo de data/ o core/ falla al cargar.
//
// Aquí se intercepta ese especificador y se sustituye por el doble local,
// sin tocar el código de producción: los módulos siguen importando la URL
// real, que es lo que necesita el navegador.
// ==============================================================

const DOBLE = new URL("../dobles/supabase.js", import.meta.url).href;

export function resolve(especificador, contexto, siguiente) {
  if (especificador.startsWith("https://esm.sh/@supabase/supabase-js")) {
    return { url: DOBLE, shortCircuit: true };
  }
  return siguiente(especificador, contexto);
}
