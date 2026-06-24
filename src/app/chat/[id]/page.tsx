export const dynamic = 'force-dynamic'

import ChatPageClient from './ChatPageClient'

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ChatPageClient convId={id} />
}