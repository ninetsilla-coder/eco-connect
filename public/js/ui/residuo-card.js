// ==============================================================
// Tarjeta de residuo — compartida
// ==============================================================
// mis-residuos y comprador-explorar-residuos pintaban la misma tarjeta
// con dos copias del mismo código. Aquí está una sola vez.
//
// Todo se construye con nodos y textContent. La versión anterior usaba
// `meta.innerHTML += \`<span>Cantidad: ${r.cantidad}</span>\``, y en la
// página de explorar esos valores vienen de residuos de OTRAS empresas:
// bastaba publicar un residuo con HTML en un campo para ejecutar código
// en el navegador de cada comprador que lo viera.
// ==============================================================

export const CATEGORIAS = {
  sin_procesar: { clase: "badge-sin-procesar", texto: "Sin procesar" },
  procesado: { clase: "badge-procesado", texto: "Procesado y limpio" },
};

export function pintarMeta(contenedor, residuo, campos) {
  contenedor.innerHTML = "";

  campos.forEach(([etiqueta, clave]) => {
    const valor = residuo[clave];
    if (!valor) return;
    const span = document.createElement("span");
    span.textContent = `${etiqueta}: ${valor}`;
    contenedor.appendChild(span);
  });
}

// `empresa` es quien publica. Sin ella, dos residuos del mismo material
// se ven idénticos en el catálogo: pasó de verdad al probar la app —dos
// tarjetas "PET" de empresas distintas— y llevó a abrir la conversación
// equivocada creyendo que era la misma.
export function crearCabecera(residuo, empresa) {
  const cabecera = document.createElement("div");
  cabecera.className = "residuo-header";

  const titulo = document.createElement("div");
  titulo.className = "residuo-title";
  titulo.textContent = residuo.tipo || "Residuo sin nombre";

  if (empresa) {
    const quien = document.createElement("span");
    quien.className = "residuo-empresa";
    quien.textContent = empresa;
    titulo.append(document.createElement("br"), quien);
  }

  const insignia = document.createElement("span");
  insignia.className = "residuo-badge";
  const categoria = CATEGORIAS[residuo.categoria];
  if (categoria) {
    insignia.classList.add(categoria.clase);
    insignia.textContent = categoria.texto;
  } else {
    insignia.textContent = "Sin categoría";
  }

  cabecera.append(titulo, insignia);
  return cabecera;
}

export function crearFotos(residuo) {
  if (!Array.isArray(residuo.fotos) || !residuo.fotos.length) return null;

  const contenedor = document.createElement("div");
  contenedor.className = "residuo-fotos";

  residuo.fotos.forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Foto del residuo";
    contenedor.appendChild(img);
  });

  return contenedor;
}

// Devuelve la tarjeta y su nodo meta, para que quien la use pueda
// repintar la meta sin reconstruir la tarjeta entera.
export function crearTarjetaResiduo(residuo, campos, { empresa } = {}) {
  const item = document.createElement("article");
  item.className = "residuo-item";

  const meta = document.createElement("div");
  meta.className = "residuo-meta";
  pintarMeta(meta, residuo, campos);

  const descripcion = document.createElement("p");
  descripcion.className = "residuo-descripcion";
  descripcion.textContent = residuo.descripcion || "Sin descripción adicional.";

  item.append(crearCabecera(residuo, empresa), meta, descripcion);

  const fotos = crearFotos(residuo);
  if (fotos) item.appendChild(fotos);

  return { item, meta };
}
