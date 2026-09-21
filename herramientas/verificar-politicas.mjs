// ==============================================================
// Pruebas de aceptación de CONTRATO-RLS.md §5
// ==============================================================
// Que una política EXISTA no demuestra que haga lo que dice. El
// diagnóstico de politicas.sql §12.1 lee el catálogo: confirma que el
// objeto está creado, no que esté bien escrito. Esto lo comprueba de
// la única forma que vale: intentando de verdad lo que debe fallar.
//
// POR QUÉ NO ESTÁ EN tests/
// CLAUDE.md §5.4.4 dice que ninguna prueba toca la red ni Supabase
// real, y esa regla es correcta: `npm test` tiene que correr siempre,
// sin credenciales y sin internet. Esto es lo contrario por diseño —
// habla con el proyecto real y necesita dos cuentas. Vive fuera de
// tests/ para que el glob de `npm test` no lo recoja nunca.
//
// POR QUÉ NO USA @supabase/supabase-js
// Porque no hace falta: Supabase expone PostgREST y GoTrue por HTTP, y
// Node 24 trae fetch. Cero dependencias, igual que el resto del
// proyecto (CLAUDE.md §1).
//
// USO
//   $env:ECO_PROVEEDOR_EMAIL="..."      # PowerShell
//   $env:ECO_PROVEEDOR_PASSWORD="..."
//   $env:ECO_COMPRADOR_EMAIL="..."
//   $env:ECO_COMPRADOR_PASSWORD="..."
//   npm run verificar:politicas
//
// Las credenciales van por variable de entorno, nunca en el repo.
// ==============================================================

import { readFileSync } from "node:fs";

// ==============================================================
// Conexión
// ==============================================================
// Se leen del mismo archivo que usa el navegador, para que no haya dos
// copias que puedan divergir. La llave es la publishable: pública por
// diseño, y precisamente por eso esta verificación tiene sentido.

const fuente = readFileSync(new URL("../public/js/core/supabase.js", import.meta.url), "utf8");
const leerConstante = (nombre) =>
  fuente.match(new RegExp(`${nombre}\\s*=\\s*"([^"]+)"`))?.[1];

const URL_BASE = leerConstante("SUPABASE_URL");
const LLAVE = leerConstante("SUPABASE_KEY");

if (!URL_BASE || !LLAVE) {
  console.error("No se pudieron leer SUPABASE_URL/SUPABASE_KEY de core/supabase.js");
  process.exit(1);
}

// ==============================================================
// Cliente HTTP mínimo
// ==============================================================

async function api(ruta, { token, ...opciones } = {}) {
  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    ...opciones,
    headers: {
      apikey: LLAVE,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...opciones.headers,
    },
  });

  const texto = await respuesta.text();
  let cuerpo = texto;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch {
    /* algunas respuestas no son JSON; se deja el texto */
  }

  return { estado: respuesta.status, ok: respuesta.ok, cuerpo };
}

// `return=representation` hace que PostgREST devuelva las filas
// afectadas. Es la clave de las pruebas de borrado y actualización:
// cuando RLS deniega un DELETE, NO da error — simplemente no toca
// ninguna fila y devuelve []. Comprobar solo el código HTTP daría un
// falso PASA.
const REPRESENTACION = { Prefer: "return=representation" };

async function entrar(email, contrasena) {
  const { ok, cuerpo } = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password: contrasena }),
  });

  if (!ok) throw new Error(cuerpo?.error_description ?? cuerpo?.msg ?? "credenciales rechazadas");
  return { token: cuerpo.access_token, id: cuerpo.user.id };
}

// ==============================================================
// Registro de resultados
// ==============================================================

const resultados = [];
const anotar = (estado, nombre, detalle) => {
  resultados.push({ estado, nombre, detalle });
  const icono = { PASA: "✔", FALLA: "✖", SALTADA: "-", MANUAL: "□" }[estado];
  console.log(`  ${icono} ${nombre}`);
  if (detalle) console.log(`      ${detalle}`);
};

