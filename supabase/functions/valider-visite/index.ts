// ================================================================
// LocaSyn — Edge Function : valider-visite
// Valide un rendez-vous via code à 6 chiffres et crédite le solde
// ================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: object, status: number = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req) => {
  // Requête preflight OPTIONS — répondre immédiatement avant toute logique métier
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { rdv_id, code_saisi, bailleur_id } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Charger le RDV avec le paiement associé
    const { data: rdv, error: fetchError } = await supabase
      .from("rendez_vous")
      .select("*, paiements(*)")
      .eq("id", rdv_id)
      .single();

    if (fetchError || !rdv) {
      return jsonResponse({ ok: false, error: "rdv_introuvable" });
    }

    if (rdv.bailleur_id !== bailleur_id) {
      return jsonResponse({ ok: false, error: "non_autorise" });
    }

    if (rdv.statut === "effectue") {
      return jsonResponse({ ok: false, error: "deja_valide" });
    }

    const codeSaisi = code_saisi?.trim();
    if (rdv.code_validation !== codeSaisi) {
      console.log("[VALIDER-VISITE] Code incorrect — attendu:", rdv.code_validation, "reçu:", codeSaisi);
      return jsonResponse({ ok: false, error: "code_incorrect" });
    }

    // Marquer le RDV comme effectué
    const { error: updateRdvError } = await supabase
      .from("rendez_vous")
      .update({ statut: "effectue", code_valide_le: new Date().toISOString() })
      .eq("id", rdv_id);

    if (updateRdvError) {
      console.error("[VALIDER-VISITE] Erreur update RDV:", updateRdvError);
      return jsonResponse({ ok: false, error: "maj_rdv_echouee" });
    }

    const paiement = rdv.paiements;
    if (!paiement) {
      // RDV sans paiement (cas visites anciennes) — validé mais pas de crédit
      return jsonResponse({ ok: true, credit: false, raison: "pas_de_paiement_associe" });
    }

    // Libérer l'escrow sur le paiement
    await supabase
      .from("paiements")
      .update({ escrow_libere: true, escrow_libere_le: new Date().toISOString() })
      .eq("id", paiement.id);

    // Montant à créditer (90% si montant_bailleur absent)
    const montantACrediter = paiement.montant_bailleur ?? Math.round(paiement.montant * 0.9);

    // Upsert le solde du bailleur
    const { data: soldeExistant } = await supabase
      .from("soldes")
      .select("*")
      .eq("utilisateur_id", bailleur_id)
      .maybeSingle();

    if (soldeExistant) {
      await supabase.from("soldes").update({
        montant_disponible: soldeExistant.montant_disponible + montantACrediter,
        montant_total_recu: soldeExistant.montant_total_recu + montantACrediter,
        updated_at: new Date().toISOString(),
      }).eq("utilisateur_id", bailleur_id);
    } else {
      await supabase.from("soldes").insert({
        utilisateur_id: bailleur_id,
        montant_disponible: montantACrediter,
        montant_total_recu: montantACrediter,
      });
    }

    // Tracer le mouvement (non bloquant)
    try {
      await supabase.from("mouvements_solde").insert({
        utilisateur_id: bailleur_id,
        type: "credit_visite",
        montant: montantACrediter,
        paiement_id: paiement.id,
        description: `Visite confirmée — ${rdv.date_visite}`,
      });
    } catch (e) {
      console.error("[VALIDER-VISITE] Traçabilité mouvement échouée (non bloquant):", e);
    }

    return jsonResponse({ ok: true, credit: true, montant: montantACrediter });

  } catch (e) {
    console.error("[VALIDER-VISITE] Exception non gérée:", e);
    return jsonResponse({ ok: false, error: "erreur_serveur" });
  }
});
