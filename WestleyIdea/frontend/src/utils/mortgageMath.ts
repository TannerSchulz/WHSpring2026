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

// Amortize with an extra monthly payment - months to payoff and total interest paid
export function payoffWithExtra(
  loan: number,
  annualRatePct: number,
  termYears: number,
  extraMonthly: number,
): { months: number; interest: number } {
  if (loan <= 0 || termYears <= 0 || annualRatePct < 0) return { months: 0, interest: 0 }
  const r = annualRatePct / 100 / 12
  const pi = calcPI(loan, annualRatePct, termYears)
  let bal = loan
  let months = 0
  let interest = 0
  const maxMonths = termYears * 12
  while (bal > 0.01 && months < maxMonths) {
    const monthInterest = bal * r
    interest += monthInterest
    bal -= Math.min(pi + extraMonthly - monthInterest, bal)
    months++
  }
  return { months, interest }
}

export interface MonthlyCostOptions {
  loanType: LoanType
  ratePct: number
  termYears: number
  taxRate: number          // annual effective property-tax rate on market value
  annualInsurance: number
  monthlyHoa?: number
  monthlyUtilities?: number
  creditScore?: number
  feeOptions?: LoanFeeOptions
}

// Monthly P&I + first-year MI + taxes + insurance (+ HOA/utilities) for one price/down combo.
export function estimateMonthlyCost(
  homePrice: number,
  downDollars: number,
  opts: MonthlyCostOptions,
): number {
  if (homePrice <= 0) return 0
  const baseLoan = Math.max(0, homePrice - downDollars)
  const downPct = downDollars / homePrice
  const adjustedLoan = adjustedLoanAmount(baseLoan, opts.loanType, downPct, opts.feeOptions ?? {})
  const ltv = (baseLoan / homePrice) * 100
  const pi = calcPI(adjustedLoan, opts.ratePct, opts.termYears)
  const mi = firstYearMortgageInsurance(
    baseLoan, adjustedLoan, ltv, opts.loanType, opts.termYears, opts.ratePct,
    opts.creditScore ?? 720,
  )
  return pi + mi + homePrice * opts.taxRate / 12 + opts.annualInsurance / 12
    + (opts.monthlyHoa ?? 0) + (opts.monthlyUtilities ?? 0)
}

// Fixed-point solve for the home price whose total monthly cost matches the budget.
// P&I is paid on the ADJUSTED loan (financed FHA MIP / VA / USDA fees), so the fee
// multiplier is backed out when converting max loan → home price.
export function affordableHomePrice(
  targetMonthly: number,
  downPct: number, // fraction, 0-1
  opts: MonthlyCostOptions,
): number {
  if (targetMonthly <= 0 || downPct < 0 || downPct >= 1) return 0
  const feeMult = adjustedLoanAmount(1, opts.loanType, downPct, opts.feeOptions ?? {})
  const fixedCosts = opts.annualInsurance / 12 + (opts.monthlyHoa ?? 0) + (opts.monthlyUtilities ?? 0)
  let homePrice = 400_000
  for (let i = 0; i < 12; i++) {
    const loan = homePrice * (1 - downPct)
    const mi = firstYearMortgageInsurance(
      loan, loan * feeMult, (1 - downPct) * 100, opts.loanType, opts.termYears,
      opts.ratePct, opts.creditScore ?? 720,
    )
    const availablePI = targetMonthly - homePrice * opts.taxRate / 12 - fixedCosts - mi
    if (availablePI <= 0) return 0
    const maxAdjustedLoan = maxLoanFromPI(availablePI, opts.ratePct, opts.termYears)
    homePrice = (maxAdjustedLoan / feeMult) / (1 - downPct)
  }
  return Math.max(0, homePrice)
}

export interface PaymentScenarioInput {
  homePrice: number
  downDollars: number
  loanType: LoanType
  termYears: number
  ratePct: number
  annualTax: number
  annualInsurance: number
  monthlyHoa?: number
  monthlyUtilities?: number
  monthlyMaintenance?: number
  annualIncome?: number
  monthlyDebts?: number
  creditScore?: number
  pmiMonthlyOverride?: number | null
  feeOptions?: LoanFeeOptions
}

