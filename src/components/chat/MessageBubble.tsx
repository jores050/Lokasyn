import { Calendar, BadgeCheck, CalendarCheck, AlertCircle, CheckCircle, Wallet, Check } from 'lucide-react'
import { dateRelative, formatFCFA } from '@/lib/utils'
import type { Message } from '@/types/database'

function formatDateFr(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  const mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  return `${parseInt(d, 10)} ${mois[parseInt(m, 10) - 1]} ${y}`
}

const RDV_LEGACY_LABELS: Record<string, string> = {
  rdv_demande:         'Demande de visite',
  rdv_confirme:        'Visite confirmée',
  rdv_programmation:   'Programmation de visite',
  annulation_demandee: "Demande d'annulation",
  visite_declaree:     'Visite déclarée effectuée',
}
const RDV_LEGACY_ICONS: Record<string, React.ElementType> = {
  rdv_demande:         Calendar,
  rdv_confirme:        BadgeCheck,
  rdv_programmation:   CalendarCheck,
  annulation_demandee: AlertCircle,
  visite_declaree:     CheckCircle,
}

interface MessageBubbleProps {
  msg: Message
  currentUserId: string
}

export function MessageBubble({ msg, currentUserId }: MessageBubbleProps) {
  if (!msg) return null
  const isMine = msg.expediteur_id === currentUserId
  const time = dateRelative(msg.created_at)
  const meta = (msg.metadata || {}) as Record<string, unknown>

  // Système
  if (msg.type === 'systeme') {
    if (!msg.contenu) return null
    return (
      <div className="msg msg--system">
        <span>{msg.contenu}</span>
        <div className="msg-time">{time}</div>
      </div>
    )
  }

  // Types RDV legacy (backward compat)
  if (Object.keys(RDV_LEGACY_LABELS).includes(msg.type)) {
    const Icon = RDV_LEGACY_ICONS[msg.type] || Calendar
    const dateVisite = (meta.date_visite || meta.date) as string | undefined
    const heureVisite = (meta.heure_visite || meta.heure) as string | undefined
    return (
      <div className="msg msg--system">
        <div className="msg-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={14} /> {RDV_LEGACY_LABELS[msg.type]}
        </div>
        {dateVisite && (
          <div className="msg-detail">{formatDateFr(dateVisite)} à {heureVisite || '—'}</div>
        )}
        <div className="msg-time">{time}</div>
      </div>
    )
  }

  // Lien paiement
  if (msg.type === 'lien_paiement') {
    return (
      <div className="msg msg--system">
        <div className="msg-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Wallet size={14} /> Paiement en attente
        </div>
        <div className="msg-detail">
          {String(meta.message || `Loyer ${meta.mois}`)} — {formatFCFA(Number(meta.montant) || 0)}
        </div>
        {!isMine && meta.lien ? (
          <div className="msg-actions" style={{ marginTop: 8 }}>
            <a href={String(meta.lien)} className="btn btn-primary btn-sm">Payer via MoMo</a>
          </div>
        ) : !isMine && meta.bail_id ? (
          <div className="msg-actions" style={{ marginTop: 8 }}>
            <a href={`/payment-loyer?bail_id=${String(meta.bail_id)}&mois=${String(meta.mois)}&montant=${String(meta.montant)}`} className="btn btn-primary btn-sm">Payer via MoMo</a>
          </div>
        ) : null}
        <div className="msg-time">{time}</div>
      </div>
    )
  }

  // Image
  if (msg.type === 'image') {
    return (
      <div className={`msg ${isMine ? 'msg--me' : 'msg--them'}`} style={{ padding: 4, background: 'transparent', border: 'none', boxShadow: 'none' }}>
        <img
          src={msg.contenu}
          style={{ maxWidth: 200, borderRadius: 'var(--radius-md)', cursor: 'pointer', display: 'block' }}
          onClick={() => window.open(msg.contenu, '_blank')}
          loading="lazy"
          alt=""
        />
        <div className="msg-time">{time}</div>
      </div>
    )
  }

  // Texte
  if (!msg.contenu) return null
  return (
    <div className={`msg ${isMine ? 'msg--me' : 'msg--them'}`}>
      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.contenu}</span>
      <div className="msg-time">
        {time}
        {isMine && msg.lu && <> · <Check size={12} /></>}
      </div>
    </div>
  )
}
