import { useState, useEffect, useRef } from 'react'
import { MortgageInput } from '../types'
import { STATE_DATA, CURRENT_RATES } from '../data/stateData'

interface Props {
  onSubmit: (data: MortgageInput) => void
  loading: boolean
  onFieldCommit: (field: string, value: string | number) => void
}

const LOAN_OPTIONS = [
  { value: 'conventional', name: 'Conventional', desc: 'Standard loan, 3%+ down' },
  { value: 'fha',          name: 'FHA',          desc: 'Flexible credit, 3.5% down' },
  { value: 'va',           name: 'VA',            desc: 'Veterans, no down payment' },
  { value: 'usda',         name: 'USDA',          desc: 'Rural areas, no down payment' },
]

export const STEPS = [
  { field: 'annual_income',    question: "What's your annual income?",                 hint: 'Before taxes — include all sources of income.',               prefix: '$', placeholder: '75,000',  type: 'currency'    },
  { field: 'monthly_debts',    question: "What are your monthly debt payments?",        hint: 'Car loans, student loans, credit cards — not rent. Enter 0 if none.', prefix: '$', placeholder: '500', type: 'currency' },
  { field: 'credit_score',     question: "What's your credit score?",                   hint: 'Check Credit Karma or your bank app for a free estimate.',    prefix: null, placeholder: '700',    type: 'number'      },
  { field: 'employment_years', question: "How long have you been at your current job?",  hint: 'Lenders like to see at least 2 years of steady employment.',  prefix: null, placeholder: null,     type: 'employment'  },
  { field: 'home_price',       question: "What's the home price you have in mind?",     hint: 'Enter your target purchase price.',                           prefix: '$', placeholder: '350,000', type: 'currency'    },
  { field: 'down_payment',     question: "How much can you put down?",                  hint: 'A larger down payment improves your odds and lowers your rate.', prefix: '$', placeholder: '35,000', type: 'currency'  },
  { field: 'loan_type',        question: "Which loan type interests you?",              hint: 'Not sure? Conventional works for most buyers.',               prefix: null, placeholder: null,     type: 'select'      },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseCurrency(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? NaN : n
}

function fmt(n: number): string { return Math.round(n).toLocaleString() }

function calcMonthlyPI(loan: number, annualRatePct: number, termYears: number): number {
  if (loan <= 0 || annualRatePct <= 0) return 0
  const r = annualRatePct / 100 / 12
  const n = termYears * 12
  return loan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1)
}

function maxLoanFromPI(targetPI: number, annualRatePct: number, termYears: number): number {
  if (targetPI <= 0 || annualRatePct <= 0) return 0
  const r = annualRatePct / 100 / 12
  const n = termYears * 12
  return targetPI * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n))
}

function calcMaxHomePrice(
  budgetMonthly: number,
  taxRate: number,
  annualInsurance: number,
  downPct = 0.1,
  rate = CURRENT_RATES['30'],
  termYears = 30,
): number {
  let homePrice = 400000
  for (let i = 0; i < 12; i++) {
    const loan = homePrice * (1 - downPct)
    const pmi = downPct < 0.2 ? loan * 0.0075 / 12 : 0
    const mTax = homePrice * taxRate / 12
    const mIns = annualInsurance / 12
    const availablePI = budgetMonthly - mTax - mIns - pmi
    if (availablePI <= 0) return 0
    const newLoan = maxLoanFromPI(availablePI, rate, termYears)
    homePrice = newLoan / (1 - downPct)
  }
  return Math.max(0, Math.round(homePrice / 5000) * 5000)
}

function estimateTotalMonthly(
  homePrice: number,
  down: number,
  taxRate: number,
  annualInsurance: number,
  rate = CURRENT_RATES['30'],
  termYears = 30,
): number {
  const loan = homePrice - down
  if (loan <= 0) return 0
  const pi = calcMonthlyPI(loan, rate, termYears)
  const ltv = (loan / homePrice) * 100
  const pmi = ltv > 80 ? loan * 0.0075 / 12 : 0
  return Math.round(pi + pmi + (homePrice * taxRate / 12) + (annualInsurance / 12))
}

