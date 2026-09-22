// ==============================================================
// Datos de ejemplo para el pitch
// ==============================================================
// Crea tres empresas INVENTADAS con su expediente completo, sus
// materiales amparados y sus publicaciones, para que el recorrido no se
// enseñe con pantallas vacías (decisiones D-9 y D-12 del plan).
//
// POR QUÉ NO ESTÁ EN tests/
// Igual que verificar-politicas.mjs: habla con el proyecto real y
// escribe en él. CLAUDE.md §5.4.4 prohíbe que una prueba toque la red,
// y con razón. Esto vive fuera del glob de `npm test` a propósito.
//
// POR QUÉ NO USA @supabase/supabase-js
// Porque no hace falta: PostgREST y GoTrue hablan HTTP y Node trae
// fetch. Cero dependencias, igual que el resto del proyecto (§1).
//
// NOMBRES INVENTADOS, Y NO ES UN DETALLE
// Ninguna de estas empresas existe, y ninguna sale del padrón de la
// SMA. Una captura de pantalla circulando con el nombre de una empresa
// real que nunca aceptó salir ahí es un problema, no una demo.
//
// LO QUE ESTE SCRIPT NO PUEDE HACER
// Poner las cuentas en `verificado`. El estado lo escribe el equipo, no
// el navegador ni una llave pública: es la cláusula C3 del CONTRATO-RLS
// y está bien que sea así. Al terminar te dice qué tocar en el panel.
//
// USO
//   npm run sembrar:ejemplos
//
// Se puede correr varias veces: antes de sembrar borra lo que sembró
// (el expediente y las publicaciones de esas tres cuentas), así que el
// resultado es siempre el mismo.
// ==============================================================

import { readFileSync } from "node:fs";

const fuente = readFileSync(new URL("../public/js/core/supabase.js", import.meta.url), "utf8");
const leerConstante = (nombre) =>
  fuente.match(new RegExp(`${nombre}\\s*=\\s*"([^"]+)"`))?.[1];

const URL_BASE = leerConstante("SUPABASE_URL");
const LLAVE = leerConstante("SUPABASE_KEY");

if (!URL_BASE || !LLAVE) {
  console.error("No se pudieron leer SUPABASE_URL/SUPABASE_KEY de core/supabase.js");
  process.exit(1);
}

// La contraseña de las tres cuentas de ejemplo. No es un secreto: son
// cuentas de demostración en un proyecto de pruebas, y hace falta
// escribirla en el pitch para entrar.
const CONTRASENA = process.env.ECO_EJEMPLOS_PASSWORD ?? "ecoconnect2026";

// ==============================================================
// Cliente HTTP mínimo
// ==============================================================

async function api(ruta, { token, cabeceras, ...opciones } = {}) {
  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    ...opciones,
    headers: {
      apikey: LLAVE,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...cabeceras,
    },
  });

  const texto = await respuesta.text();
  let cuerpo = texto;
  try {
    cuerpo = texto ? JSON.parse(texto) : null;
  } catch { /* no todas las respuestas son JSON */ }

  return { estado: respuesta.status, ok: respuesta.ok, cuerpo };
}

async function registrar(empresa) {
  const { ok, cuerpo } = await api("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email: empresa.email,
      password: CONTRASENA,
      data: {
        company_name: empresa.razonSocial,
        nombre_comercial: empresa.nombreComercial,
        rfc: empresa.rfc,
        company_type: empresa.rol,
        roles: [empresa.rol],
      },
    }),
  });

  // Que ya exista no es un error: el script se puede correr otra vez.
  if (!ok && !/already/i.test(JSON.stringify(cuerpo))) {
    throw new Error(`no se pudo registrar ${empresa.email}: ${JSON.stringify(cuerpo)}`);
  }
}

async function entrar(email) {
  const { ok, cuerpo } = await api("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password: CONTRASENA }),
  });

  if (!ok) {
    const motivo = cuerpo?.error_description ?? cuerpo?.msg ?? JSON.stringify(cuerpo);
    throw new Error(
      `no se pudo entrar como ${email}: ${motivo}\n` +
      "      Si dice que el correo no está confirmado, apaga la confirmación por correo\n" +
      "      en Supabase → Authentication → Providers → Email, y vuelve a correrlo.",
    );
  }

  return { token: cuerpo.access_token, id: cuerpo.user.id };
}

// ==============================================================
// Un PDF de verdad, mínimo
// ==============================================================
// Los documentos del expediente se pueden abrir desde la pantalla, así
// que subir un archivo de mentira dejaría un enlace que no abre nada.
// Este PDF es válido —con su tabla de referencias cruzadas— y pesa
// medio kilobyte.

