import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { STATE_DATA } from '../data/stateData'
import { FALLBACK_RATES, LiveRates, UTAH_COUNTIES, estimateAnnualHomeownersInsurance } from '../data/utahData'
import { MortgageInput } from '../types'
import { Branding, TrackedLinkContext } from '../types/branding'
import { computePaymentScenario } from '../utils/mortgageMath'
import BrandMark from './BrandMark'
import LoanOfficerCard from './LoanOfficerCard'

interface Props {
  profile: MortgageInput
  onBack: () => void
  branding: Branding
  trackedLink: TrackedLinkContext | null
}

const TIERS = [
  { ratio: .25, label: 'Low', scenarioLabel: 'low', className: 'low' },
  { ratio: .33, label: 'Average', scenarioLabel: 'average', className: 'average' },
  { ratio: .40, label: 'Stretch', scenarioLabel: 'stretch', className: 'stretch' },
] as const

const money = (value: number) => Math.round(value).toLocaleString()

function apiSlug(slug: string): string {
  return slug.split('/').map(encodeURIComponent).join('/')
}

export default function HomeBudgetResults({ profile, onBack, branding, trackedLink }: Props) {
  const [rates, setRates] = useState<LiveRates | null>(null)
  const [ratesResolved, setRatesResolved] = useState(false)
  const [submissionState, setSubmissionState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [submissionMessage, setSubmissionMessage] = useState('')
  const submissionStarted = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    const timeout = window.setTimeout(() => controller.abort(), 8_000)
    fetch('/api/utah-rates', { signal: controller.signal })
      .then(response => response.ok ? response.json() : Promise.reject())
      .then(value => { if (active) setRates(value) })
      .catch(() => { if (active) setRates(null) })
      .finally(() => {
        window.clearTimeout(timeout)
        if (active) setRatesResolved(true)
      })
    return () => {
      active = false
      window.clearTimeout(timeout)
      controller.abort()
    }
  }, [])

  const location = useMemo(() => {
    if (profile.state === 'UT') {
      const county = UTAH_COUNTIES[profile.county ?? 'other'] ?? UTAH_COUNTIES.other
      return {
        taxRate: county.taxRate,
        insurance: (price: number) => estimateAnnualHomeownersInsurance(profile.county ?? 'other', price),
        label: county.name,
        submittedCounty: county.name,
        precision: 'Utah county estimate',
      }
    }
    const state = STATE_DATA[profile.state ?? 'UT'] ?? STATE_DATA.UT
    return {
      taxRate: state.propertyTaxRate,
      insurance: () => state.avgInsuranceAnnual,
      label: `${profile.county} County, ${state.name}`,
      submittedCounty: profile.county ?? 'Unknown',
      precision: 'State-average estimate',
    }
  }, [profile])

  const rate = rates?.rate_30yr ?? FALLBACK_RATES['30']
  const planningIncome = profile.income_source === 'schooling' && profile.expected_salary
    ? profile.expected_salary
    : profile.annual_income

  const scenarios = useMemo(() => TIERS.map(tier => {
    const paymentBudget = Math.max(0, planningIncome / 12 * tier.ratio - profile.monthly_debts)
    let low = 0
    let high = 3_000_000
    for (let index = 0; index < 45; index++) {
      const price = (low + high) / 2
      const down = Math.min(profile.available_savings ?? 0, price)
      const result = computePaymentScenario({
        homePrice: price,
        downDollars: down,
        loanType: profile.loan_type,
        termYears: 30,
        ratePct: rate,
        annualTax: price * location.taxRate,
        annualInsurance: location.insurance(price),
        annualIncome: planningIncome,
        monthlyDebts: profile.monthly_debts,
        creditScore: profile.credit_score,
      })
      if (result.total <= paymentBudget) low = price
      else high = price
    }
    const homePrice = Math.max(0, Math.floor(low / 1000) * 1000)
    const down = Math.min(profile.available_savings ?? 0, homePrice)
    const detail = computePaymentScenario({
      homePrice,
      downDollars: down,
      loanType: profile.loan_type,
      termYears: 30,
      ratePct: rate,
      annualTax: homePrice * location.taxRate,
      annualInsurance: location.insurance(homePrice),
      annualIncome: planningIncome,
      monthlyDebts: profile.monthly_debts,
      creditScore: profile.credit_score,
    })
    return { ...tier, homePrice, down, detail }
  }), [location, planningIncome, profile, rate])

  const submitToCrm = useCallback(async () => {
    if (!trackedLink || !profile.submission_reference || !profile.first_name || !profile.last_name || !profile.email) return
    submissionStarted.current = true
    setSubmissionState('saving')
    setSubmissionMessage('')

    const graduationDate = profile.graduation_date
      ? `${profile.graduation_date.length === 7 ? profile.graduation_date : profile.graduation_date.slice(0, 7)}-01`
      : null
    const response = await fetch(`/api/public/links/${apiSlug(trackedLink.slug)}/submissions`, {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        submission_reference: profile.submission_reference,
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        phone: profile.phone || null,
        state: profile.state,
        county: location.submittedCounty,
        employment_path: profile.income_source === 'schooling' ? 'specialized_schooling' : 'employment',
        employment_years: profile.income_source === 'employment' ? profile.employment_years : null,
        annual_income: profile.income_source === 'employment' ? profile.annual_income : null,
        schooling_program: profile.income_source === 'schooling' ? profile.school_program : null,
        graduation_date: profile.income_source === 'schooling' ? graduationDate : null,
        gpa: profile.income_source === 'schooling' ? profile.school_gpa : null,
        expected_income: profile.income_source === 'schooling' ? profile.expected_salary : null,
        credit_range: profile.credit_range,
        monthly_debts: profile.monthly_debts,
        available_funds: profile.available_savings ?? 0,
        loan_type: profile.loan_type,
        consent: profile.consent_to_share === true,
        website: profile.website || null,
        scenarios: scenarios.map(scenario => ({
          label: scenario.scenarioLabel,
          target_income_ratio: scenario.ratio,
          home_price: scenario.homePrice,
          monthly_payment: scenario.detail.total,
          principal_and_interest: scenario.detail.pi,
          property_tax: scenario.detail.monthlyTax,
          homeowners_insurance: scenario.detail.monthlyInsurance,
          pmi: scenario.detail.mortgageInsurance > 0 ? scenario.detail.mortgageInsurance : null,
          interest_rate: rate,
          assumptions: {
            loan_type: profile.loan_type,
            down_payment: scenario.down,
            rate_source: rates?.source ?? 'fallback planning estimate',
            rate_as_of: rates?.as_of ?? null,
            location_precision: location.precision,
          },
        })),
      }),
    })

    if (!response.ok) {
      const payload = await response.json().catch(() => null) as { detail?: string } | null
      throw new Error(typeof payload?.detail === 'string' ? payload.detail : 'Your information could not be sent.')
    }
    setSubmissionState('saved')
    setSubmissionMessage(`Your information was securely shared with ${branding.officerName || branding.companyName}.`)
  }, [branding, location, profile, rate, rates, scenarios, trackedLink])

  useEffect(() => {
    if (!trackedLink || !ratesResolved || submissionStarted.current) return
    submitToCrm().catch(error => {
      submissionStarted.current = false
      setSubmissionState('error')
      setSubmissionMessage(error instanceof Error ? error.message : 'Your information could not be sent.')
    })
  }, [ratesResolved, submitToCrm, trackedLink])

  const retrySubmission = () => {
    submissionStarted.current = false
    submitToCrm().catch(error => {
      submissionStarted.current = false
      setSubmissionState('error')
      setSubmissionMessage(error instanceof Error ? error.message : 'Your information could not be sent.')
    })
  }

  return <div className="budget-page">
    <nav className="budget-nav"><BrandMark branding={branding} size="sm" /><button className="btn-back" onClick={onBack}>← Start over</button></nav>
    <header className="budget-header"><div className="budget-kicker">Your personalized estimate</div><h1>Your Home Budget</h1><p>Three planning ranges based on your income, debts, savings, loan type, and location.</p></header>
    <div className="budget-location"><strong>{location.label}</strong><span>{location.precision} · {rate.toFixed(2)}% 30-year planning rate</span></div>
    {trackedLink && <div className={`submission-status submission-status--${submissionState}`} role="status">
      <span>{submissionState === 'saved' ? '✓' : submissionState === 'error' ? '!' : '↗'}</span>
      <div><strong>{submissionState === 'saved' ? 'Sent to your mortgage professional' : submissionState === 'error' ? 'Your results are ready, but were not sent' : 'Saving your questionnaire securely'}</strong><small>{submissionMessage || 'Your results will appear in the loan officer portal for follow-up.'}</small></div>
      {submissionState === 'error' && <button type="button" onClick={retrySubmission}>Try sending again</button>}
    </div>}
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
    <aside className="results-disclosure" aria-label="Important estimate information">
      <strong>Planning estimate—not a Loan Estimate, approval, or offer to lend.</strong>
      <span>Based on a 30-year {profile.loan_type.toUpperCase()} planning rate of {rate.toFixed(2)}%, ${money(profile.available_savings ?? 0)} in entered down-payment funds, and estimated property taxes, homeowners insurance, and mortgage insurance where applicable. Actual rates, payments, closing costs, and eligibility will vary.</span>
      <small>Rate source: {rates?.source ?? 'fallback planning estimate'} · {rates?.as_of ?? 'live feed unavailable'}</small>
    </aside>
    <section className="borrower-next-step">
      <div className="borrower-next-step-copy">
        <div className="budget-kicker">Your next step</div>
        <h2>{branding.officerName ? `Review these numbers with ${branding.officerName}` : 'Review these numbers with a mortgage professional'}</h2>
        <p>A personalized review can replace planning assumptions with current loan options, property-specific costs, and verified information.</p>
        <div className="borrower-contact-actions">
          {branding.email && <a className="borrower-contact-primary" href={`mailto:${branding.email}?subject=${encodeURIComponent('Home budget review')}&body=${encodeURIComponent('I completed your home budget planner and would like to review my results with you.')}`}>Email for a review</a>}
          {branding.phone && <a className="borrower-contact-secondary" href={`tel:${branding.phone.replace(/[^\d+]/g, '')}`}>Call {branding.phone}</a>}
        </div>
        {trackedLink && <small>Your consented questionnaire and planning results are stored in this mortgage professional&apos;s secure workspace.</small>}
      </div>
      {branding.officerName && <LoanOfficerCard branding={branding} compact />}
    </section>
  </div>
}
