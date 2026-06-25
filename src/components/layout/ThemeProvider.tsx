'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'light', toggleTheme: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    // Read what the no-FOUC inline script already applied to <html>
    const applied = document.documentElement.getAttribute('data-theme') as Theme | null
    if (applied === 'dark' || applied === 'light') {
      setTheme(applied)
    } else {
      const stored = localStorage.getItem('lokasyn-theme') as Theme | null
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const initial: Theme = stored ?? (systemDark ? 'dark' : 'light')
      setTheme(initial)
      document.documentElement.setAttribute('data-theme', initial)
    }
  }, [])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('lokasyn-theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