function pdfDeEjemplo(titulo) {
  const texto = `BT /F1 13 Tf 40 90 Td (${titulo.replace(/[()\\]/g, "")}) Tj ET`;
  const objetos = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 420 140] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let pdf = "%PDF-1.4\n";
  const posiciones = [];

  objetos.forEach((cuerpo, i) => {
    posiciones.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${cuerpo}\nendobj\n`;
  });

  const inicioXref = pdf.length;
  pdf += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  posiciones.forEach((p) => {
    pdf += `${String(p).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${inicioXref}\n%%EOF\n`;

  return new TextEncoder().encode(pdf);
}

async function subirPdf({ token, usuarioId, tipo, titulo }) {
  // La convención de CLAUDE.md: toda ruta empieza por el id de quien
  // sube. Es lo que hace funcionar la política de Storage.
  const ruta = `${usuarioId}/${tipo}/${crypto.randomUUID()}.pdf`;

  const respuesta = await fetch(`${URL_BASE}/storage/v1/object/expedientes/${ruta}`, {
    method: "POST",
    headers: {
      apikey: LLAVE,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/pdf",
    },
    body: pdfDeEjemplo(titulo),
  });

  if (!respuesta.ok) {
    throw new Error(`no se pudo subir ${tipo}: ${await respuesta.text()}`);
  }

  return ruta;
}

// ==============================================================
// Las tres empresas
// ==============================================================
// Inventadas. Los RFC tienen la forma correcta pero no corresponden a
// ninguna empresa real: 12 caracteres las personas morales y 13 la
// persona física, para poder enseñar que el expediente se adapta.

const EMPRESAS = [
  {
    clave: "generadora",
    rol: "proveedor",
    email: "generadora@ejemplo.ecoconnect.mx",
    razonSocial: "Metales del Nazas S.A. de C.V.",
    nombreComercial: "Metales Nazas",
    rfc: "MNA240115AB9",
    materiales: ["acero", "hierro", "hms"],
    documentos: [
      { tipo: "constancia_fiscal", bloque: "Datos generales" },
      { tipo: "identificacion_representante", bloque: "Datos generales" },
      {
        tipo: "impacto_ambiental", bloque: "Impacto ambiental",
        subtipo: "Informe preventivo", autoridad: "SMA",
        numero_oficio: "SMA-IA-2024-0451",
      },
      {
        tipo: "registro_generador", bloque: "Registro de generador",
        numero_oficio: "SMA-RG-2025-0142", fecha: "2025-02-10",
        materiales: ["acero", "hierro", "hms"],
      },
      {
        tipo: "plan_manejo", bloque: "Registro de generador",
        numero_oficio: "SMA-PM-2025-0233", fecha: "2025-02-10",
      },
    ],
    residuos: [
      {
        tipo: "Acero", material_clave: "PENDIENTE-SMA", categoria: "sin_procesar",
        descripcion: "Rebaba de maquinado de acero 1018",
        cantidad_lote: 10, unidad: "t", cantidad: "10 t", precio: 4000,
        ubicacion: "Torreón", frecuencia: "mensual",
        nivel_procesamiento: "sin_procesar", estado_residuo: "con-impurezas",
        condicion_detalle: "restos de aceite de corte",
      },
      {
        tipo: "HMS", material_clave: "PENDIENTE-SMA", categoria: "procesado",
        descripcion: "Chatarra ferrosa HMS-1 cortada a medida",
        cantidad_lote: 8, unidad: "t", cantidad: "8 t", precio: 4200,
        ubicacion: "Torreón", frecuencia: "lote_unico",
        nivel_procesamiento: "compactado", estado_residuo: "limpio",
      },
    ],
  },
  {
    clave: "compradora",
    rol: "comprador",
    email: "compradora@ejemplo.ecoconnect.mx",
    razonSocial: "Recicladora Laguna Verde S.A. de C.V.",
    nombreComercial: "Laguna Verde",
    rfc: "RLV230920XY1",
    materiales: ["acero", "hierro", "hms", "pet"],
    documentos: [
      { tipo: "constancia_fiscal", bloque: "Datos generales" },
      { tipo: "identificacion_representante", bloque: "Datos generales" },
      {
        tipo: "impacto_ambiental", bloque: "Impacto ambiental",
        subtipo: "Manifestación de impacto ambiental", autoridad: "SMA",
        numero_oficio: "SMA-IA-2023-0188",
      },
      {
        tipo: "autorizacion_sma", bloque: "Autorización SMA",
        subtipo: "Reciclado y/o co-procesamiento",
        numero_oficio: "SMA-RC-2025-0317", fecha: "2025-03-14",
        vigencia: "2027-03-14",
        materiales: ["acero", "hierro", "hms", "pet"],
      },
    ],
  },
  {
    clave: "transportista",
    rol: "logistica",
    email: "transportista@ejemplo.ecoconnect.mx",
    razonSocial: "Fletes del Norte",
    nombreComercial: "Fletes del Norte",
    // 13 caracteres: persona física. Así se ve en la demo que a esta
    // empresa no se le pide acta constitutiva.
    rfc: "FONA850312QX7",
    materiales: ["acero", "hierro", "hms", "pet", "carton"],
    documentos: [
      { tipo: "constancia_fiscal", bloque: "Datos generales" },
      { tipo: "identificacion_representante", bloque: "Datos generales" },
      {
        tipo: "autorizacion_transporte", bloque: "Autorización de transporte",
        numero_oficio: "SMA-TR-2025-0088", fecha: "2025-01-20",
        // A tres meses vista: así la revisión previa enseña el aviso de
        // "vence pronto" en la demo.
        vigencia: new Date(Date.now() + 75 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        materiales: ["acero", "hierro", "hms", "pet", "carton"],
      },
      {
        tipo: "vehiculos", bloque: "Autorización de transporte",
        notas: "Torton, placas AB-123-CD\nRabón, placas XY-987-ZW",
        sinArchivo: true,
      },
      {
        tipo: "poliza_seguro", bloque: "Autorización de transporte",
        vigencia: "2026-12-31",
      },
    ],
    servicios: [
      {
        tipo_transporte: "Torton", capacidad_carga: "10 toneladas",
        tipos_residuos: "Chatarra ferrosa, PET, cartón",
        zona_cobertura: "Torreón y zona conurbada",
        disponibilidad: "Lunes a sábado",
        descripcion: "Unidades con lona y báscula certificada.",
        estado: "activo",
      },
    ],
  },
];

// ==============================================================
// Siembra
// ==============================================================

const paso = (texto) => console.log(`  · ${texto}`);

async function borrarLoAnterior(sesion) {
  // Se corre varias veces sin acumular basura. Solo borra lo de ESTA
  // cuenta: sus propias políticas no le dejarían tocar nada más.
  for (const tabla of ["expediente_documentos", "residuos_publicados", "servicios_transporte"]) {
    await api(`/rest/v1/${tabla}?user_id=eq.${sesion.id}`, {
      method: "DELETE",
      token: sesion.token,
    });
  }
}

async function sembrarEmpresa(empresa) {
  console.log(`\n${empresa.razonSocial}  (${empresa.email})`);

  await registrar(empresa);
  const sesion = await entrar(empresa.email);
  await borrarLoAnterior(sesion);

  for (const doc of empresa.documentos) {
    const fila = {
      bloque: doc.bloque,
      tipo_documento: doc.tipo,
      subtipo: doc.subtipo ?? null,
      autoridad: doc.autoridad ?? null,
      numero_oficio: doc.numero_oficio ?? null,
      fecha: doc.fecha ?? null,
      vigencia: doc.vigencia ?? null,
      notas: doc.notas ?? null,
      materiales: doc.materiales ?? null,
    };

    if (!doc.sinArchivo) {
      fila.archivo_ruta = await subirPdf({
        token: sesion.token,
        usuarioId: sesion.id,
        tipo: doc.tipo,
        titulo: `${doc.tipo} - ${empresa.razonSocial}`,
      });
    }

    const { ok, cuerpo } = await api("/rest/v1/expediente_documentos", {
      method: "POST",
      token: sesion.token,
      body: JSON.stringify(fila),
    });

    if (!ok) throw new Error(`documento ${doc.tipo}: ${JSON.stringify(cuerpo)}`);
  }
  paso(`${empresa.documentos.length} documentos de expediente`);

  for (const residuo of empresa.residuos ?? []) {
    const { ok, cuerpo } = await api("/rest/v1/residuos_publicados", {
      method: "POST",
      token: sesion.token,
      body: JSON.stringify({
        ...residuo,
        company_id: sesion.id,
        declaracion_no_peligroso: true,
        estado: "disponible",
      }),
    });

    if (!ok) throw new Error(`residuo ${residuo.tipo}: ${JSON.stringify(cuerpo)}`);
  }
  if (empresa.residuos) paso(`${empresa.residuos.length} residuos publicados`);

  for (const servicio of empresa.servicios ?? []) {
    const { ok, cuerpo } = await api("/rest/v1/servicios_transporte", {
      method: "POST",
      token: sesion.token,
      body: JSON.stringify(servicio),
    });

    if (!ok) throw new Error(`servicio: ${JSON.stringify(cuerpo)}`);
  }
  if (empresa.servicios) paso(`${empresa.servicios.length} servicio de transporte`);

  return sesion.id;
}

console.log("Sembrando datos de ejemplo (empresas inventadas)\n");

const ids = [];
for (const empresa of EMPRESAS) {
  try {
    ids.push({ empresa, id: await sembrarEmpresa(empresa) });
  } catch (err) {
    console.error(`\n  ✖ ${empresa.razonSocial}: ${err.message}`);
    process.exitCode = 1;
  }
}

// ==============================================================
// Lo que falta hacer a mano, y por qué
// ==============================================================

console.log(`\n${"=".repeat(60)}`);
console.log("Listo. Falta UN paso a mano, y no es un olvido:\n");
console.log("El estado de la cuenta lo escribe el equipo, nunca el navegador");
console.log("ni una llave pública. Es la cláusula C3 del CONTRATO-RLS, y está");
console.log("bien que sea así: si un script con llave pública pudiera poner una");
console.log("cuenta en `verificado`, cualquiera podría.\n");
console.log("En Supabase → Table Editor → profiles, pon estado = 'verificado' en:");
ids.forEach(({ empresa }) => console.log(`   · ${empresa.email}`));
console.log(`\nContraseña de las tres cuentas: ${CONTRASENA}`);
console.log(`${"=".repeat(60)}`);
