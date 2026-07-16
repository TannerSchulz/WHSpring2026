import { useState, useEffect, useRef } from 'react'
import { MortgageInput } from '../types'
import { UTAH_COUNTIES, DEFAULT_COUNTY, UTAH_AVERAGES, FALLBACK_RATES } from '../data/utahData'
import {
  adjustedLoanAmount,
  affordableHomePrice,
  calcPI,
  downPaymentWarnings,
  estimateMonthlyCost,
  firstYearMortgageInsurance,
  minimumDownPercent,
  type LoanType,
} from '../utils/mortgageMath'

interface Props {
  onSubmit: (data: MortgageInput) => void
  loading: boolean
  onFieldCommit: (field: string, value: string | number) => void
}

const LOAN_OPTIONS = [
  { value: 'conventional', name: 'Conventional', desc: 'As little as 3% for eligible borrowers' },
  { value: 'fha',          name: 'FHA',          desc: '3.5% with 580+ score; 10% at 500–579' },
  { value: 'va',           name: 'VA',            desc: 'Eligible service members, often 0% down' },
  { value: 'usda',         name: 'USDA',          desc: 'Eligible rural homes and households, 0% down' },
]

export const STEPS = [
  { field: 'annual_income',    question: "What's your annual income?",                 hint: 'Before taxes — include all sources of income.',               prefix: '$', placeholder: '75,000',  type: 'currency'    },
  { field: 'monthly_debts',    question: "What are your monthly debt payments?",        hint: 'Car loans, student loans, credit cards — not rent. Enter 0 if none.', prefix: '$', placeholder: '500', type: 'currency' },
  { field: 'credit_score',     question: "What's your credit score?",                   hint: 'Check Credit Karma or your bank app for a free estimate.',    prefix: null, placeholder: '700',    type: 'number'      },
  { field: 'employment_years', question: "How long have you had steady employment or qualifying income?", hint: 'Include recent jobs in the same field. A shorter history does not automatically disqualify you.', prefix: null, placeholder: null, type: 'employment' },
  { field: 'home_price',       question: "What's the home price you have in mind?",     hint: 'Enter your target purchase price.',                           prefix: '$', placeholder: '350,000', type: 'currency'    },
  { field: 'loan_type',        question: "Which loan type interests you?",              hint: 'Not sure? Conventional works for most buyers.',               prefix: null, placeholder: null,     type: 'select'      },
  { field: 'available_savings',question: "How much do you have saved for a down payment?", hint: "Enter zero if you're starting out. We'll keep this separate from any hypothetical down-payment option you explore.", prefix: '$', placeholder: '35,000', type: 'currency' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCurrency(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? NaN : n
}

function fmt(n: number): string { return Math.round(n).toLocaleString() }

// Planning assumptions for the "help me figure out a price" sub-flow: it runs
// before a loan program is chosen, so it prices a 30-year conventional loan with
// 10% down using the credit score already collected earlier in the quiz.
function subFlowCostOptions(taxRate: number, annualInsurance: number, creditScore: number) {
  return {
    loanType: 'conventional' as LoanType,
    ratePct: FALLBACK_RATES['30'],
    termYears: 30,
    taxRate,
    annualInsurance,
    creditScore,
  }
}

// What lenders count as recurring debt for DTI, per Fannie Mae B3-6-05 and
// HUD 4000.1. Shown under the monthly-debts question so the number entered
// matches what underwriting will actually use.
const DEBT_GUIDE_INCLUDE = [
  ['Car loans or leases', ''],
  ['Minimum credit-card payments', 'just the minimums, not what you actually pay'],
  ['Student loans', 'count these even if deferred — lenders use the payment on your credit report, or 0.5–1% of the balance if it shows $0'],
  ['Personal or installment loans', ''],
  ['Child support or alimony you pay', ''],
  ['Mortgage payments on properties you\'ll keep', ''],
  ['Loans you co-signed', 'unless the other person has 12 months of documented on-time payments'],
]

const DEBT_GUIDE_EXCLUDE = [
  ['Rent, or a mortgage you\'re replacing with this purchase', ''],
  ['Utilities, phone, internet, and streaming services', ''],
  ['Car insurance, health insurance, groceries, gas, and childcare', ''],
  ['401(k) or retirement-account loans', ''],
]

function DebtsGuide() {
  return (
    <div className="debts-guide">
      <div className="debts-guide-title">What counts as a monthly debt?</div>
      <div className="debts-guide-cols">
        <div className="debts-guide-col">
          <div className="debts-guide-head include">✓ Include</div>
          <ul>
            {DEBT_GUIDE_INCLUDE.map(([item, note]) => (
              <li key={item}>{item}{note && <span className="debts-guide-note"> — {note}</span>}</li>
            ))}
          </ul>
        </div>
        <div className="debts-guide-col">
          <div className="debts-guide-head exclude">✗ Leave out</div>
          <ul>
            {DEBT_GUIDE_EXCLUDE.map(([item, note]) => (
              <li key={item}>{item}{note && <span className="debts-guide-note"> — {note}</span>}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="debts-guide-footer">
        Lenders use these debts (not living expenses) to calculate your debt-to-income ratio, a key qualifying number.
      </div>
    </div>
  )
}

// ── Sub-flow types ────────────────────────────────────────────────────────────

type SubFlowType = 'home_price'

interface SubAnswers {
  budget?: number
  budgetDisplay?: string
  county?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MortgageForm({ onSubmit, loading, onFieldCommit }: Props) {
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Partial<MortgageInput>>({
    loan_type: 'conventional',
    va_usage: 'first',
    va_funding_fee_exempt: false,
  })
  const [displayValues, setDisplayValues] = useState<Record<string, string>>({})
  const [employYears, setEmployYears] = useState<string>('')
  const [employMonths, setEmployMonths] = useState<string>('')

  // Sub-flow state
  const [subFlow, setSubFlow] = useState<SubFlowType | null>(null)
  const [subStep, setSubStep] = useState(0)
  const [subAnswers, setSubAnswers] = useState<SubAnswers>({})

  const inputRef = useRef<HTMLInputElement>(null)
  const employYearsRef = useRef<HTMLInputElement>(null)
  const subInputRef = useRef<HTMLInputElement>(null)

  const current = STEPS[step]

  useEffect(() => {
    if (subFlow) {
      subInputRef.current?.focus()
      return
    }
    if (current.type === 'employment') {
      employYearsRef.current?.focus()
    } else if (current.type !== 'select') {
      inputRef.current?.focus()
    }
  }, [step, subFlow, subStep, current.type])

  // ── Validation ──────────────────────────────────────────────────────────────

  const isValid = (): boolean => {
    if (current.type === 'select') return !!values.loan_type
    if (current.type === 'employment') {
      const y = parseInt(employYears) || 0
      const m = parseInt(employMonths) || 0
      return (employYears !== '' || employMonths !== '') && y >= 0 && m >= 0 && m <= 11
    }
    if (current.type === 'currency') {
      const n = parseCurrency(displayValues[current.field] ?? '')
      if (current.field === 'monthly_debts') return !isNaN(n) && n >= 0
      if (current.field === 'available_savings') return !isNaN(n) && n >= 0
      return !isNaN(n) && n > 0
    }
    const v = values[current.field as keyof MortgageInput]
    if (current.field === 'credit_score') {
      const n = Number(v)
      return n >= 300 && n <= 850
    }
    return v !== undefined && Number(v) > 0
  }

  const isSubValid = (): boolean => {
    if (subFlow === 'home_price') {
      if (subStep === 0) return !!subAnswers.budget && subAnswers.budget > 0
      if (subStep === 1) return !!subAnswers.county
    }
    return true
  }

  // ── Advance main flow ───────────────────────────────────────────────────────

  const commitAndAdvance = () => {
    if (!isValid()) return

    if (current.type === 'employment') {
      const y = parseInt(employYears) || 0
      const m = parseInt(employMonths) || 0
      const total = y + m / 12
      setValues(v => ({ ...v, employment_years: total }))
      onFieldCommit('employment_years', total)
    } else if (current.type === 'select') {
      onFieldCommit('loan_type', values.loan_type ?? 'conventional')
    } else if (current.type === 'currency') {
      const n = parseCurrency(displayValues[current.field] ?? '')
      const val = isNaN(n) ? 0 : n
      const selectedDown = current.field === 'available_savings'
        ? Math.min(val, values.home_price ?? val)
        : val
      setValues(v => current.field === 'available_savings'
        ? ({ ...v, available_savings: val, down_payment: selectedDown })
        : ({ ...v, [current.field]: val }))
      onFieldCommit(current.field, val)
      if (current.field === 'available_savings') onFieldCommit('down_payment', selectedDown)
    } else {
      onFieldCommit(current.field, values[current.field as keyof MortgageInput] as number)
    }

    if (step < STEPS.length - 1) {
      setStep(s => s + 1)
    } else {
      const finalValues = { ...values }
      if (current.type === 'currency') {
        const n = parseCurrency(displayValues[current.field] ?? '')
        ;(finalValues as Record<string, number>)[current.field] = isNaN(n) ? 0 : n
        if (current.field === 'available_savings') {
          finalValues.down_payment = Math.min(isNaN(n) ? 0 : n, finalValues.home_price ?? (isNaN(n) ? 0 : n))
        }
      }
      onSubmit(finalValues as MortgageInput)
    }
  }
  const back = () => {
    if (step === 0) return
    setStep(s => s - 1)
  }

  // ── Sub-flow advance ────────────────────────────────────────────────────────

  const advanceSubFlow = () => {
    if (!isSubValid()) return
    setSubStep(s => s + 1)
  }

  const backSubFlow = () => {
    if (subStep === 0) {
      setSubFlow(null)
      setSubStep(0)
    } else {
      setSubStep(s => s - 1)
    }
  }

  const selectHomePrice = (price: number) => {
    const selectedCounty = subAnswers.county ?? DEFAULT_COUNTY
    setValues(v => ({ ...v, home_price: price, state: 'UT', county: selectedCounty }))
    setDisplayValues(prev => ({ ...prev, home_price: fmt(price) }))
    onFieldCommit('home_price', price)
    setSubFlow(null)
    setSubStep(0)
    setSubAnswers({})
    setStep(s => s + 1)
  }

  const selectDownPayment = (amount: number, savings: number) => {
    setValues(v => ({ ...v, available_savings: savings, down_payment: amount }))
    setDisplayValues(prev => ({ ...prev, available_savings: fmt(savings) }))
    onFieldCommit('available_savings', savings)
    onFieldCommit('down_payment', amount)
    onSubmit({
      ...values,
      available_savings: savings,
      down_payment: amount,
    } as MortgageInput)
  }

  const enterSubFlow = (type: SubFlowType) => {
    setSubFlow(type)
    setSubStep(0)
    setSubAnswers({})
  }

  // ── Currency change ─────────────────────────────────────────────────────────

  const handleCurrencyChange = (field: string, raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '')
    setDisplayValues(prev => ({ ...prev, [field]: cleaned ? Number(cleaned).toLocaleString() : '' }))
    const n = parseFloat(cleaned)
    setValues(v => ({ ...v, [field]: isNaN(n) ? undefined : n }))
  }

  const handleSubCurrencyChange = (key: keyof SubAnswers, displayKey: keyof SubAnswers, raw: string) => {
    const cleaned = raw.replace(/[^\d]/g, '')
    const n = parseFloat(cleaned)
    setSubAnswers(prev => ({
      ...prev,
      [displayKey]: cleaned ? Number(cleaned).toLocaleString() : '',
      [key]: isNaN(n) ? undefined : n,
    }))
  }

  // ── Sub-flow: home price ────────────────────────────────────────────────────

  const renderHomePriceSubFlow = () => {
    const monthlyGross = (values.annual_income ?? 0) / 12
    const planningPayment = monthlyGross > 0
      ? Math.max(0, Math.round(Math.min(
        monthlyGross * 0.28,
        monthlyGross * 0.43 - (values.monthly_debts ?? 0),
      )))
      : 0

    if (subStep === 0) {
      return (
        <>
          <div className="sub-flow-crumb">🏡 Figuring out home price</div>
          <div className="step-question">What's your comfortable monthly housing budget?</div>
          <div className="step-hint">Principal, interest, property taxes, and homeowner's insurance. If the home may have an HOA fee, leave room for it in this number.</div>
          <div className="input-wrap">
            <span className="input-prefix">$</span>
            <input
              ref={subInputRef}
              className="step-input"
              type="text"
              inputMode="numeric"
              placeholder="2,500"
              value={subAnswers.budgetDisplay ?? ''}
              onChange={e => handleSubCurrencyChange('budget', 'budgetDisplay', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') advanceSubFlow() }}
            />
            <span className="input-suffix">/mo</span>
          </div>
          {planningPayment > 0 && (
            <div className="sub-flow-hint">
              Planning start after the debts entered: <strong>${fmt(planningPayment)}/mo</strong>. This is a budgeting guide, not an approval limit.
            </div>
          )}
        </>
      )
    }

    if (subStep === 1) {
      return (
        <>
          <div className="sub-flow-crumb">🏡 Figuring out home price</div>
          <div className="step-question">Which Utah county are you looking to buy in?</div>
          <div className="step-hint">We'll use that county's property tax rate and Utah's average insurance cost.</div>
          <select
            className="sub-state-select"
            value={subAnswers.county ?? ''}
            onChange={e => setSubAnswers(prev => ({ ...prev, county: e.target.value }))}
          >
            <option value="">— Select a county —</option>
            {Object.entries(UTAH_COUNTIES).map(([key, c]) => (
              <option key={key} value={key}>{c.name}</option>
            ))}
          </select>
          {subAnswers.county && (
            <div className="sub-flow-hint">
              County planning tax rate: <strong>{(UTAH_COUNTIES[subAnswers.county].taxRate * 100).toFixed(2)}%/yr</strong>
              &nbsp;·&nbsp; Avg. insurance: <strong>${fmt(UTAH_AVERAGES.insuranceAnnual)}/yr</strong>
              <br />Actual tax-area rate, assessed value, and insurance quote will vary.
            </div>
          )}
        </>
      )
    }

    // Step 2: pick from options
    const budget = subAnswers.budget ?? 2500
    const county = subAnswers.county ?? DEFAULT_COUNTY
    const taxRate = UTAH_COUNTIES[county].taxRate
    const insurance = UTAH_AVERAGES.insuranceAnnual
    const costOptions = subFlowCostOptions(taxRate, insurance, values.credit_score ?? 720)

    const maxPrice = Math.floor(affordableHomePrice(budget, 0.10, costOptions) / 5000) * 5000
    const options = [
      { label: 'Conservative', badge: 'More breathing room', factor: 0.70, color: 'option-green' },
      { label: 'Comfortable',  badge: 'Recommended',         factor: 0.85, color: 'option-blue', recommended: true },
      { label: 'Stretch',      badge: 'At your limit',       factor: 1.00, color: 'option-orange' },
    ].map(opt => {
      const price = Math.round(maxPrice * opt.factor / 5000) * 5000
      const down = Math.round(price * 0.1)
      const monthly = Math.round(estimateMonthlyCost(price, down, costOptions))
      return { ...opt, price, down, monthly }
    }).filter(o => o.price > 0)

    return (
      <>
        <div className="sub-flow-crumb">🏡 Figuring out home price</div>
        <div className="step-question">Here's what fits your budget</div>
        <div className="step-hint">
          Based on ${fmt(budget)}/mo budget in {UTAH_COUNTIES[county].name}, assuming 10% down at {FALLBACK_RATES['30']}% for 30 years.
        </div>
        <div className="price-option-cards">
          {options.map(opt => (
            <button
              key={opt.label}
              className={`price-option-card ${opt.color}${opt.recommended ? ' recommended' : ''}`}
              onClick={() => selectHomePrice(opt.price)}
            >
              {opt.recommended && <div className="price-option-rec-banner">★ Recommended</div>}
              <div className="price-option-label">{opt.label}</div>
              <div className="price-option-price">${fmt(opt.price)}</div>
              <div className="price-option-detail">~${fmt(opt.monthly)}/mo total</div>
              <div className="price-option-down">~${fmt(opt.down)} down (10%)</div>
              <div className="price-option-cta">Select this price →</div>
            </button>
          ))}
        </div>
      </>
    )
  }

  // ── Inline down-payment scenarios ───────────────────────────────────────────

  const renderDownPaymentOptions = (savings: number) => {
    const homePrice = values.home_price ?? 350000
    const loanType = (values.loan_type ?? 'conventional') as LoanType
    const creditScore = values.credit_score ?? 720
    const minDownPct = minimumDownPercent(loanType, creditScore)
    const rate = FALLBACK_RATES['30']
    const feeOptions = {
      vaUsage: values.va_usage,
      vaFundingFeeExempt: values.va_funding_fee_exempt,
    }

    const buildScenario = (downAmt: number, label: string, badge: string, color: string) => {
      if (downAmt > homePrice) return null
      const baseLoan = Math.max(0, homePrice - downAmt)
      const downPct = homePrice > 0 ? downAmt / homePrice : 0
      const adjustedLoan = adjustedLoanAmount(baseLoan, loanType, downPct, feeOptions)
      const ltv = homePrice > 0 ? (baseLoan / homePrice) * 100 : 0
      const pi = calcPI(adjustedLoan, rate, 30)
      const mi = firstYearMortgageInsurance(
        baseLoan, adjustedLoan, ltv, loanType, 30, rate, creditScore,
      )
      return {
        downAmt, label, badge, color, pi: Math.round(pi), mi: Math.round(mi),
        shortfall: Math.max(0, downAmt - savings),
        warnings: downPaymentWarnings(loanType, downPct, creditScore),
      }
    }

    const rawScenarios = [
      buildScenario(Math.round(homePrice * minDownPct), 'Program Starting Point', minDownPct === 0 ? 'No down payment' : `${(minDownPct * 100).toFixed(1)}% down`, 'option-orange'),
      homePrice * 0.05 > homePrice * minDownPct + 1000 ? buildScenario(Math.round(homePrice * 0.05), '5% Down', '5% down', 'option-yellow') : null,
      buildScenario(Math.round(homePrice * 0.10), '10% Down', '10% down', 'option-blue'),
      buildScenario(Math.round(homePrice * 0.20), '20% Down', '20% down', 'option-green'),
    ]

    // Preserve a distinct "what you saved" scenario, including a valid $0 case.
    const savedScenario = !rawScenarios.some(s => s && Math.abs(s.downAmt - savings) < 1000)
      ? buildScenario(savings, 'What You Have Saved', `${((savings / homePrice) * 100).toFixed(1)}% down`, 'option-purple')
      : null
    if (savedScenario) rawScenarios.push(savedScenario)

    const scenarios = rawScenarios
      .filter((scenario): scenario is NonNullable<typeof scenario> => scenario !== null)
      .filter((scenario, index, all) => all.findIndex(other => other.downAmt === scenario.downAmt) === index)

    const insuranceLabel = (mi: number) => {
      if (loanType === 'va') return 'No monthly mortgage insurance'
      if (loanType === 'conventional') return mi > 0 ? `~$${fmt(mi)}/mo estimated PMI` : 'No PMI'
      if (loanType === 'fha') return `~$${fmt(mi)}/mo FHA MIP`
      return `~$${fmt(mi)}/mo USDA annual fee`
    }

    return (
      <>
        <div className="step-hint" style={{ marginTop: '1.25rem' }}>
          For a <strong>${fmt(homePrice)}</strong> home using a {rate}% planning rate and the selected {loanType.toUpperCase()} program. Taxes and homeowner's insurance are added in the full calculator.
        </div>
        <div className="down-scenario-cards">
          {scenarios.map(s => (
            <button
              key={`${s.label}-${s.downAmt}`}
              className={`down-scenario-card ${s.color}`}
              onClick={() => selectDownPayment(s.downAmt, savings)}
            >
              <div className="down-scenario-top">
                <div className="down-scenario-amount">${fmt(s.downAmt)}</div>
                <div className={`down-scenario-pmi-badge${s.mi === 0 ? ' no-pmi' : ''}`}>
                  {insuranceLabel(s.mi)}
                </div>
              </div>
              <div className="down-scenario-label">{s.label}</div>
              <div className="down-scenario-payment">
                ~${fmt(s.pi + s.mi)}/mo <span className="down-scenario-payment-note">P&amp;I{s.mi > 0 ? ' + mortgage insurance/fee' : ''}</span>
              </div>
              <div className="down-scenario-badge">{s.badge}</div>
              <div className="down-scenario-payment-note">
                {s.shortfall > 0 ? `$${fmt(s.shortfall)} more than you currently have saved` : 'Within your saved amount'}
              </div>
              {s.warnings.map(warning => (
                <div key={warning} className="down-scenario-warning">{warning}</div>
              ))}
              <div className="price-option-cta">Explore this option →</div>
            </button>
          ))}
        </div>
      </>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const progress = ((step + 1) / STEPS.length) * 100
  const isLastSubStep = subFlow === 'home_price' && subStep === 2

  const renderMainInput = () => {
    if (current.type === 'select') {
      return (
        <>
          <div className="loan-options">
            {LOAN_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`loan-option${values.loan_type === opt.value ? ' selected' : ''}`}
                onClick={() => setValues(v => ({ ...v, loan_type: opt.value as MortgageInput['loan_type'] }))}
              >
                <div className="loan-option-name">{opt.name}</div>
                <div className="loan-option-desc">{opt.desc}</div>
              </button>
            ))}
          </div>
          {values.loan_type === 'va' && (
            <div className="conditional-loan-details">
              <div className="step-hint">These details change the VA funding fee. Your Certificate of Eligibility determines the final status.</div>
              <div className="conditional-loan-row">
                <span className="conditional-loan-label">VA loan usage</span>
                <div className="conditional-loan-actions">
                  <button type="button" className={`loan-detail-btn${values.va_usage !== 'subsequent' ? ' selected' : ''}`}
                    onClick={() => setValues(v => ({ ...v, va_usage: 'first' }))}>First use</button>
                  <button type="button" className={`loan-detail-btn${values.va_usage === 'subsequent' ? ' selected' : ''}`}
                    onClick={() => setValues(v => ({ ...v, va_usage: 'subsequent' }))}>Subsequent use</button>
                </div>
              </div>
              <div className="conditional-loan-row">
                <span className="conditional-loan-label">Funding-fee status</span>
                <div className="conditional-loan-actions">
                  <button type="button" className={`loan-detail-btn${!values.va_funding_fee_exempt ? ' selected' : ''}`}
                    onClick={() => setValues(v => ({ ...v, va_funding_fee_exempt: false }))}>Not exempt / unsure</button>
                  <button type="button" className={`loan-detail-btn${values.va_funding_fee_exempt ? ' selected' : ''}`}
                    onClick={() => setValues(v => ({ ...v, va_funding_fee_exempt: true }))}>Exempt</button>
                </div>
              </div>
            </div>
          )}
        </>
      )
    }

    if (current.type === 'employment') {
      const y = parseInt(employYears) || 0
      const m = parseInt(employMonths) || 0
      const totalYears = y + m / 12
      return (
        <div className="employment-wrap">
          <div className="employment-inputs">
            <div className="employment-field">
              <input
                ref={employYearsRef}
                className="employment-input"
                type="number" inputMode="numeric"
                min="0" max="40" placeholder="0"
                value={employYears}
                onChange={e => setEmployYears(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') commitAndAdvance() }}
              />
              <span className="employment-unit">years</span>
            </div>
            <div className="employment-sep">and</div>
            <div className="employment-field">
              <input
                className="employment-input"
                type="number" inputMode="numeric"
                min="0" max="11" placeholder="0"
                value={employMonths}
                onChange={e => setEmployMonths(String(Math.min(11, Math.max(0, parseInt(e.target.value) || 0))))}
                onKeyDown={e => { if (e.key === 'Enter') commitAndAdvance() }}
              />
              <span className="employment-unit">months</span>
            </div>
          </div>
          {(y > 0 || m > 0) && (
            <div className="employment-summary">
              = {totalYears < 1
                  ? `${m} month${m !== 1 ? 's' : ''}`
                  : `${y} year${y !== 1 ? 's' : ''}${m > 0 ? ` ${m} month${m !== 1 ? 's' : ''}` : ''}`}
            </div>
          )}
        </div>
      )
    }

    if (current.type === 'currency') {
      const enteredAmount = parseCurrency(displayValues[current.field] ?? '')
      const savingsCoverPrice = current.field === 'available_savings'
        && !!values.home_price
        && enteredAmount >= values.home_price
      return (
        <>
          <div className="input-wrap">
            {current.prefix && <span className="input-prefix">{current.prefix}</span>}
            <input
              ref={inputRef}
              className="step-input"
              type="text" inputMode="numeric"
              placeholder={current.placeholder ?? ''}
              value={displayValues[current.field] ?? ''}
              onChange={e => handleCurrencyChange(current.field, e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') commitAndAdvance() }}
            />
          </div>
          {savingsCoverPrice && (
            <div className="step-hint" style={{ marginTop: '0.5rem' }}>
              Your savings cover the full purchase price. You can still choose a smaller down payment to compare mortgage options.
            </div>
          )}
          {current.field === 'available_savings'
            && (displayValues[current.field] ?? '') !== ''
            && !isNaN(enteredAmount)
            && enteredAmount >= 0 && (
            renderDownPaymentOptions(enteredAmount)
          )}
        </>
      )
    }

    return (
      <div className="input-wrap">
        {current.prefix && <span className="input-prefix">{current.prefix}</span>}
        <input
          ref={inputRef}
          className={`step-input${current.prefix ? '' : ' no-prefix'}`}
          type="number" inputMode="numeric"
          placeholder={current.placeholder ?? ''}
          value={(values[current.field as keyof MortgageInput] as number) ?? ''}
          onChange={e => {
            const v = e.target.value === '' ? undefined : Number(e.target.value)
            setValues(prev => ({ ...prev, [current.field]: v }))
          }}
          onKeyDown={e => { if (e.key === 'Enter') commitAndAdvance() }}
          min={0}
        />
      </div>
    )
  }

  return (
    <div className="card">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="step" key={`${step}-${subFlow}-${subStep}`}>
        {!subFlow && (
          <>
            <div className="step-counter">Step {step + 1} of {STEPS.length}</div>
            <div className="step-question">{current.question}</div>
            <div className="step-hint">{current.hint}</div>
            {renderMainInput()}

            {current.field === 'monthly_debts' && <DebtsGuide />}

            {/* "Not sure?" alternatives */}
            {current.field === 'home_price' && (
              <button className="not-sure-btn" onClick={() => enterSubFlow('home_price')}>
                🤔 Not sure what price to target? Help me figure it out
              </button>
            )}
          </>
        )}

        {subFlow === 'home_price' && renderHomePriceSubFlow()}

        <div className="step-nav">
          {(subFlow ? true : step > 0) && (
            <button className="btn-back" type="button" onClick={subFlow ? backSubFlow : back}>
              ← Back
            </button>
          )}

          {!isLastSubStep && (
            <button
              className="btn-next"
              type="button"
              onClick={subFlow ? advanceSubFlow : commitAndAdvance}
              disabled={subFlow ? !isSubValid() : (!isValid() || loading)}
            >
              {!subFlow && step === STEPS.length - 1
                ? loading ? 'Analyzing...' : '✨ Get My Assessment'
                : 'Continue →'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
