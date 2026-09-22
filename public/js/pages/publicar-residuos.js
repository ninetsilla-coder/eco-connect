// ==============================================================
// Página: publicar-residuos.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { requiereSesion, obtenerSesion } from "../core/sesion.js";
import { crearAvisoEstado, bloquearSiNoOpera, puedeOperar } from "../ui/estado-cuenta.js";
import { publicarResiduo, COMISION } from "../data/residuos.js";
import {
  MATERIALES, MUNICIPIOS, UNIDADES, PERIODICIDADES,
  NIVELES_PROCESAMIENTO, CONDICIONES, CLAVE_PENDIENTE, pideHumedad,
} from "../data/materiales.js";

montarNavbar();

const seccionFormulario = document.getElementById("form-residuo");
const formulario = document.getElementById("form-publicar-residuo");

let categoriaSeleccionada = null;

const MINIMO_FOTOS = 2;

const buscarMaterialElegido = () =>
  MATERIALES.find((m) => m.id === document.getElementById("material")?.value) ?? null;

// ==============================================================
// Listas del formulario
// ==============================================================
// Se pintan con createElement y textContent, no interpolando HTML
// (CLAUDE.md §4.4). Aquí los datos son nuestros, pero el día que salgan
// de la base el patrón ya está puesto.

function llenarSelect(id, opciones, { vacio = null } = {}) {
  const select = document.getElementById(id);
  if (!select) return;

  select.textContent = "";
  if (vacio) {
    const inicial = document.createElement("option");
    inicial.value = "";
    inicial.textContent = vacio;
    select.appendChild(inicial);
  }

  opciones.forEach(({ id: valor, nombre }) => {
    const opcion = document.createElement("option");
    opcion.value = valor;
    opcion.textContent = nombre;
    select.appendChild(opcion);
  });
}

llenarSelect("material", MATERIALES.map(({ id, nombre, categoria }) => ({
  id, nombre: `${nombre} — ${categoria}`,
})), { vacio: "Selecciona un material" });

llenarSelect("unidad", UNIDADES);
llenarSelect("frecuencia", PERIODICIDADES, { vacio: "Selecciona una opción" });
llenarSelect("nivel-procesamiento", NIVELES_PROCESAMIENTO, { vacio: "Selecciona una opción" });
llenarSelect("estado-residuo", CONDICIONES, { vacio: "Selecciona una opción" });
// Con un solo municipio no hay nada que elegir: sale ya seleccionado y
// sin la opción vacía, que solo daría un paso de más y un error posible.
// En cuanto la fase 2 sume municipios, vuelve a comportarse como lista.
llenarSelect("ubicacion", MUNICIPIOS.map((nombre) => ({ id: nombre, nombre })),
  MUNICIPIOS.length > 1 ? { vacio: "Selecciona un municipio" } : {});

// ==============================================================
// Campos que aparecen según lo elegido
// ==============================================================

const campoHumedad = document.getElementById("campo-humedad");
const campoCondicionDetalle = document.getElementById("campo-condicion-detalle");
const entradaCondicionDetalle = document.getElementById("condicion-detalle");

function alternarHumedad() {
  const material = document.getElementById("material")?.value;
  if (campoHumedad) campoHumedad.style.display = pideHumedad(material) ? "" : "none";
}

function alternarCondicionDetalle() {
  const condicion = document.getElementById("estado-residuo")?.value;
  const hace = condicion === "con-impurezas";
  if (campoCondicionDetalle) campoCondicionDetalle.style.display = hace ? "" : "none";
  // El `required` se pone y se quita con el campo: un campo oculto y
  // obligatorio bloquea el envío sin que se vea por qué.
  if (entradaCondicionDetalle) entradaCondicionDetalle.required = hace;
}

document.getElementById("material")?.addEventListener("change", alternarHumedad);
document.getElementById("estado-residuo")?.addEventListener("change", alternarCondicionDetalle);
alternarHumedad();
alternarCondicionDetalle();

// ==============================================================
// Lo que verá el comprador, mientras se escribe
// ==============================================================
// El precio es el campo donde más fácil se equivoca uno de unidad. Ver
// el total del lote con la comisión mientras se teclea lo delata.

