'use client'

import { useState, useEffect } from 'react'
import { MessageCircle, AlertTriangle, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { initiales, avatarColor, dateRelative, truncate } from '@/lib/utils'
import type { Profile } from '@/types/database'

interface ConvRow {
  id: string
  statut: string
  derniere_activite: string
  logements: { id: string; titre: string; ref_interne: string } | null
  locataire: Profile | null
  bailleur: Profile | null
  _lastMsg?: { contenu: string; type: string; created_at: string; expediteur_id: string } | null
  _unread?: number
}

const PREVIEW_LABELS: Record<string, string> = {
  rdv_programmation: 'Visite proposée',
  rdv_confirme:      'Visite confirmée',
  rdv_demande:       'Demande de visite',
  lien_paiement:     'Lien de paiement',
  image:             'Photo',
}

interface Props {
  activeId: string | null
  onSelect: (id: string) => void
}

export function ConversationsList({ activeId, onSelect }: Props) {
  const { user } = useAppStore()
  const supabase = createClient()
  const [convs, setConvs] = useState<ConvRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.id) return
    load()
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true)
    const { data, error: convErr } = await supabase
      .from('conversations')
      .select(`id, derniere_activite, statut,
        logements(id, titre, ref_interne),
        locataire:profiles!locataire_id(id, nom, prenom, photo_url, role),
        bailleur:profiles!bailleur_id(id, nom, prenom, photo_url, role)`)
      .or(`locataire_id.eq.${user!.id},bailleur_id.eq.${user!.id}`)
      .order('derniere_activite', { ascending: false })

    if (convErr) { setError(convErr.message); setLoading(false); return }
    if (!data?.length) { setConvs([]); setLoading(false); return }

    const ids = data.map(c => c.id)
    const [{ data: unreads }, { data: lastMsgs }] = await Promise.all([
      supabase.from('messages').select('conversation_id')
        .in('conversation_id', ids).eq('lu', false).neq('expediteur_id', user!.id),
      supabase.from('messages').select('conversation_id, contenu, type, created_at, expediteur_id')
        .in('conversation_id', ids).order('created_at', { ascending: false }),
    ])

    const unreadMap: Record<string, number> = {}
    ;(unreads || []).forEach(m => {
      unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1
    })
    const lastMsgMap: Record<string, ConvRow['_lastMsg']> = {}
    ;(lastMsgs || []).forEach(m => {
      if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m
    })

    setConvs((data as unknown as ConvRow[]).map(c => ({
      ...c,
      _lastMsg: lastMsgMap[c.id] || null,
      _unread: unreadMap[c.id] || 0,
    })))
    setLoading(false)
  }

  if (loading) {
    return (
      <div className="conversations-col">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="conv-item" style={{ pointerEvents: 'none' }}>
            <div className="avatar skeleton" style={{ flexShrink: 0 }} />
            <div className="conv-item-info" style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: 14, width: '60%', borderRadius: 4, marginBottom: 6 }} />
              <div className="skeleton" style={{ height: 12, width: '40%', borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="conversations-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div style={{ textAlign: 'center', color: 'var(--ink-mid)' }}>
          <AlertTriangle size={32} strokeWidth={1.25} />
          <p style={{ marginTop: 8, fontSize: '0.875rem' }}>{error}</p>
        </div>
      </div>
    )
  }

  if (!convs.length) {
    return (
      <div className="conversations-col" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="empty-state">
          <div className="empty-icon"><MessageCircle size={40} strokeWidth={1.25} /></div>
          <h3>Aucune conversation</h3>
          <p>Trouvez un logement et contactez un bailleur !</p>
        </div>
      </div>
    )
  }

  return (
    <div className="conversations-col">
      <div style={{ padding: '16px 16px 8px', borderBottom: '1px solid var(--border-light)' }}>
        <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>Messages</h2>
      </div>
      {convs.map(conv => {
        const isLocataire = conv.locataire?.id === user?.id
        const other = isLocataire ? conv.bailleur : conv.locataire
        if (!other) return null

        const nom    = `${other.prenom || ''} ${other.nom || ''}`.trim()
        const inis   = initiales(other.nom || '', other.prenom || '')
        const color  = avatarColor(nom)
        const lastMsg = conv._lastMsg
        const unread  = conv._unread || 0
        const diffMs  = Date.now() - new Date(conv.derniere_activite).getTime()
        const isOnline = diffMs < 300_000

        let preview = 'Démarrez la conversation'
        if (lastMsg) {
          preview = PREVIEW_LABELS[lastMsg.type] || (lastMsg.contenu ? truncate(lastMsg.contenu, 55) : preview)
        }

        return (
          <div
            key={conv.id}
            className={`conv-item${activeId === conv.id ? ' active' : ''}`}
            style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}
            onClick={() => onSelect(conv.id)}
          >
            <div className="avatar" style={{ background: color, position: 'relative', flexShrink: 0 }}>
              {other.photo_url ? <img src={other.photo_url} alt={nom} /> : inis}
              {isOnline && (
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, background: 'var(--green-mid)', borderRadius: '50%', border: '2px solid var(--white)' }} />
              )}
            </div>
            <div className="conv-item-info">
              <div className="conv-item-top">
                <div className="conv-item-name">{nom}</div>
                <div className="conv-item-time">{lastMsg ? dateRelative(lastMsg.created_at) : ''}</div>
              </div>
              <div className="conv-item-logement" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--ink-mid)' }}>
                <Home size={12} /> {conv.logements?.titre || 'Logement'} · {conv.logements?.ref_interne || ''}
              </div>
              <div className="conv-item-preview" style={unread ? { fontWeight: 600, color: 'var(--ink)' } : {}}>
                {preview}
              </div>
            </div>
            {unread > 0 && <div className="conv-item-badge">{unread}</div>}
          </div>
        )
      })}
    </div>
  )
}
