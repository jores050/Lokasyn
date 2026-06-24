'use client'

import { useState, useEffect } from 'react'
import {
  Calendar, BadgeCheck, AlertCircle, CheckCircle,
  Clock, ShieldCheck, ChevronDown,
} from 'lucide-react'
import { formatFCFA } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/components/ui/Toast'
import type { RendezVous } from '@/types/database'

function formatDateCourt(dateStr: string): string {
  if (!dateStr) return '—'
  const [, m, d] = dateStr.split('-')
  const mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  return `${parseInt(d, 10)} ${mois[parseInt(m, 10) - 1]}`
}

function labelStatut(statut: string): string {
  const labels: Record<string, string> = {
    en_attente:     'Visite proposée',
    confirme:       'Visite confirmée',
    annule_demande: 'Annulation demandée',
    effectue:       'Visite effectuée',
  }
  return labels[statut] || 'Visite'
}

function IconStatut({ statut }: { statut: string }) {
  if (statut === 'confirme')       return <BadgeCheck size={14} />
  if (statut === 'annule_demande') return <AlertCircle size={14} />
  if (statut === 'effectue')       return <CheckCircle size={14} />
  return <Calendar size={14} />
}

interface RdvBannerProps {
  rdv: RendezVous
  userId: string
  onConfirmer: (id: string) => void
  onDemanderAnnulation: (id: string) => void
  onConfirmerAnnulation: (id: string) => void
  onRefuserAnnulation: (id: string) => void
  onDeclarerEffectuee: (id: string) => void
}

