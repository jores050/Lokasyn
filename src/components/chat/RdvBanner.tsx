'use client'

import { Calendar, BadgeCheck, AlertCircle, CheckCircle, Clock, ShieldCheck } from 'lucide-react'
import { formatFCFA } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { showToast } from '@/components/ui/Toast'
import type { RendezVous } from '@/types/database'

function formatDateFr(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  const mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  return `${parseInt(d, 10)} ${mois[parseInt(m, 10) - 1]} ${y}`
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

  if (rdv.statut === 'en_attente') {
    return (
      <div className="rdv-banniere-card rdv-banniere-card--neutral" data-rdv-id={rdv.id}>
        <div className="rdv-card-header"><Calendar size={14} /> Visite proposée</div>
        <div className="rdv-card-detail">{formatDateFr(rdv.date_visite)} à {rdv.heure_visite || '—'}</div>
        {rdv.prix_visite ? <div className="programmation-prix">{formatFCFA(rdv.prix_visite)}</div> : null}
        {estBailleur
          ? <div className="rdv-card-detail" style={{ marginTop: 4 }}>En attente de confirmation du locataire</div>
          : (
            <>
              <button
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 10 }}
                onClick={() => onConfirmer(rdv.id)}
              >
                {rdv.prix_visite ? `Confirmer (${formatFCFA(rdv.prix_visite)})` : 'Confirmer la visite'}
              </button>
              <div className="programmation-rassurance">
                <ShieldCheck size={14} /> Vous pouvez annuler à tout moment avant la visite
              </div>
            </>
          )
        }
      </div>
    )
  }

  if (rdv.statut === 'confirme') {
    return (
      <div className="rdv-banniere-card rdv-banniere-card--confirme" data-rdv-id={rdv.id}>
        <div className="rdv-card-header"><BadgeCheck size={14} /> Visite confirmée</div>
        <div className="rdv-card-detail">{formatDateFr(rdv.date_visite)} à {rdv.heure_visite || '—'}</div>
        {estLocataire
          ? (
            <div className="rdv-card-actions" style={{ marginTop: 10 }}>
              <button className="rdv-decline" onClick={() => onDemanderAnnulation(rdv.id)}>
                Annuler
              </button>
              <button className="rdv-accept" onClick={() => onDeclarerEffectuee(rdv.id)}>
                <CheckCircle size={14} /> Visite effectuée
              </button>
            </div>
          )
          : <div className="rdv-card-detail" style={{ marginTop: 4 }}>En attente de la date</div>
        }
      </div>
    )
  }

  if (rdv.statut === 'annule_demande') {
    if (estBailleur) {
      return (
        <div className="rdv-banniere-card rdv-banniere-card--alerte" data-rdv-id={rdv.id}>
          <div className="rdv-card-header"><AlertCircle size={14} /> Demande d&apos;annulation</div>
          <div className="rdv-card-detail">Le locataire souhaite annuler — {formatDateFr(rdv.date_visite)}</div>
          <div className="rdv-card-actions" style={{ marginTop: 10 }}>
            <button className="rdv-accept" onClick={() => onConfirmerAnnulation(rdv.id)}>
              Confirmer l&apos;annulation
            </button>
            <button className="rdv-decline" onClick={() => onRefuserAnnulation(rdv.id)}>
              Refuser
            </button>
          </div>
        </div>
      )
    }
    return (
      <div className="rdv-banniere-card rdv-banniere-card--alerte" data-rdv-id={rdv.id}>
        <div className="rdv-card-header"><Clock size={14} /> Annulation en attente</div>
        <div className="rdv-card-detail">Le bailleur doit confirmer votre demande d&apos;annulation</div>
      </div>
    )
  }

  if (rdv.statut === 'effectue') {
    const estPayant = rdv.prix_visite && rdv.prix_visite > 0
    return (
      <div className="rdv-banniere-card rdv-banniere-card--confirme" data-rdv-id={rdv.id}>
        <div className="rdv-card-header"><CheckCircle size={14} /> Visite effectuée</div>
        <div className="rdv-card-detail">{formatDateFr(rdv.date_visite)}</div>
        {estBailleur
          ? (
            <>
              <div className="rdv-card-detail" style={{ marginTop: 4 }}>
                {estPayant ? 'Paiement libéré automatiquement sous 24h sauf contestation' : 'Confirmation enregistrée'}
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
          : (
            <div className="rdv-card-detail" style={{ marginTop: 4 }}>
              {estPayant ? 'Paiement en cours de libération' : 'Visite confirmée'}
            </div>
          )
        }
      </div>
    )
  }

  return null
}
