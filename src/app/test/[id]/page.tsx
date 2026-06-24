export const dynamic = 'force-dynamic'

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <h1>dynamic route ok: {id}</h1>
}
