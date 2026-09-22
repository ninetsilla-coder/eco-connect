// ==============================================================
// Alta de cuenta
// ==============================================================
// El formulario de registro es la única puerta por la que entran el
// RFC y los roles de una empresa, y los tres los escribe el trigger
// desde lo que manda este módulo (supabase/politicas.sql §2). Si el
// payload sale mal, no hay segunda oportunidad: nadie puede corregir
// esos campos después desde la aplicación.
//
// Lo que se fija aquí:
//   1. El rol PRINCIPAL sale del orden declarado, no del orden en que
//      el usuario fue marcando. De él cuelgan el menú y las cinco
//      políticas de escritura.
//   2. La lista completa de roles viaja aunque hoy no mande (D-3 de
//      docs/plan-de-trabajo.md). Es el dato que se perdería sin ruido.
//   3. Sin casillas, o con un RFC mal formado, NO se crea nada.
//
// No toca la red: el cliente es el doble de tests/dobles/supabase.js.
// ==============================================================

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

import { montarDom, desmontarDom } from "./ayudas/dom.js";
import { registro, reiniciar, programar } from "./dobles/supabase.js";

let montarModalAuth;

// El submit del formulario dispara un manejador async; hay que darle su
// turno antes de mirar qué se envió.
const asentar = () => new Promise((resolver) => setTimeout(resolver, 0));

function marcar(...roles) {
  roles.forEach((rol) => {
    document.querySelector(`.signup-role[value="${rol}"]`).checked = true;
  });
}

function llenar({ empresa = "Metales del Nazas S.A. de C.V.", comercial = "",
                  rfc = "MNA240115AB9", correo = "hola@nazas.mx",
                  password = "secreta123" } = {}) {
  document.getElementById("signup-company").value = empresa;
  document.getElementById("signup-trade-name").value = comercial;
  document.getElementById("signup-rfc").value = rfc;
  document.getElementById("signup-email").value = correo;
  document.getElementById("signup-password").value = password;
}

async function enviar() {
  document.getElementById("signup-form")
    .dispatchEvent(new window.Event("submit", { cancelable: true, bubbles: true }));
  await asentar();
}

const textoEstado = () => document.getElementById("signup-status").textContent;

describe("alta de cuenta", () => {
  beforeEach(async () => {
    montarDom();
    reiniciar();
    // Sin esto el alta responde { data: null } y el módulo se va por su
    // rama de error, que no es lo que estas pruebas miran.
    programar("auth.signUp", { data: { user: { id: "u-1" } }, error: null });
    programar("rfc_disponible", { data: true, error: null });
    ({ montarModalAuth } = await import("../public/js/ui/auth-modal.js"));
    montarModalAuth();
  });

  afterEach(desmontarDom);

  test("manda razón social, RFC y la lista completa de roles", async () => {
    llenar({ comercial: "Metales Nazas" });
    marcar("comprador", "proveedor");

    await enviar();

    assert.equal(registro.altas.length, 1, "no se llamó al alta");
    const { email, options } = registro.altas[0];
    assert.equal(email, "hola@nazas.mx");
    assert.equal(options.data.company_name, "Metales del Nazas S.A. de C.V.");
    assert.equal(options.data.nombre_comercial, "Metales Nazas");
    assert.equal(options.data.rfc, "MNA240115AB9");
    assert.deepEqual(options.data.roles, ["proveedor", "comprador"]);
  });

  // La prioridad es Generador > Comprador > Transportista, y tiene que
  // ser estable: el principal decide qué deja hacer la base, así que dos
  // empresas que marcan lo mismo no pueden acabar con permisos
  // distintos. Se comprueban las dos parejas que fijan el orden entero.
  test("con varios roles el principal respeta la prioridad declarada", async () => {
    llenar();
    marcar("logistica", "comprador");
    await enviar();

    assert.equal(registro.altas[0].options.data.company_type, "comprador");
    assert.deepEqual(registro.altas[0].options.data.roles, ["comprador", "logistica"]);

    document.querySelector('.signup-role[value="comprador"]').checked = true;
    document.querySelector('.signup-role[value="proveedor"]').checked = true;
    llenar({ rfc: "MNB240115AB9" });
    await enviar();

    assert.equal(registro.altas[1].options.data.company_type, "proveedor");
  });

  test("el RFC se guarda en mayúsculas y sin espacios ni guiones", async () => {
    llenar({ rfc: " mna-240115 ab9 " });
    marcar("proveedor");

    await enviar();

    assert.equal(registro.altas[0].options.data.rfc, "MNA240115AB9");
  });

  test("sin ningún tipo de empresa no se crea la cuenta", async () => {
    llenar();

    await enviar();

    assert.equal(registro.altas.length, 0, "se registró sin rol");
    assert.match(textoEstado(), /al menos un tipo/i);
  });

  test("un RFC con forma inválida no llega a la base", async () => {
    llenar({ rfc: "ABC123" });
    marcar("proveedor");

    await enviar();

    assert.equal(registro.altas.length, 0, "se registró con un RFC inválido");
    assert.match(textoEstado(), /12 caracteres/i);
  });

  test("si el RFC ya existe se avisa y no se intenta el alta", async () => {
    programar("rfc_disponible", { data: false, error: null });
    llenar();
    marcar("proveedor");

    await enviar();

    assert.deepEqual(registro.rpc[0], {
      nombre: "rfc_disponible",
      argumentos: { rfc_consultado: "MNA240115AB9" },
    });
    assert.equal(registro.altas.length, 0, "se intentó el alta con un RFC repetido");
    assert.match(textoEstado(), /ya está registrado/i);
  });

  // Si la función de la base no está aplicada todavía, la comprobación
  // falla — y no puede llevarse por delante el registro: el índice
  // único sigue protegiendo el duplicado.
  test("si la comprobación del RFC falla, el registro continúa", async () => {
    programar("rfc_disponible", { data: null, error: { message: "function does not exist" } });
    llenar();
    marcar("proveedor");

    await enviar();

    assert.equal(registro.altas.length, 1, "un fallo de cortesía bloqueó el alta");
  });

  test("con un solo rol no se avisa del menú; con dos, sí", async () => {
    const aviso = document.getElementById("signup-role-aviso");
    const casilla = document.querySelector('.signup-role[value="proveedor"]');

    casilla.checked = true;
    casilla.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(aviso.textContent, "");

    const segunda = document.querySelector('.signup-role[value="comprador"]');
    segunda.checked = true;
    segunda.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.match(aviso.textContent, /Generador de residuos/);
  });
});
