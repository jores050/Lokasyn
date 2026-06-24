import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function jsonResponse(body: object, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  })
}

function calculerCommission(fraisDemarcheur: number): number {
  return fraisDemarcheur <= 1000 ? 100 : Math.round(fraisDemarcheur * 0.10)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { rdv_id, locataire_id } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: rdv, error: rdvError } = await supabase
      .from('rendez_vous')
      .select(`
        *,
        logements(id, titre, ref_interne, prix_visite, bailleur_id),
        demandeur:profiles!demandeur_id(nom, prenom, telephone),
        bailleur:profiles!bailleur_id(nom, prenom)
      `)
      .eq('id', rdv_id)
      .single()

    if (rdvError || !rdv) return jsonResponse({ ok: false, error: 'rdv_introuvable' })
    if (rdv.statut !== 'en_attente') return jsonResponse({ ok: false, error: 'statut_invalide' })

    const fraisDemarcheur = rdv.prix_visite || rdv.logements?.prix_visite || 0

    if (fraisDemarcheur <= 0) {
      await supabase.from('rendez_vous')
        .update({ statut: 'confirme', confirme_le: new Date().toISOString() })
        .eq('id', rdv_id)
      return jsonResponse({ ok: true, gratuit: true })
    }

    const commission = calculerCommission(fraisDemarcheur)
    const montantTotal = fraisDemarcheur + commission

    const { data: paiement, error: paiementError } = await supabase
      .from('paiements')
      .insert({
        logement_id: rdv.logements?.id || rdv.logement_id,
        payeur_id: locataire_id,
        beneficiaire_id: rdv.bailleur_id,
        type: 'frais_visite',
        montant: montantTotal,
        montant_bailleur: fraisDemarcheur,
        montant_commission_plateforme: commission,
        statut: 'en_cours',
        metadata: { rdv_id },
        escrow_libere: false,
      })
      .select()
      .single()

    if (paiementError || !paiement) {
      console.error('[FEDAPAY] Erreur création paiement:', paiementError)
      return jsonResponse({ ok: false, error: 'erreur_creation_paiement' })
    }

    const fedapayResponse = await fetch('https://api.fedapay.com/v1/transactions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('FEDAPAY_SECRET_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: `LocaSyn — Frais de visite ${rdv.logements?.ref_interne || ''}`,
        amount: montantTotal,
        currency: { iso: 'XOF' },
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/fedapay-webhook`,
        metadata: { paiement_id: paiement.id, rdv_id, type: 'frais_visite' },
        customer: {
          firstname: rdv.demandeur?.prenom || '',
          lastname: rdv.demandeur?.nom || '',
          phone_number: { number: rdv.demandeur?.telephone || '', country: 'BJ' }
        }
      })
    })

    const fedapayData = await fedapayResponse.json()

    if (!fedapayResponse.ok || !fedapayData?.v1?.transaction) {
      console.error('[FEDAPAY] Erreur création transaction:', fedapayData)
      await supabase.from('paiements').update({ statut: 'echec' }).eq('id', paiement.id)
      return jsonResponse({ ok: false, error: 'erreur_fedapay' })
    }

    const transaction = fedapayData.v1.transaction

    await supabase.from('paiements')
      .update({ kkiapay_transaction_id: String(transaction.id) })
      .eq('id', paiement.id)

    const tokenResponse = await fetch(
      `https://api.fedapay.com/v1/transactions/${transaction.id}/token`,
      { headers: { 'Authorization': `Bearer ${Deno.env.get('FEDAPAY_SECRET_KEY')}` } }
    )
    const tokenData = await tokenResponse.json()
    const token = tokenData?.v1?.token?.token

    return jsonResponse({
      ok: true,
      gratuit: false,
      transaction_id: transaction.id,
      token,
      montant_total: montantTotal,
      frais_demarcheur: fraisDemarcheur,
      commission,
      paiement_id: paiement.id
    })

  } catch (e) {
    console.error('[FEDAPAY] Exception:', e)
    return jsonResponse({ ok: false, error: 'erreur_serveur' })
  }
})
