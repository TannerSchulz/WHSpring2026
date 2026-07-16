import test from 'node:test'
import assert from 'node:assert/strict'

import {
  adjustedLoanAmount,
  annualAverageScheduledBalance,
  calcPI,
  downPaymentWarnings,
  estimatedPmiAnnualRate,
  fhaAnnualMipRate,
  firstYearMortgageInsurance,
  maxLoanFromPI,
  minimumDownPercent,
  monthsUntilBalanceRatio,
  mortgageInsuranceDurationMonths,
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