export function RdvBanner({
  rdv, userId,
  onConfirmer, onDemanderAnnulation,
  onConfirmerAnnulation, onRefuserAnnulation,
  onDeclarerEffectuee,
}: RdvBannerProps) {
  const estLocataire = rdv.demandeur_id === userId
  const estBailleur  = rdv.bailleur_id  === userId

  const [ouvert, setOuvert] = useState(
    rdv.statut === 'en_attente' || rdv.statut === 'annule_demande'
  )
  const [loading, setLoading]     = useState(false)
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)

  const frais      = rdv.prix_visite ?? (rdv as any).logements?.prix_visite ?? 0
  const commission = frais > 0 ? (frais <= 1000 ? 100 : Math.round(frais * 0.10)) : 0
  const total      = frais + commission

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== 'fedapay_retour') return
      setIframeUrl(null)
      if (e.data.status === 'confirme') {
        showToast(`Paiement de ${formatFCFA(total)} confirmé — visite en attente de confirmation`)
      } else {
        showToast('Paiement annulé', 'error')
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [total])

  async function handlePayer() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.functions.invoke('creer-transaction-visite', {
        body: { rdv_id: rdv.id, locataire_id: userId },
      })
      if (error || !data?.ok) {
        showToast(data?.error || "Erreur lors de l'initialisation du paiement", 'error')
        return
      }
      if (data.gratuit) return
      const paymentUrl = data.payment_url || `https://sandbox-checkout.fedapay.com/${data.token}`
      setIframeUrl(paymentUrl)
    } finally {
      setLoading(false)
    }
  }

  // Overlay paiement FedaPay — reste plein écran, hors collapsible
  if (iframeUrl) {
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{
          background: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '10px 16px',
          borderBottom: '1px solid #e5e7eb',
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Paiement sécurisé</span>
          <button
            onClick={() => setIframeUrl(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: '#6b7280' }}
            aria-label="Fermer"
          >✕</button>
        </div>
        <iframe
          src={iframeUrl}
          style={{ flex: 1, border: 'none', width: '100%' }}
          title="Paiement FedaPay"
        />
      </div>
    )
  }

  function renderCorps() {
    if (rdv.statut === 'en_attente') {
      if (estBailleur) {
        return (
          <div className="rdv-card-detail">
            En attente de confirmation du locataire
          </div>
        )
      }
      return (
        <>
          {frais > 0 && (
            <div className="rdv-card-detail" style={{ fontSize: '0.8rem' }}>
              {formatFCFA(frais)} frais + {formatFCFA(commission)} service = <strong>{formatFCFA(total)}</strong>
            </div>
          )}
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 10 }}
            onClick={frais > 0 ? handlePayer : () => onConfirmer(rdv.id)}
            disabled={loading}
          >
            {loading ? 'Chargement…' : frais > 0 ? `Payer ${formatFCFA(total)} et confirmer` : 'Confirmer la visite'}
          </button>
          <div className="programmation-rassurance">
            <ShieldCheck size={14} /> Vous pouvez annuler à tout moment avant la visite
          </div>
        </>
      )
    }

    if (rdv.statut === 'confirme') {
      if (estLocataire) {
        return (
          <div className="rdv-card-actions" style={{ marginTop: 4 }}>
            <button className="rdv-decline" onClick={() => onDemanderAnnulation(rdv.id)}>
              Annuler
            </button>
            <button className="rdv-accept" onClick={() => onDeclarerEffectuee(rdv.id)}>
              <CheckCircle size={14} /> Visite effectuée
            </button>
          </div>
        )
      }
      return (
        <div className="rdv-card-detail">En attente de la date</div>
      )
    }

    if (rdv.statut === 'annule_demande') {
      if (estBailleur) {
        return (
          <>
            <div className="rdv-card-detail">Le locataire souhaite annuler</div>
            <div className="rdv-card-actions" style={{ marginTop: 10 }}>
              <button className="rdv-accept" onClick={() => onConfirmerAnnulation(rdv.id)}>
                Confirmer l&apos;annulation
              </button>
              <button className="rdv-decline" onClick={() => onRefuserAnnulation(rdv.id)}>
                Refuser
              </button>
            </div>
          </>
        )
      }
      return (
        <div className="rdv-card-detail">
          Le bailleur doit confirmer votre demande d&apos;annulation
        </div>
      )
    }

    if (rdv.statut === 'effectue') {
      const estPayant = rdv.prix_visite && rdv.prix_visite > 0
      if (estBailleur) {
        return (
          <>
            <div className="rdv-card-detail">
              {estPayant
                ? 'Paiement libéré automatiquement sous 24h sauf contestation'
                : 'Confirmation enregistrée'}
            </div>
            <button
              className="btn-link"
              style={{ marginTop: 8, fontSize: '0.8125rem' }}
              onClick={async () => {
                const motif = prompt('Décrivez pourquoi cette visite n\'a pas eu lieu :')
                if (!motif) return
                const supabase = createClient()
                await supabase.from('rendez_vous').update({ contestation_motif: motif }).eq('id', rdv.id)
                const { data: rdvData } = await supabase.from('rendez_vous').select('paiement_id').eq('id', rdv.id).single()
                if (rdvData?.paiement_id) {
                  await supabase.from('paiements').update({ statut: 'en_contestation' }).eq('id', rdvData.paiement_id)
                }
                showToast('Contestation enregistrée — un administrateur va examiner le dossier')
              }}
            >
              Cette visite n&apos;a pas eu lieu — contester
            </button>
          </>
        )
      }
      return (
        <div className="rdv-card-detail">
          {estPayant ? 'Paiement en cours de libération' : 'Visite confirmée'}
        </div>
      )
    }

    return null
  }

  // Aucun contenu pour les statuts non gérés
  if (!['en_attente', 'confirme', 'annule_demande', 'effectue'].includes(rdv.statut)) {
    return null
  }

  return (
    <div className="rdv-banniere" data-rdv-id={rdv.id}>
      <button
        className="rdv-banniere-header"
        onClick={() => setOuvert(o => !o)}
        type="button"
        aria-expanded={ouvert}
      >
        <div className="rdv-banniere-resume">
          <IconStatut statut={rdv.statut} />
          <span>{labelStatut(rdv.statut)}</span>
          <span className="rdv-banniere-dot">·</span>
          <span>{formatDateCourt(rdv.date_visite)} à {rdv.heure_visite?.slice(0, 5) || '—'}</span>
          {total > 0 && (
            <>
              <span className="rdv-banniere-dot">·</span>
              <span className="rdv-banniere-prix">{formatFCFA(total)}</span>
            </>
          )}
        </div>
        <ChevronDown
          size={16}
          className={`rdv-banniere-chevron${ouvert ? ' ouvert' : ''}`}
        />
      </button>

      {ouvert && (
        <div className="rdv-banniere-body">
          {renderCorps()}
        </div>
      )}
    </div>
  )
}
