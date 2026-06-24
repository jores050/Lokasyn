import Link from 'next/link'
import { Search, Bell } from 'lucide-react'
import dynamic from 'next/dynamic'
import { ListingGrid } from '@/components/listing/ListingGrid'
import { HomePublishButton } from '@/components/layout/HomePublishButton'

export const revalidate = 60

const StatsStrip = dynamic(() => import('@/components/home/StatsStrip').then(m => ({ default: m.StatsStrip })), { ssr: false })

export default function HomePage() {
  return (
    <>
      {/* Navbar */}
      <nav className="navbar">
        <div className="navbar-logo">Loka<span>syn</span></div>
        <div className="navbar-actions">
          <HomePublishButton />
          <Link href="/messages" className="btn-icon" style={{ position: 'relative' }}>
            <Bell size={24} strokeWidth={1.75} />
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="home-hero">
        <h1 className="home-hero-title">Trouvez votre logement idéal au Bénin</h1>
        <p className="home-hero-sub">Des milliers d&apos;annonces vérifiées à Cotonou, Calavi et partout au pays</p>
        <div className="home-search mt-3">
          <Link href="/search" className="search-bar" style={{ cursor: 'pointer' }}>
            <span className="search-bar-icon"><Search size={18} /></span>
            <span style={{ color: 'var(--ink-light)', fontSize: '0.9375rem' }}>Quartier, ville, type...</span>
          </Link>
        </div>
      </div>

      <StatsStrip />

      {/* Grille avec filtres (Client Component) */}
      <ListingGrid />
    </>
  )
}