function getMinDownPct(loanType: string): number {
  if (loanType === 'va' || loanType === 'usda') return 0
  if (loanType === 'fha') return 0.035
  return 0.03
}

// ── Sub-flow types ────────────────────────────────────────────────────────────

type SubFlowType = 'home_price' | 'down_payment'

interface SubAnswers {
  budget?: number
  budgetDisplay?: string
  state?: string
  savings?: number
  savingsDisplay?: string
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MortgageForm({ onSubmit, loading, onFieldCommit }: Props) {
  const [step, setStep] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [values, setValues] = useState<Partial<MortgageInput>>({ loan_type: 'conventional' })
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
      setTimeout(() => subInputRef.current?.focus(), 350)
      return
    }
    if (current.type === 'employment') {
      setTimeout(() => employYearsRef.current?.focus(), 350)
    } else if (current.type !== 'select') {
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [step, subFlow, subStep, current.type])

  // ── Validation ──────────────────────────────────────────────────────────────

  const isValid = (): boolean => {
    if (current.type === 'select') return !!values.loan_type
    if (current.type === 'employment') {
      const y = parseInt(employYears) || 0
      const m = parseInt(employMonths) || 0
      return y >= 0 && m >= 0 && m <= 11
    }
    if (current.type === 'currency') {
      const n = parseCurrency(displayValues[current.field] ?? '')
      if (current.field === 'monthly_debts') return !isNaN(n) && n >= 0
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
      if (subStep === 1) return !!subAnswers.state
    }
    if (subFlow === 'down_payment') {
      if (subStep === 0) return subAnswers.savings !== undefined && subAnswers.savings >= 0
    }
    return true
  }

  // ── Advance main flow ───────────────────────────────────────────────────────