// Una comprobación devuelve { ok } o { saltada: true }. Saltada NO es
// lo mismo que pasada: significa que no se pudo probar, y contarla
// como éxito sería exactamente el autoengaño que este script existe
// para evitar.
async function comprobar(nombre, fn) {
  try {
    const { ok, saltada, detalle } = await fn();
    anotar(saltada ? "SALTADA" : ok ? "PASA" : "FALLA", nombre, detalle);
  } catch (err) {
    anotar("FALLA", nombre, `error inesperado: ${err.message}`);
  }
}

// ==============================================================
// Arranque
// ==============================================================

const falta = ["ECO_PROVEEDOR_EMAIL", "ECO_PROVEEDOR_PASSWORD",
               "ECO_COMPRADOR_EMAIL", "ECO_COMPRADOR_PASSWORD"]
  .filter((v) => !process.env[v]);

if (falta.length) {
  console.error(`\nFaltan variables de entorno: ${falta.join(", ")}\n`);
  console.error("Hacen falta dos cuentas YA REGISTRADAS en el proyecto, una con");
  console.error("company_type='proveedor' y otra con 'comprador'. Créalas desde");
  console.error("el propio sitio y confirma su correo antes de correr esto.\n");
  process.exit(1);
}

console.log(`\nProyecto: ${URL_BASE}\n`);

// Se intentan las DOS y luego se decide. Abortar en la primera que
// falle deja al que ejecuta sin saber cuál de las dos era, y con dos
// cuentas eso es la mitad de la información que necesita.
const CUENTAS = {
  proveedor: [process.env.ECO_PROVEEDOR_EMAIL, process.env.ECO_PROVEEDOR_PASSWORD],
  comprador: [process.env.ECO_COMPRADOR_EMAIL, process.env.ECO_COMPRADOR_PASSWORD],
};

const sesiones = {};
const fallidas = [];

for (const [rol, [email, contrasena]] of Object.entries(CUENTAS)) {
  try {
    sesiones[rol] = await entrar(email, contrasena);
    console.log(`  ✔ sesión iniciada como ${rol.padEnd(10)} ${email}`);
  } catch (err) {
    console.log(`  ✖ ${rol.padEnd(22)} ${email}`);
    fallidas.push({ rol, email, motivo: err.message });
  }
}

if (fallidas.length) {
  console.error("\nNo se pudo iniciar sesión con:\n");
  fallidas.forEach(({ rol, email, motivo }) => {
    console.error(`  ${rol}: ${email}`);
    console.error(`    ${motivo}`);

    // Causa frecuente y difícil de ver a simple vista: un carácter no
    // ASCII en el correo. Suele venir de copiar y pegar, y el mensaje
    // de Supabase es el mismo que para una contraseña equivocada.
    if (email && /[^\x20-\x7E]/.test(email)) {
      const raros = [...new Set(email.split("").filter((c) => /[^\x20-\x7E]/.test(c)))];
      console.error(`    ⚠️  el correo contiene ${raros.join(" ")} — ¿es así en el registro?`);
    }
  });

  console.error("\n'Invalid login credentials' significa correo O contraseña incorrectos.");
  console.error("Compruébalo entrando con esa misma cuenta en el sitio: si ahí tampoco");
  console.error("entra, el problema son las credenciales y no este script.\n");
  process.exit(1);
}

const { proveedor, comprador } = sesiones;

// ==============================================================
// Controles positivos
// ==============================================================
// Van PRIMERO y a propósito. Todas las pruebas de abajo confirman que
// algo NO se puede hacer, y esas pruebas pasan solas si la conexión
// está rota, la llave es inválida o las tablas no responden. Sin estos
// controles, un proyecto completamente caído daría cinco PASA.

console.log("Controles positivos (si estos fallan, lo de abajo no significa nada)");

await comprobar("el catálogo se lee sin sesión", async () => {
  const { estado, cuerpo } = await api("/rest/v1/residuos_publicados?select=id&limit=1");
  return {
    ok: estado === 200 && Array.isArray(cuerpo),
    detalle: estado !== 200 ? `HTTP ${estado}: ${JSON.stringify(cuerpo)}` : null,
  };
});

