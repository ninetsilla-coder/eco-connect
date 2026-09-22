// ==============================================================
// Página: manifiesto.html
// ==============================================================
// SIMULADO (CLAUDE.md §0.1). Lo que hará la versión real y aquí NO
// ocurre:
//
//   1. Al recibirse el pago, la plataforma genera el PDF del Manifiesto
//      de Generador de la SMA sobre el formato oficial, ya lleno con el
//      expediente, la ficha técnica y el transporte asignado.
//   2. El generador captura su folio autorizado e imprime el original,
//      que viaja con el material con sello de la SMA.
//   3. Cada parte firma su sección en doc2sign: generador y
//      transportista en la recolección, destinatario en la entrega.
//      En la fase 1 esas firmas las envía el equipo desde su cuenta de
//      doc2sign y las marca aquí; no hay integración por API.
//   4. El generador sube el escaneo del original firmado y sellado.
//
// Aquí solo hay una vista previa en HTML y unas casillas que se marcan.
// No se genera ningún PDF, no se envía nada a doc2sign y las firmas no
// tienen valor: es lo que pide §0.1 para el prototipo, y está escrito a
// la vista del usuario.
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { OPERACION, modalidadDestinatario } from "../data/operacion-ejemplo.js";

montarNavbar();

const firmadas = new Set();
let folio = "";

function campo(etiqueta, valor) {
  const caja = document.createElement("div");

  const nombre = document.createElement("div");
  nombre.className = "campo-etiqueta";
  nombre.textContent = etiqueta;

  const contenido = document.createElement("div");
  contenido.className = "campo-valor";
  contenido.textContent = valor || "—";

  caja.append(nombre, contenido);
  return caja;
}

function seccion(titulo, campos) {
  const caja = document.createElement("div");
  caja.className = "seccion";

  const encabezado = document.createElement("div");
  encabezado.className = "seccion-titulo";
  encabezado.textContent = titulo;
  caja.appendChild(encabezado);

  const rejilla = document.createElement("div");
  rejilla.className = "campos";
  campos.forEach(([etiqueta, valor]) => rejilla.appendChild(campo(etiqueta, valor)));
  caja.appendChild(rejilla);

  return caja;
}

function lineaFirma(caja, id, texto) {
  const linea = document.createElement("div");
  linea.className = firmadas.has(id) ? "firma-linea firma-hecha" : "firma-linea";
  linea.textContent = firmadas.has(id) ? `✓ ${texto} — firmada` : `${texto} — pendiente`;
  caja.appendChild(linea);
}

// Las secciones son las del formato oficial de la SMA, con los mismos
// números (documento maestro §06 y cambios-plataforma §7): quien lo
// haya llenado a mano tiene que reconocerlo.
function pintarFormato() {
  const contenedor = document.getElementById("formato");
  if (!contenedor) return;

  const { generador, comprador, transportista, residuo } = OPERACION;

  contenedor.textContent = "";

  const encabezado = document.createElement("div");
  encabezado.className = "formato-encabezado";
  const titulo = document.createElement("h3");
  titulo.textContent = "Manifiesto de Generador de Residuos de Manejo Especial";
  const sub = document.createElement("p");
  sub.textContent = folio
    ? `Secretaría de Medio Ambiente de Coahuila · Folio ${folio}`
    : "Secretaría de Medio Ambiente de Coahuila · Folio pendiente de capturar";
  encabezado.append(titulo, sub);
  contenedor.appendChild(encabezado);

  contenedor.appendChild(seccion("1. Registro como generador", [
    ["Número de registro", generador.registroGenerador],
  ]));

  contenedor.appendChild(seccion("2. Datos del generador", [
    ["Razón social", generador.razonSocial],
    ["RFC", generador.rfc],
    ["Municipio", generador.municipio],
    ["Teléfono", generador.telefono],
  ]));

  contenedor.appendChild(seccion("3. Residuo", [
    ["Material", residuo.material],
    ["Clave del catálogo", residuo.clave],
    ["Descripción", residuo.descripcion],
    ["Cantidad", `${residuo.cantidad} ${residuo.unidad}`],
  ]));

  const seccion4 = seccion("4. Firma del generador", [
    ["Nombre", generador.razonSocial],
  ]);
  lineaFirma(seccion4, "generador", "Firma en la recolección");
  contenedor.appendChild(seccion4);

  contenedor.appendChild(seccion("5. Empresa transportista", [
    ["Razón social", transportista.razonSocial],
    ["Número de autorización", transportista.autorizacion],
  ]));

  const seccion6 = seccion("6. Firma del transportista", [
    ["Nombre", transportista.razonSocial],
  ]);
  lineaFirma(seccion6, "transportista", "Firma en la recolección");
  contenedor.appendChild(seccion6);

  contenedor.appendChild(seccion("7. Vehículo", [
    ["Tipo", transportista.vehiculo],
    ["Placas", transportista.placas],
  ]));

  const seccion8 = seccion("8. Empresa destinataria", [
    ["Razón social", comprador.razonSocial],
    ["Autorización SMA", `${comprador.autorizacion} · ${comprador.tipoAutorizacion}`],
    ["Modalidad", modalidadDestinatario()],
  ]);
  lineaFirma(seccion8, "comprador", "Firma de recepción en la entrega");
  contenedor.appendChild(seccion8);
}

