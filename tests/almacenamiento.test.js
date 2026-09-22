// ==============================================================
// core/almacenamiento.js
// ==============================================================
// La convención `${usuarioId}/...` no es una preferencia de estilo: es
// lo que hace posible la política per-usuario de storage.objects
// (politicas.sql §11). Si alguien la rompe, las subidas siguen
// funcionando y la separación entre empresas desaparece en silencio.
// Por eso está fijada aquí.
// ==============================================================

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { reiniciar, registro, programar } from "./dobles/supabase.js";
import {
  subirArchivos,
  esPrivado,
  urlPublica,
  urlFirmada,
  referenciar,
  BUCKETS_PRIVADOS,
} from "../public/js/core/almacenamiento.js";

const USUARIO = "11111111-2222-3333-4444-555555555555";
const archivo = (nombre) => ({ name: nombre });

beforeEach(reiniciar);

describe("convención de rutas", () => {
  test("toda subida se guarda bajo la carpeta del usuario", async () => {
    await subirArchivos("residuos-fotos", USUARIO, [archivo("foto.png")]);

    assert.equal(registro.subidas.length, 1);
    assert.ok(
      registro.subidas[0].ruta.startsWith(`${USUARIO}/`),
      `la ruta ${registro.subidas[0].ruta} no empieza por el id del usuario`
    );
  });

  test("la subcarpeta se anida dentro de la del usuario, no la sustituye", async () => {
    await subirArchivos("gestion-ambiental", USUARIO, [archivo("permiso.pdf")], {
      subcarpeta: "residuo-9/documentacion",
    });

    const { ruta } = registro.subidas[0];
    assert.ok(ruta.startsWith(`${USUARIO}/residuo-9/documentacion/`), ruta);
  });

  test("conserva la extensión del archivo original", async () => {
    await subirArchivos("company-logos", USUARIO, [archivo("logo.corp.svg")]);
    assert.match(registro.subidas[0].ruta, /\.svg$/);
  });

  test("dos archivos con el mismo nombre no colisionan", async () => {
    await subirArchivos("residuos-fotos", USUARIO, [
      archivo("foto.png"),
      archivo("foto.png"),
    ]);

    const [una, otra] = registro.subidas.map((s) => s.ruta);
    assert.notEqual(una, otra);
  });

  // Storage NO tiene política de UPDATE, y es correcto que no la tenga:
  // la app nunca reemplaza un archivo. Cada subida estrena un nombre
  // aleatorio y va con upsert:false, así que siempre es un INSERT.
  //
  // Poner upsert:true reabriría eso de la peor forma posible: la
  // petición se convierte en un UPDATE sobre storage.objects, RLS la
  // deniega, y el usuario ve un fallo al subir sin ninguna pista de por
  // qué. Si alguna vez hace falta reemplazar archivos, primero va la
  // política a politicas.sql §11 y después este flag.
  test("las subidas no reemplazan: sin política de UPDATE, upsert rompería", async () => {
    await subirArchivos("company-logos", USUARIO, [archivo("logo.png")]);

    assert.equal(
      registro.subidas[0].opciones?.upsert,
      false,
      "upsert debe ser false mientras storage.objects no tenga política de UPDATE"
    );
  });

  test("un fallo de subida se propaga en vez de devolver una ruta falsa", async () => {
    programar("storage:residuos-fotos", { data: null, error: new Error("cuota excedida") });

    await assert.rejects(() =>
      subirArchivos("residuos-fotos", USUARIO, [archivo("foto.png")])
    );
  });
});

describe("clasificación de buckets", () => {
  // El recuento importa tanto como la lista: un bucket nuevo con
  // documentación regulatoria que se olvide de entrar aquí se subiría
  // como público, y `referenciar()` devolvería una URL abierta sin dar
  // ningún error. `expedientes` se sumó el 2026-09-22.
  test("los buckets de documentación regulatoria son privados", () => {
    assert.ok(esPrivado("gestion-ambiental"));
    assert.ok(esPrivado("docs-transporte"));
    assert.ok(esPrivado("expedientes"));
    assert.equal(BUCKETS_PRIVADOS.size, 3);
  });

  test("los buckets de catálogo son públicos", () => {
    ["residuos-fotos", "fotos-transporte", "company-logos"].forEach((bucket) => {
      assert.equal(esPrivado(bucket), false, bucket);
    });
  });
});

describe("referenciar", () => {
  test("un bucket público devuelve URL pública a partir de una ruta", async () => {
    const url = await referenciar("residuos-fotos", `${USUARIO}/foto.png`);
    assert.equal(url, urlPublica("residuos-fotos", `${USUARIO}/foto.png`));
  });

  test("un bucket público deja pasar una URL ya completa", async () => {
    const previa = "https://fake.supabase.co/residuos-fotos/x/y.png";
    assert.equal(await referenciar("residuos-fotos", previa), previa);
  });

  test("un bucket privado firma la ruta en vez de exponerla", async () => {
    const url = await referenciar("docs-transporte", `${USUARIO}/permiso.pdf`);
    assert.match(url, /\/firmada\//);
  });

  // Las filas anteriores a la migración guardan URLs públicas completas.
  // Al volver privado el bucket esas URLs dejan de resolver, así que hay
  // que recuperar la ruta y firmarla.
  test("un bucket privado recupera la ruta de una URL antigua y la firma", async () => {
    const antigua = `https://fake.supabase.co/docs-transporte/${USUARIO}/permiso.pdf`;
    const url = await referenciar("docs-transporte", antigua);

    assert.match(url, /\/firmada\//);
    assert.ok(url.includes(`${USUARIO}/permiso.pdf`), url);
  });

  test("un valor vacío no produce URL", async () => {
    assert.equal(await referenciar("residuos-fotos", null), null);
    assert.equal(await referenciar("residuos-fotos", ""), null);
  });

  test("si la firma falla se devuelve null en vez de una URL rota", async () => {
    programar("storage:docs-transporte", { data: null, error: new Error("sin permiso") });
    assert.equal(await urlFirmada("docs-transporte", "x/y.pdf"), null);
  });
});
