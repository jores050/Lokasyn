'use client'

import { useRouter } from 'next/navigation'
import { ChatPanel } from '@/components/chat/ChatPanel'

export default function ChatPageClient({ convId }: { convId: string }) {
  const router = useRouter()
  return <ChatPanel convId={convId} onBack={() => router.push('/messages')} />
}
