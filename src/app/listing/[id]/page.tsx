export const dynamic = 'force-dynamic'

import ListingDetailClient from './ListingDetailClient'

export default async function ListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ListingDetailClient id={id} />
}
