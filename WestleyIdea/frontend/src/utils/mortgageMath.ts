export type LoanType = 'conventional' | 'fha' | 'va' | 'usda'
export type VaUsage = 'first' | 'subsequent'

export interface LoanFeeOptions {
  vaUsage?: VaUsage
  vaFundingFeeExempt?: boolean
}

export const FHA_UPFRONT_MIP_RATE = 0.0175
export const USDA_UPFRONT_GUARANTEE_RATE = 0.01
export const USDA_ANNUAL_GUARANTEE_RATE = 0.0035
export const FHA_HIGH_BALANCE_MIP_THRESHOLD = 726_200

export function calcPI(loan: number, annualRatePct: number, termYears: number): number {
  if (loan <= 0 || termYears <= 0) return 0
  const n = termYears * 12
  if (annualRatePct === 0) return loan / n
  if (annualRatePct < 0) return 0
  const r = annualRatePct / 100 / 12
  return loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

export function maxLoanFromPI(targetPI: number, annualRatePct: number, termYears: number): number {
  if (targetPI <= 0 || termYears <= 0) return 0
  const n = termYears * 12
  if (annualRatePct === 0) return targetPI * n
  if (annualRatePct < 0) return 0
  const r = annualRatePct / 100 / 12
  return targetPI * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n))
}

export function minimumDownPercent(loanType: LoanType, creditScore = 720): number {
  if (loanType === 'va' || loanType === 'usda') return 0
  if (loanType === 'fha') return creditScore < 580 ? 0.10 : 0.035
  return 0.03
}

export function vaFundingFeeRate(
  downPct: number,
  usage: VaUsage = 'first',
  exempt = false,
): number {
  if (exempt) return 0
  if (downPct >= 0.10) return 0.0125
  if (downPct >= 0.05) return 0.015
  return usage === 'subsequent' ? 0.033 : 0.0215
}

export function upfrontFeeRate(
  loanType: LoanType,
  downPct: number,
  options: LoanFeeOptions = {},
): number {
  if (loanType === 'fha') return FHA_UPFRONT_MIP_RATE
  if (loanType === 'va') {
    return vaFundingFeeRate(downPct, options.vaUsage, options.vaFundingFeeExempt)
  }
  if (loanType === 'usda') return USDA_UPFRONT_GUARANTEE_RATE
  return 0
}

export function adjustedLoanAmount(
  baseLoan: number,
  loanType: LoanType,
  downPct: number,
  options: LoanFeeOptions = {},
): number {
  if (baseLoan <= 0) return 0
  return baseLoan * (1 + upfrontFeeRate(loanType, downPct, options))
}

export function fhaAnnualMipRate(baseLoan: number, ltv: number, termYears: number): number {
  const highBalance = baseLoan > FHA_HIGH_BALANCE_MIP_THRESHOLD
  if (termYears <= 15) {
    if (!highBalance) return ltv > 90 ? 0.0040 : 0.0015
    if (ltv <= 78) return 0.0015
    if (ltv <= 90) return 0.0040
    return 0.0065
  }
  if (!highBalance) return ltv > 95 ? 0.0055 : 0.0050
  return ltv > 95 ? 0.0075 : 0.0070
}

// Planning midpoint only. Private MI is lender/insurer-specific, so callers should
// allow a borrower or loan officer to replace this estimate with an actual quote.
export function estimatedPmiAnnualRate(creditScore: number, ltv: number): number {
  const ltvBand = ltv <= 85 ? 0 : ltv <= 90 ? 1 : ltv <= 95 ? 2 : 3
  const rates = creditScore >= 760
    ? [0.0019, 0.0028, 0.0038, 0.0055]
    : creditScore >= 720
      ? [0.0030, 0.0043, 0.0055, 0.0070]
      : creditScore >= 680
        ? [0.0050, 0.0068, 0.0085, 0.0105]
        : creditScore >= 640
          ? [0.0075, 0.0095, 0.0115, 0.0135]
          : [0.0100, 0.0120, 0.0140, 0.0160]
  return rates[ltvBand]
}

export function annualAverageScheduledBalance(
  loan: number,
  annualRatePct: number,
  termYears: number,
  yearNumber: number,
): number {
  if (loan <= 0 || yearNumber < 1 || yearNumber > termYears) return 0
  const payment = calcPI(loan, annualRatePct, termYears)
  const monthlyRate = annualRatePct / 100 / 12
  const startMonth = (yearNumber - 1) * 12
  const endMonth = Math.min(yearNumber * 12, termYears * 12)
  let balance = loan
  let sum = 0
  let count = 0

  for (let month = 0; month < endMonth; month++) {
    if (month >= startMonth) {
      sum += balance
      count++
    }
    const interest = annualRatePct === 0 ? 0 : balance * monthlyRate
    balance = Math.max(0, balance - Math.min(payment - interest, balance))
  }
  return count > 0 ? sum / count : 0
}

