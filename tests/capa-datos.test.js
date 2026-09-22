// ==============================================================
// Capa de datos: forma de las consultas y lógica pura
// ==============================================================
// Lo que se comprueba aquí no es que Supabase funcione, sino que las
// consultas se construyen como deben: con el filtro de propiedad, con
// la columna correcta según el tipo, y sin escribir columnas vetadas.
// ==============================================================

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { reiniciar, registro, programar, ultimaConsulta } from "./dobles/supabase.js";

import { agruparPorResiduo } from "../public/js/data/cumplimiento.js";
import { etiquetaRol, actualizarPerfil } from "../public/js/data/perfiles.js";
import {
  guardarInteres,
  eliminarInteres,
  existeInteres,
  TIPO_RESIDUO,
  TIPO_TRANSPORTE,
} from "../public/js/data/intereses.js";
import { cambiarEstadoResiduo, eliminarResiduo } from "../public/js/data/residuos.js";
import { cambiarEstadoServicio, eliminarServicio } from "../public/js/data/transporte.js";

const USUARIO = "u-1";

beforeEach(reiniciar);

// ==============================================================
// Defensa en profundidad
// ==============================================================
// Estos filtros NO son el control de acceso — lo son las políticas RLS.
// Pero si desaparecen del cliente, un fallo de configuración en Supabase
// deja de tener una segunda barrera. Se fijan aquí.

describe("filtro de propiedad en escrituras", () => {
  const filtra = (consulta, columna, valor) =>
    consulta.filtros.some(([op, c, v]) => op === "eq" && c === columna && v === valor);

  test("cambiar el estado de un residuo filtra por usuario", async () => {
    await cambiarEstadoResiduo("r-9", USUARIO, "vendido");

    const consulta = ultimaConsulta();
    assert.equal(consulta.operacion, "update");
    assert.ok(filtra(consulta, "id", "r-9"));
    assert.ok(filtra(consulta, "user_id", USUARIO), "falta el filtro de propiedad");
  });

  test("borrar un residuo filtra por usuario", async () => {
    await eliminarResiduo("r-9", USUARIO);

    const consulta = ultimaConsulta();
    assert.equal(consulta.operacion, "delete");
    assert.ok(filtra(consulta, "user_id", USUARIO));
  });

  test("cambiar el estado de un servicio filtra por usuario", async () => {
    await cambiarEstadoServicio("s-3", USUARIO, "inactivo");

    const consulta = ultimaConsulta();
    assert.equal(consulta.operacion, "update");
    assert.ok(filtra(consulta, "user_id", USUARIO));
  });

  test("borrar un servicio filtra por usuario", async () => {
    await eliminarServicio("s-3", USUARIO);
    assert.ok(filtra(ultimaConsulta(), "user_id", USUARIO));
  });

  test("borrar un interés filtra por usuario", async () => {
    await eliminarInteres("i-7", USUARIO);
    assert.ok(filtra(ultimaConsulta(), "user_id", USUARIO));
  });
});

// ==============================================================
// profiles: columnas escribibles
// ==============================================================

describe("actualizarPerfil", () => {
  test("nunca envía company_type", async () => {
    await actualizarPerfil(USUARIO, { location: "Torreón", logo_url: "x.png" });

    const enviado = ultimaConsulta().payload;
    assert.equal("company_type" in enviado, false, "el rol no se escribe desde el cliente");
  });

  test("solo toca location, logo_url y updated_at", async () => {
    await actualizarPerfil(USUARIO, { location: "Torreón", logo_url: "x.png" });

    assert.deepEqual(
      Object.keys(ultimaConsulta().payload).sort(),
      ["location", "logo_url", "updated_at"]
    );
  });

  test("sin logo nuevo no sobrescribe el que ya hay", async () => {
    await actualizarPerfil(USUARIO, { location: "Torreón" });
    assert.equal("logo_url" in ultimaConsulta().payload, false);
  });
});

describe("etiquetaRol", () => {
  // El identificador interno sigue siendo `proveedor`; lo que cambió es
  // solo la etiqueta, al vocabulario de docs/documento-maestro.md §05.
  test("traduce los tres roles", () => {
    assert.equal(etiquetaRol("comprador"), "Comprador industrial");
    assert.equal(etiquetaRol("proveedor"), "Generador de residuos");
    assert.equal(etiquetaRol("logistica"), "Transportista");
  });

  test("un rol ausente o desconocido no rompe la vista", () => {
    assert.equal(etiquetaRol(null), "—");
    assert.equal(etiquetaRol("otro"), "—");
  });
});

// ==============================================================
// intereses: la columna depende del tipo
// ==============================================================

describe("intereses", () => {
  test("un interés en residuo llena residuo_id y deja el otro en null", async () => {
    await guardarInteres(USUARIO, TIPO_RESIDUO, "r-4");

    const fila = ultimaConsulta().payload;
    assert.equal(fila.residuo_id, "r-4");
    assert.equal(fila.servicio_transporte_id, null);
    assert.equal(fila.tipo, TIPO_RESIDUO);
  });

  test("un interés en transporte llena servicio_transporte_id", async () => {
    await guardarInteres(USUARIO, TIPO_TRANSPORTE, "s-4");

    const fila = ultimaConsulta().payload;
    assert.equal(fila.servicio_transporte_id, "s-4");
    assert.equal(fila.residuo_id, null);
  });

  test("la comprobación de duplicado usa la columna del tipo", async () => {
    await existeInteres(USUARIO, TIPO_TRANSPORTE, "s-4");

    const columnas = ultimaConsulta().filtros.map(([, c]) => c);
    assert.ok(columnas.includes("servicio_transporte_id"));
    assert.equal(columnas.includes("residuo_id"), false);
  });

  test("devuelve false cuando no hay interés previo", async () => {
    programar("intereses", { data: null, error: null });
    assert.equal(await existeInteres(USUARIO, TIPO_RESIDUO, "r-4"), false);
  });

  test("devuelve true cuando ya existe", async () => {
    programar("intereses", { data: { id: "i-1" }, error: null });
    assert.equal(await existeInteres(USUARIO, TIPO_RESIDUO, "r-4"), true);
  });
});

// ==============================================================
// Agrupaciones para los badges
// ==============================================================

describe("agruparPorResiduo", () => {
  test("junta los tipos de cada residuo", () => {
    const mapa = agruparPorResiduo([
      { residuo_id: "r-1", tipo: "documentacion" },
      { residuo_id: "r-1", tipo: "condiciones" },
      { residuo_id: "r-2", tipo: "practicas" },
    ]);

    assert.deepEqual([...mapa["r-1"]].sort(), ["condiciones", "documentacion"]);
    assert.deepEqual([...mapa["r-2"]], ["practicas"]);
  });

  test("los duplicados no cuentan dos veces", () => {
    const mapa = agruparPorResiduo([
      { residuo_id: "r-1", tipo: "documentacion" },
      { residuo_id: "r-1", tipo: "documentacion" },
    ]);

    assert.equal(mapa["r-1"].size, 1);
  });

  test("sin filas devuelve un mapa vacío", () => {
    assert.deepEqual(agruparPorResiduo([]), {});
  });
});

