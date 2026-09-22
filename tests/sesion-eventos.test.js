// ==============================================================
// core/sesion.js — el lado de los eventos de auth
// ==============================================================
// `sesion.test.js` cubre la caché de obtenerSesion(). Esto cubre la
// otra mitad del defecto original, que se había quedado sin prueba:
//
//   "script.js consultaba profiles dos veces por carga, y REPETÍA AMBAS
//    en cada onAuthStateChange"
//
// La parte de "por carga" está fijada. La de "en cada evento" no lo
// estaba, y es la que más fácil se rompe: basta sacar el
// onAuthStateChange de dentro del `if (!listenerInstalado)` para que
// cada módulo registre el suyo. Con navbar y la página suscritos, eso
// son dos listeners y dos consultas por evento — el defecto entero, de
// vuelta, sin que nada avise.
//
// ⚠️ POR QUÉ AQUÍ NO HAY beforeEach(reiniciar), contra §5.4.5
// `listenerInstalado` es estado de módulo y no se puede revertir desde
// fuera. reiniciar() vacía registro.suscriptores, así que dejaría a
// sesion.js creyendo que tiene instalado un listener que el doble ya
// no conoce: el evento no llegaría a ninguna parte y las pruebas
// pasarían en falso.
//
// Así que se monta UNA vez en before() y las pruebas comparten ese
// montaje, en orden. Lo que se reinicia entre ellas es solo el contador
// de consultas. La alternativa —exportar un reinicio solo para
// pruebas— sería tocar el código de producción para poder probarlo,
// que es justo lo que §5.1 dice que no se haga.
// ==============================================================

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";

import { reiniciar, registro, programar, establecerSesion } from "./dobles/supabase.js";
import { alCambiarSesion, invalidarSesion } from "../public/js/core/sesion.js";

const USUARIO = { id: "u-1", email: "empresa@ejemplo.com" };

const consultasAProfiles = () =>
  registro.consultas.filter((c) => c.tabla === "profiles").length;

const olvidarConsultas = () => {
  registro.consultas.length = 0;
};

// El callback de onAuthStateChange resuelve en microtareas posteriores.
const asentar = () => new Promise((resolver) => setTimeout(resolver, 0));

const perfilCon = (rol) => ({
  data: { id: USUARIO.id, company_type: rol, company_name: "Acme" },
  error: null,
});

// Lo que recibe cada suscriptor, en orden.
const navbar = [];
const pagina = [];

let dispararEvento;

before(async () => {
  reiniciar();
  invalidarSesion();
  establecerSesion({ user: USUARIO });
  programar("profiles", perfilCon("proveedor"));

  // Dos módulos distintos se enganchan, como pasa en cada página:
  // ui/navbar.js y el pages/*.js correspondiente.
  alCambiarSesion((estado) => navbar.push(estado));
  alCambiarSesion((estado) => pagina.push(estado));
  await asentar();

  // El listener que sesion.js registró en el cliente. Dispararlo es lo
  // que hace Supabase al iniciar o cerrar sesión.
  dispararEvento = registro.suscriptores[0];
});

describe("un solo listener para toda la app", () => {
  // El corazón de esta prueba. Si alguien mueve el onAuthStateChange
  // fuera del guard, aquí habría 2 en vez de 1.
  test("dos suscriptores registran UN solo onAuthStateChange", () => {
    assert.equal(
      registro.suscriptores.length,
      1,
      "cada módulo registró su propio listener; vuelve el defecto de script.js"
    );
  });

  test("al suscribirse se recibe el estado actual sin esperar a un evento", () => {
    assert.equal(navbar.length, 1);
    assert.equal(pagina.length, 1);
    assert.equal(navbar[0].rol, "proveedor");
    assert.equal(pagina[0].rol, "proveedor");
  });

  test("los dos reciben exactamente el mismo objeto de estado", () => {
    assert.equal(navbar[0], pagina[0], "no comparten estado: se resolvió dos veces");
  });
});

describe("un evento de auth", () => {
  before(async () => {
    olvidarConsultas();
    // El perfil cambia: sirve para comprobar que el evento invalida la
    // caché en vez de repartir lo que ya tenía guardado.
    programar("profiles", perfilCon("comprador"));

    await dispararEvento("SIGNED_IN", { user: USUARIO });
    await asentar();
  });

  // La otra mitad del defecto: antes eran dos consultas por evento.
  test("dispara UNA sola consulta a profiles, no una por suscriptor", () => {
    assert.equal(consultasAProfiles(), 1);
  });

  test("notifica a todos los suscriptores", () => {
    assert.equal(navbar.length, 2);
    assert.equal(pagina.length, 2);
  });

  test("invalida la caché: el estado nuevo llega, no el viejo", () => {
    assert.equal(navbar.at(-1).rol, "comprador");
    assert.equal(pagina.at(-1).rol, "comprador");
  });
});

describe("darse de baja", () => {
  test("un suscriptor dado de baja deja de recibir eventos", async () => {
    const recibidos = [];
    const baja = alCambiarSesion((estado) => recibidos.push(estado));
    await asentar();

    // Se suscribe: recibe el estado actual de entrada.
    assert.equal(recibidos.length, 1);

    // Y sigue sin instalar un segundo listener.
    assert.equal(registro.suscriptores.length, 1);

    await dispararEvento("SIGNED_IN", { user: USUARIO });
    await asentar();
    assert.equal(recibidos.length, 2, "no recibió el evento estando suscrito");

    baja();
    await dispararEvento("SIGNED_OUT", {});
    await asentar();
    assert.equal(recibidos.length, 2, "siguió recibiendo después de darse de baja");
  });
});
