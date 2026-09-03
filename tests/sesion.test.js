// ==============================================================
// core/sesion.js
// ==============================================================
// El motivo de existir de este módulo es que antes se consultaba
// profiles dos veces por carga y otras dos en cada evento de auth.
// Estas pruebas fijan que eso no vuelva.
// ==============================================================

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { reiniciar, registro, programar, establecerSesion } from "./dobles/supabase.js";
import { obtenerSesion, invalidarSesion } from "../public/js/core/sesion.js";

const USUARIO = { id: "u-1", email: "empresa@ejemplo.com" };

const consultasAProfiles = () =>
  registro.consultas.filter((c) => c.tabla === "profiles").length;

beforeEach(() => {
  reiniciar();
  invalidarSesion();
});

describe("sin sesión", () => {
  test("devuelve el estado vacío", async () => {
    const estado = await obtenerSesion();

    assert.equal(estado.usuario, null);
    assert.equal(estado.rol, null);
    assert.equal(estado.perfil, null);
  });

  test("no consulta profiles si no hay nadie autenticado", async () => {
    await obtenerSesion();
    assert.equal(consultasAProfiles(), 0);
  });
});

describe("con sesión", () => {
  beforeEach(() => {
    establecerSesion({ user: USUARIO });
    programar("profiles", {
      data: { id: USUARIO.id, company_type: "proveedor", company_name: "Acme" },
      error: null,
    });
  });

  test("expone usuario, perfil y rol", async () => {
    const estado = await obtenerSesion();

    assert.equal(estado.usuario.id, USUARIO.id);
    assert.equal(estado.rol, "proveedor");
    assert.equal(estado.perfil.company_name, "Acme");
  });

  test("consulta profiles filtrando por el id del usuario", async () => {
    await obtenerSesion();

    const consulta = registro.consultas.find((c) => c.tabla === "profiles");
    assert.deepEqual(consulta.filtros, [["eq", "id", USUARIO.id]]);
  });

  // El defecto original: dos consultas por carga y dos más por evento.
  test("varias llamadas seguidas consultan profiles UNA sola vez", async () => {
    await obtenerSesion();
    await obtenerSesion();
    await obtenerSesion();

    assert.equal(consultasAProfiles(), 1);
  });

  // Dos módulos que arrancan a la vez (navbar y la página) no deben
  // disparar dos consultas: la segunda tiene que engancharse a la que
  // ya está en vuelo.
  test("llamadas simultáneas comparten una sola consulta", async () => {
    const [a, b, c] = await Promise.all([
      obtenerSesion(),
      obtenerSesion(),
      obtenerSesion(),
    ]);

    assert.equal(consultasAProfiles(), 1);
    assert.equal(a.rol, "proveedor");
    assert.deepEqual(a, b);
    assert.deepEqual(b, c);
  });

  test("invalidar fuerza una consulta nueva", async () => {
    await obtenerSesion();
    invalidarSesion();
    await obtenerSesion();

    assert.equal(consultasAProfiles(), 2);
  });

  // Un perfil sin fila (el trigger no corrió) no debe romper la app:
  // simplemente no hay rol, y el dropdown se queda vacío.
  test("un perfil inexistente deja rol en null sin lanzar", async () => {
    programar("profiles", { data: null, error: null });
    invalidarSesion();

    const estado = await obtenerSesion();
    assert.equal(estado.usuario.id, USUARIO.id);
    assert.equal(estado.rol, null);
  });
});
