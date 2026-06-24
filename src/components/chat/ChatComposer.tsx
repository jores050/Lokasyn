'use client'

import { useState, useRef, FormEvent } from 'react'
import { Send, Calendar } from 'lucide-react'
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
  conversationId, userId, destinataireId, isBailleur, peutCreerRdv, onOpenRdvForm
}: ChatComposerProps) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const supabase = createClient()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const contenu = sanitizeMessage(trimmed)

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
  }

  return (
    <footer className="chat-col__composer">
      {isBailleur && (
        <button
          className="composer-action rdv-trigger"
          title="Proposer un créneau de visite"
          disabled={!peutCreerRdv}
          onClick={onOpenRdvForm}
          type="button"
        >
          <Calendar size={18} />
        </button>
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