await comprobar("cada cuenta tiene el rol que dice tener", async () => {
  const roles = {};
  for (const [nombre, cuenta] of Object.entries({ proveedor, comprador })) {
    const { cuerpo } = await api(
      `/rest/v1/profiles?select=company_type&id=eq.${cuenta.id}`,
      { token: cuenta.token }
    );
    roles[nombre] = cuerpo?.[0]?.company_type ?? null;
  }

  const correcto = roles.proveedor === "proveedor" && roles.comprador === "comprador";
  return {
    ok: correcto,
    detalle: correcto ? null : `roles leídos: ${JSON.stringify(roles)} — revisa las cuentas`,
  };
});

// ==============================================================
// Las cinco pruebas de aceptación
// ==============================================================

console.log("\nPruebas de aceptación (CONTRATO-RLS.md §5)");

// --- 1 — C4: el rol decide quién escribe ---
await comprobar("1. un comprador NO puede publicar residuos", async () => {
  const { estado, cuerpo } = await api("/rest/v1/residuos_publicados", {
    method: "POST",
    token: comprador.token,
    headers: REPRESENTACION,
    body: JSON.stringify({
      user_id: comprador.id,
      tipo: "PRUEBA-RLS (borrar si aparece)",
      estado: "disponible",
    }),
  });

  if (estado === 201 || estado === 200) {
    // La política falló. Se limpia lo que se acaba de colar.
    const creado = Array.isArray(cuerpo) ? cuerpo[0] : cuerpo;
    if (creado?.id) {
      await api(`/rest/v1/residuos_publicados?id=eq.${creado.id}`, {
        method: "DELETE",
        token: comprador.token,
      });
    }
    return { ok: false, detalle: "el insert SE ACEPTÓ; revisa la política residuos_inserta (§5)" };
  }

  return { ok: estado === 403, detalle: estado === 403 ? null : `HTTP ${estado} inesperado` };
});

// --- 2 — C1: propiedad en escrituras destructivas ---
await comprobar("2. un proveedor NO puede borrar el residuo de otro", async () => {
  const { cuerpo: ajenos } = await api(
    `/rest/v1/residuos_publicados?select=id&user_id=neq.${proveedor.id}&limit=1`
  );

  const victima = ajenos?.[0];
  if (!victima) {
    return {
      saltada: true,
      detalle: "no hay ningún residuo de otra cuenta con el que probar; publica uno desde una tercera cuenta",
    };
  }

  // Un DELETE denegado por RLS no da error: afecta 0 filas. Por eso se
  // mira lo que devuelve, no el código HTTP.
  const { cuerpo: borradas } = await api(`/rest/v1/residuos_publicados?id=eq.${victima.id}`, {
    method: "DELETE",
    token: proveedor.token,
    headers: REPRESENTACION,
  });

  const cuantas = Array.isArray(borradas) ? borradas.length : 0;
  return {
    ok: cuantas === 0,
    detalle: cuantas === 0 ? null : `BORRÓ ${cuantas} fila(s) ajena(s); revisa residuos_borra (§5)`,
  };
});

// --- 3 — C3: el rol es inmutable desde el cliente ---
await comprobar("3. un usuario NO puede cambiarse el company_type", async () => {
  const { estado, cuerpo } = await api(`/rest/v1/profiles?id=eq.${comprador.id}`, {
    method: "PATCH",
    token: comprador.token,
    headers: REPRESENTACION,
    body: JSON.stringify({ company_type: "logistica" }),
  });

  if (estado === 403) return { ok: true };

  // Si no dio 403, hay que confirmar que al menos no cambió nada.
  const { cuerpo: ahora } = await api(
    `/rest/v1/profiles?select=company_type&id=eq.${comprador.id}`,
    { token: comprador.token }
  );
  const rol = ahora?.[0]?.company_type;

  if (rol === "logistica") {
    return { ok: false, detalle: "EL ROL CAMBIÓ. Es escalada de privilegios: revisa el grant de §4" };
  }

  return {
    ok: Array.isArray(cuerpo) && cuerpo.length === 0,
    detalle: `HTTP ${estado}, el rol sigue siendo '${rol}' — esperado 403`,
  };
});

// --- 4 — C5: los leads no son públicos ---
await comprobar("4. un anónimo NO puede leer empresas_registro", async () => {
  const { estado, cuerpo } = await api("/rest/v1/empresas_registro?select=*&limit=5");

  // Sin política de SELECT, RLS no da error: filtra todas las filas.
  if (estado === 200 && Array.isArray(cuerpo) && cuerpo.length > 0) {
    return { ok: false, detalle: `DEVOLVIÓ ${cuerpo.length} leads a un anónimo; revisa §10` };
  }

  return { ok: true };
});

