'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Calendar } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { useRdv } from '@/hooks/useRdv'
import { RdvBanner } from '@/components/chat/RdvBanner'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { ChatComposer } from '@/components/chat/ChatComposer'
import { initiales, avatarColor } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'
import type { Message, Profile } from '@/types/database'

interface ConvData {
  id: string
  statut: string
  derniere_activite: string
  logements: { id: string; titre: string; quartier: string; ref_interne: string } | null
  locataire: Profile | null
  bailleur: Profile | null
}

interface RdvFormState { date: string; heure: string; message: string }

interface ChatPanelProps {
  convId: string
  onBack?: () => void
}

export function ChatPanel({ convId, onBack }: ChatPanelProps) {
  const { user, profile } = useAppStore()
  const supabase = createClient()

  const [conv, setConv] = useState<ConvData | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [showRdvForm, setShowRdvForm] = useState(false)
  const [rdvForm, setRdvForm] = useState<RdvFormState>({ date: '', heure: '', message: '' })
  const [submittingRdv, setSubmittingRdv] = useState(false)

  const msgEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const rdv = useRdv(convId, user?.id)

  useEffect(() => {
    if (!user?.id || !convId) return

    async function load() {
      const [{ data: convData }, { data: msgs }] = await Promise.all([
        supabase
          .from('conversations')
          .select(`id, statut, derniere_activite,
            logements(id, titre, quartier, ref_interne),
            locataire:profiles!locataire_id(id, nom, prenom, photo_url, role),
            bailleur:profiles!bailleur_id(id, nom, prenom, photo_url, role)`)
          .eq('id', convId)
          .single(),
        supabase
          .from('messages').select('*')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true })
          .limit(100),
      ])

      if (!convData) return
      setConv(convData as unknown as ConvData)
      setMessages((msgs || []) as Message[])
      setLoading(false)

      // Marquer lu avec timestamp
      await supabase.from('messages').update({ lu: true, lu_le: new Date().toISOString() })
        .eq('conversation_id', convId)
        .neq('expediteur_id', user!.id)
        .eq('lu', false)
    }

    load()

    channelRef.current = supabase
      .channel(`conv:${convId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
        filter: `conversation_id=eq.${convId}`,
      }, payload => {
        const msg = payload.new as Message
        setMessages(prev => {
          if (prev.find(m => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        if (msg.expediteur_id !== user?.id) {
          supabase.from('messages').update({ lu: true, lu_le: new Date().toISOString() }).eq('id', msg.id)
        }
      })
      .subscribe()

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
    }
  }, [convId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleCreerRdv() {
    if (!rdvForm.date || !rdvForm.heure) { showToast('Renseignez la date et l\'heure', 'error'); return }
    setSubmittingRdv(true)
    const result = await rdv.creerRdv(rdvForm.date, rdvForm.heure, rdvForm.message)
    setSubmittingRdv(false)
    if (result) {
      setShowRdvForm(false)
      setRdvForm({ date: '', heure: '', message: '' })
      showToast('Demande de visite envoyée !', 'success')
    } else {
      showToast('Erreur lors de la création du RDV', 'error')
    }
  }

  if (!user?.id) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Link href="/auth?redirect=/messages" className="btn btn-primary">Se connecter</Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="chat-col" style={{ flex: 1 }}>
        <div className="chat-col__header skeleton" style={{ height: 56 }} />
        <div className="chat-col__messages">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`msg skeleton ${i % 2 === 0 ? 'msg--them' : 'msg--me'}`} style={{ width: '60%', height: 40, marginLeft: i % 2 !== 0 ? 'auto' : 0 }} />
          ))}
        </div>
      </div>
    )
  }

  if (!conv) return null

  const isLocataire = conv.locataire?.id === user.id
  const isBailleur  = profile?.role === 'bailleur' || profile?.role === 'agence'
  const other       = isLocataire ? conv.bailleur : conv.locataire
  const otherNom    = other ? `${other.prenom || ''} ${other.nom || ''}`.trim() : 'Inconnu'
  const otherInis   = initiales(other?.nom || '', other?.prenom || '')
  const otherColor  = avatarColor(otherNom)

  return (
    <div className="chat-col" style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="chat-col__header">
        {onBack && (
          <button className="btn-icon" style={{ marginRight: 8, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)' }} onClick={onBack}>
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="avatar avatar--sm" style={{ background: otherColor, marginRight: 10 }}>
          {other?.photo_url ? <img src={other.photo_url} alt={otherNom} /> : otherInis}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.9375rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{otherNom}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--ink-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {conv.logements?.titre || 'Logement'} · {conv.logements?.ref_interne || ''}
          </div>
        </div>
        {conv.logements?.id && (
          <Link href={`/listing/${conv.logements.id}`} className="btn-icon" style={{ color: 'var(--ink)', marginLeft: 'auto' }}>
            🏠
          </Link>
        )}
      </div>

      {/* Barre logement + notice sécurité */}
      {conv.logements && (
        <>
          <Link href={`/listing/${conv.logements.id}`} className="chat-logement-bar" style={{ textDecoration: 'none' }}>
            <span className="chat-logement-bar-text">
              🏠 {conv.logements.titre} · {conv.logements.ref_interne} · {conv.logements.quartier} ›
            </span>
          </Link>
          <div className="security-notice">
            🔒 Coordonnées masquées jusqu&apos;à la signature du bail
          </div>
        </>
      )}

      {/* Bannière RDV */}
      {rdv.rdvActif && (
        <div id="rdvBanniere" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light)' }}>
          <RdvBanner
            rdv={rdv.rdvActif}
            userId={user.id}
            onConfirmer={rdv.confirmerRdv}
            onDemanderAnnulation={rdv.demanderAnnulation}
            onConfirmerAnnulation={rdv.confirmerAnnulation}
            onRefuserAnnulation={rdv.refuserAnnulation}
            onDeclarerEffectuee={rdv.declarerEffectuee}
          />
        </div>
      )}

      {/* Messages */}
      <div className="chat-col__messages" id="chatMessages">
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: 24, color: 'var(--ink-light)', fontSize: '0.875rem', fontStyle: 'italic' }}>
            Démarrez la conversation !
          </div>
        )}
        {messages.map(msg => (
          <MessageBubble key={msg.id} msg={msg} currentUserId={user.id} />
        ))}
        {rdv.rdvsTermines.map(r => {
          const labels: Record<string, string> = {
            annule_confirme: 'Visite annulée',
            refuse:          'Demande refusée',
            effectue:        'Visite effectuée',
          }
          return (
            <div key={r.id} className="msg msg--system" data-rdv-trace={r.id}>
              {labels[r.statut] || 'Visite terminée'}
            </div>
          )
        })}
        <div ref={msgEndRef} />
      </div>

      {/* Formulaire RDV */}
      {showRdvForm && (
        <div style={{ background: 'var(--surface)', borderTop: '1px solid var(--border-light)', padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Calendar size={16} /> Proposer une visite
            </div>
            <button onClick={() => setShowRdvForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-mid)' }}>✕</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input className="form-input" type="date" value={rdvForm.date} onChange={e => setRdvForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Heure</label>
              <input className="form-input" type="time" value={rdvForm.heure} onChange={e => setRdvForm(f => ({ ...f, heure: e.target.value }))} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">Message (optionnel)</label>
            <input className="form-input" type="text" placeholder="Apportez une pièce d'identité…" value={rdvForm.message} onChange={e => setRdvForm(f => ({ ...f, message: e.target.value }))} />
          </div>
          <button className="btn btn-primary btn-full" disabled={submittingRdv} onClick={handleCreerRdv}>
            {submittingRdv ? '...' : 'Envoyer la proposition'}
          </button>
        </div>
      )}

      {/* Composer */}
      <ChatComposer
        conversationId={convId}
        userId={user.id}
        isBailleur={isBailleur}
        peutCreerRdv={rdv.peutCreer}
        onOpenRdvForm={() => setShowRdvForm(v => !v)}
      />
    </div>
  )
}
