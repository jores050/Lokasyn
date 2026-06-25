import { Calendar, Clock, MapPin } from 'lucide-react'
import { formatFCFA } from '@/lib/utils'

function formatDateFr(dateStr: string): string {
  if (!dateStr) return '—'
  const [, m, d] = dateStr.split('-')
  const mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  return `${parseInt(d, 10)} ${mois[parseInt(m, 10) - 1]}`
}

interface RdvCardProps {
  date: string
  heure: string
  logementTitre?: string | null
  logementQuartier?: string | null
  logementAdresse?: string | null
  prixVisite?: number | null
  time?: string
}

export function RdvCard({
  date, heure,
  logementTitre, logementQuartier, logementAdresse,
  prixVisite, time,
}: RdvCardProps) {
  const adresse = logementAdresse || logementQuartier || null

  return (
    <div className="rdv-card-chat">
      <div className="rdv-card-chat-header">
        <Calendar size={15} />
        <span>Proposition de visite</span>
      </div>
      <div className="rdv-card-chat-body">
        <div className="rdv-card-chat-row">
          <Clock size={13} />
          <span>{formatDateFr(date)} à {heure?.slice(0, 5) || '—'}</span>
        </div>
        {adresse && (
          <div className="rdv-card-chat-row">
            <MapPin size={13} />
            <span>
              {logementTitre ? <strong>{logementTitre}</strong> : null}
              {logementTitre && adresse ? ' · ' : null}
              {adresse}
            </span>
          </div>
        )}
        {prixVisite != null && prixVisite > 0 && (
          <div className="rdv-card-chat-row rdv-card-chat-prix">
            Frais de visite : <strong>{formatFCFA(prixVisite)}</strong>
          </div>
        )}
        {prixVisite === 0 && (
          <div className="rdv-card-chat-row rdv-card-chat-prix">
            Visite gratuite
          </div>
        )}
      </div>
      {time && <div className="msg-time" style={{ marginTop: 6 }}>{time}</div>}
    </div>
  )
}
