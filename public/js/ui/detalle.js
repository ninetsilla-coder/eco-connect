// ==============================================================
// Bloques de detalle — compartidos por las dos páginas de detalle
// ==============================================================
// Antes ambas construían el detalle con innerHTML e interpolación
// directa. El contenido viene de publicaciones de OTRAS empresas, así
// que bastaba con publicar HTML en un campo para ejecutarlo en el
// navegador de quien abriera el detalle. Aquí todo son nodos.
// ==============================================================

export function crearGaleria(urls, textoAlternativo) {
  if (!Array.isArray(urls) || !urls.length) return null;

  const galeria = document.createElement("div");
  galeria.className = "detalle-fotos";

  urls.forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = textoAlternativo;
    galeria.appendChild(img);
  });

  return galeria;
}

// campos: [[etiqueta, valor], ...] — los vacíos se omiten.
export function crearMeta(campos) {
  const meta = document.createElement("div");
  meta.className = "detalle-meta";

  campos.forEach(([etiqueta, valor]) => {
    if (!valor) return;

    const span = document.createElement("span");
    const fuerte = document.createElement("strong");
    fuerte.textContent = `${etiqueta}: `;
    span.append(fuerte, document.createTextNode(valor));
    meta.appendChild(span);
  });

  return meta;
}

export function crearDescripcion(texto) {
  if (!texto) return null;

  const p = document.createElement("p");
  p.className = "detalle-descripcion";
  const fuerte = document.createElement("strong");
  fuerte.textContent = "Descripción: ";
  p.append(fuerte, document.createTextNode(texto));
  return p;
}

export function crearTitulo(texto) {
  const h2 = document.createElement("h2");
  h2.textContent = texto;
  return h2;
}
