'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFCFA } from '@/lib/utils'

const STATUTS_ACTIFS = ['en_attente', 'confirme', 'annule_demande']

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  en_attente:      { label: 'En attente de confirmation', color: 'neutral' },
  confirme:        { label: 'Confirmée',                  color: 'success' },
  annule_demande:  { label: 'Annulation demandée',        color: 'warning' },
}

interface Props {
  conversationId: string
  currentUserId: string
}

export function RdvList({ conversationId, currentUserId }: Props) {
  const [rdvs, setRdvs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    chargerRdvs()
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  async function chargerRdvs() {
    const { data, error } = await supabase
      .from('rendez_vous')
      .select('*, logements(titre, ref_interne, quartier, photos)')
      .eq('conversation_id', conversationId)
      .in('statut', STATUTS_ACTIFS)
      .order('date_visite', { ascending: true })

    if (!error && data) setRdvs(data)
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="rdv-list-empty">
        <div className="skeleton" style={{ width: '100%', height: 80, borderRadius: 8 }} />
        <div className="skeleton" style={{ width: '100%', height: 80, borderRadius: 8 }} />
      </div>
    )
  }

  if (rdvs.length === 0) {
    return (
      <div className="rdv-list-empty">
        <div className="rdv-list-empty-icon">📅</div>
        <div className="rdv-list-empty-text">Aucune visite en cours</div>
        <div className="rdv-list-empty-sub">Les visites programmées apparaîtront ici</div>
      </div>
    )
  }

  return (
    <div className="rdv-list">
      {rdvs.map(rdv => {
        const statutInfo = STATUT_LABELS[rdv.statut] || { label: rdv.statut, color: 'neutral' }
        const estPasse = new Date(rdv.date_visite) < new Date()
        const photo = rdv.logements?.photos?.[0]
        const dateLabel = new Date(rdv.date_visite).toLocaleDateString('fr-FR', {
          weekday: 'long', day: 'numeric', month: 'long',
        })

        return (
          <div key={rdv.id} className="rdv-list-item">
            <div className="rdv-list-photo">
              {photo
                ? <img src={photo} alt={rdv.logements?.titre} />
                : <div className="rdv-list-photo-placeholder">🏠</div>
              }
            </div>

            <div className="rdv-list-body">
              <div className="rdv-list-logement">
                {rdv.logements?.titre}
                {rdv.logements?.ref_interne && (
                  <span className="rdv-list-ref"> · {rdv.logements.ref_interne}</span>
                )}
              </div>

              <div className="rdv-list-date">
                📅 {dateLabel} à {rdv.heure_visite?.slice(0, 5) || '—'}
                {estPasse && <span className="rdv-list-passe"> · Passée</span>}
              </div>

              {rdv.prix_visite > 0 && (
                <div className="rdv-list-prix">{formatFCFA(rdv.prix_visite)} frais de visite</div>
              )}

              <div className={`rdv-list-statut rdv-list-statut--${statutInfo.color}`}>
                {statutInfo.label}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
