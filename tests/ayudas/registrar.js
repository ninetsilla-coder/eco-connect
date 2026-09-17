// Registra el hook de resolución antes de que se cargue ningún módulo.
// Se engancha con `node --import ./tests/ayudas/registrar.js`.
import { register } from "node:module";

register("./cargador.js", import.meta.url);
