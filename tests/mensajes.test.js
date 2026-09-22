// ==============================================================
// Mensajería entre empresas
// ==============================================================
// El contacto se resolvió conversando dentro de la app en vez de
// repartir correos, para no reabrir la fuga que cerró perfil_lectura.
// Eso mueve el riesgo a otro sitio: el cuerpo de un mensaje es la
// entrada de datos ajenos más directa que tiene el producto.
// ==============================================================

import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { montarDom } from "./ayudas/dom.js";
import { reiniciar, registro, programar, ultimaConsulta } from "./dobles/supabase.js";

montarDom();

const { crearMensaje, crearHilo, crearRedactor } = await import(
  "../public/js/ui/conversacion.js"
);
const {
  enviarMensaje,
  listarMensajesDePublicacion,
  marcarLeidos,
  otraParte,
  agruparEnConversaciones,
  nombresDeEmpresas,
} = await import("../public/js/data/mensajes.js");

const YO = "u-yo";
const OTRO = "u-otro";

const mensaje = (extra = {}) => ({
  id: "m-1",
  created_at: "2026-09-21T10:00:00Z",
  remitente_id: OTRO,
  destinatario_id: YO,
  cuerpo: "Hola",
  leido_at: null,
  ...extra,
});

beforeEach(reiniciar);

// ==============================================================
// Seguridad
// ==============================================================

describe("el cuerpo de un mensaje no es marcado", () => {
  const CARGA = '<img src=x onerror="window.pwned=1">';

  test("el HTML de un mensaje ajeno no se convierte en elementos", () => {
    const nodo = crearMensaje(mensaje({ cuerpo: CARGA }), YO, "Peñoles");

    assert.equal(nodo.querySelectorAll("img").length, 0);
    assert.equal(nodo.querySelector(".mensaje-cuerpo").textContent, CARGA);
  });

  // El nombre sale de empresas_publicas, que lo escribe otra empresa
  // en su propio perfil.
  test("el nombre de la empresa tampoco se interpreta", () => {
    const nodo = crearMensaje(mensaje(), YO, CARGA);

    assert.equal(nodo.querySelectorAll("img").length, 0);
    assert.equal(nodo.querySelector("strong").textContent, CARGA);
  });

  test("un hilo entero con HTML sigue sin producir elementos", () => {
    const lista = crearHilo([mensaje({ cuerpo: CARGA }), mensaje({ id: "m-2", cuerpo: CARGA })], {
      usuarioId: YO,
      nombre: "Peñoles",
    });

    assert.equal(lista.querySelectorAll("img").length, 0);
    assert.equal(lista.querySelectorAll("li.mensaje").length, 2);
  });
});

// ==============================================================
// Presentación
// ==============================================================

describe("hilo", () => {
  test("distingue lo mío de lo suyo", () => {
    const mio = crearMensaje(mensaje({ remitente_id: YO, destinatario_id: OTRO }), YO, "Peñoles");
    const suyo = crearMensaje(mensaje(), YO, "Peñoles");

    assert.equal(mio.querySelector("strong").textContent, "Tú");
    assert.equal(suyo.querySelector("strong").textContent, "Peñoles");
    assert.ok(mio.classList.contains("mensaje-mio"));
    assert.ok(suyo.classList.contains("mensaje-suyo"));
  });

  test("sin nombre de empresa no deja el autor en blanco", () => {
    const nodo = crearMensaje(mensaje(), YO, undefined);
    assert.equal(nodo.querySelector("strong").textContent, "La otra empresa");
  });

  test("una conversación vacía lo dice", () => {
    const lista = crearHilo([], { usuarioId: YO });

    assert.equal(lista.querySelectorAll("li.mensaje").length, 0);
    assert.match(lista.textContent, /Todavía no hay mensajes/);
  });

  test("una fecha inválida no rompe el mensaje", () => {
    const nodo = crearMensaje(mensaje({ created_at: "no es fecha" }), YO, "Peñoles");
    assert.equal(nodo.querySelector(".mensaje-fecha").textContent, "");
  });
});

