'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatFCFA } from '@/lib/utils'

interface Props {
  bailleurId: string
  onClose: () => void
  onSend: (logement: LogementReco) => void
}

interface LogementReco {
  id: string
  titre: string
  ref_interne: string | null
  quartier: string
  ville: string
  loyer_mensuel: number
  photos: string[]
}

export function RecoLogementModal({ bailleurId, onClose, onSend }: Props) {
  const [logements, setLogements] = useState<LogementReco[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('logements')
      .select('id, titre, ref_interne, quartier, ville, loyer_mensuel, photos')
      .eq('bailleur_id', bailleurId)
      .eq('statut', 'libre')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setLogements((data || []) as LogementReco[])
        setLoading(false)
      })
  }, [bailleurId]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />
        <div className="modal-header">
          <div className="modal-title">Recommander un logement</div>
          <button className="modal-close" onClick={onClose} type="button" aria-label="Fermer">
            <X size={20} />
          </button>
        </div>

        {loading && (
          <div className="modal-loading">Chargement…</div>
        )}

        {!loading && logements.length === 0 && (
          <div className="modal-empty">Aucun logement disponible à recommander.</div>
        )}

        <div className="reco-logement-list">
          {logements.map(l => (
            <button
              key={l.id}
              className="reco-logement-item"
              type="button"
              onClick={() => { onSend(l); onClose() }}
            >
              <div className="reco-logement-photo">
                {l.photos?.[0]
                  ? <img src={l.photos[0]} alt={l.titre} />
                  : <div className="reco-logement-photo-placeholder">🏠</div>
                }
              </div>
              <div className="reco-logement-info">
                <div className="reco-logement-titre">{l.titre}</div>
                <div className="reco-logement-location">📍 {l.quartier}, {l.ville}</div>
                <div className="reco-logement-prix">{formatFCFA(l.loyer_mensuel)}/mois</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
