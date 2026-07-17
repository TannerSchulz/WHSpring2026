import test from 'node:test'
import assert from 'node:assert/strict'

import {
  adjustedLoanAmount,
  affordableHomePrice,
  annualAverageScheduledBalance,
  calcPI,
  computePaymentScenario,
  downPaymentWarnings,
  estimatedPmiAnnualRate,
  estimateMonthlyCost,
  fhaAnnualMipRate,
  firstYearMortgageInsurance,
  maxLoanFromPI,
  minimumDownPercent,
  monthsUntilBalanceRatio,
  mortgageInsuranceDurationMonths,
  payoffWithExtra,
  totalScheduledMortgageInsurance,
  upfrontFeeRate,
  vaFundingFeeRate,
} from '../.test-dist/mortgageMath.js'

const closeTo = (actual, expected, tolerance = 0.01) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`)
}

test('principal and interest handles standard, zero-rate, cash, and inverse cases', () => {
  closeTo(calcPI(300_000, 6.5, 30), 1896.20, 0.01)
  closeTo(calcPI(120_000, 0, 10), 1000)
  assert.equal(calcPI(0, 6.5, 30), 0)
  assert.equal(calcPI(300_000, -1, 30), 0)
  closeTo(maxLoanFromPI(calcPI(425_000, 6.25, 30), 6.25, 30), 425_000, 0.01)
})

test('program minimum down payments honor FHA score boundaries and zero-down programs', () => {
  assert.equal(minimumDownPercent('conventional', 720), 0.03)
  assert.equal(minimumDownPercent('fha', 580), 0.035)
  assert.equal(minimumDownPercent('fha', 579), 0.10)
  assert.equal(minimumDownPercent('fha', 499), 0.10)
  assert.equal(minimumDownPercent('va', 720), 0)
  assert.equal(minimumDownPercent('usda', 720), 0)
})

test('VA funding fee boundaries, prior usage, and exemptions are exact', () => {
  assert.equal(vaFundingFeeRate(0.049999, 'first'), 0.0215)
  assert.equal(vaFundingFeeRate(0.049999, 'subsequent'), 0.033)
  assert.equal(vaFundingFeeRate(0.05, 'first'), 0.015)
  assert.equal(vaFundingFeeRate(0.099999, 'subsequent'), 0.015)
  assert.equal(vaFundingFeeRate(0.10, 'subsequent'), 0.0125)
  assert.equal(vaFundingFeeRate(0, 'subsequent', true), 0)
  assert.equal(upfrontFeeRate('va', 0, { vaUsage: 'subsequent' }), 0.033)
})

test('financed fees apply only to a positive mortgage balance', () => {
  closeTo(adjustedLoanAmount(300_000, 'fha', 0.035), 305_250)
  closeTo(adjustedLoanAmount(300_000, 'usda', 0), 303_000)
  closeTo(adjustedLoanAmount(300_000, 'va', 0, { vaFundingFeeExempt: true }), 300_000)
  assert.equal(adjustedLoanAmount(0, 'fha', 0.035), 0)
})

test('FHA annual MIP rate handles term, LTV, and high-balance boundaries', () => {
  assert.equal(fhaAnnualMipRate(726_200, 96, 30), 0.0055)
  assert.equal(fhaAnnualMipRate(726_201, 96, 30), 0.0075)
  assert.equal(fhaAnnualMipRate(500_000, 95, 30), 0.0050)
  assert.equal(fhaAnnualMipRate(800_000, 95, 30), 0.0070)
  assert.equal(fhaAnnualMipRate(500_000, 90, 15), 0.0015)
  assert.equal(fhaAnnualMipRate(800_000, 90, 15), 0.0040)
  assert.equal(fhaAnnualMipRate(800_000, 78, 15), 0.0015)
})

test('scheduled balances and FHA/USDA annual charges decline over time', () => {
  const loan = 404_000
  const yearOne = annualAverageScheduledBalance(loan, 6.5, 30, 1)
  const yearTwo = annualAverageScheduledBalance(loan, 6.5, 30, 2)
  assert.ok(yearOne < loan)
  assert.ok(yearTwo < yearOne)

  const usdaFirst = firstYearMortgageInsurance(400_000, loan, 100, 'usda', 30, 6.5, 720)
  const usdaTotal = totalScheduledMortgageInsurance(
    400_000, loan, 100, 'usda', 30, 6.5, 720, 0, null,
  )
  assert.ok(usdaFirst > 0)
  assert.ok(usdaTotal > 0)
  assert.ok(usdaTotal < usdaFirst * 360)
})

test('mortgage insurance durations honor FHA 10% and conventional cancellation rules', () => {
  assert.equal(mortgageInsuranceDurationMonths('fha', 0.099999, 30, null), 360)
  assert.equal(mortgageInsuranceDurationMonths('fha', 0.10, 30, null), 132)
  assert.equal(mortgageInsuranceDurationMonths('fha', 0.10, 10, null), 120)
  assert.equal(mortgageInsuranceDurationMonths('usda', 0, 30, null), 360)
  assert.equal(mortgageInsuranceDurationMonths('va', 0, 30, null), 0)
  assert.equal(mortgageInsuranceDurationMonths('conventional', 0.05, 30, 91), 91)
})

test('conventional PMI stops at 80% LTV and accepts an actual monthly quote', () => {
  assert.equal(firstYearMortgageInsurance(320_000, 320_000, 80, 'conventional', 30, 6.5, 720), 0)
  assert.ok(firstYearMortgageInsurance(320_040, 320_040, 80.01, 'conventional', 30, 6.5, 720) > 0)
  assert.equal(firstYearMortgageInsurance(380_000, 380_000, 95, 'conventional', 30, 6.5, 720, 143), 143)
  assert.ok(estimatedPmiAnnualRate(760, 85) < estimatedPmiAnnualRate(640, 85))
  assert.ok(estimatedPmiAnnualRate(720, 90) < estimatedPmiAnnualRate(720, 97))
})

test('PMI request timing at 80% precedes automatic termination at scheduled 78%', () => {
  const requestMonth = monthsUntilBalanceRatio(380_000, 400_000, 6.5, 30, 0.80)
  const automaticMonth = monthsUntilBalanceRatio(380_000, 400_000, 6.5, 30, 0.78)
  assert.ok(requestMonth > 0)
  assert.ok(automaticMonth > requestMonth)
  assert.equal(monthsUntilBalanceRatio(320_000, 400_000, 6.5, 30, 0.80), 0)
})

test('program warnings cover ineligible and conditional edge cases', () => {
  assert.match(downPaymentWarnings('fha', 0.10, 499).join(' '), /below a 500/i)
  assert.match(downPaymentWarnings('fha', 0.035, 579).join(' '), /at least 10%/i)
  assert.match(downPaymentWarnings('fha', 0.034, 580).join(' '), /at least 3.5%/i)
  assert.match(downPaymentWarnings('conventional', 0.03, 720).join(' '), /requirements/i)
  assert.match(downPaymentWarnings('va', 0, 720).join(' '), /eligibility/i)
  assert.match(downPaymentWarnings('usda', 0, 720).join(' '), /property-location/i)
})

// ── Full payment scenarios (the composition the calculator UI displays) ──────

test('conventional 20%-down scenario matches hand-computed payment, total, and DTI', () => {
  // $450k home, $90k down, 6.5%/30yr, $2,700/yr tax, $1,150/yr insurance,
  // $240 utilities, $375 maintenance, $95k income, $450 debts.
  // P&I on $360k: 360000 × r / (1 − (1+r)^−360), r = 0.065/12 → $2,275.44
  const s = computePaymentScenario({
    homePrice: 450_000, downDollars: 90_000, loanType: 'conventional',
    termYears: 30, ratePct: 6.5, annualTax: 2_700, annualInsurance: 1_150,
    monthlyUtilities: 240, monthlyMaintenance: 375,
    annualIncome: 95_000, monthlyDebts: 450, creditScore: 720,
  })
  closeTo(s.pi, 2275.44, 0.01)
  assert.equal(s.mortgageInsurance, 0) // 80% LTV - no PMI
  assert.equal(s.baseLoan, 360_000)
  assert.equal(s.adjustedLoan, 360_000)
  closeTo(s.ltv, 80, 1e-9)
  // 2275.44 + 0 + 225 + 95.83 + 0 + 240 + 375
  closeTo(s.total, 3211.28, 0.02)
  // Housing ratio excludes utilities/maintenance: (2275.44+225+95.83)/7916.67
  closeTo(s.frontEndDTI, 32.80, 0.01)
  closeTo(s.backEndDTI, 38.48, 0.01)
  // Scheduled interest simulated month-by-month independently: $459,160
  closeTo(s.totalInterest, 459_160, 1)
  assert.equal(s.pmiRequestMonth, null)
  assert.equal(s.totalScheduledMortgageInsurance, 0)
})

test('FHA 3.5%-down scenario finances UFMIP and charges MIP on the base-equivalent balance', () => {
  const s = computePaymentScenario({
    homePrice: 400_000, downDollars: 14_000, loanType: 'fha',
    termYears: 30, ratePct: 6.5, annualTax: 2_400, annualInsurance: 1_150,
    creditScore: 680,
  })
  assert.equal(s.baseLoan, 386_000)
  closeTo(s.adjustedLoan, 386_000 * 1.0175, 0.01) // 392,755
  closeTo(s.ltv, 96.5, 1e-9)
  // P&I must be charged on the adjusted (UFMIP-financed) loan
  closeTo(s.pi, calcPI(392_755, 6.5, 30), 0.01)
  // First-year MIP: 0.55%/yr on the year-1 average base-equivalent balance ≈ $176.02
  closeTo(s.mortgageInsurance, 176.02, 0.05)
  assert.equal(s.pmiRequestMonth, null) // FHA has no PMI-cancellation months
  // <10% down → MIP scheduled for the full term, so total MI is large but finite
  assert.ok(s.totalScheduledMortgageInsurance > 30_000)
  assert.equal(s.frontEndDTI, null) // no income given
})

test('VA exempt scenario has no financed fee and no monthly mortgage insurance', () => {
  const s = computePaymentScenario({
    homePrice: 400_000, downDollars: 0, loanType: 'va',
    termYears: 30, ratePct: 6.5, annualTax: 2_400, annualInsurance: 1_150,
    feeOptions: { vaFundingFeeExempt: true },
  })
  assert.equal(s.adjustedLoan, 400_000)
  assert.equal(s.mortgageInsurance, 0)
  assert.equal(s.totalScheduledMortgageInsurance, 0)
})

test('cash purchase produces zero loan figures and only carrying costs', () => {
  const s = computePaymentScenario({
    homePrice: 300_000, downDollars: 300_000, loanType: 'conventional',
    termYears: 30, ratePct: 6.5, annualTax: 1_800, annualInsurance: 1_150,
  })
  assert.equal(s.pi, 0)
  assert.equal(s.totalInterest, 0)
  closeTo(s.total, 1_800 / 12 + 1_150 / 12, 0.01)
})

// ── Monthly cost and affordability solver ────────────────────────────────────

test('estimateMonthlyCost matches hand-computed conventional PITI', () => {
  // $400k, 20% down: P&I on $320k @6.5/30 = $2,022.62; tax $200; ins $95.83
  const cost = estimateMonthlyCost(400_000, 80_000, {
    loanType: 'conventional', ratePct: 6.5, termYears: 30,
    taxRate: 0.0060, annualInsurance: 1_150, creditScore: 720,
  })
  closeTo(cost, 2022.62 + 200 + 95.83, 0.05)
})

test('affordableHomePrice inverts estimateMonthlyCost across programs', () => {
  const cases = [
    { downPct: 0.10, opts: { loanType: 'conventional', ratePct: 6.5, termYears: 30, taxRate: 0.0060, annualInsurance: 1_150, monthlyUtilities: 240, creditScore: 720 } },
    { downPct: 0.035, opts: { loanType: 'fha', ratePct: 7.0, termYears: 30, taxRate: 0.0052, annualInsurance: 1_150, creditScore: 660 } },
    { downPct: 0, opts: { loanType: 'usda', ratePct: 6.0, termYears: 30, taxRate: 0.0055, annualInsurance: 1_150, monthlyHoa: 100 } },
    { downPct: 0, opts: { loanType: 'va', ratePct: 6.5, termYears: 15, taxRate: 0.0060, annualInsurance: 1_150, feeOptions: { vaUsage: 'subsequent' } } },
  ]
  for (const { downPct, opts } of cases) {
    const target = 2_500
    const price = affordableHomePrice(target, downPct, opts)
    assert.ok(price > 0, `${opts.loanType} solver found no price`)
    const roundTrip = estimateMonthlyCost(price, price * downPct, opts)
    closeTo(roundTrip, target, 1)
  }
})

test('affordableHomePrice returns 0 when fixed costs already exceed the budget', () => {
  assert.equal(affordableHomePrice(300, 0.10, {
    loanType: 'conventional', ratePct: 6.5, termYears: 30,
    taxRate: 0.0060, annualInsurance: 1_150, monthlyUtilities: 240, monthlyHoa: 250,
  }), 0)
  assert.equal(affordableHomePrice(0, 0.10, {
    loanType: 'conventional', ratePct: 6.5, termYears: 30,
    taxRate: 0.0060, annualInsurance: 1_150,
  }), 0)
})

// ── Extra-payment payoff ──────────────────────────────────────────────────────

test('payoffWithExtra matches the schedule with no extra and shortens it with extra', () => {
  const noExtra = payoffWithExtra(360_000, 6.5, 30, 0)
  assert.equal(noExtra.months, 360)
  closeTo(noExtra.interest, 459_160, 1) // independently simulated schedule

  const withExtra = payoffWithExtra(360_000, 6.5, 30, 200)
  assert.equal(withExtra.months, 287)   // independently simulated
  closeTo(withExtra.interest, 350_243, 5)
  assert.ok(withExtra.interest < noExtra.interest)
})

test('payoffWithExtra amortizes zero-rate loans by simple division', () => {
  const p = payoffWithExtra(120_000, 0, 10, 1_000)
  assert.equal(p.months, 60) // $1,000 P&I + $1,000 extra on $120k
  closeTo(p.interest, 0, 1e-9)
})
