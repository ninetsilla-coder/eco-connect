// ==============================================================
// Página: pago.html
// ==============================================================
// SIMULADO de principio a fin (CLAUDE.md §0.1). Lo que hará la versión
// real, y que aquí NO ocurre:
//
//   1. EcoConnect crea el cobro en Stripe con el total de la operación.
//   2. Stripe devuelve una CLABE y una referencia, que son las que se
//      enseñan aquí.
//   3. El comprador transfiere por SPEI.
//   4. Stripe avisa a una función nueva en `api/` (el webhook), que
//      pasa la operación a `pagada`. Solo ese aviso habilita el
//      manifiesto — nunca un botón de esta pantalla.
//   5. Stripe reparte: el lote al generador, el flete al transportista
//      y el 3% a EcoConnect.
//
// Aquí no hay Stripe, ni cobro, ni CLABE de verdad: el botón "Simular
// pago recibido" mueve el estado en la pantalla y nada más. Está
// escrito a la vista del usuario, no solo en este comentario.
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { OPERACION, desglose, CLABE_EJEMPLO } from "../data/operacion-ejemplo.js";
import { COMISION } from "../data/residuos.js";

montarNavbar();

const DINERO = new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN", maximumFractionDigits: 0,
});

const PASOS = [
  { id: "creada", titulo: "Operación acordada", detalle: "El generador aceptó el lote y la fecha." },
  { id: "esperando", titulo: "Esperando tu transferencia", detalle: "Transfiere el monto exacto a la CLABE de arriba." },
  { id: "pagada", titulo: "Pago recibido", detalle: "Stripe reparte el lote, el flete y la comisión." },
  { id: "manifiesto", titulo: "Manifiesto disponible", detalle: "El generador ya puede capturar su folio." },
];

let pasosHechos = 2; // acordada + esperando

function fila(concepto, detalle, importe) {
  const tr = document.createElement("tr");

  const tdConcepto = document.createElement("td");
  tdConcepto.textContent = concepto;
  if (detalle) {
    const span = document.createElement("span");
    span.className = "concepto-detalle";
    span.textContent = detalle;
    tdConcepto.appendChild(span);
  }

  const tdImporte = document.createElement("td");
  tdImporte.textContent = DINERO.format(importe);

  tr.append(tdConcepto, tdImporte);
  return tr;
}

function pintarDesglose() {
  const cuerpo = document.getElementById("desglose");
  if (!cuerpo) return;

  const { lote, flete, comision, total } = desglose(COMISION);
  const { residuo } = OPERACION;

  cuerpo.textContent = "";
  cuerpo.append(
    fila(
      "Lote (al generador)",
      `${residuo.cantidad} ${residuo.unidad} de ${residuo.material} × ${DINERO.format(residuo.precio)}/${residuo.unidad}`,
      lote,
    ),
    fila("Flete (al transportista)", `${OPERACION.transportista.razonSocial} · ${OPERACION.transportista.vehiculo}`, flete),
    fila(`Comisión EcoConnect (${COMISION * 100}%)`, "Sobre el valor del lote, no sobre el flete", comision),
    fila("Total a transferir", null, total),
  );

  const resumen = document.getElementById("pago-resumen");
  if (resumen) {
    resumen.textContent =
      `Operación ${OPERACION.folio} · ${residuo.descripcion} · ` +
      `${OPERACION.generador.razonSocial} → ${OPERACION.comprador.razonSocial}`;
  }
}

function pintarPasos() {
  const contenedor = document.getElementById("pasos-pago");
  if (!contenedor) return;

  contenedor.textContent = "";
  PASOS.forEach((paso, indice) => {
    const hecho = indice < pasosHechos;

    const fila = document.createElement("div");
    fila.className = hecho ? "paso paso-hecho" : "paso";

    const marca = document.createElement("span");
    marca.className = "paso-marca";
    marca.textContent = hecho ? "✓" : "";

    const texto = document.createElement("div");
    texto.className = "paso-texto";
    const titulo = document.createElement("strong");
    titulo.textContent = paso.titulo;
    const detalle = document.createElement("span");
    detalle.textContent = paso.detalle;
    texto.append(titulo, detalle);

    fila.append(marca, texto);
    contenedor.appendChild(fila);
  });
}

pintarDesglose();
pintarPasos();

const clabe = document.getElementById("clabe");
if (clabe) clabe.textContent = CLABE_EJEMPLO;

// Los avisos de que esto es una demostración se escriben desde aquí y
// no en el HTML por una razón: si algún día esta pantalla se conecta a
// Stripe de verdad, quitar el aviso será parte de tocar este archivo.
const avisoClabe = document.getElementById("aviso-clabe");
if (avisoClabe) {
  avisoClabe.textContent =
    "CLABE de ejemplo: no existe en ningún banco. La real la genera Stripe al crear el cobro.";
}

const avisoSimulacion = document.getElementById("aviso-simulacion");
if (avisoSimulacion) {
  avisoSimulacion.textContent =
    "Pantalla de demostración. En la versión real, el pago lo confirma Stripe y nadie puede " +
    "marcarlo desde aquí: es ese aviso, y solo ese, el que habilita el manifiesto.";
}

document.getElementById("btn-simular")?.addEventListener("click", (evento) => {
  const boton = evento.currentTarget;
  pasosHechos = PASOS.length;
  pintarPasos();

  boton.disabled = true;
  boton.textContent = "Pago recibido (simulado)";

  const enlace = document.getElementById("enlace-manifiesto");
  if (enlace) enlace.style.display = "inline-flex";

  const estado = document.getElementById("estado-pago");
  if (estado) {
    estado.className = "form-status success";
    estado.textContent =
      "Pago recibido. En la versión real esto lo dispara el aviso de Stripe, no este botón.";
  }
});
