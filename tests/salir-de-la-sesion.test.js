// ==============================================================
// Qué pasa al cerrar sesión
// ==============================================================
// Regresión de un defecto que se vivía así: "a veces me redirige a la
// página pública y muchas veces no; me quedo sin sesión pero viendo la
// pantalla de alguien que la tiene".
//
// La causa era doble, y las dos mitades se arreglan por separado:
//
//   1. `montarNavbar()` solo redirigía si la página le pasaba un
//      destino, y la única que lo pasaba era profile.html. En las demás
//      la opción venía vacía: cerrar sesión no llevaba a ningún lado.
//
//   2. `requiereSesion()` comprobaba la sesión AL CARGAR y nunca más.
//      Aunque la primera mitad estuviera bien, cerrar sesión en otra
//      pestaña —o que caduque— dejaba la página abierta igual.
//
// Lo que se prueba aquí es la segunda: es la que no se ve, la que
// sobrevive a cualquier cambio de la barra, y la que volvería a fallar
// en silencio.
//
// ⚠️ NO se usa jsdom, y no es por comodidad: su `window.location` no se
// deja sustituir, así que no habría forma de observar la navegación.
// `core/sesion.js` no toca el DOM —solo `window.location.href`—, así
// que un window de mentira basta y además deja la intención a la vista.
//
// ⚠️ Sin beforeEach(reiniciar), por lo mismo que sesion-eventos.test.js:
// el listener de auth es estado de módulo y reiniciar() lo dejaría
// apuntando a un doble que ya no lo conoce.
// ==============================================================

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import { registro, programar, establecerSesion } from "./dobles/supabase.js";
import { requiereSesion, invalidarSesion } from "../public/js/core/sesion.js";

const USUARIO = { id: "u-1", email: "empresa@ejemplo.com" };

// El callback de onAuthStateChange resuelve en microtareas posteriores.
const asentar = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("salir de una página que exige sesión", () => {
  const navegaciones = [];

  before(() => {
    globalThis.window = {
      location: {
        pathname: "/mis-residuos.html",
        set href(destino) { navegaciones.push(destino); },
        get href() { return navegaciones.at(-1) ?? ""; },
      },
    };
  });

  after(() => {
    delete globalThis.window;
  });

  test("con sesión, la página se queda donde está", async () => {
    establecerSesion({ user: USUARIO });
    programar("profiles", { data: { id: USUARIO.id, company_type: "proveedor" }, error: null });
    invalidarSesion();

    const estado = await requiereSesion("index.html");

    assert.ok(estado?.usuario, "debería haber dejado pasar");
    assert.deepEqual(navegaciones, [], "no debía navegar a ninguna parte");
  });

  // El corazón del defecto: la sesión termina DESPUÉS de cargar la
  // página. Antes esto no lo miraba nadie y el usuario se quedaba
  // delante de una pantalla que ya no le correspondía.
  test("si la sesión termina después, la página se va sola", async () => {
    establecerSesion(null);

    // Lo que hace el cliente de Supabase al cerrar sesión.
    registro.suscriptores.forEach((cb) => cb("SIGNED_OUT", null));
    await asentar();

    assert.deepEqual(
      navegaciones,
      ["index.html"],
      "al quedarse sin sesión debía volver a la página pública",
    );
  });
});
