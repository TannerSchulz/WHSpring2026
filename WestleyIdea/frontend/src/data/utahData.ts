// Utah-specific cost data for the mortgage calculator.
//
// Property tax: Utah taxes primary residences on 55% of market value (the 45%
// residential exemption, Utah Code §59-2-103). The county rates below are
// EFFECTIVE rates on full market value for a primary residence — the exemption
// is already baked in. Approximate 2024–2025 county averages; actual rates vary
// by tax district within each county.

export interface UtahCounty {
  name: string
  taxRate: number // effective annual rate on market value (primary residence)
}

export const UTAH_COUNTIES: Record<string, UtahCounty> = {
  'salt-lake':  { name: 'Salt Lake County',  taxRate: 0.0060 },
  'utah':       { name: 'Utah County',        taxRate: 0.0052 },
  'davis':      { name: 'Davis County',       taxRate: 0.0058 },
  'weber':      { name: 'Weber County',       taxRate: 0.0064 },
  'washington': { name: 'Washington County',  taxRate: 0.0048 },
  'cache':      { name: 'Cache County',       taxRate: 0.0053 },
  'tooele':     { name: 'Tooele County',      taxRate: 0.0063 },
  'box-elder':  { name: 'Box Elder County',   taxRate: 0.0057 },
  'iron':       { name: 'Iron County',        taxRate: 0.0050 },
  'summit':     { name: 'Summit County',      taxRate: 0.0037 },
  'wasatch':    { name: 'Wasatch County',     taxRate: 0.0044 },
  'juab':       { name: 'Juab County',        taxRate: 0.0058 },
  'sanpete':    { name: 'Sanpete County',     taxRate: 0.0052 },
  'sevier':     { name: 'Sevier County',      taxRate: 0.0055 },
  'carbon':     { name: 'Carbon County',      taxRate: 0.0066 },
  'uintah':     { name: 'Uintah County',      taxRate: 0.0048 },
  'duchesne':   { name: 'Duchesne County',    taxRate: 0.0050 },
  'morgan':     { name: 'Morgan County',      taxRate: 0.0050 },
  'grand':      { name: 'Grand County',       taxRate: 0.0055 },
  'kane':       { name: 'Kane County',        taxRate: 0.0040 },
  'other':      { name: 'Other Utah County',  taxRate: 0.0055 },
}

export const DEFAULT_COUNTY = 'salt-lake'

// Statewide averages (Insurance Information Institute / EIA / HOA-USA, 2024–25)
export const UTAH_AVERAGES = {
  insuranceAnnual: 1150,   // homeowners insurance, $/yr
  hoaMonthly: 235,         // typical for homes that have an HOA
  utilitiesMonthly: 240,   // electricity, gas, water, trash
}

// Conventional PMI annual rate by credit score (approximate industry averages)
export function pmiAnnualRate(creditScore: number): number {
  if (creditScore >= 760) return 0.0038
  if (creditScore >= 720) return 0.0055
  if (creditScore >= 680) return 0.0085
  if (creditScore >= 640) return 0.0115
  return 0.014
}

// Fallbacks if the live Freddie Mac PMMS feed is unreachable
export const FALLBACK_RATES: Record<string, number> = {
  '30': 6.4,
  '20': 6.2,
  '15': 5.8,
  '10': 5.7,
}

export interface LiveRates {
  rate_30yr: number
  rate_15yr: number
  as_of: string
  source: string
  live: boolean
}

// PMMS surveys 30yr and 15yr only; 20yr and 10yr are estimated from spreads.
export function rateForTerm(rates: LiveRates | null, term: string): { rate: number; estimated: boolean } {
  if (!rates) return { rate: FALLBACK_RATES[term] ?? 6.4, estimated: true }
  switch (term) {
    case '30': return { rate: rates.rate_30yr, estimated: false }
    case '15': return { rate: rates.rate_15yr, estimated: false }
    case '20': return { rate: Math.round((rates.rate_30yr - 0.2) * 100) / 100, estimated: true }
    case '10': return { rate: Math.round((rates.rate_15yr - 0.1) * 100) / 100, estimated: true }
    default:   return { rate: rates.rate_30yr, estimated: true }
  }
}