// ==============================================================
// Regresiones del 2026-09-17
// ==============================================================
// Estas dos no estaban en el contrato original: se añaden porque la
// primera ejecución real destapó siete políticas heredadas del panel
// de Supabase que anulaban a las del script por OR (ver politicas.sql
// §1.3). Cubren los dos agujeros que NO eran el de la prueba 1, para
// que no puedan volver sin que nadie se entere.

// --- 6 — C4 sobre servicios_transporte ---
// El agujero era `Usuarios insertan sus servicios`: comprobaba la
// propiedad pero no el rol, así que cualquiera con sesión podía
// publicar transporte.
await comprobar("6. un comprador NO puede publicar servicios de transporte", async () => {
  const { estado, cuerpo } = await api("/rest/v1/servicios_transporte", {
    method: "POST",
    token: comprador.token,
    headers: REPRESENTACION,
    body: JSON.stringify({
      user_id: comprador.id,
      tipo_transporte: "PRUEBA-RLS (borrar si aparece)",
      capacidad_carga: "0",
      tipos_residuos: "prueba",
      zona_cobertura: "prueba",
      disponibilidad: "prueba",
      estado: "activo",
    }),
  });

  if (estado === 201 || estado === 200) {
    const creado = Array.isArray(cuerpo) ? cuerpo[0] : cuerpo;
    if (creado?.id) {
      await api(`/rest/v1/servicios_transporte?id=eq.${creado.id}`, {
        method: "DELETE",
        token: comprador.token,
      });
    }
    return { ok: false, detalle: "el insert SE ACEPTÓ; revisa servicios_inserta (§6)" };
  }

  return { ok: estado === 403, detalle: estado === 403 ? null : `HTTP ${estado} inesperado` };
});

// --- 7 — C5: el catálogo solo muestra lo publicado ---
// El agujero era `residuos_all_authenticated_select`, con `using
// (true)`: cualquier usuario con sesión veía TODOS los residuos,
// incluidos los borradores y vendidos de otras empresas.
//
// Ojo con el falso PASA: si en la base no hay ningún residuo en otro
// estado, la consulta devuelve [] tanto si la política protege como si
// no. Por eso primero se busca uno que exista de verdad.
await comprobar("7. un comprador NO ve residuos ajenos sin publicar", async () => {
  const { cuerpo: mios } = await api(
    `/rest/v1/residuos_publicados?select=id,estado&user_id=eq.${proveedor.id}&estado=neq.disponible&limit=1`,
    { token: proveedor.token }
  );

  const oculto = mios?.[0];
  if (!oculto) {
    return {
      saltada: true,
      detalle: "el proveedor no tiene ningún residuo en estado distinto de 'disponible' con el que probar; marca uno como vendido en mis-residuos.html",
    };
  }

  // El proveedor SÍ lo ve (es suyo). La pregunta es si lo ve el otro.
  const { cuerpo: visto } = await api(
    `/rest/v1/residuos_publicados?select=id&id=eq.${oculto.id}`,
    { token: comprador.token }
  );

  const loVe = Array.isArray(visto) && visto.length > 0;
  return {
    ok: !loVe,
    detalle: loVe
      ? `VE un residuo ajeno en estado '${oculto.estado}'; revisa residuos_catalogo (§5)`
      : null,
  };
});

// ==============================================================
// C4 completo: las cinco puertas de rol
// ==============================================================
// El contrato pone una comprobación de rol en el INSERT de cinco
// tablas. Las pruebas 1 y 6 cubrían dos; estas cubren las otras tres.
//
// Faltaban justo las de las tablas que menos se tocan, que es donde una
// política mal escrita puede vivir años sin que nadie la ejecute.

// Devuelve el código de error de PostgREST: 42501 es RLS denegando,
// 23503 es una clave foránea. Distinguirlos importa — una prueba que
// pasa por violar una FK no ha probado la política.
const codigo = (cuerpo) => cuerpo?.code ?? null;

