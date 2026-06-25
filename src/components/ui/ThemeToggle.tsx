'use client'

import { Sun, Moon } from 'lucide-react'
import { useTheme } from '@/components/layout/ThemeProvider'

interface ThemeToggleProps {
  variant?: 'icon' | 'row'
}

export function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  if (variant === 'row') {
    return (
      <div className="profile-menu-item" style={{ cursor: 'pointer' }} onClick={toggleTheme}>
        <span className="profile-menu-icon">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </span>
        <span className="profile-menu-label">Mode {isDark ? 'clair' : 'sombre'}</span>
        <span className="profile-menu-arrow">›</span>
      </div>
    )
  }

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle-btn"
      title={isDark ? 'Passer en mode clair' : 'Passer en mode sombre'}
      aria-label={isDark ? 'Mode clair' : 'Mode sombre'}
    >
      {isDark ? <Sun size={18} strokeWidth={1.75} /> : <Moon size={18} strokeWidth={1.75} />}
    </button>
  )
}
