// ==============================================================
// Formulario de contacto de empresas
// ==============================================================

import { supabaseClient } from "../core/supabase.js";

// Guarda el lead y AVISA por correo después, sin esperar la respuesta.
//
// El orden es deliberado: si Resend falla, el lead ya está en
// empresas_registro y no se pierde nada. No invertirlo.
export async function registrarEmpresa({ empresa, correo, mensaje }) {
  const { error } = await supabaseClient
    .from("empresas_registro")
    .insert([{ empresa, correo, mensaje: mensaje || null }]);

  if (error) throw error;

  // Fire-and-forget: /api/contacto solo existe bajo `vercel dev` o en
  // producción, así que en un servidor estático esto falla y da igual.
  fetch("/api/contacto", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ empresa, correo, mensaje }),
  }).catch((err) => console.error("No se pudo enviar la notificación:", err));
}
