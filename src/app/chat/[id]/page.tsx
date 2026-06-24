'use client'

import { use } from 'react'
import { useRouter } from 'next/navigation'
import { ChatPanel } from '@/components/chat/ChatPanel'

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: convId } = use(params)
  const router = useRouter()
  return <ChatPanel convId={convId} onBack={() => router.push('/messages')} />
}
