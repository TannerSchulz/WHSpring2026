import { useState, useCallback } from 'react'
import type { UserProfile } from '../types/profile'

const STORAGE_KEY = 'mortgageai_profile'

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? (JSON.parse(raw) as UserProfile) : null
    } catch {
      return null
    }
  })

  const save = useCallback((p: UserProfile) => {
    const updated: UserProfile = { ...p, lastUpdated: new Date().toISOString() }
    setProfile(updated)
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)) } catch {}
  }, [])

  const clear = useCallback(() => {
    setProfile(null)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  return { profile, save, clear }
}
