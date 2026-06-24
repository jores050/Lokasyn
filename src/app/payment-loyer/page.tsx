'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Script from 'next/script'
import { Home, CheckCircle, XCircle, Smartphone, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { formatFCFA, moisLabel } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

type Screen = 'form' | 'success' | 'error' | 'invalid'

const STATUT_CLASS: Record<string, string> = {
  confirme: 'paye', en_cours: 'en-cours', echec: 'retard', en_attente: 'futur',
}

function PaymentLoyerContent() {
  const { user } = useAppStore()
  const router = useRouter()
  const searchParams = useSearchParams()

  const tokenParam = searchParams.get('token')
  const bailIdParam = searchParams.get('bail_id')
  const moisParam   = searchParams.get('mois') || ''
  const montantParam = parseInt(searchParams.get('montant') || '0')

  const [bail, setBail]        = useState<{ id: string; loyer_mensuel: number; logement_id: string; bailleur_id: string; logements: { titre: string; quartier: string } | null; locataire: { nom: string; prenom: string } | null } | null>(null)
  const [historique, setHistorique] = useState<{ mois_concerne: string; statut: string }[]>([])
  const [bailId, setBailId]    = useState(bailIdParam || '')
  const [mois, setMois]        = useState(moisParam)
  const [montant, setMontant]  = useState(montantParam)
  const [telephone, setTelephone] = useState('')
  const [moyen, setMoyen]      = useState<'mtn_momo' | 'moov_money'>('mtn_momo')
  const [screen, setScreen]    = useState<Screen>('form')
  const [errorMsg, setErrorMsg] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sdkReady, setSdkReady] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    if (!user?.id) { router.push(`/auth?redirect=/payment-loyer${window.location.search}`); return }
    decodeAndLoad()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function decodeAndLoad() {
    let bid = bailId, m = mois, mt = montant

    if (tokenParam) {
      try {
        const decoded = JSON.parse(atob(tokenParam))
        if (decoded.exp < Date.now()) { setScreen('invalid'); return }
        bid = decoded.bail_id; m = decoded.mois; mt = decoded.montant
        setBailId(bid); setMois(m); setMontant(mt)
      } catch { setScreen('invalid'); return }
    }

    if (!bid) return
    const [{ data: bailData }, { data: hist }] = await Promise.all([
      supabase.from('baux')
        .select('id, loyer_mensuel, logement_id, bailleur_id, logements(titre, quartier), locataire:profiles!locataire_id(nom, prenom)')
        .eq('id', bid).single(),
      supabase.from('paiements')
        .select('mois_concerne, statut').eq('bail_id', bid).eq('type', 'loyer_mensuel')
        .order('created_at', { ascending: false }).limit(6),
    ])
    setBail(bailData as typeof bail)
    setHistorique((hist || []) as typeof historique)
    if (!mt && bailData) setMontant(bailData.loyer_mensuel)
  }

  async function handlePay() {
    if (!telephone.trim()) { showToast('Numéro Mobile Money requis', 'error'); return }
    if (!sdkReady || !window.openKkiapayWidget) { showToast('SDK KKiaPay non chargé', 'error'); return }
    setSubmitting(true)

    try {
      const { data: paiement, error: pErr } = await supabase.from('paiements').insert({
        bail_id: bailId,
        logement_id: bail?.logement_id || null,
        payeur_id: user!.id,
        beneficiaire_id: bail?.bailleur_id || user!.id,
        type: 'loyer_mensuel',
        montant,
        mois_concerne: mois || null,
        statut: 'en_cours',
        telephone_paiement: telephone,
        moyen_paiement: moyen,
      }).select().single()

      if (pErr) throw new Error(pErr.message)

      window.openKkiapayWidget({
        amount: montant,
        api_key: process.env.NEXT_PUBLIC_KKIAPAY_PUBLIC_KEY || 'sandbox',
        callback: window.location.href,
        data: JSON.stringify({ paiement_id: paiement.id, type: 'loyer_mensuel', mois }),
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
          setTransactionId(detail.transactionId as string)
          setScreen('success')
          setSubmitting(false)
        })
      }
    } catch (err) {
      setSubmitting(false)
      setErrorMsg((err as Error).message)
      setScreen('error')
    }
  }

  const moisAffiche = moisLabel(mois) || mois || 'Mois en cours'

  if (screen === 'invalid') return (
    <div className="payment-screen">
      <div className="success-screen" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <AlertTriangle size={64} strokeWidth={1.25} color="var(--amber)" style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>Lien invalide</h2>
        <p style={{ color: 'var(--ink-mid)', marginBottom: 24 }}>Ce lien de paiement a expiré ou est invalide.</p>
        <button className="btn btn-primary btn-full" onClick={() => router.push('/')}>Retour à l&apos;accueil</button>
      </div>
    </div>
  )

  if (screen === 'success') return (
    <div className="payment-screen">
      <div className="success-screen" style={{ textAlign: 'center', padding: '48px 24px' }}>
        <CheckCircle size={64} strokeWidth={1.25} color="var(--green)" style={{ marginBottom: 16 }} />
        <h2 style={{ marginBottom: 8 }}>Paiement confirmé !</h2>
        <p style={{ color: 'var(--ink-mid)', marginBottom: transactionId ? 16 : 24 }}>
          Votre loyer de {formatFCFA(montant)} pour {moisAffiche} a été reçu.
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
      <Script src="https://cdn.kkiapay.me/k.js" onLoad={() => setSdkReady(true)} strategy="afterInteractive" />

      <div className="payment-screen">
        {/* En-tête */}
        <div className="payment-header" style={{ textAlign: 'center', padding: '32px 24px 24px', background: 'linear-gradient(160deg, var(--green-dark) 0%, var(--green) 100%)', color: 'white' }}>
          <Home size={48} strokeWidth={1.25} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: '2rem', fontWeight: 800 }}>{formatFCFA(montant)}</div>
          <div style={{ opacity: 0.85, marginTop: 4 }}>Loyer {moisAffiche}</div>
        </div>

        <div style={{ padding: '20px 16px' }}>
          {/* Info bail */}
          {bail && (
            <div style={{ background: 'var(--white)', borderRadius: 12, padding: 14, marginBottom: 20, boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ fontWeight: 600 }}>{bail.logements?.titre || 'Logement'}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--ink-mid)', marginTop: 2 }}>{bail.logements?.quartier}</div>
              {bail.locataire && <div style={{ fontSize: '0.875rem', color: 'var(--ink-mid)', marginTop: 2 }}>Locataire : {bail.locataire.prenom} {bail.locataire.nom}</div>}
            </div>
          )}

          {/* Historique */}
          {historique.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--ink-mid)', marginBottom: 8 }}>Historique récent</div>
              <div className="mois-grid">
                {historique.map((h, i) => (
                  <div key={i} className={`mois-pill ${STATUT_CLASS[h.statut] || 'futur'}`}>{h.mois_concerne?.slice(5) || '—'}</div>
                ))}
              </div>
            </div>
          )}

          {/* Moyen */}
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

          {/* Téléphone */}
          <div className="form-group" style={{ marginBottom: 24 }}>
            <label className="form-label">Numéro Mobile Money</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><Smartphone size={16} color="var(--ink-light)" /></span>
              <input className="form-input" type="tel" placeholder="+229 97 00 00 00" value={telephone} onChange={e => setTelephone(e.target.value)} style={{ paddingLeft: 40 }} />
            </div>
          </div>

          <button className="btn btn-primary btn-full" disabled={submitting || !montant} onClick={handlePay}>
            {submitting ? 'Ouverture du paiement…' : `Payer ${formatFCFA(montant)}`}
          </button>
        </div>
      </div>
    </>
  )
}

export default function PaymentLoyerPage() {
  return <Suspense><PaymentLoyerContent /></Suspense>
}