const rechazaInsert = async (tabla, token, fila, politica) => {
  const { estado, cuerpo } = await api(`/rest/v1/${tabla}`, {
    method: "POST",
    token,
    headers: REPRESENTACION,
    body: JSON.stringify(fila),
  });

  if (estado === 200 || estado === 201) {
    const creado = Array.isArray(cuerpo) ? cuerpo[0] : cuerpo;
    if (creado?.id) {
      await api(`/rest/v1/${tabla}?id=eq.${creado.id}`, { method: "DELETE", token });
    }
    return { ok: false, detalle: `el insert SE ACEPTÓ; revisa ${politica}` };
  }

  // Una FK rota rechaza igual, pero no demuestra nada sobre el rol.
  if (codigo(cuerpo) === "23503") {
    return {
      saltada: true,
      detalle: `lo rechazó una clave foránea (23503), no la política; no prueba ${politica}`,
    };
  }

  return { ok: true, detalle: estado === 403 ? null : `HTTP ${estado} (${codigo(cuerpo) ?? "sin código"})` };
};

// Un residuo real con el que construir filas válidas: si la fila fuera
// inválida por otro motivo, el rechazo no probaría el rol.
const { cuerpo: catalogo } = await api("/rest/v1/residuos_publicados?select=id&limit=1");
const RESIDUO = catalogo?.[0]?.id ?? null;

await comprobar("9. un proveedor NO puede registrar intereses", async () => {
  if (!RESIDUO) return { saltada: true, detalle: "no hay ningún residuo con el que construir el interés" };

  return rechazaInsert(
    "intereses",
    proveedor.token,
    { user_id: proveedor.id, tipo: "residuo", residuo_id: RESIDUO, servicio_transporte_id: null },
    "intereses_inserta (§7)"
  );
});

await comprobar("10. un comprador NO puede subir gestión ambiental", async () => {
  if (!RESIDUO) return { saltada: true, detalle: "no hay ningún residuo del que colgar la documentación" };

  return rechazaInsert(
    "residuos_gestion_ambiental",
    comprador.token,
    {
      user_id: comprador.id,
      residuo_id: RESIDUO,
      tipo: "documentacion",
      descripcion: "PRUEBA-RLS (borrar si aparece)",
    },
    "gestion_inserta (§8)"
  );
});

await comprobar("11. un comprador NO puede subir cumplimiento de transporte", async () =>
  rechazaInsert(
    "cumplimiento_transporte",
    comprador.token,
    {
      user_id: comprador.id,
      servicio_id: null,
      practicas_manejo: "PRUEBA-RLS (borrar si aparece)",
    },
    "cumplimiento_inserta (§8)"
  )
);

// --- 12 — la otra mitad de C4: propiedad transitiva ---
// No basta con ser proveedor: la documentación tiene que colgar de un
// residuo PROPIO. Se prueba con un residuo inexistente, que es la forma
// de comprobarlo sin necesitar una tercera cuenta — si la cláusula
// `exists (...)` faltara, la fila entraría.
await comprobar("12. la gestión ambiental NO cuelga de un residuo ajeno", async () => {
  const INEXISTENTE = "00000000-0000-4000-8000-000000000000";

  return rechazaInsert(
    "residuos_gestion_ambiental",
    proveedor.token,
    {
      user_id: proveedor.id,
      residuo_id: INEXISTENTE,
      tipo: "documentacion",
      descripcion: "PRUEBA-RLS (borrar si aparece)",
    },
    "la cláusula exists() de gestion_inserta (§8)"
  );
});

// ==============================================================
// C1 completo: las cuatro escrituras destructivas
// ==============================================================
// La auditoría señaló CUATRO operaciones que filtran solo por un id
// sacado de un data-id del DOM, y las llamó "la vulnerabilidad más
// explotable del proyecto":
//
//   delete()          servicio
//   update({estado})  servicio
//   update({estado})  residuo
//   delete()          interés
//
// La prueba 2 cubre el borrado de un residuo, que es una quinta. Las
// cuatro nombradas no las cubría nada.
//
// Recordatorio de por qué el codigo HTTP no vale aquí: un UPDATE o un
// DELETE denegado por RLS NO da error. Postgres no toca ninguna fila y
// devuelve 200. Hay que contar filas afectadas.

