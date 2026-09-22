// ==============================================================
// Página: autorizaciones.html
// ==============================================================
// Lo que la SMA autoriza a esta empresa. Es la segunda mitad del
// expediente y está aparte por dos razones: depende del rol —cada
// empresa ve solo sus bloques— y se repite POR ESTABLECIMIENTO, así que
// es la parte que crece.
//
// Los tres roles llegan aquí desde su propio enlace del menú ("Mi
// registro de generador", "Mi autorización SMA", "Mi autorización de
// transporte"): una sola página, tres nombres, porque lo que cambia son
// los bloques que se pintan, no el recorrido.
//
// Gemela de expediente.js: mismo cableado, otra pantalla.
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
  pantallaId: "autorizaciones",
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
