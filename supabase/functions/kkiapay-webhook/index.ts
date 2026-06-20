// ================================================================
// LocaSyn — kkiapay-webhook/index.ts
// Réception des confirmations de paiement KKiaPay
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-kkiapay-signature",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Vérification signature KKiaPay (HMAC-SHA256)
  const signature = req.headers.get("x-kkiapay-signature");
  const secret = Deno.env.get("KKIAPAY_SECRET_HASH") || "";
  if (secret && signature) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );
    const body = JSON.stringify(payload);
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSig = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0")).join("");
    if (expectedSig !== signature) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  if (payload.status === "SUCCESS") {
    const rawData = payload.data as string;
    let paiementData: { paiement_id?: string; type?: string; mois?: string } = {};
    try {
      paiementData = JSON.parse(rawData);
    } catch {
      paiementData = {};
    }

    const { paiement_id, type, mois } = paiementData;
    if (!paiement_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "no paiement_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mettre à jour le paiement
    const { error: updateError } = await supabase
      .from("paiements")
      .update({
        statut: "confirme",
        kkiapay_transaction_id: payload.transactionId as string,
        webhook_recu_le: new Date().toISOString(),
      })
      .eq("id", paiement_id);

    if (updateError) {
      console.error("Paiement update error:", updateError);
    }

    // Actions post-paiement selon le type
    if (type === "loyer_mensuel") {
      await notifyBailleurLoyer(supabase, paiement_id, mois);
    }

    if (type === "boost") {
      await activerBoost(supabase, paiement_id, rawData);
    }

    if (type === "caution") {
      await enregistrerCaution(supabase, paiement_id);
    }
  } else if (payload.status === "FAILED") {
    const rawData = payload.data as string;
    let paiementData: { paiement_id?: string } = {};
    try { paiementData = JSON.parse(rawData); } catch {}

    if (paiementData.paiement_id) {
      await supabase.from("paiements")
        .update({ statut: "echec" })
        .eq("id", paiementData.paiement_id);
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

async function notifyBailleurLoyer(
  supabase: ReturnType<typeof createClient>,
  paiementId: string,
  mois?: string
) {
  const { data: paiement } = await supabase
    .from("paiements")
    .select("beneficiaire_id, montant, logements(titre)")
    .eq("id", paiementId)
    .single();

  if (!paiement) return;

  await supabase.from("notifications").insert({
    utilisateur_id: paiement.beneficiaire_id,
    type: "loyer_recu",
    titre: "Loyer reçu ✓",
    corps: `Le loyer${mois ? ` de ${mois}` : ""} pour "${(paiement as Record<string, unknown> & { logements?: { titre?: string } }).logements?.titre || "votre logement"}" a été confirmé.`,
    lien: "#loyers",
  });
}

async function activerBoost(
  supabase: ReturnType<typeof createClient>,
  paiementId: string,
  rawData: string
) {
  const { data: paiement } = await supabase
    .from("paiements")
    .select("logement_id, metadata")
    .eq("id", paiementId)
    .single();

  if (!paiement?.logement_id) return;

  const fin = new Date();
  fin.setDate(fin.getDate() + 7);

  await supabase.from("logements").update({
    boost_actif: true,
    boost_type: "semaine",
    boost_expire_le: fin.toISOString(),
  }).eq("id", paiement.logement_id);

  await supabase.from("boosts").insert({
    logement_id: paiement.logement_id,
    bailleur_id: (paiement as Record<string, unknown> & { bailleur_id?: string }).bailleur_id,
    type: "semaine",
    montant: 2000,
    fin: fin.toISOString(),
    paiement_id: paiementId,
  });
}

async function enregistrerCaution(
  supabase: ReturnType<typeof createClient>,
  paiementId: string
) {
  const { data: paiement } = await supabase
    .from("paiements")
    .select("beneficiaire_id, payeur_id, montant")
    .eq("id", paiementId)
    .single();

  if (!paiement) return;

  await supabase.from("notifications").insert({
    utilisateur_id: paiement.beneficiaire_id,
    type: "caution_recue",
    titre: "Caution reçue 🔐",
    corps: `Une caution de ${paiement.montant.toLocaleString("fr-FR")} FCFA a été sécurisée en escrow.`,
    lien: "#loyers",
  });
}
