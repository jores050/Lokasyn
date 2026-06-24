import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fedapay-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const payload = await req.json()
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    console.log('[WEBHOOK FEDAPAY] Event reçu:', payload.name, payload.entity?.id)

    if (payload.name !== 'transaction.approved') {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const transaction = payload.entity
    const { paiement_id, rdv_id } = transaction.metadata || {}

    if (!paiement_id || !rdv_id) {
      console.error('[WEBHOOK FEDAPAY] Metadata manquante:', transaction.metadata)
      return new Response(JSON.stringify({ ok: false, error: 'metadata_manquante' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Confirmer le paiement en base — critique, retourne 500 si échec pour que FedaPay retente
    const { error: updatePaiementError } = await supabase
      .from('paiements')
      .update({ statut: 'confirme', webhook_recu_le: new Date().toISOString() })
      .eq('id', paiement_id)

    if (updatePaiementError) {
      console.error('[WEBHOOK FEDAPAY] Erreur update paiement:', updatePaiementError)
      return new Response(JSON.stringify({ ok: false }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Confirmer le RDV (non bloquant)
    try {
      await supabase.from('rendez_vous')
        .update({ statut: 'confirme', confirme_le: new Date().toISOString(), paiement_id })
        .eq('id', rdv_id)
    } catch (e) {
      console.error('[WEBHOOK FEDAPAY] Erreur update RDV (non bloquant):', e)
    }

    // Notifications (non bloquant)
    try {
      const { data: rdv } = await supabase
        .from('rendez_vous')
        .select('demandeur_id, bailleur_id, date_visite, heure_visite, logements(titre)')
        .eq('id', rdv_id)
        .single()

      if (rdv) {
        await supabase.from('notifications').insert([
          {
            utilisateur_id: rdv.demandeur_id,
            type: 'visite_confirmee',
            titre: 'Visite confirmée',
            corps: `Votre visite du ${rdv.date_visite} à ${rdv.heure_visite} est confirmée`,
            lien: '/chat'
          },
          {
            utilisateur_id: rdv.bailleur_id,
            type: 'visite_confirmee',
            titre: 'Nouvelle visite confirmée',
            corps: `Une visite a été confirmée pour ${(rdv.logements as any)?.titre}`,
            lien: '/chat'
          }
        ])
      }
    } catch (e) {
      console.error('[WEBHOOK FEDAPAY] Erreur notifications (non bloquant):', e)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (e) {
    console.error('[WEBHOOK FEDAPAY] Exception:', e)
    return new Response(JSON.stringify({ ok: false, error: 'erreur_serveur' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
