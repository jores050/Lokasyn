'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, MessageCircle, User } from 'lucide-react'
import { useAppStore } from '@/lib/store'

const NAV_ITEMS = [
  { route: '/',         icon: Home,          label: 'Accueil' },
  { route: '/search',   icon: Search,        label: 'Recherche' },
  { route: '/messages', icon: MessageCircle, label: 'Messages' },
  { route: '/profile',  icon: User,          label: 'Profil' },
]

export function BottomNav() {
  const pathname = usePathname()
  const { unreadCount } = useAppStore()

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ route, icon: Icon, label }) => (
        <Link
          key={route}
          href={route}
          className={`bottom-nav-item ${pathname === route ? 'active' : ''}`}
          data-route={route.replace('/', '') || 'home'}
        >
          <span className="bottom-nav-icon" style={{ position: 'relative' }}>
            <Icon size={24} strokeWidth={1.75} />
            {route === '/messages' && unreadCount > 0 && (
              <span className="bottom-nav-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </span>
          <span className="bottom-nav-label">{label}</span>
        </Link>
      ))}
    </nav>
  )
}
