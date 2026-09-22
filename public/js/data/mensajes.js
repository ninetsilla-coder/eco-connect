// ==============================================================
// Tabla: mensajes
// ==============================================================
// El contacto entre empresas vive dentro de la app: ningún correo
// cruza de una a otra. Ver politicas.sql §7.1 y §7.2.
//
// Un hilo cuelga de una publicación (un residuo O un servicio) y tiene
// exactamente dos partes. Como `mensajes_propios` ya limita la lectura
// a las filas donde soy remitente o destinatario, aquí basta con
// filtrar por la publicación: lo que vuelve son mis conversaciones
// sobre ella, nunca las de otros.
// ==============================================================

import { supabaseClient } from "../core/supabase.js";

const CAMPOS = "id, created_at, residuo_id, servicio_id, remitente_id, destinatario_id, cuerpo, leido_at";

// La publicación se identifica por uno de los dos campos, nunca los
// dos: lo garantiza la restricción `una_sola_publicacion`.
function filtrarPorPublicacion(consulta, { residuoId, servicioId }) {
  return residuoId
    ? consulta.eq("residuo_id", residuoId)
    : consulta.eq("servicio_id", servicioId);
}

export async function listarMensajesDePublicacion({ residuoId, servicioId }) {
  if (!residuoId && !servicioId) return [];

  const { data, error } = await filtrarPorPublicacion(
    supabaseClient.from("mensajes").select(CAMPOS),
    { residuoId, servicioId }
  ).order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function enviarMensaje(remitenteId, { residuoId, servicioId, destinatarioId, cuerpo }) {
  const texto = cuerpo?.trim();
  if (!texto) throw new Error("El mensaje está vacío");

  const { data, error } = await supabaseClient
    .from("mensajes")
    .insert({
      residuo_id: residuoId ?? null,
      servicio_id: servicioId ?? null,
      remitente_id: remitenteId,
      destinatario_id: destinatarioId,
      cuerpo: texto,
    })
    .select(CAMPOS)
    .single();

  if (error) throw error;
  return data;
}

// Solo el destinatario puede marcar, y solo esa columna: politicas.sql
// §7.1 revoca el UPDATE general y concede únicamente `leido_at`.
export async function marcarLeidos(ids, usuarioId) {
  if (!ids?.length) return;

  const { error } = await supabaseClient
    .from("mensajes")
    .update({ leido_at: new Date().toISOString() })
    .in("id", ids)
    .eq("destinatario_id", usuarioId);

  if (error) throw error;
}

// ==============================================================
// Agrupar en conversaciones
// ==============================================================

// Con quién hablo en este mensaje: el otro, sea cual sea mi papel.
export function otraParte(mensaje, usuarioId) {
  return mensaje.remitente_id === usuarioId
    ? mensaje.destinatario_id
    : mensaje.remitente_id;
}

// Devuelve [{ interlocutorId, mensajes, sinLeer, ultimo }], la más
// reciente primero. Un proveedor con cinco compradores interesados ve
// cinco conversaciones separadas, no un revoltijo.
export function agruparEnConversaciones(mensajes, usuarioId) {
  const porInterlocutor = new Map();

  mensajes.forEach((mensaje) => {
    const id = otraParte(mensaje, usuarioId);
    if (!porInterlocutor.has(id)) porInterlocutor.set(id, []);
    porInterlocutor.get(id).push(mensaje);
  });

  return [...porInterlocutor.entries()]
    .map(([interlocutorId, lista]) => ({
      interlocutorId,
      mensajes: lista,
      ultimo: lista[lista.length - 1],
      sinLeer: lista.filter((m) => m.destinatario_id === usuarioId && !m.leido_at).length,
    }))
    .sort((a, b) => new Date(b.ultimo.created_at) - new Date(a.ultimo.created_at));
}

// ==============================================================
// Nombres de empresa
// ==============================================================
// Lee la vista empresas_publicas (§7.2), que expone id y company_name
// y NADA más. profiles sigue cerrado a su dueño: un nombre comercial es
// público en un marketplace, un correo no.

export async function nombresDeEmpresas(ids) {
  const unicos = [...new Set((ids ?? []).filter(Boolean))];
  if (!unicos.length) return {};

  const { data, error } = await supabaseClient
    .from("empresas_publicas")
    .select("id, company_name")
    .in("id", unicos);

  if (error) throw error;

  const mapa = {};
  (data ?? []).forEach(({ id, company_name }) => {
    mapa[id] = company_name || "Empresa sin nombre";
  });
  return mapa;
}
