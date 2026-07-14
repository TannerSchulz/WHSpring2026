import { useState, useCallback, useEffect } from 'react'
import { Branding, DEFAULT_BRANDING } from '../types/branding'
import { deriveTheme, isValidHex } from '../lib/color'

const STORAGE_KEY = 'mortgageai_branding'

function load(): Branding {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BRANDING
    return { ...DEFAULT_BRANDING, ...(JSON.parse(raw) as Partial<Branding>) }
  } catch {
    return DEFAULT_BRANDING
  }
}

export function applyBranding(b: Branding) {
  const root = document.documentElement
  const primary = isValidHex(b.primaryColor) ? b.primaryColor : DEFAULT_BRANDING.primaryColor
  const accent = isValidHex(b.accentColor) ? b.accentColor : DEFAULT_BRANDING.accentColor
  const theme = deriveTheme(primary, accent)
  for (const [k, v] of Object.entries(theme)) root.style.setProperty(k, v)
  document.title = `${b.companyName || DEFAULT_BRANDING.companyName} — Mortgage Tools`
}

export function useBranding() {
  const [branding, setBranding] = useState<Branding>(load)

  // Apply on mount and whenever branding changes
  useEffect(() => {
    applyBranding(branding)
  }, [branding])

  const save = useCallback((b: Branding) => {
    setBranding(b)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(b))
    } catch {
      // Data URLs can exceed the localStorage quota — persist everything else
      // so at least text/colors survive a reload.
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...b, logoDataUrl: null, officerPhotoDataUrl: null }))
      } catch {}
    }
  }, [])

  const reset = useCallback(() => {
    setBranding(DEFAULT_BRANDING)
    try { localStorage.removeItem(STORAGE_KEY) } catch {}
  }, [])

  return { branding, save, reset }
}
