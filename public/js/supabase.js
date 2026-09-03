// ==============================
// Conexión a Supabase
// ==============================
// Este archivo es el ÚNICO lugar donde se configura la conexión.
// Se carga antes que script.js y profile.js, así que todos comparten
// la misma variable supabaseClient. Si algún día cambias de proyecto
// en Supabase, se cambia aquí y nada más.
//
// Esta llave es la "publishable" (pública): está hecha para vivir en el
// navegador. Lo que protege tus datos son las políticas RLS de Supabase,
// no esconder esta llave. Las llaves SECRETAS nunca van en esta carpeta.

const SUPABASE_URL = "https://afutqmvovdkqyxopdcfo.supabase.co";
const SUPABASE_KEY = "sb_publishable_P7aBG_DaIGC2fKZR7UaQBw_wdI1BU3R";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
