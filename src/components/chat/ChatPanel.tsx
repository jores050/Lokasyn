'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { useRdv } from '@/hooks/useRdv'
import { RdvBanner } from '@/components/chat/RdvBanner'
import { RdvFormModal } from '@/components/chat/RdvFormModal'
import { RecoLogementModal } from '@/components/chat/RecoLogementModal'
import { RdvList } from '@/components/chat/RdvList'
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
  const [showRecoModal, setShowRecoModal] = useState(false)
  const [onglet, setOnglet] = useState<'messages' | 'visites'>('messages')

  const msgEndRef = useRef<HTMLDivElement>(null)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const rdv = useRdv(convId, user?.id)

  useEffect(() => {
    if (!user?.id || !convId) return
    let isMounted = true

    async function load() {
      console.log('[DEBUG] load() — userId:', user?.id, 'convId:', convId)

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

      if (!isMounted || !convData) return
      setConv(convData as unknown as ConvData)
      setMessages((msgs || []) as Message[])
      setLoading(false)

      const now = new Date().toISOString()

      // Marquer messages comme lus + mise à jour state local
      const { data: luData, error: luError } = await supabase
        .from('messages')
        .update({ lu: true, lu_le: now })
        .eq('conversation_id', convId)
        .neq('expediteur_id', user!.id)
        .eq('lu', false)
        .select()
      console.log('[MARQUAGE LU] data:', luData, 'error:', luError)
      if (isMounted && luData && luData.length > 0) {
        const markedIds = new Set(luData.map((m: { id: string }) => m.id))
        setMessages(prev => prev.map(m =>
          markedIds.has(m.id) ? { ...m, lu: true, lu_le: now } : m
        ))
      }

      // Marquer notifications comme lues
      const { data: notifData, error: notifError } = await supabase
        .from('notifications')
        .update({ lue: true, lue_le: now })
        .eq('utilisateur_id', user!.id)
        .eq('lien', `/chat/${convId}`)
        .eq('lue', false)
        .select()
      console.log('[MARQUAGE NOTIF LUE] data:', notifData, 'error:', notifError)
    }

    function souscrireRealtime() {
      channelRef.current = supabase
        .channel(`conv:${convId}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'messages',
          filter: `conversation_id=eq.${convId}`,
        }, payload => {
          if (!isMounted) return
          console.log('[REALTIME] Nouveau message reçu:', payload.new)
          const msg = payload.new as Message
          setMessages(prev => {
            if (prev.find(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          if (msg.expediteur_id !== user?.id) {
            supabase.from('messages').update({ lu: true, lu_le: new Date().toISOString() }).eq('id', msg.id)
          }
        })
        .subscribe((status, err) => {
          console.log('[REALTIME] Statut canal messages:', status, err ?? '')
        })
    }

    async function init() {
      await load()
      if (isMounted) souscrireRealtime()
    }

    init()

    return () => {
      isMounted = false
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [convId, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
  const isBailleur  = conv.bailleur?.id === user.id
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
        <div className="chat-header-info">
          <div className="chat-header-name">{otherNom}</div>
          <div className="chat-header-status">
            {conv.logements?.titre || 'Logement'} · {conv.logements?.ref_interne || ''}
          </div>
        </div>
        {conv.logements?.id && (
          <Link href={`/listing/${conv.logements.id}`} className="btn-icon" style={{ color: 'var(--ink)', marginLeft: 'auto' }}>
            🏠
          </Link>
        )}
      </div>

      {/* Onglets Messages / Visites */}
      <div className="chat-tabs">
        <button
          className={`chat-tab${onglet === 'messages' ? ' active' : ''}`}
          onClick={() => setOnglet('messages')}
          type="button"
        >
          Messages
        </button>
        <button
          className={`chat-tab${onglet === 'visites' ? ' active' : ''}`}
          onClick={() => setOnglet('visites')}
          type="button"
        >
          Visites
          {rdv.rdvActif?.statut === 'en_attente' && (
            <span className="chat-tab-badge" />
          )}
        </button>
      </div>

      {/* Onglet Messages */}
      {onglet === 'messages' && (
        <>
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
            <RdvBanner
              rdv={rdv.rdvActif}
              userId={user.id}
              onConfirmer={rdv.confirmerRdv}
              onDemanderAnnulation={rdv.demanderAnnulation}
              onConfirmerAnnulation={rdv.confirmerAnnulation}
              onRefuserAnnulation={rdv.refuserAnnulation}
              onDeclarerEffectuee={rdv.declarerEffectuee}
            />
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

          {/* Modal RDV — sélecteur logement + date/heure */}
          {showRdvForm && (
            <RdvFormModal
              conversationId={convId}
              bailleurId={user.id}
              onClose={() => setShowRdvForm(false)}
              onSend={async (lgmtId, date, heure) => {
                const result = await rdv.creerRdv(lgmtId, date, heure)
                if (result) showToast('Demande de visite envoyée !', 'success')
                else showToast('Erreur lors de la création du RDV', 'error')
              }}
            />
          )}

          {/* Modal recommandation de logement */}
          {showRecoModal && (
            <RecoLogementModal
              bailleurId={user.id}
              onClose={() => setShowRecoModal(false)}
              onSend={async (logement) => {
                const destinataireId = isLocataire ? (conv.bailleur?.id || '') : (conv.locataire?.id || '')
                const { error } = await supabase.from('messages').insert({
                  conversation_id: convId,
                  expediteur_id: user.id,
                  contenu: `Logement recommandé : ${logement.titre}`,
                  type: 'reco_logement',
                  metadata: {
                    logement_id: logement.id,
                    titre: logement.titre,
                    ref_interne: logement.ref_interne || null,
                    quartier: logement.quartier,
                    ville: logement.ville,
                    loyer_mensuel: logement.loyer_mensuel,
                    photo: logement.photos?.[0] || null,
                  },
                })
                if (error) showToast('Erreur lors de l\'envoi', 'error')
                else {
                  // Notifier le locataire
                  const { data: existante } = await supabase.from('notifications')
                    .select('id').eq('utilisateur_id', destinataireId)
                    .eq('type', 'nouveau_message').eq('lien', `/chat/${convId}`)
                    .eq('lue', false).maybeSingle()
                  if (!existante) {
                    await supabase.from('notifications').insert({
                      utilisateur_id: destinataireId,
                      type: 'nouveau_message',
                      titre: 'Nouveau message',
                      corps: `Logement recommandé : ${logement.titre}`,
                      lien: `/chat/${convId}`,
                      lue: false,
                    })
                  }
                }
              }}
            />
          )}

          {/* Composer */}
          <ChatComposer
            conversationId={convId}
            userId={user.id}
            destinataireId={isLocataire ? (conv.bailleur?.id || '') : (conv.locataire?.id || '')}
            isBailleur={isBailleur}
            peutCreerRdv={rdv.peutCreer}
            onOpenRdvForm={() => setShowRdvForm(v => !v)}
            onOpenRecoModal={() => setShowRecoModal(v => !v)}
          />
        </>
      )}

      {/* Onglet Visites */}
      {onglet === 'visites' && (
        <RdvList conversationId={convId} currentUserId={user.id} />
      )}
    </div>
  )
}