const DINERO = new Intl.NumberFormat("es-MX", {
  style: "currency", currency: "MXN", maximumFractionDigits: 0,
});

function actualizarResumenPrecio() {
  const resumen = document.getElementById("precio-resumen");
  if (!resumen) return;

  const precio = Number(document.getElementById("precio")?.value);
  const cantidad = Number(document.getElementById("cantidad-lote")?.value);
  const unidad = document.getElementById("unidad")?.value || "t";

  if (!(precio > 0) || !(cantidad > 0)) {
    resumen.textContent = "Pesos por kilogramo o por tonelada, según la unidad que elegiste.";
    return;
  }

  // La multiplicación se enseña entera. Con solo el resultado, quien
  // escribe 80 ve aparecer 4,000 y no sabe si se equivocó de unidad o
  // si el cálculo está mal.
  const lote = precio * cantidad;
  const comision = lote * COMISION;
  resumen.textContent =
    `${cantidad} ${unidad} × ${DINERO.format(precio)}/${unidad} = ${DINERO.format(lote)}. ` +
    `El comprador paga ${DINERO.format(lote + comision)} ` +
    `(incluye la comisión del ${COMISION * 100}%: ${DINERO.format(comision)}).`;
}

["precio", "cantidad-lote", "unidad"].forEach((id) => {
  document.getElementById(id)?.addEventListener("input", actualizarResumenPrecio);
  document.getElementById(id)?.addEventListener("change", actualizarResumenPrecio);
});

// ==============================================================
// Cuántas fotos van seleccionadas
// ==============================================================
// El cuadro del sistema deja elegir varias solo con Ctrl, y una
// selección nueva REEMPLAZA a la anterior. Sin decir cuántas hay, quien
// las elige de una en una cree que se van sumando y solo se entera al
// enviar, cuando el aviso de "sube al menos 2" parece un error del
// formulario.

function actualizarResumenFotos() {
  const resumen = document.getElementById("fotos-resumen");
  if (!resumen) return;

  const cuantas = document.getElementById("fotos")?.files?.length ?? 0;
  if (!cuantas) {
    resumen.textContent = "";
  } else if (cuantas < MINIMO_FOTOS) {
    resumen.textContent = `${cuantas} foto seleccionada: falta al menos una más.`;
  } else {
    resumen.textContent = `${cuantas} fotos seleccionadas.`;
  }
}

document.getElementById("fotos")?.addEventListener("change", actualizarResumenFotos);

const TEXTOS = {
  sin_procesar: {
    titulo: "Publicar residuo sin procesar",
    subtitulo:
      "Describe el residuo tal como sale de tu proceso (antes de limpieza, selección o compactado).",
  },
  procesado: {
    titulo: "Publicar residuo procesado y limpio",
    subtitulo:
      "Describe el material ya procesado para que los recicladores entiendan en qué estado lo recibirán.",
  },
};