describe("redactor", () => {
  test("no envía un mensaje vacío", async () => {
    let llamadas = 0;
    const { formulario, campo } = crearRedactor({
      alEnviar: async () => {
        llamadas++;
      },
    });

    campo.value = "   ";
    formulario.dispatchEvent(new window.Event("submit"));
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(llamadas, 0);
    assert.match(formulario.querySelector(".form-status").textContent, /Escribe un mensaje/);
  });

  // Un doble clic mandaría el mismo mensaje dos veces.
  test("bloquea el formulario mientras envía", async () => {
    let resolver;
    const { formulario, campo } = crearRedactor({
      alEnviar: () => new Promise((r) => (resolver = r)),
    });

    campo.value = "Nos interesan 20 t/mes";
    formulario.dispatchEvent(new window.Event("submit"));
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(campo.disabled, true, "el campo debe bloquearse durante el envío");

    resolver();
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(campo.disabled, false);
    assert.equal(campo.value, "", "el campo se vacía tras enviar");
  });

  test("si el envío falla lo dice y no borra lo escrito", async () => {
    const { formulario, campo } = crearRedactor({
      alEnviar: async () => {
        throw new Error("sin red");
      },
    });

    campo.value = "Texto que no debe perderse";
    formulario.dispatchEvent(new window.Event("submit"));
    await new Promise((r) => setTimeout(r, 0));

    assert.equal(campo.value, "Texto que no debe perderse");
    assert.match(formulario.querySelector(".form-status").textContent, /No se pudo enviar/);
  });
});

// ==============================================================
// Capa de datos
// ==============================================================

describe("enviarMensaje", () => {
  test("manda residuo_id y deja servicio_id en null", async () => {
    await enviarMensaje(YO, { residuoId: "r-1", destinatarioId: OTRO, cuerpo: "Hola" });

    const fila = ultimaConsulta().payload;
    assert.equal(fila.residuo_id, "r-1");
    assert.equal(fila.servicio_id, null);
    assert.equal(fila.remitente_id, YO);
    assert.equal(fila.destinatario_id, OTRO);
  });

  test("manda servicio_id y deja residuo_id en null", async () => {
    await enviarMensaje(YO, { servicioId: "s-1", destinatarioId: OTRO, cuerpo: "Hola" });

    const fila = ultimaConsulta().payload;
    assert.equal(fila.servicio_id, "s-1");
    assert.equal(fila.residuo_id, null);
  });

  test("recorta el texto y rechaza el vacío sin tocar la base", async () => {
    await enviarMensaje(YO, { residuoId: "r-1", destinatarioId: OTRO, cuerpo: "  Hola  " });
    assert.equal(ultimaConsulta().payload.cuerpo, "Hola");

    const antes = registro.consultas.length;
    await assert.rejects(() =>
      enviarMensaje(YO, { residuoId: "r-1", destinatarioId: OTRO, cuerpo: "   " })
    );
    assert.equal(registro.consultas.length, antes, "no debe llegar a consultar");
  });
});

describe("listarMensajesDePublicacion", () => {
  test("filtra por el residuo", async () => {
    await listarMensajesDePublicacion({ residuoId: "r-1" });

    const consulta = ultimaConsulta();
    assert.equal(consulta.tabla, "mensajes");
    assert.ok(consulta.filtros.some(([op, c, v]) => op === "eq" && c === "residuo_id" && v === "r-1"));
  });

  test("sin publicación no consulta nada", async () => {
    await listarMensajesDePublicacion({});
    assert.equal(registro.consultas.length, 0);
  });
});

