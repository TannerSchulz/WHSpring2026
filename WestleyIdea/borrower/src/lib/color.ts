// Color helpers for runtime theming from a single brand hex

export function isValidHex(hex: string): boolean {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hex.trim())
}

export function normalizeHex(hex: string): string {
  let h = hex.trim().toLowerCase()
  if (!h.startsWith('#')) h = '#' + h
  if (/^#[0-9a-f]{3}$/.test(h)) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3]
  }
  return h
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const h6 = normalizeHex(hex)
  const r = parseInt(h6.slice(1, 3), 16) / 255
  const g = parseInt(h6.slice(3, 5), 16) / 255
  const b = parseInt(h6.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return { h: 0, s: 0, l: l * 100 }
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
  else if (max === g) h = ((b - r) / d + 2) / 6
  else h = ((r - g) / d + 4) / 6
  return { h: h * 360, s: s * 100, l: l * 100 }
}

export function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(((h % 360) + 360) % 360)}, ${Math.round(Math.max(0, Math.min(100, s)))}%, ${Math.round(Math.max(0, Math.min(100, l)))}%)`
}

/** Derived theme tokens from primary + accent brand hexes */
export function deriveTheme(primary: string, accent: string): Record<string, string> {
  const p = hexToHsl(primary)
  return {
    '--primary': normalizeHex(primary),
    '--primary-dark': hsl(p.h, p.s, Math.max(10, p.l - 12)),
    '--primary-light': hsl(p.h, p.s, Math.min(88, p.l + 18)),
    '--accent': normalizeHex(accent),
    '--brand-ink': hsl(p.h + 5, 47, 20),
    // Dark background gradient stops derived from the primary hue
    '--bg-grad-1': hsl(p.h + 5, 47, 20),
    '--bg-grad-2': hsl(p.h + 3, 48, 31),
    '--bg-grad-3': hsl(p.h + 24, 60, 33),
    '--bg-grad-4': hsl(p.h - 25, 52, 25),
  }
}
