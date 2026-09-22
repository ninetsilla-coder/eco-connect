// ==============================================================
// Doble de @supabase/supabase-js
// ==============================================================
// Sustituye al cliente real durante las pruebas (ver ayudas/cargador.js).
// Hace dos cosas:
//   1. Registra cada llamada, para poder afirmar CÓMO se consultó.
//   2. Devuelve respuestas programadas, para simular datos y errores.
//
// El constructor de consultas es "thenable": supabase-js permite hacer
// `await client.from(t).select()` sin método terminal, y el doble también.
// ==============================================================

export const registro = {
  consultas: [],
  subidas: [],
  respuestas: new Map(),
  sesion: null,
  suscriptores: [],
  // Altas de cuenta y llamadas a funciones de la base (rpc). Se anotan
  // igual que las consultas: el alta manda el rol y el RFC, y eso hay
  // que poder afirmarlo sin salir a la red.
  altas: [],
  rpc: [],
};

export function reiniciar() {
  registro.consultas.length = 0;
  registro.subidas.length = 0;
  registro.respuestas.clear();
  registro.sesion = null;
  registro.suscriptores.length = 0;
  registro.altas.length = 0;
  registro.rpc.length = 0;
}

// Programa la respuesta para una tabla. Sin programar: { data: null }.
export function programar(tabla, respuesta) {
  registro.respuestas.set(tabla, respuesta);
}

export function establecerSesion(sesion) {
  registro.sesion = sesion;
}

export function ultimaConsulta() {
  return registro.consultas[registro.consultas.length - 1];
}

function respuestaDe(tabla) {
  return registro.respuestas.get(tabla) ?? { data: null, error: null };
}

function constructor(tabla) {
  const consulta = { tabla, operacion: "select", filtros: [], payload: null, orden: null };
  registro.consultas.push(consulta);

  const api = {
    select(columnas) {
      consulta.columnas = columnas;
      return api;
    },
    insert(valores) {
      consulta.operacion = "insert";
      consulta.payload = valores;
      return api;
    },
    update(valores) {
      consulta.operacion = "update";
      consulta.payload = valores;
      return api;
    },
    delete() {
      consulta.operacion = "delete";
      return api;
    },
    eq(columna, valor) {
      consulta.filtros.push(["eq", columna, valor]);
      return api;
    },
    in(columna, valores) {
      consulta.filtros.push(["in", columna, valores]);
      return api;
    },
    ilike(columna, valor) {
      consulta.filtros.push(["ilike", columna, valor]);
      return api;
    },
    order(columna, opciones) {
      consulta.orden = { columna, ...opciones };
      return api;
    },
    maybeSingle: () => Promise.resolve(respuestaDe(tabla)),
    single: () => Promise.resolve(respuestaDe(tabla)),
    then: (alCumplir, alFallar) =>
      Promise.resolve(respuestaDe(tabla)).then(alCumplir, alFallar),
  };

  return api;
}

function almacenamiento(bucket) {
  return {
    async upload(ruta, archivo, opciones) {
      registro.subidas.push({ bucket, ruta, archivo, opciones });
      const programada = registro.respuestas.get(`storage:${bucket}`);
      if (programada?.error) return programada;
      return { data: { path: ruta }, error: null };
    },
    getPublicUrl(ruta) {
      return { data: { publicUrl: `https://fake.supabase.co/${bucket}/${ruta}` } };
    },
    async createSignedUrl(ruta, segundos) {
      const programada = registro.respuestas.get(`storage:${bucket}`);
      if (programada?.error) return programada;
      return {
        data: { signedUrl: `https://fake.supabase.co/firmada/${bucket}/${ruta}?exp=${segundos}` },
        error: null,
      };
    },
  };
}

export function createClient() {
  return {
    from: constructor,
    storage: { from: almacenamiento },
    // Funciones de la base (public.rfc_disponible, etc.). Se programan
    // por nombre, igual que las tablas: programar("rfc_disponible", ...)
    rpc: async (nombre, argumentos) => {
      registro.rpc.push({ nombre, argumentos });
      return respuestaDe(nombre);
    },
    auth: {
      getSession: async () => ({ data: { session: registro.sesion }, error: null }),
      getUser: async () => ({
        data: { user: registro.sesion?.user ?? null },
        error: null,
      }),
      signOut: async () => ({ error: null }),
      signUp: async (payload) => {
        registro.altas.push(payload);
        return registro.respuestas.get("auth.signUp")
          ?? { data: { user: null }, error: null };
      },
      signInWithPassword: async () => ({ data: {}, error: null }),
      onAuthStateChange: (callback) => {
        registro.suscriptores.push(callback);
        return { data: { subscription: { unsubscribe() {} } } };
      },
    },
  };
}
