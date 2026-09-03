// ==============================================================
// api/contacto.js  —  BACKEND
// ==============================================================
// Este archivo NO corre en el navegador. Corre en los servidores de
// Vercel, donde nadie puede verlo ni abrirlo. Por eso aquí sí se
// pueden usar llaves secretas: se leen de process.env, que Vercel
// llena con las variables que configuras en su panel.
//
// Qué hace: recibe los datos del formulario de contacto y te manda
// un correo avisando. El mensaje YA quedó guardado en Supabase antes
// de llegar aquí, así que si el correo falla, no se pierde nada.
//
// Variables de entorno que necesita (se configuran en Vercel):
//   RESEND_API_KEY  → la llave secreta de tu cuenta de Resend
//   CORREO_DESTINO  → a qué correo te quieres avisar
// ==============================================================

// Evita que alguien meta HTML raro dentro del correo.
function limpiar(texto) {
  return String(texto || "")
    .slice(0, 2000)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

module.exports = async (req, res) => {
  // Solo aceptamos envíos del formulario, nada más.
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { empresa, correo, mensaje } = req.body || {};

  if (!empresa || !correo) {
    return res.status(400).json({ error: "Faltan la empresa o el correo" });
  }

  const API_KEY = process.env.RESEND_API_KEY;
  const DESTINO = process.env.CORREO_DESTINO;

  if (!API_KEY || !DESTINO) {
    console.error("Faltan RESEND_API_KEY o CORREO_DESTINO en Vercel");
    return res.status(500).json({ error: "El servidor no está configurado" });
  }

  const cuerpo = `
    <h2>Nuevo contacto desde Eco Connect</h2>
    <p><strong>Empresa:</strong> ${limpiar(empresa)}</p>
    <p><strong>Correo:</strong> ${limpiar(correo)}</p>
    <p><strong>Mensaje:</strong><br>${limpiar(mensaje) || "(sin mensaje)"}</p>
    <hr>
    <p style="color:#888;font-size:12px">
      Este mensaje también quedó guardado en tu tabla empresas_registro.
    </p>
  `;

  try {
    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Eco Connect <onboarding@resend.dev>",
        to: [DESTINO],
        reply_to: limpiar(correo),
        subject: `Nuevo contacto: ${limpiar(empresa)}`,
        html: cuerpo,
      }),
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error("Resend respondió con error:", detalle);
      return res.status(502).json({ error: "No se pudo enviar el correo" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Error inesperado al enviar el correo:", err);
    return res.status(500).json({ error: "Error inesperado" });
  }
};
