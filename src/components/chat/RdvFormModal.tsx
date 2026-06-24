'use client'

import { useState, useEffect } from 'react'
import { getLogementsDeLaConversation, peutCreerNouveauRdv, type LogementRdv } from '@/hooks/useRdv'
import { formatFCFA } from '@/lib/utils'

interface Props {
  conversationId: string
  bailleurId: string
  onClose: () => void
  onSend: (logementId: string, date: string, heure: string) => Promise<void>
}

export function RdvFormModal({ conversationId, bailleurId, onClose, onSend }: Props) {
  const [visible, setVisible] = useState(false)
  const [etape, setEtape] = useState<'logement' | 'datetime'>('logement')
  const [logements, setLogements] = useState<LogementRdv[]>([])
  const [logementId, setLogementId] = useState<string | null>(null)
  const [rdvBloque, setRdvBloque] = useState(false)
  const [date, setDate] = useState('')
  const [heure, setHeure] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingRdv, setCheckingRdv] = useState(false)

  useEffect(() => { setVisible(true) }, [])

  useEffect(() => {
    getLogementsDeLaConversation(conversationId, bailleurId).then(data => {
      setLogements(data)
      if (data.length === 1) {
        setLogementId(data[0].id)
        setEtape('datetime')
      }
    })
  }, [conversationId, bailleurId])

  async function handleEnvoyer() {
    if (!logementId || !date || !heure) return
    setLoading(true)
    await onSend(logementId, date, heure)
    setLoading(false)
    onClose()
  }

  const today = new Date().toISOString().split('T')[0]
  const logementActif = logements.find(l => l.id === logementId)

  return (
    <div className={`modal-overlay${visible ? ' show' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        <div className="modal-handle" />

        {etape === 'logement' && (
          <>
            <div className="modal-title">Pour quel logement ?</div>
            <div className="rdv-logement-list">
              {logements.map(l => (
                <button
                  key={l.id}
                  className={`rdv-logement-item${logementId === l.id ? ' selected' : ''}`}
                  onClick={() => { setLogementId(l.id); setRdvBloque(false) }}
                  type="button"
                >
                  <div className="rdv-logement-titre">{l.titre}</div>
                  <div className="rdv-logement-meta">
                    {l.ref_interne} · {l.quartier}
                    {l.prix_visite > 0 && ` · ${formatFCFA(l.prix_visite)} frais visite`}
                  </div>
                </button>
              ))}
            </div>
            {rdvBloque && (
              <p style={{ marginTop: 10, fontSize: '0.875rem', color: 'var(--red)', textAlign: 'center' }}>
                Un RDV est déjà en cours pour ce logement.
              </p>
            )}
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 16 }}
              disabled={!logementId || checkingRdv}
              onClick={async () => {
                if (!logementId) return
                setCheckingRdv(true)
                const ok = await peutCreerNouveauRdv(conversationId, logementId)
                setCheckingRdv(false)
                if (!ok) { setRdvBloque(true); return }
                setRdvBloque(false)
                setEtape('datetime')
              }}
              type="button"
            >
              {checkingRdv ? 'Vérification...' : 'Continuer'}
            </button>
          </>
        )}

        {etape === 'datetime' && (
          <>
            <div className="modal-title">Proposer un créneau</div>
            {logementActif && (
              <div className="rdv-logement-item selected" style={{ marginBottom: 12, cursor: 'default' }}>
                <div className="rdv-logement-titre">{logementActif.titre}</div>
                <div className="rdv-logement-meta">{logementActif.ref_interne} · {logementActif.quartier}</div>
              </div>
            )}
            {logements.length > 1 && (
              <button className="btn-link" style={{ marginBottom: 12, fontSize: '0.875rem' }} onClick={() => setEtape('logement')} type="button">
                ← Changer de logement
              </button>
            )}
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" min={today} value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Heure</label>
              <input className="form-input" type="time" value={heure} onChange={e => setHeure(e.target.value)} />
            </div>
            <button
              className="btn btn-primary btn-full"
              style={{ marginTop: 16 }}
              disabled={!date || !heure || loading}
              onClick={handleEnvoyer}
              type="button"
            >
              {loading ? 'Envoi...' : 'Envoyer la programmation'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
