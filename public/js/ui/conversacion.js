// ==============================================================
// Conversación entre dos empresas
// ==============================================================
// Solo pinta: recibe mensajes ya cargados y devuelve nodos. Quien
// consulta y envía es la página (§4.1: ui no importa data).
//
// ⚠️ El cuerpo de un mensaje lo escribe la OTRA empresa. Es la entrada
// de datos ajenos más directa que tiene la app, así que todo va por
// textContent. Nada de innerHTML aquí, ni para el nombre del
// interlocutor, ni para la fecha, ni para el texto.
// ==============================================================

function formatearFecha(valor) {
  if (!valor) return "";
  const fecha = new Date(valor);
  if (Number.isNaN(fecha.getTime())) return "";

  return fecha.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function crearMensaje(mensaje, usuarioId, nombreInterlocutor) {
  const esMio = mensaje.remitente_id === usuarioId;

  const elemento = document.createElement("li");
  elemento.className = `mensaje ${esMio ? "mensaje-mio" : "mensaje-suyo"}`;
  elemento.dataset.mensajeId = mensaje.id;

  const cabecera = document.createElement("div");
  cabecera.className = "mensaje-cabecera";

  const autor = document.createElement("strong");
  autor.textContent = esMio ? "Tú" : nombreInterlocutor || "La otra empresa";

  const fecha = document.createElement("span");
  fecha.className = "mensaje-fecha";
  fecha.textContent = formatearFecha(mensaje.created_at);

  cabecera.append(autor, fecha);

  const cuerpo = document.createElement("p");
  cuerpo.className = "mensaje-cuerpo";
  cuerpo.textContent = mensaje.cuerpo ?? "";

  elemento.append(cabecera, cuerpo);
  return elemento;
}

export function crearHilo(mensajes, { usuarioId, nombre } = {}) {
  const lista = document.createElement("ul");
  lista.className = "mensajes-hilo";

  if (!mensajes?.length) {
    const vacio = document.createElement("li");
    vacio.className = "mensajes-vacio";
    vacio.textContent = "Todavía no hay mensajes en esta conversación.";
    lista.appendChild(vacio);
    return lista;
  }

  mensajes.forEach((mensaje) => {
    lista.appendChild(crearMensaje(mensaje, usuarioId, nombre));
  });

  return lista;
}

// Caja de redacción. `alEnviar` recibe el texto y devuelve una promesa;
// mientras tanto el formulario queda bloqueado para que un doble clic
// no mande el mismo mensaje dos veces.
export function crearRedactor({ alEnviar, marcador = "Escribe un mensaje...", boton = "Enviar" } = {}) {
  const formulario = document.createElement("form");
  formulario.className = "mensajes-redactor";

  const campo = document.createElement("textarea");
  campo.className = "mensajes-campo";
  campo.rows = 3;
  campo.placeholder = marcador;
  campo.required = true;

  const enviar = document.createElement("button");
  enviar.type = "submit";
  enviar.className = "btn btn-primary";
  enviar.textContent = boton;

  const estado = document.createElement("p");
  estado.className = "form-status";

  formulario.append(campo, enviar, estado);

  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const texto = campo.value.trim();
    if (!texto) {
      estado.textContent = "Escribe un mensaje antes de enviar.";
      estado.className = "form-status error";
      return;
    }

    campo.disabled = true;
    enviar.disabled = true;
    estado.textContent = "Enviando...";
    estado.className = "form-status";

    try {
      await alEnviar(texto);
      campo.value = "";
      estado.textContent = "";
    } catch (err) {
      console.error("Error enviando el mensaje:", err);
      estado.textContent = "No se pudo enviar. Intenta de nuevo.";
      estado.className = "form-status error";
    } finally {
      campo.disabled = false;
      enviar.disabled = false;
    }
  });

  return { formulario, campo };
}

// Monta una conversación en `contenedor` y la mantiene al día.
//
// Recibe `cargar` y `enviar` como funciones, no importa data: así el
// ciclo (pintar → enviar → repintar) se escribe una vez y las cuatro
// pantallas que lo usan no lo copian, sin romper la regla de capas.
//
// Devuelve { refrescar } por si la página necesita repintar desde fuera.
export async function montarConversacion(contenedor, {
  usuarioId,
  nombre,
  titulo,
  cargar,
  enviar,
}) {
  if (!contenedor) return null;

  async function refrescar() {
    contenedor.innerHTML = "";

    let mensajes = [];
    try {
      mensajes = await cargar();
    } catch (err) {
      console.error("Error cargando la conversación:", err);

      const aviso = document.createElement("p");
      aviso.className = "form-status error";
      aviso.textContent = "No se pudo cargar la conversación.";
      contenedor.appendChild(aviso);
      return;
    }

    contenedor.appendChild(
      crearPanelConversacion({
        mensajes,
        usuarioId,
        nombre,
        titulo,
        alEnviar: async (texto) => {
          await enviar(texto);
          await refrescar();
        },
      })
    );
  }

  await refrescar();
  return { refrescar };
}

// Varias conversaciones sobre la misma publicación, una por empresa.
//
// El dueño de un residuo puede tener cinco compradores interesados, y
// mezclarlos en un solo hilo sería ilegible además de filtrar a cada
// uno lo que escribieron los demás. Aquí van separadas.
//
// `cargar` devuelve { conversaciones, nombres }; `enviar` recibe el id
// del interlocutor y el texto.
export async function montarBandeja(contenedor, { usuarioId, cargar, enviar }) {
  if (!contenedor) return null;

  async function refrescar() {
    contenedor.innerHTML = "";

    let datos;
    try {
      datos = await cargar();
    } catch (err) {
      console.error("Error cargando los mensajes:", err);

      const aviso = document.createElement("p");
      aviso.className = "form-status error";
      aviso.textContent = "No se pudieron cargar los mensajes.";
      contenedor.appendChild(aviso);
      return;
    }

    const { conversaciones = [], nombres = {} } = datos ?? {};

    if (!conversaciones.length) {
      const vacio = document.createElement("p");
      vacio.className = "mensajes-vacio";
      vacio.textContent = "Nadie te ha escrito sobre esta publicación todavía.";
      contenedor.appendChild(vacio);
      return;
    }

    conversaciones.forEach((conversacion) => {
      const nombre = nombres[conversacion.interlocutorId] || "Empresa";
      const titulo = conversacion.sinLeer
        ? `${nombre} · ${conversacion.sinLeer} sin leer`
        : nombre;

      contenedor.appendChild(
        crearPanelConversacion({
          mensajes: conversacion.mensajes,
          usuarioId,
          nombre,
          titulo,
          alEnviar: async (texto) => {
            await enviar(conversacion.interlocutorId, texto);
            await refrescar();
          },
        })
      );
    });
  }

  await refrescar();
  return { refrescar };
}

// Un hilo completo con su caja de redacción.
export function crearPanelConversacion({ mensajes, usuarioId, nombre, alEnviar, titulo } = {}) {
  const panel = document.createElement("section");
  panel.className = "conversacion";

  if (titulo) {
    const encabezado = document.createElement("h3");
    encabezado.className = "conversacion-titulo";
    encabezado.textContent = titulo;
    panel.appendChild(encabezado);
  }

  panel.appendChild(crearHilo(mensajes, { usuarioId, nombre }));

  if (alEnviar) {
    panel.appendChild(crearRedactor({ alEnviar }).formulario);
  }

  return panel;
}
