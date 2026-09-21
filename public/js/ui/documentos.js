// ==============================================================
// Lista de documentos de cumplimiento
// ==============================================================
// Hasta ahora los permisos, licencias y seguros se subían y no se
// mostraban en ningún sitio: quien los cargaba no tenía forma de
// comprobar qué había quedado guardado.
//
// Este módulo solo PINTA. Recibe URLs ya firmadas y devuelve nodos; no
// consulta nada. Firmar es una llamada de red y vive en core/data, que
// es de donde la página las trae (§4.1: ui no importa data).
//
// Los enlaces son temporales por diseño: los buckets de cumplimiento
// son privados y `urlFirmada()` caduca. Por eso no se guardan ni se
// comparten — se piden cada vez que se pinta la pantalla.
// ==============================================================

// El nombre en disco es un UUID, que no le dice nada a nadie. Se
// muestra la posición y la extensión, que es lo único informativo.
function etiquetaDocumento(url, indice) {
  const sinParametros = String(url).split("?")[0];
  const extension = sinParametros.includes(".")
    ? sinParametros.split(".").pop().toLowerCase()
    : "";

  const sufijo = extension && extension.length <= 5 ? ` (.${extension})` : "";
  return `Documento ${indice + 1}${sufijo}`;
}

export function crearListaDocumentos(urls, { titulo, textoVacio = "Sin archivos." } = {}) {
  const bloque = document.createElement("div");
  bloque.className = "documentos-grupo";

  if (titulo) {
    const encabezado = document.createElement("strong");
    encabezado.className = "documentos-titulo";
    encabezado.textContent = titulo;
    bloque.appendChild(encabezado);
  }

  if (!urls?.length) {
    const vacio = document.createElement("span");
    vacio.className = "documentos-vacio";
    vacio.textContent = textoVacio;
    bloque.appendChild(vacio);
    return bloque;
  }

  const lista = document.createElement("ul");
  lista.className = "documentos-lista";

  urls.forEach((url, i) => {
    const elemento = document.createElement("li");

    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.textContent = etiquetaDocumento(url, i);
    enlace.target = "_blank";
    // Sin esto, la pestaña que se abre puede manipular la nuestra por
    // window.opener. El enlace apunta a Storage, pero la regla no
    // depende de confiar en el destino.
    enlace.rel = "noopener noreferrer";

    elemento.appendChild(enlace);
    lista.appendChild(elemento);
  });

  bloque.appendChild(lista);
  return bloque;
}

// Varios grupos de documentos (permisos, certificaciones, seguros) en
// un solo contenedor. `grupos` es [{ titulo, urls }, ...].
export function crearBloqueDocumentos(grupos, { textoVacio } = {}) {
  const contenedor = document.createElement("div");
  contenedor.className = "documentos";

  grupos.forEach(({ titulo, urls }) => {
    contenedor.appendChild(crearListaDocumentos(urls, { titulo, textoVacio }));
  });

  return contenedor;
}