export interface PaymentScenario {
  baseLoan: number
  adjustedLoan: number
  ltv: number
  downPct: number
  pi: number
  mortgageInsurance: number
  monthlyTax: number
  monthlyInsurance: number
  monthlyHoa: number
  monthlyUtilities: number
  monthlyMaintenance: number
  total: number
  totalInterest: number
  pmiRequestMonth: number | null
  pmiAutomaticMonth: number | null
  totalScheduledMortgageInsurance: number
  frontEndDTI: number | null
  backEndDTI: number | null
}

// The full monthly-ownership-cost scenario shown by the payment calculator.
// DTI ratios use the qualifying housing payment (PITI + MI + HOA) - utilities
// and maintenance are ownership costs, not part of lender ratios.
export function computePaymentScenario(input: PaymentScenarioInput): PaymentScenario {
  const {
    homePrice, downDollars, loanType, termYears, ratePct,
    annualTax, annualInsurance,
  } = input
  const feeOptions = input.feeOptions ?? {}
  const creditScore = input.creditScore ?? 720
  const baseLoan = Math.max(0, homePrice - downDollars)
  const downPct = homePrice > 0 ? downDollars / homePrice : 0
  const adjustedLoan = adjustedLoanAmount(baseLoan, loanType, downPct, feeOptions)
  const ltv = homePrice > 0 ? (baseLoan / homePrice) * 100 : 0
  const pi = calcPI(adjustedLoan, ratePct, termYears)
  const mortgageInsurance = firstYearMortgageInsurance(
    baseLoan, adjustedLoan, ltv, loanType, termYears, ratePct, creditScore,
    input.pmiMonthlyOverride,
  )
  const monthlyTax = annualTax / 12
  const monthlyInsurance = annualInsurance / 12
  const monthlyHoa = input.monthlyHoa ?? 0
  const monthlyUtilities = input.monthlyUtilities ?? 0
  const monthlyMaintenance = input.monthlyMaintenance ?? 0
  const total = pi + mortgageInsurance + monthlyTax + monthlyInsurance
    + monthlyHoa + monthlyUtilities + monthlyMaintenance
  const totalInterest = pi * termYears * 12 - adjustedLoan

  const conventionalPmi = mortgageInsurance > 0 && loanType === 'conventional'
  const pmiRequestMonth = conventionalPmi
    ? monthsUntilBalanceRatio(baseLoan, homePrice, ratePct, termYears, 0.80) : null
  const pmiAutomaticMonth = conventionalPmi
    ? monthsUntilBalanceRatio(baseLoan, homePrice, ratePct, termYears, 0.78) : null

  const totalMi = totalScheduledMortgageInsurance(
    baseLoan, adjustedLoan, ltv, loanType, termYears, ratePct, creditScore, downPct,
    pmiAutomaticMonth, input.pmiMonthlyOverride,
  )

  const income = input.annualIncome ?? 0
  const debts = input.monthlyDebts ?? 0
  const qualifyingHousing = pi + mortgageInsurance + monthlyTax + monthlyInsurance + monthlyHoa
  const frontEndDTI = income > 0 ? (qualifyingHousing / (income / 12)) * 100 : null
  const backEndDTI = income > 0 ? ((qualifyingHousing + debts) / (income / 12)) * 100 : null

  return {
    baseLoan, adjustedLoan, ltv, downPct, pi, mortgageInsurance,
    monthlyTax, monthlyInsurance, monthlyHoa, monthlyUtilities, monthlyMaintenance,
    total, totalInterest, pmiRequestMonth, pmiAutomaticMonth,
    totalScheduledMortgageInsurance: totalMi, frontEndDTI, backEndDTI,
  }
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
    else if (creditScore < 580 && downPct < 0.10) warnings.push('FHA generally limits scores from 500-579 to 90% LTV, requiring at least 10% down.')
    else if (creditScore >= 580 && downPct < 0.035) warnings.push('FHA maximum financing generally requires at least 3.5% down.')
  }
  if (loanType === 'va') warnings.push('VA eligibility, entitlement, occupancy, appraisal, and lender underwriting still apply.')
  if (loanType === 'usda') warnings.push('USDA property-location and household-income eligibility still apply.')
  return warnings
}
