'use client'

import { create } from 'zustand'
import type { Profile } from '@/types/database'

export type { Profile }

interface AppState {
  user: { id: string; email: string } | null
  profile: Profile | null
  unreadCount: number
  favorites: Set<string>
  isAuthChecked: boolean
  setUser: (user: AppState['user']) => void
  setProfile: (profile: Profile | null) => void
  setUnreadCount: (n: number) => void
  setAuthChecked: () => void
  toggleFavorite: (id: string) => boolean
  loadFavorites: (ids: string[]) => void
  isFavorite: (id: string) => boolean
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  profile: null,
  unreadCount: 0,
  favorites: new Set(),
  isAuthChecked: false,

  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  setUnreadCount: (n) => set({ unreadCount: n }),
  setAuthChecked: () => set({ isAuthChecked: true }),

  toggleFavorite: (id) => {
    const favs = new Set(get().favorites)
    if (favs.has(id)) { favs.delete(id) } else { favs.add(id) }
    set({ favorites: favs })
    return favs.has(id)
  },

  loadFavorites: (ids) => set({ favorites: new Set(ids) }),
  isFavorite: (id) => get().favorites.has(id),
}))
