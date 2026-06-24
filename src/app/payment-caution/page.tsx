'use client'

import { useState, useEffect, use } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { Lock, Sparkles, CheckCircle, XCircle, Smartphone } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

declare global {
  interface Window {
    openKkiapayWidget?: (opts: Record<string, unknown>) => void
    addSuccessListener?: (fn: (data: Record<string, unknown>) => void) => void
  }
}

type Screen = 'form' | 'success' | 'error'

export default function PaymentCautionPage() {
  const { user } = useAppStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const bailId      = searchParams.get('bail_id')
  const logementId  = searchParams.get('logement_id')
  const montantParam = parseInt(searchParams.get('montant') || '0')
  const type        = searchParams.get('type') || 'caution'
  const boostType   = searchParams.get('boost_type') || 'semaine'
  const isBoost     = type === 'boost'

  const [logement, setLogement]       = useState<{ titre: string; quartier: string; ville: string } | null>(null)
  const [montantFinal, setMontantFinal] = useState(montantParam)
  const [telephone, setTelephone]      = useState('')
  const [moyen, setMoyen]              = useState<'mtn_momo' | 'moov_money'>('mtn_momo')
  const [screen, setScreen]            = useState<Screen>('form')
  const [errorMsg, setErrorMsg]        = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [submitting, setSubmitting]    = useState(false)
  const [paiementId, setPaiementId]    = useState<string | null>(null)
  const [sdkReady, setSdkReady]        = useState(false)

  const supabase = createClient()

  useEffect(() => {
    if (!user?.id) { router.push(`/auth?redirect=/payment-caution${window.location.search}`); return }
    loadLogement()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadLogement() {
    if (bailId) {
      const { data } = await supabase.from('baux')
        .select('caution_montant, logements(titre, quartier, ville)')
        .eq('id', bailId).single()
      if (data) {
        const log = (data as Record<string, unknown>).logements as typeof logement
        setLogement(log)
        if (!montantParam) setMontantFinal((data as Record<string, unknown>).caution_montant as number || 0)
      }
    } else if (logementId) {
      const { data } = await supabase.from('logements')
        .select('titre, quartier, ville, loyer_mensuel, caution_mois')
        .eq('id', logementId).single()
      if (data) {
        setLogement({ titre: data.titre, quartier: data.quartier, ville: data.ville })
        if (!montantParam) setMontantFinal(data.loyer_mensuel * (data.caution_mois || 2))
      }
    }
  }

  async function handlePay() {
    if (!telephone.trim()) { showToast('Numéro Mobile Money requis', 'error'); return }
    if (!sdkReady || !window.openKkiapayWidget) { showToast('SDK KKiaPay non chargé', 'error'); return }
    setSubmitting(true)

    try {
      const { data: paiement, error: pErr } = await supabase.from('paiements').insert({
        bail_id: bailId || null,
        logement_id: logementId || null,
        payeur_id: user!.id,
        type: isBoost ? 'boost' : 'caution',
        montant: montantFinal,
        statut: 'en_cours',
        telephone_paiement: telephone,
        moyen_paiement: moyen,
        ...(isBoost ? { boost_type: boostType } : {}),
      }).select().single()

      if (pErr) throw new Error(pErr.message)
      setPaiementId(paiement.id)

      window.openKkiapayWidget({
        amount: montantFinal,
        api_key: process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY || 'sandbox',
        callback: window.location.href,
        data: JSON.stringify({ paiement_id: paiement.id, type: isBoost ? 'boost' : 'caution' }),
        phone: telephone.replace(/[\s\-+]/g, ''),
        name: 'LocaSyn',
        theme: '#1B6B4A',
        sandbox: true,
      })

      if (window.addSuccessListener) {
        window.addSuccessListener(async (detail) => {
          await supabase.from('paiements').update({
            statut: 'confirme',
            kkiapay_transaction_id: detail.transactionId as string,
          }).eq('id', paiement.id)

          if (isBoost && logementId) {
            const expire = new Date()
            expire.setDate(expire.getDate() + (boostType === 'mois' ? 30 : 7))
            await supabase.from('logements').update({
              boost_actif: true, boost_type: boostType,
              boost_expire_le: expire.toISOString(),
            }).eq('id', logementId)
          }

          setTransactionId(detail.transactionId as string)
          setScreen('success')
          setSubmitting(false)
        })
      }
    } catch (err) {
      setSubmitting(false)
      if (paiementId) await supabase.from('paiements').update({ statut: 'echec' }).eq('id', paiementId)
      setErrorMsg((err as Error).message)
      setScreen('error')
    }
  }

  if (screen === 'success') return (
    <div className="payment-screen">
      <div className="success-screen" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <CheckCircle size={64} strokeWidth={1.25} color="var(--green)" style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>{isBoost ? 'Boost activé !' : 'Caution sécurisée !'}</h2>
        <p style={{ color: 'var(--ink-mid)', marginBottom: transactionId ? 16 : 0 }}>
          {isBoost
            ? 'Votre annonce est maintenant mise en avant.'
            : `${formatFCFA(montantFinal)} bloqués sur compte escrow. Vous récupérez votre caution à la fin du bail.`}
        </p>
        {transactionId && <div style={{ background: 'var(--sand-dark)', padding: '10px 16px', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--ink-mid)', marginBottom: 24 }}>Réf. : {transactionId}</div>}
        <button className="btn btn-primary btn-full" onClick={() => router.push('/')}>Retour à l&apos;accueil</button>
      </div>
    </div>
  )

  if (screen === 'error') return (
    <div className="payment-screen">
      <div className="success-screen" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <XCircle size={64} strokeWidth={1.25} color="var(--red)" style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>Paiement échoué</h2>
        <p style={{ color: 'var(--ink-mid)', marginBottom: 24 }}>{errorMsg || 'Le paiement n\'a pas pu être traité.'}</p>
        <button className="btn btn-primary btn-full" onClick={() => setScreen('form')}>Réessayer</button>
      </div>
    </div>
  )

  return (
    <>
      <Script
        src="https://cdn.kkiapay.me/k.js"
        onLoad={() => setSdkReady(true)}
        strategy="afterInteractive"
      />

      <div className="payment-screen">
        {/* En-tête montant */}
        <div className="payment-header" style={{ textAlign: 'center', padding: '32px 24px 24px', background: 'linear-gradient(160deg, var(--green-dark) 0%, var(--green) 100%)', color: 'white' }}>
          <div style={{ marginBottom: 12 }}>
            {isBoost ? <Sparkles size={48} strokeWidth={1.25} /> : <Lock size={48} strokeWidth={1.25} />}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatFCFA(montantFinal)}</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>{isBoost ? 'Boost de votre annonce' : 'Caution sécurisée (Escrow)'}</div>
        </div>

        <div style={{ padding: '20px 16px' }}>
          {/* Info escrow/boost */}
          <div style={{ background: 'var(--sand-dark)', borderRadius: 12, padding: 14, marginBottom: 20, fontSize: '0.875rem', color: 'var(--ink-mid)', lineHeight: 1.5 }}>
            {isBoost
              ? 'Votre annonce sera mise en avant pendant 7 jours après confirmation du paiement.'
              : `Votre caution de ${formatFCFA(montantFinal)} sera bloquée sur un compte sécurisé et vous sera restituée à la fin du bail si tout s'est bien passé.`}
          </div>

          {/* Logement info */}
          {logement && (
            <div style={{ background: 'var(--white)', borderRadius: 12, padding: 14, marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontWeight: 600 }}>{logement.titre}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--ink-mid)', marginTop: 4 }}>{logement.quartier}, {logement.ville}</div>
            </div>
          )}

          {/* Moyen de paiement */}
          <div className="form-group" style={{ marginBottom: 14 }}>
            <label className="form-label">Moyen de paiement</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {([['mtn_momo', 'MTN MoMo'], ['moov_money', 'Moov Money']] as const).map(([val, label]) => (
                <label key={val} style={{ flex: 1, padding: '10px 12px', border: `1.5px solid ${moyen === val ? 'var(--green)' : 'var(--border)'}`, borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontSize: '0.875rem', fontWeight: 500, color: moyen === val ? 'var(--green)' : 'var(--ink)' }}>
                  <input type="radio" value={val} checked={moyen === val} onChange={() => setMoyen(val)} style={{ display: 'none' }} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Numéro */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Numéro Mobile Money</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><Smartphone size={16} color="var(--ink-light)" /></span>
              <input className="form-input" type="tel" placeholder="+229 97 00 00 00" value={telephone} onChange={e => setTelephone(e.target.value)} style={{ paddingLeft: 40 }} />
            </div>
          </div>

          <button className="btn btn-primary btn-full" disabled={submitting || !montantFinal} onClick={handlePay}>
            {submitting ? 'Ouverture du paiement…' : `Payer ${formatFCFA(montantFinal)} via MoMo`}
          </button>
        </div>
      </div>
    </>
  )
}