  const animate = (cb: () => void) => {
    setAnimating(true)
    setTimeout(() => { cb(); setAnimating(false) }, 280)
  }

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
      setValues(v => ({ ...v, [current.field]: val }))
      onFieldCommit(current.field, val)
    } else {
      onFieldCommit(current.field, values[current.field as keyof MortgageInput] as number)
    }

    if (step < STEPS.length - 1) {
      animate(() => setStep(s => s + 1))
    } else {
      const finalValues = { ...values }
      if (current.type === 'currency') {
        const n = parseCurrency(displayValues[current.field] ?? '')
        ;(finalValues as Record<string, number>)[current.field] = isNaN(n) ? 0 : n
      }
      onSubmit(finalValues as MortgageInput)
    }
  }

  const back = () => {
    if (step === 0) return
    animate(() => setStep(s => s - 1))
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
    const selectedState = subAnswers.state
    setValues(v => ({ ...v, home_price: price, ...(selectedState ? { state: selectedState } : {}) }))
    setDisplayValues(prev => ({ ...prev, home_price: fmt(price) }))
    onFieldCommit('home_price', price)
    setSubFlow(null)
    setSubStep(0)
    setSubAnswers({})
    animate(() => setStep(s => s + 1))
  }

  const selectDownPayment = (amount: number) => {
    setValues(v => ({ ...v, down_payment: amount }))
    setDisplayValues(prev => ({ ...prev, down_payment: fmt(amount) }))
    onFieldCommit('down_payment', amount)
    setSubFlow(null)
    setSubStep(0)
    setSubAnswers({})
    animate(() => setStep(s => s + 1))
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
    if (subStep === 0) {
      return (
        <>
          <div className="sub-flow-crumb">🏡 Figuring out home price</div>
          <div className="step-question">What's your comfortable monthly housing budget?</div>
          <div className="step-hint">Include everything — principal, interest, taxes, insurance, and any HOA.</div>
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
          {values.annual_income && (
            <div className="sub-flow-hint">
              28% rule suggests: <strong>${fmt(values.annual_income / 12 * 0.28)}/mo</strong>
            </div>
          )}
        </>
      )
    }

    if (subStep === 1) {
      return (
        <>
          <div className="sub-flow-crumb">🏡 Figuring out home price</div>
          <div className="step-question">Which state are you looking to buy in?</div>
          <div className="step-hint">We'll use the average property tax and insurance rates for that state.</div>
          <select
            className="sub-state-select"
            value={subAnswers.state ?? ''}
            onChange={e => setSubAnswers(prev => ({ ...prev, state: e.target.value }))}
          >
            <option value="">— Select a state —</option>
            {Object.entries(STATE_DATA)
              .sort((a, b) => a[1].name.localeCompare(b[1].name))
              .map(([code, data]) => (
                <option key={code} value={code}>{data.name}</option>
              ))}
          </select>
          {subAnswers.state && (
            <div className="sub-flow-hint">
              Avg. tax: <strong>{(STATE_DATA[subAnswers.state].propertyTaxRate * 100).toFixed(2)}%/yr</strong>
              &nbsp;·&nbsp; Avg. insurance: <strong>${fmt(STATE_DATA[subAnswers.state].avgInsuranceAnnual)}/yr</strong>
            </div>
          )}
        </>
      )
    }

    // Step 2: pick from options
    const budget = subAnswers.budget ?? 2500
    const state = subAnswers.state
    const taxRate = state ? STATE_DATA[state].propertyTaxRate : 0.01
    const insurance = state ? STATE_DATA[state].avgInsuranceAnnual : 1500

    const maxPrice = calcMaxHomePrice(budget, taxRate, insurance, 0.1)
    const options = [
      { label: 'Conservative', badge: 'More breathing room', factor: 0.70, color: 'option-green' },
      { label: 'Comfortable',  badge: 'Recommended',         factor: 0.85, color: 'option-blue', recommended: true },
      { label: 'Stretch',      badge: 'At your limit',       factor: 1.00, color: 'option-orange' },
    ].map(opt => {
      const price = Math.round(maxPrice * opt.factor / 5000) * 5000
      const down = Math.round(price * 0.1)
      const monthly = estimateTotalMonthly(price, down, taxRate, insurance)
      return { ...opt, price, down, monthly }
    }).filter(o => o.price > 0)

    return (
      <>
        <div className="sub-flow-crumb">🏡 Figuring out home price</div>
        <div className="step-question">Here's what fits your budget</div>
        <div className="step-hint">
          Based on ${fmt(budget)}/mo budget in {state ? STATE_DATA[state].name : 'your state'}, assuming 10% down at {CURRENT_RATES['30']}% for 30 years.
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

  // ── Sub-flow: down payment ──────────────────────────────────────────────────

  const renderDownPaymentSubFlow = () => {
    if (subStep === 0) {
      return (
        <>
          <div className="sub-flow-crumb">💰 Figuring out down payment</div>
          <div className="step-question">How much do you have saved for a down payment?</div>
          <div className="step-hint">Enter your total savings available for the home purchase. We'll show you what different amounts mean for your monthly payment.</div>
          <div className="input-wrap">
            <span className="input-prefix">$</span>
            <input
              ref={subInputRef}
              className="step-input"
              type="text"
              inputMode="numeric"
              placeholder="30,000"
              value={subAnswers.savingsDisplay ?? ''}
              onChange={e => handleSubCurrencyChange('savings', 'savingsDisplay', e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') advanceSubFlow() }}
            />
          </div>
        </>
      )
    }

    // Step 1: show scenarios
    const homePrice = values.home_price ?? 350000
    const loanType = values.loan_type ?? 'conventional'
    const savings = subAnswers.savings ?? 0
    const minDownPct = getMinDownPct(loanType)

    const buildScenario = (downAmt: number, label: string, badge: string, color: string, recommended?: boolean) => {
      if (downAmt > homePrice) return null
      const loan = homePrice - downAmt
      const pi = calcMonthlyPI(loan, CURRENT_RATES['30'], 30)
      const ltv = (loan / homePrice) * 100
      const pmi = ltv > 80 ? Math.round(loan * 0.0075 / 12) : 0
      return { downAmt, label, badge, color, recommended, pi: Math.round(pi), pmi, ltv, noPmi: ltv <= 80 }
    }

    const rawScenarios = [
      buildScenario(Math.round(homePrice * minDownPct), 'Minimum Required', minDownPct === 0 ? 'No down payment' : `${(minDownPct * 100).toFixed(1)}% down`, 'option-orange'),
      homePrice * 0.05 > homePrice * minDownPct + 1000 ? buildScenario(Math.round(homePrice * 0.05), '5% Down', '5% down', 'option-yellow') : null,
      buildScenario(Math.round(homePrice * 0.10), '10% Down', '10% down', 'option-blue', true),
      buildScenario(Math.round(homePrice * 0.20), '20% Down — No PMI', '20% down · no PMI', 'option-green'),
    ]

    // Add "what you saved" if it's a meaningfully different amount
    const savedScenario = savings > 0 && !rawScenarios.some(s => s && Math.abs(s.downAmt - savings) < 1000)
      ? buildScenario(savings, 'What You Have Saved', `${((savings / homePrice) * 100).toFixed(1)}% down`, 'option-purple')
      : null
    if (savedScenario) rawScenarios.push(savedScenario)

    const scenarios = rawScenarios.filter(Boolean) as NonNullable<ReturnType<typeof buildScenario>>[]

    return (
      <>
        <div className="sub-flow-crumb">💰 Figuring out down payment</div>
        <div className="step-question">Here's what different down payments look like</div>
        <div className="step-hint">
          For a <strong>${fmt(homePrice)}</strong> home at {CURRENT_RATES['30']}% / 30 years. P&amp;I + PMI only — taxes &amp; insurance not included.
        </div>
        <div className="down-scenario-cards">
          {scenarios.map(s => (
            <button
              key={s.label}
              className={`down-scenario-card ${s.color}${s.recommended ? ' recommended' : ''}`}
              onClick={() => selectDownPayment(s.downAmt)}
            >
              {s.recommended && <div className="price-option-rec-banner">★ Common Choice</div>}
              <div className="down-scenario-top">
                <div className="down-scenario-amount">${fmt(s.downAmt)}</div>
                <div className={`down-scenario-pmi-badge${s.noPmi ? ' no-pmi' : ''}`}>
                  {s.noPmi ? '✓ No PMI' : `+$${fmt(s.pmi)}/mo PMI`}
                </div>
              </div>
              <div className="down-scenario-label">{s.label}</div>
              <div className="down-scenario-payment">
                ~${fmt(s.pi + s.pmi)}/mo <span className="down-scenario-payment-note">P&amp;I{s.pmi > 0 ? ' + PMI' : ''}</span>
              </div>
              <div className="down-scenario-badge">{s.badge}</div>
              <div className="price-option-cta">Select →</div>
            </button>
          ))}
        </div>
      </>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const progress = ((step + 1) / STEPS.length) * 100
  const isLastSubStep = subFlow === 'home_price' && subStep === 2
                     || subFlow === 'down_payment' && subStep === 1

  const renderMainInput = () => {
    if (current.type === 'select') {
      return (
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
      return (
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

      <div className={`step${animating ? ' exit' : ''}`} key={`${step}-${subFlow}-${subStep}`}>
        {!subFlow && (
          <>
            <div className="step-counter">Step {step + 1} of {STEPS.length}</div>
            <div className="step-question">{current.question}</div>
            <div className="step-hint">{current.hint}</div>
            {renderMainInput()}

            {/* "Not sure?" alternatives */}
            {current.field === 'home_price' && (
              <button className="not-sure-btn" onClick={() => enterSubFlow('home_price')}>
                🤔 Not sure what price to target? Help me figure it out
              </button>
            )}
            {current.field === 'down_payment' && (
              <button className="not-sure-btn" onClick={() => enterSubFlow('down_payment')}>
                🤔 Not sure how much to put down? Show me my options
              </button>
            )}
          </>
        )}

        {subFlow === 'home_price' && renderHomePriceSubFlow()}
        {subFlow === 'down_payment' && renderDownPaymentSubFlow()}

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
