'use client'

import { useState, useRef, FormEvent, MutableRefObject } from 'react'
import { Send, Calendar, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sanitizeMessage } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface ChatComposerProps {
  conversationId: string
  userId: string
  destinataireId: string
  isBailleur: boolean
  peutCreerRdv: boolean
  onOpenRdvForm: () => void
  onOpenRecoModal: () => void
  presenceChannelRef?: MutableRefObject<any>
  currentUserPrenom?: string
}

async function envoyerNotification(
  supabase: ReturnType<typeof createClient>,
  expediteurId: string,
  destinataireId: string,
  conversationId: string,
  contenuPreview: string
) {
  if (expediteurId === destinataireId) return

  // Une seule notif non lue par conversation — évite le spam
  const { data: existante } = await supabase
    .from('notifications')
    .select('id')
    .eq('utilisateur_id', destinataireId)
    .eq('type', 'nouveau_message')
    .eq('lien', `/chat/${conversationId}`)
    .eq('lue', false)
    .maybeSingle()

  if (existante) return

  await supabase.from('notifications').insert({
    utilisateur_id: destinataireId,
    type: 'nouveau_message',
    titre: 'Nouveau message',
    corps: contenuPreview.length > 50 ? contenuPreview.slice(0, 50) + '...' : contenuPreview,
    lien: `/chat/${conversationId}`,
    lue: false,
  })
}

export function ChatComposer({
  conversationId, userId, destinataireId, isBailleur, peutCreerRdv,
  onOpenRdvForm, onOpenRecoModal, presenceChannelRef, currentUserPrenom,
}: ChatComposerProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const supabase = createClient()

  function trackTyping(typing: boolean) {
    presenceChannelRef?.current?.track({
      user_id: userId,
      prenom: currentUserPrenom || '',
      typing,
      at: Date.now(),
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const contenu = sanitizeMessage(trimmed)

    // Arrêter l'indicateur de frappe immédiatement à l'envoi
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    trackTyping(false)

    setSending(true)
    setText('')
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      expediteur_id: userId,
      contenu,
      type: 'texte',
    })
    setSending(false)
    if (error) {
      showToast('Erreur lors de l\'envoi', 'error')
      setText(trimmed)
      return
    }

    envoyerNotification(supabase, userId, destinataireId, conversationId, contenu)

    // Notification push PWA (fire-and-forget, silencieux si non souscrit)
    supabase.functions.invoke('send-push-notification', {
      body: {
        destinataire_id: destinataireId,
        titre: currentUserPrenom || 'Nouveau message',
        corps: contenu.slice(0, 100),
        conversation_id: conversationId,
        url: '/messages',
      },
    }).catch(() => {})
  }

  return (
    <footer className="chat-col__composer">
      {isBailleur && (
        <>
          <button
            className="composer-action rdv-trigger"
            title="Proposer un créneau de visite"
            disabled={!peutCreerRdv}
            onClick={onOpenRdvForm}
            type="button"
          >
            <Calendar size={18} />
          </button>
          <button
            className="composer-action"
            title="Recommander un logement"
            onClick={onOpenRecoModal}
            type="button"
          >
            <Home size={18} />
          </button>
        </>
      )}
      <form style={{ flex: 1, display: 'flex', gap: 8 }} onSubmit={handleSubmit}>
        <textarea
          ref={textareaRef}
          className="composer-input"
          placeholder="Votre message…"
          value={text}
          rows={1}
          style={{ resize: 'none', overflow: 'hidden' }}
          onChange={e => {
            setText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'
            // Broadcast typing — auto-stop après 3 s d'inactivité
            trackTyping(true)
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
            typingTimeoutRef.current = setTimeout(() => trackTyping(false), 3000)
          }}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              handleSubmit(e as unknown as FormEvent)
            }
          }}
          autoComplete="off"
        />
        <button
          className="composer-send"
          type="submit"
          disabled={!text.trim() || sending}
          aria-label="Envoyer"
        >
          <Send size={18} />
        </button>
      </form>
    </footer>
  )
}
