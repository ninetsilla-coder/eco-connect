// ==============================================================
// Estado de la cuenta: aviso y botones
// ==============================================================
// El estado decide qué puede hacer una empresa
// (docs/cambios-plataforma.md §3). Aquí vive lo que se ve: el texto de
// cada estado, el aviso y el apagado de los botones.
//
// ⚠️ ESTO NO ES SEGURIDAD, Y NO DEBE PRESENTARSE COMO TAL.
// Apagar un botón no impide nada: quien llame a la API directamente
// publica igual. Es experiencia de usuario —que no se intente algo que
// va a fallar, y que se sepa qué falta— exactamente como
// `requiereSesion()` (CLAUDE.md §4.3 y §4.5).
//
// Para que el estado bloquee de verdad hay que comprobarlo en las
// políticas de la base, como hace `mi_rol()` con el rol. Está anotado
// como pendiente de seguridad en CLAUDE.md §7 y decidido así para el
// prototipo (D-15 de docs/plan-de-trabajo.md).
// ==============================================================

const POR_DEFECTO = "pendiente";

export const ESTADOS = Object.freeze({
  pendiente: {
    titulo: "Expediente pendiente",
    detalle: "Completa tu expediente para empezar a operar.",
    opera: false,
  },
  en_revision: {
    titulo: "En revisión",
    detalle: "Estamos revisando tus documentos (24 a 48 horas).",
    opera: false,
  },
  verificado: {
    titulo: "Verificado",
    detalle: "Tu documentación está cotejada y vigente. Ya puedes operar.",
    opera: true,
  },
  rechazado: {
    titulo: "Rechazado",
    detalle: "Revisa el motivo en tu expediente y vuelve a enviarlo.",
    opera: false,
  },
  vencido: {
    titulo: "Autorización vencida",
    detalle: "Tu autorización venció. Sube el refrendo para reactivar tus publicaciones.",
    opera: false,
  },
  // El registro de generador NO vence: se actualiza cada tres años
  // (documento maestro §20). Llamarle "vencido" a un generador sería
  // decirle que perdió un permiso que sigue teniendo.
  actualizacion_pendiente: {
    titulo: "Actualización pendiente",
    detalle: "Tu registro de generador se actualiza cada tres años. Sube la actualización para seguir publicando.",
    opera: false,
  },
});

export function infoEstado(estado) {
  return ESTADOS[estado] ?? ESTADOS[POR_DEFECTO];
}

// Qué decir del veredicto de UN documento. Son dos estados distintos
// —el de la cuenta y el de cada documento— y pueden contradecirse:
// "Verificado" arriba y "En espera de revisión" en cada papel, que es
// justo lo que no debe leerse.
//
// El del documento manda cuando el equipo lo tocó de verdad. Cuando
// sigue en `pendiente` —su valor por defecto, o sea: nadie lo miró por
// separado— la respuesta la da la cuenta, porque el estado de la cuenta
// ES el veredicto del equipo sobre el expediente entero:
//
//   cuenta verificada     el expediente se revisó y pasó
//   cuenta en revisión    está en la cola
//   cuenta sin enviar     no hay nada que esperar: aún no se ha mandado
//
// Devuelve null cuando no hay nada honesto que decir.
export function etiquetaRevision(estadoDocumento, estadoCuenta) {
  if (estadoDocumento === "aprobado") return ["Aprobado", "aprobado"];
  if (estadoDocumento === "rechazado") return ["Rechazado", "rechazado"];

  if (estadoCuenta === "verificado") return ["Aprobado", "aprobado"];
  if (estadoCuenta === "en_revision") return ["En revisión", "pendiente"];
  return null;
}

// Ver publicaciones no depende del estado: cualquiera explora el
// catálogo (§3). Lo que se reserva a las cuentas verificadas es
// contactar, comprar, publicar y ofrecer transporte.
export function puedeOperar(estado) {
  return infoEstado(estado).opera === true;
}

// El aviso que se pinta arriba de la página. Devuelve null cuando la
// cuenta está verificada: ahí no hay nada que avisar, y una barra verde
// diciendo "todo bien" en cada pantalla es ruido.
export function crearAvisoEstado(estado, { accion = "operar" } = {}) {
  if (puedeOperar(estado)) return null;

  const info = infoEstado(estado);

  const caja = document.createElement("div");
  caja.className = "aviso-estado";
  caja.setAttribute("role", "status");

  const titulo = document.createElement("strong");
  titulo.textContent = info.titulo;

  const detalle = document.createElement("p");
  detalle.textContent = `${info.detalle} Mientras tanto no puedes ${accion}.`;

  const enlace = document.createElement("a");
  enlace.href = "expediente.html";
  enlace.textContent = "Ir a mi expediente";

  caja.append(titulo, detalle, enlace);
  return caja;
}

// Apaga un botón y dice por qué. El motivo va en `title` y en
// `aria-label` para que también lo reciba quien usa lector de pantalla:
// un botón gris y mudo no explica nada.
export function bloquearSiNoOpera(boton, estado, { accion = "operar" } = {}) {
  if (!boton || puedeOperar(estado)) return false;

  const info = infoEstado(estado);
  boton.disabled = true;
  boton.classList.add("btn-bloqueado");

  const motivo = `${info.titulo}: completa tu expediente para ${accion}.`;
  boton.title = motivo;
  boton.setAttribute("aria-label", `${boton.textContent}. ${motivo}`);
  return true;
}
