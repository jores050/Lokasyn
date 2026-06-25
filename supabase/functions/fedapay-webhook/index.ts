import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-fedapay-signature',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

async function confirmerPaiement(supabase: ReturnType<typeof createClient>, paiement_id: string, rdv_id: string) {
  const { error } = await supabase
    .from('paiements')
    .update({ statut: 'confirme', webhook_recu_le: new Date().toISOString() })
    .eq('id', paiement_id)

  if (error) throw error

  await supabase.from('rendez_vous')
    .update({ statut: 'confirme', confirme_le: new Date().toISOString(), paiement_id })
    .eq('id', rdv_id)

  // Notifications + message système + push (tout non bloquant)
  try {
    const { data: rdv } = await supabase
      .from('rendez_vous')
      .select(`
        demandeur_id, bailleur_id, conversation_id,
        date_visite, heure_visite,
        logements(titre, quartier),
        demandeur:profiles!demandeur_id(nom, prenom)
      `)
      .eq('id', rdv_id)
      .single()

    if (!rdv) return

    const locataireNom = (rdv.demandeur as any)
      ? `${(rdv.demandeur as any).prenom ?? ''} ${(rdv.demandeur as any).nom ?? ''}`.trim()
      : 'Le locataire'
    const logementTitre   = (rdv.logements as any)?.titre   || 'le logement'
    const logementQuartier = (rdv.logements as any)?.quartier || ''

    // 1. Notifications in-app pour les deux participants
    await supabase.from('notifications').insert([
      {
        utilisateur_id: rdv.demandeur_id,
        type: 'visite_confirmee',
        titre: 'Visite confirmée',
        corps: `Votre visite du ${rdv.date_visite} à ${rdv.heure_visite} est confirmée`,
        lien: rdv.conversation_id ? `/chat/${rdv.conversation_id}` : '/messages',
      },
      {
        utilisateur_id: rdv.bailleur_id,
        type: 'paiement_recu',
        titre: 'Paiement reçu',
        corps: `${locataireNom} a payé les frais de visite pour ${logementTitre}`,
        lien: rdv.conversation_id ? `/chat/${rdv.conversation_id}` : '/messages',
      },
    ])

    // 2. Message système dans la conversation
    if (rdv.conversation_id) {
      const { data: paiement } = await supabase
        .from('paiements')
        .select('montant')
        .eq('id', paiement_id)
        .single()

      await supabase.from('messages').insert({
        conversation_id: rdv.conversation_id,
        expediteur_id: rdv.demandeur_id, // locataire = auteur du paiement
        contenu: '✅ Frais de visite payés avec succès — la visite est confirmée',
        type: 'systeme',
        metadata: {
          rdv_id,
          montant: (paiement as any)?.montant ?? null,
          locataire_nom: locataireNom,
        },
      })
    }

    // 3. Web Push au bailleur
    try {
      await supabase.functions.invoke('send-push-notification', {
        body: {
          destinataire_id: rdv.bailleur_id,
          titre: 'Paiement reçu 💰',
          corps: `${locataireNom} a payé les frais de visite pour ${logementQuartier || logementTitre}`,
          url: rdv.conversation_id ? `/chat/${rdv.conversation_id}` : '/messages',
          conversation_id: rdv.conversation_id,
        },
      })
    } catch (pushErr) {
      console.error('[WEBHOOK FEDAPAY] Erreur push (non bloquant):', pushErr)
    }

  } catch (e) {
    console.error('[WEBHOOK FEDAPAY] Erreur post-paiement (non bloquant):', e)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // ─── GET : redirection navigateur après paiement FedaPay ───────────────────
  // Vérifie le statut réel via l'API FedaPay avant de confirmer (ne fait pas
  // confiance au param status= de l'URL — forgeable)
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const transactionId = url.searchParams.get('id')
    const appUrl = Deno.env.get('APP_URL') || 'https://lokasyn.vercel.app'

    let confirmed = false

    if (transactionId) {
      try {
        const fedapayKey = Deno.env.get('FEDAPAY_SECRET_KEY') || ''
        const fedapayBase = fedapayKey.startsWith('sk_sandbox')
          ? 'https://sandbox-api.fedapay.com/v1'
          : 'https://api.fedapay.com/v1'

        // Vérification du statut réel auprès de FedaPay
        const res = await fetch(`${fedapayBase}/transactions/${transactionId}`, {
          headers: { 'Authorization': `Bearer ${fedapayKey}` }
        })
        const data = await res.json()
        const transaction = data?.['v1/transaction']

        if (transaction?.status === 'approved') {
          const { data: paiement } = await supabase
            .from('paiements')
            .select('id, metadata')
            .eq('kkiapay_transaction_id', transactionId)
            .single()

          if (paiement?.metadata?.rdv_id) {
            await confirmerPaiement(supabase, paiement.id, paiement.metadata.rdv_id)
            confirmed = true
          }
        }
      } catch (e) {
        console.error('[WEBHOOK FEDAPAY] Erreur vérification GET:', e)
      }
    }

    const redirectUrl = confirmed
      ? `${appUrl}/paiement/retour?status=confirme`
      : `${appUrl}/paiement/retour?status=annule`
    return new Response(null, { status: 302, headers: { Location: redirectUrl } })
  }

  // ─── POST : webhook serveur FedaPay ────────────────────────────────────────
  try {
    const payload = await req.json()

    console.log('[WEBHOOK FEDAPAY] Event reçu:', payload.name, payload.entity?.id)

    if (payload.name !== 'transaction.approved') {
      return jsonResponse({ ok: true, ignored: true })
    }

    const transaction = payload.entity
    const { paiement_id, rdv_id } = transaction.metadata || {}

    if (!paiement_id || !rdv_id) {
      console.error('[WEBHOOK FEDAPAY] Metadata manquante:', transaction.metadata)
      return jsonResponse({ ok: false, error: 'metadata_manquante' })
    }

    await confirmerPaiement(supabase, paiement_id, rdv_id)

    return jsonResponse({ ok: true })

  } catch (e) {
    console.error('[WEBHOOK FEDAPAY] Exception:', e)
    return jsonResponse({ ok: false, error: 'erreur_serveur' }, 500)
  }
})
