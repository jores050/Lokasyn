'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, MessageCircle, User, PlusCircle, Heart } from 'lucide-react'
import { useAppStore } from '@/lib/store'

const NAV_ITEMS = [
  { route: '/',         icon: Home,          label: 'Accueil' },
  { route: '/search',   icon: Search,        label: 'Recherche' },
  { route: '/messages', icon: MessageCircle, label: 'Messages', badge: true },
  { route: '/profile',  icon: User,          label: 'Mon profil' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { profile, unreadCount } = useAppStore()
  const peutPublier = profile && (profile.role === 'bailleur' || profile.role === 'agence')

  return (
    <nav className="sidebar-nav">
      <div className="sidebar-logo">Loka<span>syn</span></div>

      {peutPublier && (
        <Link href="/publish" className="sidebar-publish-btn">
          + Publier une annonce
        </Link>
      )}

      <div className="sidebar-nav-items">
        {NAV_ITEMS.map(({ route, icon: Icon, label, badge }) => (
          <Link
            key={route}
            href={route}
            className={`sidebar-nav-item ${pathname === route ? 'active' : ''}`}
          >
            <span className="sidebar-nav-icon"><Icon size={18} strokeWidth={1.75} /></span>
            <span className="sidebar-nav-label">{label}</span>
            {badge && unreadCount > 0 && (
              <span className="sidebar-nav-badge">{unreadCount}</span>
            )}
          </Link>
        ))}
        {peutPublier && (
          <Link href="/publish" className={`sidebar-nav-item ${pathname === '/publish' ? 'active' : ''}`}>
            <span className="sidebar-nav-icon"><PlusCircle size={18} strokeWidth={1.75} /></span>
            <span className="sidebar-nav-label">Publier</span>
          </Link>
        )}
      </div>

      <div className="sidebar-bottom">
        <Link href="/favoris" className={`sidebar-nav-item ${pathname === '/favoris' ? 'active' : ''}`}>
          <span className="sidebar-nav-icon"><Heart size={18} strokeWidth={1.75} /></span>
          <span className="sidebar-nav-label">Favoris</span>
        </Link>
      </div>
    </nav>
  )
}