const noAfectaFilas = async (ruta, token, cuerpo, politica) => {
  const { cuerpo: afectadas } = await api(ruta, {
    method: cuerpo ? "PATCH" : "DELETE",
    token,
    headers: REPRESENTACION,
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });

  const cuantas = Array.isArray(afectadas) ? afectadas.length : 0;
  return {
    ok: cuantas === 0,
    detalle: cuantas === 0 ? null : `AFECTÓ ${cuantas} fila(s) ajena(s); revisa ${politica}`,
  };
};

await comprobar("13. un proveedor NO puede cambiar el estado del residuo de otro", async () => {
  const { cuerpo: ajenos } = await api(
    `/rest/v1/residuos_publicados?select=id&user_id=neq.${proveedor.id}&limit=1`
  );
  if (!ajenos?.[0]) {
    return { saltada: true, detalle: "no hay ningún residuo de otra cuenta con el que probar" };
  }

  return noAfectaFilas(
    `/rest/v1/residuos_publicados?id=eq.${ajenos[0].id}`,
    proveedor.token,
    { estado: "vendido" },
    "residuos_actualiza (§5)"
  );
});

// El interés lo crea el comprador y lo limpia él mismo. Es la única
// forma de probar esto: los intereses son privados, así que desde fuera
// no se puede descubrir el id de uno ajeno — pero un atacante que lo
// adivine sí podría intentarlo, y eso es lo que se comprueba.
await comprobar("14. un proveedor NO puede borrar el interés de un comprador", async () => {
  if (!RESIDUO) return { saltada: true, detalle: "no hay residuo sobre el que registrar un interés" };

  const { estado, cuerpo } = await api("/rest/v1/intereses", {
    method: "POST",
    token: comprador.token,
    headers: REPRESENTACION,
    body: JSON.stringify({
      user_id: comprador.id,
      tipo: "residuo",
      residuo_id: RESIDUO,
      servicio_transporte_id: null,
    }),
  });

  const creado = Array.isArray(cuerpo) ? cuerpo[0] : cuerpo;
  if ((estado !== 200 && estado !== 201) || !creado?.id) {
    return {
      saltada: true,
      detalle: `el comprador no pudo crear el interés de prueba (HTTP ${estado}); quizá ya tenía uno en ese residuo`,
    };
  }

  try {
    return await noAfectaFilas(
      `/rest/v1/intereses?id=eq.${creado.id}`,
      proveedor.token,
      null,
      "intereses_borra (§7)"
    );
  } finally {
    await api(`/rest/v1/intereses?id=eq.${creado.id}`, {
      method: "DELETE",
      token: comprador.token,
    });
  }
});

await comprobar("15. un proveedor NO puede tocar el servicio de transporte de otro", async () => {
  const { cuerpo: servicios } = await api(
    `/rest/v1/servicios_transporte?select=id&user_id=neq.${proveedor.id}&limit=1`
  );
  if (!servicios?.[0]) {
    return { saltada: true, detalle: "no hay ningún servicio de otra cuenta; publica uno desde una cuenta logistica" };
  }

  const ruta = `/rest/v1/servicios_transporte?id=eq.${servicios[0].id}`;

  // Las dos operaciones que señalaba la auditoría, en una prueba.
  const cambio = await noAfectaFilas(ruta, proveedor.token, { estado: "inactivo" }, "servicios_actualiza (§6)");
  if (!cambio.ok) return cambio;

  return noAfectaFilas(ruta, proveedor.token, null, "servicios_borra (§6)");
});

// --- 16 — los perfiles ajenos no son legibles ---
// `perfil_lectura` era `using (true)`, con un comentario que prometía
// "los ajenos solo por su nombre público". RLS no filtra columnas, así
// que en realidad cualquier usuario con sesión podía hacer
// select("*") sobre profiles y llevarse el correo de todas las
// empresas. El control positivo del arranque comprueba lo contrario
// —que el perfil PROPIO sí se lee—, así que entre los dos acotan la
// política por arriba y por abajo.
await comprobar("16. un usuario NO puede leer el perfil de otra empresa", async () => {
  const { estado, cuerpo } = await api(
    `/rest/v1/profiles?select=id,email,company_name&id=eq.${proveedor.id}`,
    { token: comprador.token }
  );

  if (estado !== 200) return { ok: false, detalle: `HTTP ${estado} inesperado` };

  const filas = Array.isArray(cuerpo) ? cuerpo : [];
  return {
    ok: filas.length === 0,
    detalle: filas.length
      ? `LEE el perfil ajeno (correo: ${filas[0].email ?? "sin columna"}); revisa perfil_lectura (§4)`
      : null,
  };
});