function pintarFirmas() {
  const contenedor = document.getElementById("firmas");
  if (!contenedor) return;

  contenedor.textContent = "";

  OPERACION.firmas.forEach((firma) => {
    const fila = document.createElement("div");
    fila.className = "paso";

    const etiqueta = document.createElement("label");
    etiqueta.className = "declaracion-opcion";
    etiqueta.style.display = "flex";
    etiqueta.style.gap = "10px";
    etiqueta.style.alignItems = "center";

    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.style.width = "auto";
    casilla.checked = firmadas.has(firma.id);

    const texto = document.createElement("span");
    texto.textContent = `${firma.seccion} · ${firma.quien} — ${firma.cuando}`;

    casilla.addEventListener("change", () => {
      if (casilla.checked) firmadas.add(firma.id);
      else firmadas.delete(firma.id);

      pintarFormato();
      actualizarEstadoFirmas();
    });

    etiqueta.append(casilla, texto);
    fila.appendChild(etiqueta);
    contenedor.appendChild(fila);
  });
}

function actualizarEstadoFirmas() {
  const estado = document.getElementById("estado-firmas");
  if (!estado) return;

  const total = OPERACION.firmas.length;
  if (firmadas.size === total) {
    estado.className = "form-status success";
    estado.textContent =
      "Manifiesto completo. La firma de recepción es la que cierra la operación; " +
      "falta subir el escaneo del original sellado.";
  } else {
    estado.className = "form-status";
    estado.textContent = `${firmadas.size} de ${total} firmas marcadas.`;
  }
}

const resumen = document.getElementById("manifiesto-resumen");
if (resumen) {
  resumen.textContent =
    `Operación ${OPERACION.folio} · ${OPERACION.residuo.descripcion} · ` +
    `${OPERACION.generador.razonSocial} → ${OPERACION.comprador.razonSocial}`;
}

const aviso = document.getElementById("aviso-simulacion");
if (aviso) {
  aviso.textContent =
    "Pantalla de demostración: no se genera ningún PDF ni se envía nada a doc2sign, y estas " +
    "firmas no tienen valor legal. En la versión real el original impreso y sellado viaja con " +
    "el material, y cada parte firma su sección por separado.";
}

document.getElementById("btn-folio")?.addEventListener("click", () => {
  const entrada = document.getElementById("folio");
  const estado = document.getElementById("estado-folio");
  const valor = entrada?.value.trim() ?? "";

  if (!valor) {
    if (estado) {
      estado.className = "form-status error";
      estado.textContent = "Escribe el folio que te autorizó la SMA.";
    }
    return;
  }

  folio = valor;
  pintarFormato();

  if (estado) {
    estado.className = "form-status success";
    estado.textContent = "Folio guardado en el manifiesto (simulado).";
  }
});

pintarFormato();
pintarFirmas();
actualizarEstadoFirmas();