function abrirFormulario(categoria) {
  categoriaSeleccionada = categoria;

  const textos = TEXTOS[categoria] ?? {
    titulo: "Publicar residuo",
    subtitulo:
      "Completa los datos del residuo para que los recicladores puedan evaluar la oportunidad.",
  };

  const titulo = document.getElementById("form-title");
  const subtitulo = document.getElementById("form-subtitle");
  if (titulo) titulo.textContent = textos.titulo;
  if (subtitulo) subtitulo.textContent = textos.subtitulo;

  if (seccionFormulario) {
    seccionFormulario.style.display = "block";
    seccionFormulario.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function cerrarFormulario() {
  if (seccionFormulario) seccionFormulario.style.display = "none";
}

// Antes esto eran atributos onclick="" en el HTML, que necesitan
// funciones globales. Los módulos tienen su propio ámbito, así que
// ahora el enganche es por data-categoria y data-cerrar-formulario.
document.querySelectorAll("[data-categoria]").forEach((boton) => {
  boton.addEventListener("click", () => abrirFormulario(boton.dataset.categoria));
});

document.querySelectorAll("[data-cerrar-formulario]").forEach((boton) => {
  boton.addEventListener("click", cerrarFormulario);
});

// ==============================================================
// Estado de la cuenta
// ==============================================================
// Solo las cuentas verificadas publican (cambios-plataforma §3). Los
// botones se apagan, no se esconden: quien llega aquí tiene que
// entender qué le falta, no creer que la página está rota.
//
// ⚠️ Esto es aviso, no control: las políticas de la base todavía no
// comprueban el estado (D-15, CLAUDE.md §7).
(async () => {
  const sesion = await obtenerSesion();
  if (!sesion?.usuario) return;

  const aviso = crearAvisoEstado(sesion.estado, { accion: "publicar residuos" });
  if (aviso) document.querySelector("main")?.prepend(aviso);

  document.querySelectorAll("[data-categoria]").forEach((boton) => {
    bloquearSiNoOpera(boton, sesion.estado, { accion: "publicar" });
  });
})();

// ==============================================================
// Envío
// ==============================================================

const estadoFormulario = document.createElement("p");
estadoFormulario.className = "form-status";
estadoFormulario.style.marginTop = "8px";
formulario?.parentElement?.appendChild(estadoFormulario);

function mostrarEstado(texto, clase = "") {
  estadoFormulario.textContent = texto;
  estadoFormulario.className = clase ? `form-status ${clase}` : "form-status";
}

formulario?.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  mostrarEstado("Guardando residuo...");

  const estado = await requiereSesion("index.html");
  if (!estado) return;

  // El botón ya está apagado, pero el formulario se puede enviar con la
  // tecla Enter: sin esto, una cuenta pendiente llegaría al insert.
  if (!puedeOperar(estado.estado)) {
    return mostrarEstado(
      "Tu cuenta todavía no está verificada. Completa tu expediente para publicar.",
      "error",
    );
  }

  const valor = (id) => document.getElementById(id)?.value.trim() ?? "";

  const material = buscarMaterialElegido();
  const cantidadLote = Number(valor("cantidad-lote"));
  const precio = Number(valor("precio"));
  const unidad = document.getElementById("unidad")?.value;
  const condicion = document.getElementById("estado-residuo")?.value;
  const fotos = document.getElementById("fotos")?.files;

  // El navegador ya exige los `required`, pero solo si el formulario se
  // envía con el botón. Estas comprobaciones son las que no puede hacer
  // él: mínimo de fotos, números positivos y el detalle de impurezas.
  if (!material) return mostrarEstado("Elige un material del catálogo.", "error");
  if (!(cantidadLote > 0)) return mostrarEstado("La cantidad del lote debe ser mayor que cero.", "error");
  if (!(precio > 0)) return mostrarEstado("El precio debe ser mayor que cero.", "error");
  if ((fotos?.length ?? 0) < MINIMO_FOTOS) {
    return mostrarEstado(`Sube al menos ${MINIMO_FOTOS} fotos del material.`, "error");
  }
  if (condicion === "con-impurezas" && !valor("condicion-detalle")) {
    return mostrarEstado("Describe qué impurezas trae el material.", "error");
  }
  if (!document.getElementById("declaracion")?.checked) {
    return mostrarEstado("Falta la declaración de material no peligroso.", "error");
  }

  try {
    await publicarResiduo(
      estado.usuario.id,
      {
        // `tipo` guarda el nombre del catálogo, no lo que se teclee.
        tipo: material.nombre,
        materialClave: CLAVE_PENDIENTE,
        categoria: categoriaSeleccionada,
        cantidadLote,
        unidad,
        cantidadTexto: `${cantidadLote} ${unidad}`,
        precio,
        ubicacion: valor("ubicacion"),
        frecuencia: document.getElementById("frecuencia")?.value,
        nivelProcesamiento: document.getElementById("nivel-procesamiento")?.value,
        estadoResiduo: condicion,
        condicionDetalle: condicion === "con-impurezas" ? valor("condicion-detalle") : "",
        humedad: pideHumedad(material.id) && valor("humedad") ? Number(valor("humedad")) : null,
        descripcion: valor("descripcion"),
        declaracion: true,
      },
      fotos
    );

    mostrarEstado("Residuo publicado correctamente.", "success");
    formulario.reset();
    alternarHumedad();
    alternarCondicionDetalle();
    actualizarResumenPrecio();
    actualizarResumenFotos();
  } catch (err) {
    console.error("Error publicando el residuo:", err);
    mostrarEstado(
      "Ocurrió un error al guardar el residuo. Intenta de nuevo.",
      "error"
    );
  }
});
