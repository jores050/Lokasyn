// ================================================================
// LocaSyn — Edge Function : confirmer-annulation
// Valide l'annulation d'une visite et crédite le bailleur à 85%
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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { rdv_id, bailleur_id } = await req.json();
    console.log('[CONFIRMER-ANNULATION] rdv_id:', rdv_id, '| bailleur_id:', bailleur_id);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Requête RDV sans jointure — évite les erreurs de FK manquante sur paiements
    const { data: rdv, error: rdvError } = await supabase
      .from('rendez_vous')
      .select('*')
      .eq('id', rdv_id)
      .maybeSingle();

    console.log('[CONFIRMER-ANNULATION] rdv:', JSON.stringify(rdv), '| rdvError:', JSON.stringify(rdvError));

    if (rdvError) {
      console.error('[CONFIRMER-ANNULATION] Erreur requête RDV:', rdvError);
      return jsonResponse({ ok: false, error: 'erreur_requete_rdv' });
    }
    if (!rdv) return jsonResponse({ ok: false, error: 'rdv_introuvable' });
    if (rdv.bailleur_id !== bailleur_id) return jsonResponse({ ok: false, error: 'non_autorise' });
    if (rdv.statut !== 'annule_demande') {
      console.warn('[CONFIRMER-ANNULATION] Statut inattendu:', rdv.statut);
      return jsonResponse({ ok: false, error: 'statut_invalide', statut_actuel: rdv.statut });
    }

    // Marquer le RDV annulé
    await supabase.from('rendez_vous').update({ statut: 'annule_confirme' }).eq('id', rdv_id);

    // Récupérer le paiement séparément si paiement_id existe
    let paiement = null;
    if (rdv.paiement_id) {
      const { data: paiementData, error: paiementError } = await supabase
        .from('paiements')
        .select('*')
        .eq('id', rdv.paiement_id)
        .maybeSingle();

      if (paiementError) {
        console.error('[CONFIRMER-ANNULATION] Erreur requête paiement (non bloquant):', paiementError);
      } else {
        paiement = paiementData;
      }
    }

    if (!paiement) {
      return jsonResponse({ ok: true, credit: false, raison: 'pas_de_paiement_associe' });
    }

    // Split 85% bailleur / 15% plateforme pour une annulation
    const montantBailleur = Math.round(paiement.montant * 0.85);
    const montantPlateforme = Math.round(paiement.montant * 0.15);

    await supabase.from('paiements').update({
      statut: 'annule_confirme',
      montant_bailleur: montantBailleur,
      montant_commission_plateforme: montantPlateforme,
      escrow_libere: true,
      escrow_libere_le: new Date().toISOString(),
    }).eq('id', paiement.id);

    // Upsert solde bailleur
    const { data: soldeExistant } = await supabase
      .from('soldes').select('*').eq('utilisateur_id', bailleur_id).maybeSingle();

    if (soldeExistant) {
      await supabase.from('soldes').update({
        montant_disponible: soldeExistant.montant_disponible + montantBailleur,
        montant_total_recu: soldeExistant.montant_total_recu + montantBailleur,
        updated_at: new Date().toISOString(),
      }).eq('utilisateur_id', bailleur_id);
    } else {
      await supabase.from('soldes').insert({
        utilisateur_id: bailleur_id,
        montant_disponible: montantBailleur,
        montant_total_recu: montantBailleur,
      });
    }

    try {
      await supabase.from('mouvements_solde').insert({
        utilisateur_id: bailleur_id,
        type: 'credit_visite',
        montant: montantBailleur,
        paiement_id: paiement.id,
        description: `Annulation confirmée — dédommagement 85% — ${rdv.date_visite}`,
      });
    } catch (e) {
      console.error('[CONFIRMER-ANNULATION] Traçabilité mouvement échouée (non bloquant):', e);
    }

    console.log('[CONFIRMER-ANNULATION] Succès — montant crédité:', montantBailleur);
    return jsonResponse({ ok: true, credit: true, montant: montantBailleur });

  } catch (e) {
    console.error('[CONFIRMER-ANNULATION] Exception non gérée:', e);
    return jsonResponse({ ok: false, error: 'erreur_serveur' });
  }
});