// --- 17 y 18 — la vista de resumen expone lo justo ---
// `transporte_cumplimiento_resumen` (§8.1) es la única pieza del
// esquema que ATRAVIESA RLS a propósito: se ejecuta con los permisos de
// su dueño para que un comprador pueda ver si un transportista tiene
// papeles, sin darle acceso a la tabla donde están las rutas.
//
// Eso la convierte en el punto más delicado del contrato: aquí no hay
// política que revise nadie, la seguridad está en QUÉ columnas devuelve
// el select. Si alguien añade una columna a la vista, esta comprobación
// es lo único que lo detecta.
//
// Van en pareja y las dos hacen falta: la 17 acota por arriba (no
// enseña de más) y la 18 por abajo (enseña algo). Sin la 18, revocar el
// grant dejaría la 17 en verde con los badges rotos para todos.

await comprobar("17. la vista de cumplimiento NO expone las rutas de los documentos", async () => {
  const columnas = ["permisos_urls", "certificaciones_urls", "seguros_urls", "user_id"];
  const expuestas = [];

  for (const columna of columnas) {
    const { estado } = await api(
      `/rest/v1/transporte_cumplimiento_resumen?select=${columna}&limit=1`,
      { token: comprador.token }
    );
    if (estado === 200) expuestas.push(columna);
  }

  return {
    ok: expuestas.length === 0,
    detalle: expuestas.length
      ? `la vista devuelve ${expuestas.join(", ")}; debe quedarse en los tres booleanos (§8.1)`
      : null,
  };
});

await comprobar("18. un comprador SÍ puede leer el resumen de cumplimiento", async () => {
  const { estado, cuerpo } = await api(
    "/rest/v1/transporte_cumplimiento_resumen?select=servicio_id,tiene_permisos&limit=1",
    { token: comprador.token }
  );

  if (estado !== 200) {
    return {
      ok: false,
      detalle: `HTTP ${estado}: sin acceso a la vista, los badges de documentación se quedan en blanco. ¿Falta el grant de §8.1?`,
    };
  }
  return { ok: Array.isArray(cuerpo), detalle: null };
});

// ==============================================================
// Storage (C6)
// ==============================================================
// La primera versión dejaba esto como comprobación manual porque el
// script "no sabe la ruta de ningún objeto sin subir uno". Era una
// excusa: puede subirlo él. Y merecía la pena, porque el 2026-09-17
// aparecieron OCHO políticas heredadas en storage.objects, cinco de
// ellas agujeros — incluida una que daba a los anónimos toda la
// documentación regulatoria. Un paso manual es un paso que no se hace.

const OBJETO_PRUEBA = `PRUEBA-RLS-${Date.now()}.txt`;

const subir = (bucket, ruta, token) =>
  api(`/storage/v1/object/${bucket}/${ruta}`, {
    method: "POST",
    token,
    headers: { "Content-Type": "text/plain" },
    body: "prueba de politicas; se borra sola",
  });

const borrar = (bucket, ruta, token) =>
  api(`/storage/v1/object/${bucket}/${ruta}`, { method: "DELETE", token });

