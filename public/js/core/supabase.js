// ==============================================================
// Conexión a Supabase (módulo ES)
// ==============================================================
// Sustituye a js/supabase.js, que define una global y desaparecerá
// cuando las 13 páginas estén migradas. Mientras dure la migración
// conviven los dos: cada página usa uno u otro, nunca ambos.
//
// La llave es la "publishable" (pública): está hecha para vivir en el
// navegador. Lo que protege los datos son las políticas RLS, no
// esconder esta llave. Las llaves SECRETAS nunca van en public/.
//
// Versión fijada a propósito: con @2 flotante, un cambio upstream
// puede romper el sitio sin que nadie toque el repo. Subirla es una
// decisión deliberada, no un accidente.
// ==============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const SUPABASE_URL = "https://afutqmvovdkqyxopdcfo.supabase.co";
const SUPABASE_KEY = "sb_publishable_P7aBG_DaIGC2fKZR7UaQBw_wdI1BU3R";

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
