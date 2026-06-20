// ================================================================
// LocaSyn — whatsapp-notify/index.ts
// Envoi de notifications WhatsApp via Meta Cloud API
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotifPayload {
  telephone: string;
  type: "relance_loyer" | "rdv_confirme" | "nouveau_message";
  data: Record<string, string>;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let payload: NotifPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { telephone, type, data } = payload;

  if (!telephone || !type) {
    return new Response(JSON.stringify({ error: "telephone and type required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const templates: Record<string, string> = {
    relance_loyer: `Bonjour ! 👋\n\nVotre loyer du mois de *${data.mois}* d'un montant de *${data.montant}* est dû.\n\nPayez facilement ici :\n${data.lien}\n\n_LocaSyn — Votre partenaire immobilier_`,
    rdv_confirme: `✅ *Visite confirmée !*\n\nVotre visite du *${data.date}* à *${data.heure}* est confirmée pour :\n📍 ${data.logement}\n\n_LocaSyn_`,
    nouveau_message: `💬 *Nouveau message*\n\nVous avez un nouveau message concernant *${data.logement}*.\n\nOuvrez LocaSyn pour répondre.\n\n_LocaSyn_`,
  };

  const messageText = templates[type];
  if (!messageText) {
    return new Response(JSON.stringify({ error: "Unknown template type" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const phoneId = Deno.env.get("WHATSAPP_PHONE_ID");
  const token = Deno.env.get("WHATSAPP_TOKEN");

  if (!phoneId || !token) {
    console.warn("WhatsApp credentials not configured — skipping send");
    return new Response(JSON.stringify({ ok: true, skipped: "credentials_missing" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Normaliser le numéro (retirer espaces, +, 00)
  const normalizedPhone = telephone
    .replace(/[\s\-\.]/g, "")
    .replace(/^\+/, "")
    .replace(/^00/, "");

  try {
    const response = await fetch(
      `https://graph.facebook.com/v18.0/${phoneId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "text",
          text: { body: messageText },
        }),
      }
    );

    const result = await response.json();

    if (!response.ok) {
      console.error("WhatsApp API error:", result);
      return new Response(JSON.stringify({ error: result }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("WhatsApp fetch error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
