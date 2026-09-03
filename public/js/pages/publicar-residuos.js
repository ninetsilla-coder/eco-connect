// ==============================================================
// Página: publicar-residuos.html
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { requiereSesion } from "../core/sesion.js";
import { publicarResiduo } from "../data/residuos.js";

montarNavbar();

const seccionFormulario = document.getElementById("form-residuo");
const formulario = document.getElementById("form-publicar-residuo");

let categoriaSeleccionada = null;

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

  const valor = (id) => document.getElementById(id)?.value.trim() ?? "";

  try {
    await publicarResiduo(
      estado.usuario.id,
      {
        tipo: valor("tipo"),
        categoria: categoriaSeleccionada,
        cantidad: valor("cantidad"),
        ubicacion: valor("ubicacion"),
        frecuencia: document.getElementById("frecuencia")?.value,
        estadoResiduo: document.getElementById("estado-residuo")?.value,
        descripcion: valor("descripcion"),
      },
      document.getElementById("fotos")?.files
    );

    mostrarEstado("Residuo publicado correctamente.", "success");
    formulario.reset();
  } catch (err) {
    console.error("Error publicando el residuo:", err);
    mostrarEstado(
      "Ocurrió un error al guardar el residuo. Intenta de nuevo.",
      "error"
    );
  }
});
