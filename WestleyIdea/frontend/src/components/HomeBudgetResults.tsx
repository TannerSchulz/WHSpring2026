import { useEffect, useMemo, useState } from 'react'
import { MortgageInput } from '../types'
import { STATE_DATA } from '../data/stateData'
import { FALLBACK_RATES, LiveRates, UTAH_COUNTIES, estimateAnnualHomeownersInsurance } from '../data/utahData'
import { computePaymentScenario } from '../utils/mortgageMath'
import { Branding } from '../types/branding'
import BrandMark from './BrandMark'

interface Props { profile: MortgageInput; onBack: () => void; branding: Branding }

const TIERS = [
  { ratio: .25, label: 'Low', className: 'low' },
  { ratio: .33, label: 'Average', className: 'average' },
  { ratio: .40, label: 'Stretch', className: 'stretch' },
]

const money = (n: number) => Math.round(n).toLocaleString()

export default function HomeBudgetResults({ profile, onBack, branding }: Props) {
  const [rates, setRates] = useState<LiveRates | null>(null)

  useEffect(() => {
    fetch('/api/utah-rates').then(r => r.ok ? r.json() : Promise.reject()).then(setRates).catch(() => setRates(null))
  }, [])

  const location = useMemo(() => {
    if (profile.state === 'UT') {
      const county = UTAH_COUNTIES[profile.county ?? 'other'] ?? UTAH_COUNTIES.other
      return { taxRate: county.taxRate, insurance: (price: number) => estimateAnnualHomeownersInsurance(profile.county ?? 'other', price), label: county.name, precision: 'Utah county estimate' }
    }
    const state = STATE_DATA[profile.state ?? 'UT'] ?? STATE_DATA.UT
    return { taxRate: state.propertyTaxRate, insurance: () => state.avgInsuranceAnnual, label: `${profile.county} County, ${state.name}`, precision: 'State-average estimate' }
  }, [profile])

  const rate = rates?.rate_30yr ?? FALLBACK_RATES['30']
  const planningIncome = profile.income_source === 'schooling' && profile.expected_salary
    ? profile.expected_salary : profile.annual_income

  const scenarios = TIERS.map(tier => {
    const paymentBudget = Math.max(0, planningIncome / 12 * tier.ratio - profile.monthly_debts)
    let low = 0
    let high = 3_000_000
    for (let i = 0; i < 45; i++) {
      const price = (low + high) / 2
      const down = Math.min(profile.available_savings ?? 0, price)
      const annualInsurance = location.insurance(price)
      const result = computePaymentScenario({
        homePrice: price, downDollars: down, loanType: profile.loan_type,
        termYears: 30, ratePct: rate, annualTax: price * location.taxRate,
        annualInsurance, annualIncome: planningIncome, monthlyDebts: profile.monthly_debts,
        creditScore: profile.credit_score,
      })
      if (result.total <= paymentBudget) low = price
      else high = price
    }
    const homePrice = Math.max(0, Math.floor(low / 1000) * 1000)
    const down = Math.min(profile.available_savings ?? 0, homePrice)
    const detail = computePaymentScenario({ homePrice, downDollars: down, loanType: profile.loan_type, termYears: 30, ratePct: rate, annualTax: homePrice * location.taxRate, annualInsurance: location.insurance(homePrice), annualIncome: planningIncome, monthlyDebts: profile.monthly_debts, creditScore: profile.credit_score })
    return { ...tier, homePrice, detail }
  })

  return <div className="budget-page">
    <nav className="budget-nav"><BrandMark branding={branding} size="sm" /><button className="btn-back" onClick={onBack}>← Start over</button></nav>
    <header className="budget-header"><div className="budget-kicker">Your personalized estimate</div><h1>Your Home Budget</h1><p>Three planning ranges based on your income, debts, savings, loan type, and location.</p></header>
    <div className="budget-location"><strong>{location.label}</strong><span>{location.precision} · {rate.toFixed(2)}% 30-year planning rate</span></div>
    <div className="budget-cards">{scenarios.map(item => <article className={`budget-card budget-card--${item.className}`} key={item.ratio}>
      <div className="budget-card-top"><span className="budget-percent">{Math.round(item.ratio * 100)}%</span><span className="budget-label">{item.label}</span></div>
      <div className="budget-home"><span>Estimated home price</span><strong>${money(item.homePrice)}</strong></div>
      <div className="budget-payment"><span>Estimated monthly payment</span><strong>${money(item.detail.total)}</strong></div>
      <div className="budget-breakdown">
        <div><span>Principal &amp; interest</span><b>${money(item.detail.pi)}</b></div>
        <div><span>Property tax</span><b>${money(item.detail.monthlyTax)}</b></div>
        <div><span>Home insurance</span><b>${money(item.detail.monthlyInsurance)}</b></div>
        <div><span>{profile.loan_type === 'conventional' ? 'PMI' : 'Mortgage insurance / fee'}</span><b>{item.detail.mortgageInsurance > 0 ? `$${money(item.detail.mortgageInsurance)}` : 'None'}</b></div>
      </div>
    </article>)}</div>
    <div className="budget-note">The percentages represent the share of gross monthly income available for housing and existing monthly debts combined. These are planning estimates—not loan offers. Taxes and insurance vary by property, and the final rate depends on lender underwriting.</div>
  </div>
}