export function firstYearMortgageInsurance(
  baseLoan: number,
  adjustedLoan: number,
  ltv: number,
  loanType: LoanType,
  termYears: number,
  annualRatePct: number,
  creditScore: number,
  conventionalMonthlyOverride?: number | null,
): number {
  if (baseLoan <= 0) return 0
  if (loanType === 'conventional') {
    if (ltv <= 80) return 0
    if (conventionalMonthlyOverride != null && conventionalMonthlyOverride >= 0) {
      return conventionalMonthlyOverride
    }
    return baseLoan * estimatedPmiAnnualRate(creditScore, ltv) / 12
  }
  if (loanType === 'fha') {
    const averageBalance = annualAverageScheduledBalance(adjustedLoan, annualRatePct, termYears, 1)
    return averageBalance * fhaAnnualMipRate(baseLoan, ltv, termYears)
      / (1 + FHA_UPFRONT_MIP_RATE) / 12
  }
  if (loanType === 'usda') {
    const averageBalance = annualAverageScheduledBalance(adjustedLoan, annualRatePct, termYears, 1)
    return averageBalance * USDA_ANNUAL_GUARANTEE_RATE / 12
  }
  return 0
}

export function monthsUntilBalanceRatio(
  loan: number,
  homePrice: number,
  annualRatePct: number,
  termYears: number,
  targetRatio: number,
): number {
  if (loan <= 0 || homePrice <= 0 || termYears <= 0) return 0
  if (loan / homePrice <= targetRatio) return 0
  const payment = calcPI(loan, annualRatePct, termYears)
  const monthlyRate = annualRatePct / 100 / 12
  let balance = loan
  const maxMonths = termYears * 12
  for (let month = 1; month <= maxMonths; month++) {
    const interest = annualRatePct === 0 ? 0 : balance * monthlyRate
    balance = Math.max(0, balance - Math.min(payment - interest, balance))
    if (balance / homePrice <= targetRatio) return month
  }
  return maxMonths
}

export function mortgageInsuranceDurationMonths(
  loanType: LoanType,
  downPct: number,
  termYears: number,
  conventionalAutomaticMonth: number | null,
): number {
  const termMonths = termYears * 12
  if (loanType === 'va') return 0
  if (loanType === 'usda') return termMonths
  if (loanType === 'fha') return downPct >= 0.10 ? Math.min(132, termMonths) : termMonths
  return conventionalAutomaticMonth ?? 0
}

export function totalScheduledMortgageInsurance(
  baseLoan: number,
  adjustedLoan: number,
  ltv: number,
  loanType: LoanType,
  termYears: number,
  annualRatePct: number,
  creditScore: number,
  downPct: number,
  conventionalAutomaticMonth: number | null,
  conventionalMonthlyOverride?: number | null,
): number {
  if (loanType === 'va' || baseLoan <= 0) return 0
  if (loanType === 'conventional') {
    return firstYearMortgageInsurance(
      baseLoan, adjustedLoan, ltv, loanType, termYears, annualRatePct, creditScore,
      conventionalMonthlyOverride,
    ) * (conventionalAutomaticMonth ?? 0)
  }

  const durationMonths = mortgageInsuranceDurationMonths(
    loanType, downPct, termYears, conventionalAutomaticMonth,
  )
  const durationYears = Math.ceil(durationMonths / 12)
  let total = 0
  for (let year = 1; year <= durationYears; year++) {
    const monthsThisYear = Math.min(12, durationMonths - (year - 1) * 12)
    const averageBalance = annualAverageScheduledBalance(adjustedLoan, annualRatePct, termYears, year)
    const annualFee = loanType === 'fha'
      ? averageBalance * fhaAnnualMipRate(baseLoan, ltv, termYears) / (1 + FHA_UPFRONT_MIP_RATE)
      : averageBalance * USDA_ANNUAL_GUARANTEE_RATE
    total += annualFee * (monthsThisYear / 12)
  }
  return total
}

export function downPaymentWarnings(
  loanType: LoanType,
  downPct: number,
  creditScore: number,
): string[] {
  const warnings: string[] = []
  if (loanType === 'conventional') {
    if (downPct < 0.03) warnings.push('This is below the typical 3% minimum for eligible low-down-payment conventional programs.')
    else if (downPct < 0.05) warnings.push('A 3% down conventional loan has first-time-buyer, occupancy, property, and underwriting requirements.')
  }
  if (loanType === 'fha') {
    if (creditScore < 500) warnings.push('FHA standard financing is generally unavailable below a 500 decision credit score.')
    else if (creditScore < 580 && downPct < 0.10) warnings.push('FHA generally limits scores from 500–579 to 90% LTV, requiring at least 10% down.')
    else if (creditScore >= 580 && downPct < 0.035) warnings.push('FHA maximum financing generally requires at least 3.5% down.')
  }
  if (loanType === 'va') warnings.push('VA eligibility, entitlement, occupancy, appraisal, and lender underwriting still apply.')
  if (loanType === 'usda') warnings.push('USDA property-location and household-income eligibility still apply.')
  return warnings
}
