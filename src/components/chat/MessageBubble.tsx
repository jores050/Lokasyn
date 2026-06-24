import { Wallet, Check, Home } from 'lucide-react'
import { dateRelative, formatFCFA } from '@/lib/utils'
import type { Message } from '@/types/database'

function formatDateFr(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  const mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.']
  return `${parseInt(d, 10)} ${mois[parseInt(m, 10) - 1]} ${y}`
}

// Types gérés par la bannière épinglée — ne pas afficher dans le flux
const TYPES_BANNIERE = new Set([
  'rdv_programmation', 'rdv_confirme', 'rdv_confirme_gratuit',
  'rdv_demande', 'annulation_demandee', 'visite_declaree', 'systeme_rdv',
])

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

  // Types gérés par la bannière — ne pas dupliquer dans le flux
  if (TYPES_BANNIERE.has(msg.type)) return null

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

  // Recommandation de logement
  if (msg.type === 'recommandation_logement') {
    const logementId = String(meta.logement_id || '')
    return (
      <div className={isMine ? 'msg--me' : 'msg--them'} style={{ maxWidth: '85%', alignSelf: isMine ? 'flex-end' : 'flex-start' }}>
        <a href={logementId ? `/listing/${logementId}` : '#'} className="msg-reco" style={{ display: 'flex' }}>
          <div className="msg-reco-photo">
            {meta.photo
              ? <img src={String(meta.photo)} alt={String(meta.titre || '')} />
              : <div className="msg-reco-photo-placeholder"><Home size={20} /></div>
            }
          </div>
          <div className="msg-reco-info">
            <div className="msg-reco-label">Logement recommandé</div>
            <div className="msg-reco-titre">{String(meta.titre || '—')}</div>
            <div className="msg-reco-prix">{formatFCFA(Number(meta.loyer_mensuel) || 0)}/mois</div>
          </div>
        </a>
        <div className="msg-time" style={{ textAlign: isMine ? 'right' : 'left', marginTop: 4 }}>
          {time}{isMine && msg.lu && <> · <Check size={12} /></>}
        </div>
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
