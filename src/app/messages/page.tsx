'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { ConversationsList } from '@/components/chat/ConversationsList'
import { ChatPanel } from '@/components/chat/ChatPanel'

export default function MessagesPage() {
  const { user } = useAppStore()
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [isDesktop, setIsDesktop] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Avant hydration : afficher le shell mobile vide (évite le flash "Connectez-vous")
  if (!mounted) {
    return (
      <div className="messages-screen">
        <div className="messages-header"><h2>Messages</h2></div>
        <ConversationsList activeId={null} onSelect={() => {}} />
      </div>
    )
  }

  if (!user?.id) {
    return (
      <div className="messages-screen" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div className="empty-state">
          <div className="empty-icon"><MessageCircle size={40} strokeWidth={1.25} /></div>
          <h3>Connectez-vous</h3>
          <p>Vous devez être connecté pour voir vos messages.</p>
          <Link href="/auth?redirect=/messages" className="btn btn-primary">Se connecter</Link>
        </div>
      </div>
    )
  }

  // Desktop — layout 2 colonnes
  if (isDesktop) {
    return (
      <div className="messages-shell">
        <ConversationsList activeId={activeConvId} onSelect={setActiveConvId} />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, height: '100%' }}>
          {activeConvId
            ? <ChatPanel convId={activeConvId} />
            : (
              <div className="messages-empty-panel">
                <div className="empty-icon"><MessageCircle size={40} strokeWidth={1.25} /></div>
                <p>Sélectionnez une conversation</p>
              </div>
            )
          }
        </div>
      </div>
    )
  }

  // Mobile — chat si conversation active, sinon liste
  if (activeConvId) {
    return <ChatPanel convId={activeConvId} onBack={() => setActiveConvId(null)} />
  }

  return (
    <div className="messages-screen">
      <div className="messages-header"><h2>Messages</h2></div>
      <ConversationsList activeId={null} onSelect={setActiveConvId} />
    </div>
  )
}
