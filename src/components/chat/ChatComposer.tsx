'use client'

import { useState, useRef, FormEvent } from 'react'
import { Send, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { sanitizeMessage } from '@/lib/utils'
import { showToast } from '@/components/ui/Toast'

interface ChatComposerProps {
  conversationId: string
  userId: string
  isBailleur: boolean
  peutCreerRdv: boolean
  onOpenRdvForm: () => void
}

export function ChatComposer({
  conversationId, userId, isBailleur, peutCreerRdv, onOpenRdvForm
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
    }
  }

  return (
    <footer className="chat-col__composer">
      {isBailleur && (
        <button
          className="composer-action rdv-trigger"
          title={peutCreerRdv ? 'Proposer un créneau de visite' : 'Une visite est déjà en cours'}
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