// --- 8 — la convención de carpetas se cumple de verdad ---
// Los agujeros eran políticas como `upload_docs_transporte`, que
// comprobaban el bucket pero NO que la carpeta fuera la tuya. Toda la
// separación entre empresas en Storage descansa en ese prefijo.
await comprobar("8. un usuario NO puede subir a la carpeta de otro", async () => {
  const ruta = `${proveedor.id}/${OBJETO_PRUEBA}`;
  const { estado, cuerpo } = await subir("residuos-fotos", ruta, comprador.token);

  if (estado === 200 || estado === 201) {
    // Se coló: la carpeta es del proveedor, así que lo limpia él.
    await borrar("residuos-fotos", ruta, proveedor.token);
    return {
      ok: false,
      detalle: "SUBIÓ a la carpeta de otra empresa; revisa sube_en_su_carpeta (§11)",
    };
  }

  // Que la subida falle NO basta: hay que saber POR QUÉ falló.
  //
  // Esta comprobación miraba solo el código de estado, y Storage
  // responde 400 tanto a una petición mal formada como a una denegada
  // por RLS. Con ese criterio, un error de tipos en este mismo script
  // —una ruta mal construida, una cabecera que falta— daría PASA sin
  // que la política llegara a evaluarse nunca. Verde por el motivo
  // equivocado, que es peor que rojo.
  //
  // Storage manda el motivo en el cuerpo, así que se exige que hable de
  // autorización. Si algún día cambia ese texto, esto pasa a FALLA y se
  // revisa: es la dirección correcta en la que equivocarse.
  const motivo = JSON.stringify(cuerpo ?? "");
  const esDenegacion = /row-level security|Unauthorized|not authorized|403/i.test(motivo);

  return {
    ok: esDenegacion,
    detalle: esDenegacion
      ? null
      : `rechazada con HTTP ${estado}, pero el motivo no parece la política: ${motivo.slice(0, 160)}. ` +
        `Comprueba que la petición sea válida antes de fiarte de este verde.`,
  };
});

// --- 5 — C6: los buckets de cumplimiento no abren sin firmar ---
await comprobar("5. un documento de cumplimiento NO se lee sin permiso", async () => {
  const ruta = `${proveedor.id}/${OBJETO_PRUEBA}`;
  const { estado: subida } = await subir("gestion-ambiental", ruta, proveedor.token);

  if (subida !== 200 && subida !== 201) {
    return {
      saltada: true,
      detalle: `no se pudo subir el documento de prueba (HTTP ${subida}); sin él no hay nada que intentar leer`,
    };
  }

  try {
    // a) Por URL pública, sin sesión. Con el bucket privado debe fallar.
    const { estado: anonimo } = await api(`/storage/v1/object/public/gestion-ambiental/${ruta}`);

    // b) Con sesión, pero de otra empresa. Aunque el bucket sea
    //    privado, una política de SELECT demasiado abierta —como era
    //    read_docs_transporte— seguiría sirviéndolo por API.
    const { estado: ajeno } = await api(`/storage/v1/object/gestion-ambiental/${ruta}`, {
      token: comprador.token,
    });

    // c) CONTROL POSITIVO, y no es un adorno: sin él, esta prueba
    //    pasaría también con la lectura rota para TODO el mundo. Y eso
    //    no seria seguridad, sería que `lee_privados_propios` no
    //    existe — createSignedUrl() no podría firmar nada y la pantalla
    //    de documentos saldría en blanco sin un solo error.
    const { estado: dueno } = await api(`/storage/v1/object/gestion-ambiental/${ruta}`, {
      token: proveedor.token,
    });

    const problemas = [];
    if (anonimo === 200) problemas.push("un ANÓNIMO lo descarga por URL pública");
    if (ajeno === 200) problemas.push("otra empresa lo descarga por API");
    if (dueno !== 200) {
      problemas.push(
        `su DUEÑO tampoco lo lee (HTTP ${dueno}): falta lee_privados_propios y urlFirmada() no podrá firmar`
      );
    }

    return {
      ok: problemas.length === 0,
      detalle: problemas.length ? `${problemas.join("; ")} — revisa §11` : null,
    };
  } finally {
    await borrar("gestion-ambiental", ruta, proveedor.token);
  }
});

// ==============================================================
// Resumen
// ==============================================================

const cuenta = (estado) => resultados.filter((r) => r.estado === estado).length;
const fallos = cuenta("FALLA");

console.log(
  `\n${cuenta("PASA")} pasan · ${fallos} fallan · ` +
  `${cuenta("SALTADA")} saltadas · ${cuenta("MANUAL")} manuales\n`
);

if (fallos) {
  console.log("Cada FALLA es una política que existe pero no protege. Los datos");
  console.log("están expuestos hasta arreglarla.\n");
}

process.exit(fallos ? 1 : 0);