describe("marcarLeidos", () => {
  // La política solo deja marcar al destinatario, y el grant solo
  // concede la columna leido_at. Esto es defensa en profundidad.
  test("solo marca lo dirigido a mí", async () => {
    await marcarLeidos(["m-1", "m-2"], YO);

    const consulta = ultimaConsulta();
    assert.equal(consulta.operacion, "update");
    assert.ok(consulta.filtros.some(([op, c, v]) => op === "eq" && c === "destinatario_id" && v === YO));
  });

  test("solo escribe leido_at, nunca el cuerpo", async () => {
    await marcarLeidos(["m-1"], YO);
    assert.deepEqual(Object.keys(ultimaConsulta().payload), ["leido_at"]);
  });

  test("sin ids no consulta", async () => {
    await marcarLeidos([], YO);
    assert.equal(registro.consultas.length, 0);
  });
});

describe("agrupar en conversaciones", () => {
  test("la otra parte es el otro, sea cual sea mi papel", () => {
    assert.equal(otraParte(mensaje(), YO), OTRO);
    assert.equal(otraParte(mensaje({ remitente_id: YO, destinatario_id: OTRO }), YO), OTRO);
  });

  // Un proveedor con varios compradores interesados no debe verlos
  // mezclados: sería ilegible y enseñaría a cada uno lo de los demás.
  test("separa por empresa", () => {
    const conversaciones = agruparEnConversaciones(
      [
        mensaje({ id: "a", remitente_id: "comprador-1" }),
        mensaje({ id: "b", remitente_id: "comprador-2" }),
        mensaje({ id: "c", remitente_id: YO, destinatario_id: "comprador-1" }),
      ],
      YO
    );

    assert.equal(conversaciones.length, 2);
    const uno = conversaciones.find((c) => c.interlocutorId === "comprador-1");
    assert.equal(uno.mensajes.length, 2);
  });

  test("cuenta los no leídos solo de los que recibí", () => {
    const [conversacion] = agruparEnConversaciones(
      [
        mensaje({ id: "a" }),
        mensaje({ id: "b", leido_at: "2026-09-21T11:00:00Z" }),
        mensaje({ id: "c", remitente_id: YO, destinatario_id: OTRO }),
      ],
      YO
    );

    assert.equal(conversacion.sinLeer, 1);
  });

  test("la conversación más reciente va primero", () => {
    const conversaciones = agruparEnConversaciones(
      [
        mensaje({ id: "a", remitente_id: "vieja", created_at: "2026-01-01T00:00:00Z" }),
        mensaje({ id: "b", remitente_id: "nueva", created_at: "2026-09-21T00:00:00Z" }),
      ],
      YO
    );

    assert.equal(conversaciones[0].interlocutorId, "nueva");
  });
});

describe("nombresDeEmpresas", () => {
  // profiles está cerrado a su dueño; el nombre sale de la vista, que
  // expone id y company_name y nada más.
  test("lee la vista, no profiles", async () => {
    programar("empresas_publicas", { data: [{ id: OTRO, company_name: "Peñoles" }], error: null });
    await nombresDeEmpresas([OTRO]);

    const tablas = registro.consultas.map((c) => c.tabla);
    assert.ok(tablas.includes("empresas_publicas"));
    assert.equal(tablas.includes("profiles"), false, "profiles no se consulta desde aquí");
  });

  test("devuelve un mapa id -> nombre", async () => {
    programar("empresas_publicas", { data: [{ id: OTRO, company_name: "Peñoles" }], error: null });
    assert.deepEqual(await nombresDeEmpresas([OTRO]), { [OTRO]: "Peñoles" });
  });

  test("una empresa sin nombre no deja la etiqueta vacía", async () => {
    programar("empresas_publicas", { data: [{ id: OTRO, company_name: null }], error: null });
    assert.equal((await nombresDeEmpresas([OTRO]))[OTRO], "Empresa sin nombre");
  });

  test("sin ids no consulta", async () => {
    assert.deepEqual(await nombresDeEmpresas([]), {});
    assert.equal(registro.consultas.length, 0);
  });
});
