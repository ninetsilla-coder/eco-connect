// ==============================================================
// Página: expediente.html
// ==============================================================
// "Mi expediente" son los documentos que describen a la EMPRESA: se
// llenan una vez y valen para cualquier rol. Lo que la SMA autoriza
// está en autorizaciones.html, porque depende del rol y se repite por
// establecimiento.
//
// El recorrido completo vive en ui/expediente-pantalla.js: las dos
// páginas se diferencian en qué pantalla piden, y en nada más. Aquí
// solo se conectan los cables, que es lo único que `pages/` puede
// hacer (§4.1).
// ==============================================================

import { montarNavbar } from "../ui/navbar.js";
import { requiereSesion, invalidarSesion } from "../core/sesion.js";
import {
  bloquesDePantalla, listarMiExpediente, guardarDocumento, urlDeDocumento,
  enviarARevision, faltantesPorPantalla, puedeEnviarse, filasDe, admiteVarios,
  documentosDeRol, vigenciasPorVencer, CAMPOS,
} from "../data/expediente.js";
import { leerDocumento, LEYENDA_LECTURA } from "../data/lectura-documentos.js";
import { MATERIALES } from "../data/materiales.js";
import { infoEstado } from "../ui/estado-cuenta.js";
import { montarExpediente, SUBTITULOS } from "../ui/expediente-pantalla.js";

montarNavbar();

montarExpediente({
  pantallaId: "empresa",
  subtitulos: SUBTITULOS,
  campos: CAMPOS,
  materiales: MATERIALES,
  datos: {
    requiereSesion: () => requiereSesion("index.html"),
    invalidarSesion,
    infoEstado,
    listar: listarMiExpediente,
    guardar: guardarDocumento,
    obtenerUrl: urlDeDocumento,
    bloques: bloquesDePantalla,
    filasDe,
    admiteVarios,
    faltantesPorPantalla,
    puedeEnviarse,
    enviar: enviarARevision,
    documentosDeRol,
    vigenciasPorVencer,
    leerDocumento,
    leyendaLectura: LEYENDA_LECTURA,
  },
});
