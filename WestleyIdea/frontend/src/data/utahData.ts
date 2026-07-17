// Utah-specific cost data for the mortgage calculator.
//
// Property tax: Utah taxes primary residences on 55% of market value (the 45%
// residential exemption, Utah Code §59-2-103). The county rates below are
// EFFECTIVE rates on full market value for a primary residence - the exemption
// is already baked in. Approximate 2024-2025 county averages; actual rates vary
// by tax district within each county.
//
// Homeowners insurance: the county benchmarks are 2026 quoted averages for
// $300,000 dwelling coverage, $300,000 liability, and a $1,000 deductible.
// A home's purchase price is only a planning proxy for its replacement cost;
// the calculator scales the benchmark by the selected price and keeps the
// result editable. It is not an insurance quote.

export interface UtahCounty {
  name: string
  taxRate: number // effective annual rate on market value (primary residence)
  insuranceAnnualAt300k: number
}

export const UTAH_COUNTIES: Record<string, UtahCounty> = {
  'salt-lake':  { name: 'Salt Lake County',  taxRate: 0.0060, insuranceAnnualAt300k: 1779 },
  'utah':       { name: 'Utah County',        taxRate: 0.0052, insuranceAnnualAt300k: 1792 },
  'davis':      { name: 'Davis County',       taxRate: 0.0058, insuranceAnnualAt300k: 1802 },
  'weber':      { name: 'Weber County',       taxRate: 0.0064, insuranceAnnualAt300k: 1895 },
  'washington': { name: 'Washington County',  taxRate: 0.0048, insuranceAnnualAt300k: 1734 },
  'cache':      { name: 'Cache County',       taxRate: 0.0053, insuranceAnnualAt300k: 1858 },
  'tooele':     { name: 'Tooele County',      taxRate: 0.0063, insuranceAnnualAt300k: 1874 },
  'box-elder':  { name: 'Box Elder County',   taxRate: 0.0057, insuranceAnnualAt300k: 1921 },
  'iron':       { name: 'Iron County',        taxRate: 0.0050, insuranceAnnualAt300k: 1888 },
  'summit':     { name: 'Summit County',      taxRate: 0.0037, insuranceAnnualAt300k: 1919 },
  'wasatch':    { name: 'Wasatch County',     taxRate: 0.0044, insuranceAnnualAt300k: 2044 },
  'juab':       { name: 'Juab County',        taxRate: 0.0058, insuranceAnnualAt300k: 1788 },
  'sanpete':    { name: 'Sanpete County',     taxRate: 0.0052, insuranceAnnualAt300k: 1771 },
  'sevier':     { name: 'Sevier County',      taxRate: 0.0055, insuranceAnnualAt300k: 1821 },
  'carbon':     { name: 'Carbon County',      taxRate: 0.0066, insuranceAnnualAt300k: 1830 },
  'uintah':     { name: 'Uintah County',      taxRate: 0.0048, insuranceAnnualAt300k: 1765 },
  'duchesne':   { name: 'Duchesne County',    taxRate: 0.0050, insuranceAnnualAt300k: 1766 },
  'morgan':     { name: 'Morgan County',      taxRate: 0.0050, insuranceAnnualAt300k: 1836 },
  'grand':      { name: 'Grand County',       taxRate: 0.0055, insuranceAnnualAt300k: 1764 },
  'kane':       { name: 'Kane County',        taxRate: 0.0040, insuranceAnnualAt300k: 1757 },
  'other':      { name: 'Other Utah County',  taxRate: 0.0055, insuranceAnnualAt300k: 1814 },
}

export const DEFAULT_COUNTY = 'salt-lake'

const INSURANCE_COVERAGE_BANDS: ReadonlyArray<readonly [number, number]> = [
  [200_000, 0.775],
  [300_000, 1],
  [400_000, 1.152],
  [600_000, 1.587],
  [1_000_000, 2.302],
]

/**
 * Planning estimate based on the county's quoted $300k-coverage benchmark.
 * Home price is used as a replacement-cost proxy and should be replaced with
 * the insurer's dwelling-coverage quote when one is available.
 */
export function estimateAnnualHomeownersInsurance(countyKey: string, homePrice: number): number {
  const county = UTAH_COUNTIES[countyKey] ?? UTAH_COUNTIES[DEFAULT_COUNTY]
  if (!Number.isFinite(homePrice) || homePrice <= 0) return 0

  const bands = INSURANCE_COVERAGE_BANDS
  let multiplier: number
  if (homePrice <= bands[0][0]) {
    multiplier = bands[0][1] * homePrice / bands[0][0]
  } else {
    const upperIndex = bands.findIndex(([coverage]) => homePrice <= coverage)
    if (upperIndex === -1) {
      const [lowerCoverage, lowerMultiplier] = bands[bands.length - 2]
      const [upperCoverage, upperMultiplier] = bands[bands.length - 1]
      multiplier = upperMultiplier + (homePrice - upperCoverage)
        * (upperMultiplier - lowerMultiplier) / (upperCoverage - lowerCoverage)
    } else {
      const [upperCoverage, upperMultiplier] = bands[upperIndex]
      const [lowerCoverage, lowerMultiplier] = bands[upperIndex - 1]
      multiplier = lowerMultiplier + (homePrice - lowerCoverage)
        * (upperMultiplier - lowerMultiplier) / (upperCoverage - lowerCoverage)
    }
  }

  return Math.max(0, Math.round(county.insuranceAnnualAt300k * multiplier))
}

// Statewide averages (Insurance Information Institute / EIA / HOA-USA, 2024-25)
export const UTAH_AVERAGES = {
  insuranceAnnual: 1150,   // homeowners insurance, $/yr
  hoaMonthly: 235,         // typical for homes that have an HOA
  utilitiesMonthly: 240,   // electricity, gas, water, trash
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
