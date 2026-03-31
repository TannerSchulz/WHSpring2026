import { useState, useEffect, useRef } from 'react'
import { STATE_DATA, CURRENT_RATES, MORTGAGE_INSURANCE, RATE_DATA_DATE } from '../data/stateData'
import { MortgageInput } from '../types'

interface Props {
  onBack: () => void
  prefill?: MortgageInput | null
  isDemoRun?: boolean
  demoPaused?: boolean
  inDashboard?: boolean
}

type Mode = 'payment' | 'afford'
type LoanType = 'conventional' | 'fha' | 'va' | 'usda'

// ── Math helpers ──────────────────────────────────────────────────────────────

function calcPI(loan: number, annualRatePct: number, termYears: number): number {
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

// Returns adjusted loan amount (after FHA upfront MIP financed in, or VA fee)
function adjustedLoanAmount(baseLoan: number, loanType: LoanType, downPct: number): number {
  if (loanType === 'fha') {
    return baseLoan * (1 + MORTGAGE_INSURANCE.fha_upfront_mip) // upfront 1.75% financed
  }
  if (loanType === 'va') {
    // VA funding fee: 2.15% first use 0% down, 1.5% at 5%+, 1.25% at 10%+
    const fee = downPct >= 0.10 ? 0.0125 : downPct >= 0.05 ? 0.015 : 0.0215
    return baseLoan * (1 + fee)
  }
  if (loanType === 'usda') {
    return baseLoan * (1 + 0.01) // 1% upfront guarantee fee
  }
  return baseLoan
}

function calcMortgageInsurance(loan: number, ltv: number, loanType: LoanType, termYears: number): number {
  if (loanType === 'fha') {
    // FHA MIP: 0.55%/yr regardless (for 30yr, <10% down: life of loan; ≥10% down: 11 years)
    return loan * MORTGAGE_INSURANCE.fha_mip_annual / 12
  }
  if (loanType === 'conventional' && ltv > 80) {
    return loan * MORTGAGE_INSURANCE.conventional_pmi_annual / 12
  }
  if (loanType === 'usda') {
    return loan * MORTGAGE_INSURANCE.usda_annual_fee / 12
  }
  // VA: no monthly MI
  return 0
}

function mortgageInsuranceDropsOff(loanType: LoanType, downPct: number): boolean {
  if (loanType === 'conventional') return true // PMI drops at 80% LTV
  if (loanType === 'fha') return downPct >= 0.10  // MIP drops after 11yr if ≥10% down
  return false
}

// Amortization — returns remaining balance after N payments
// Find month when LTV drops below 80% (for PMI drop-off)
function monthsUntilPmiDrops(loan: number, homePrice: number, annualRatePct: number, termYears: number): number {
  const r = annualRatePct / 100 / 12
  const n = termYears * 12
  const pi = calcPI(loan, annualRatePct, termYears)
  let bal = loan
  for (let i = 0; i < n; i++) {
    if (bal / homePrice <= 0.80) return i
    bal = bal - (pi - bal * r)
  }
  return n
}

// Extra payment: returns months to payoff given extra payment
function monthsWithExtraPayment(loan: number, annualRatePct: number, termYears: number, extraMonthly: number): number {
  if (loan <= 0) return 0
  const r = annualRatePct / 100 / 12
  const pi = calcPI(loan, annualRatePct, termYears)
  const total = pi + extraMonthly
  let bal = loan
  let months = 0
  const maxMonths = termYears * 12
  while (bal > 0.01 && months < maxMonths) {
    bal = bal - (total - bal * r)
    months++
  }
  return months
}

// Closing cost estimate
function estimateClosingCosts(homePrice: number, loan: number, loanType: LoanType): {
  cashItems: { label: string; amount: number }[]
  financedItems: { label: string; amount: number }[]
  cashTotal: number
  financedTotal: number
  range: [number, number]
} {
  const cashItems = [
    { label: 'Loan origination fee (0.5–1%)',  amount: Math.round(loan * 0.0075) },
    { label: 'Appraisal',                       amount: 550 },
    { label: 'Home inspection',                 amount: 400 },
    { label: 'Title insurance',                 amount: Math.round(homePrice * 0.005) },
    { label: 'Title search & attorney',         amount: 850 },
    { label: 'Recording fees',                  amount: 250 },
    { label: 'Credit report',                   amount: 50 },
  ]
  const prepaidEscrow = Math.round(homePrice * 0.012)
  cashItems.push({ label: 'Prepaid items & escrow setup (est.)', amount: prepaidEscrow })

  const financedItems: { label: string; amount: number }[] = []
  if (loanType === 'fha') financedItems.push({ label: 'FHA upfront MIP (1.75%)', amount: Math.round(loan * 0.0175) })
  if (loanType === 'va')  financedItems.push({ label: 'VA funding fee (est.)',    amount: Math.round(loan * 0.0215) })
  if (loanType === 'usda') financedItems.push({ label: 'USDA guarantee fee (1%)', amount: Math.round(loan * 0.01) })

  const cashTotal = cashItems.reduce((s, i) => s + i.amount, 0)
  const financedTotal = financedItems.reduce((s, i) => s + i.amount, 0)
  return { cashItems, financedItems, cashTotal, financedTotal, range: [Math.round(loan * 0.02), Math.round(loan * 0.05)] }
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number): string { return Math.round(n).toLocaleString() }
function fmtK(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `$${Math.round(n / 1000)}k`
  return `$${fmt(n)}`
}
function parseCurrency(s: string): number {
  const n = parseFloat(s.replace(/,/g, ''))
  return isNaN(n) ? 0 : n
}
function fmtInput(n: number): string { return n > 0 ? n.toLocaleString() : '' }

// ── Shared sub-components ─────────────────────────────────────────────────────

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="calc-field">
      <label className="calc-label">{label}</label>
      {children}
      {hint && <div className="calc-sub-hint">{hint}</div>}
    </div>
  )
}

function CurrencyInput({ value, onChange, placeholder, suffix }: {
  value: string; onChange: (v: string) => void; placeholder?: string; suffix?: string
}) {
  return (
    <div className="calc-input-wrap">
      <span className="calc-prefix">$</span>
      <input
        className="calc-input"
        type="text"
        inputMode="numeric"
        placeholder={placeholder ?? '0'}
        value={value}
        onChange={e => {
          const cleaned = e.target.value.replace(/[^\d]/g, '')
          onChange(cleaned ? Number(cleaned).toLocaleString() : '')
        }}
        onBlur={e => {
          const n = parseCurrency(e.target.value)
          if (n > 0) onChange(n.toLocaleString())
        }}
      />
      {suffix && <span className="calc-suffix">{suffix}</span>}
    </div>
  )
}

function SegGroup({ options, value, onChange }: {
  options: { label: string; value: string }[]; value: string; onChange: (v: string) => void
}) {
  return (
    <div className="calc-seg-group">
      {options.map(o => (
        <button key={o.value} className={`calc-seg${value === o.value ? ' active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

function StateSelect({ value, onChange, label, hint }: { value: string; onChange: (v: string) => void; label: string; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <select className="calc-select" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">— Select a state —</option>
        {Object.entries(STATE_DATA).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([code, data]) => (
          <option key={code} value={code}>{data.name} ({code})</option>
        ))}
      </select>
      {value && (
        <div className="calc-state-info">
          <span>Tax: <strong>{(STATE_DATA[value].propertyTaxRate * 100).toFixed(2)}%/yr</strong></span>
          <span>Insurance: <strong>${fmt(STATE_DATA[value].avgInsuranceAnnual)}/yr</strong></span>
          <span>Avg HOA: <strong>${fmt(STATE_DATA[value].avgHoaMonthly)}/mo</strong></span>
          <span>Avg Utilities: <strong>${fmt(STATE_DATA[value].avgUtilitiesMonthly)}/mo</strong></span>
        </div>
      )}
    </Field>
  )
}

// ── Payment Calculator ────────────────────────────────────────────────────────

interface PaymentResult {
  loanBase: number; loanAdjusted: number; ltv: number
  pi: number; mortgageInsurance: number; monthlyTax: number; monthlyInsurance: number
  monthlyHoa: number; utilities: number; maintenance: number; total: number
  totalInterest: number; totalCost: number; closingCosts: ReturnType<typeof estimateClosingCosts>
  pmiDropMonth: number | null; frontEndDTI: number | null; down: number
}

function PaymentCalc({ prefill, runDemo, onDemoComplete, demoPaused }: { prefill?: MortgageInput | null; runDemo?: boolean; onDemoComplete?: () => void; demoPaused?: boolean }) {
  const [homePrice, setHomePrice] = useState(prefill ? fmtInput(prefill.home_price) : '')
  const [downDisplay, setDownDisplay] = useState(prefill ? fmtInput(prefill.down_payment) : '')
  const [downMode, setDownMode] = useState<'dollar' | 'percent'>('dollar')
  const [loanType, setLoanType] = useState<LoanType>(prefill?.loan_type as LoanType ?? 'conventional')
  const [term, setTerm] = useState<'10'|'15'|'20'|'30'>('30')
  const [rate, setRate] = useState(String(CURRENT_RATES['30']))
  const [state, setState] = useState(prefill?.state ?? '')
  const [annualTax, setAnnualTax] = useState('')
  const [annualInsurance, setAnnualInsurance] = useState('')
  const [monthlyHoa, setMonthlyHoa] = useState('')
  const [hasHoa, setHasHoa] = useState(false)
  const [utilities, setUtilities] = useState('')
  const [includeMaintenance, setIncludeMaintenance] = useState(true)
  const [annualIncome, setAnnualIncome] = useState(prefill ? fmtInput(prefill.annual_income) : '')
  const [extraPayment, setExtraPayment] = useState('')
  const [showAmort, setShowAmort] = useState(false)
  const [showClosing, setShowClosing] = useState(false)
  const [showRefi, setShowRefi] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [disabledRows, setDisabledRows] = useState<Set<string>>(new Set())
  const [aiLoading, setAiLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [autoCalcPending, setAutoCalcPending] = useState(false)
  const calculateRef = useRef<() => void>(() => {})

  const fetchAIRates = async () => {
    if (!state) return
    setAiLoading(true)
    setAiInsight(null)
    try {
      const res = await fetch('/api/market-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state_code: state,
          state_name: STATE_DATA[state]?.name ?? state,
          credit_score: prefill?.credit_score ?? 720,
          loan_type: loanType,
          term_years: parseInt(term),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setRate(String(data.interest_rate))
      const hp = parseCurrency(homePrice)
      if (hp > 0) setAnnualTax(fmtInput(Math.round(hp * data.property_tax_rate)))
      setAnnualInsurance(fmtInput(data.avg_insurance_annual))
      setAiInsight(data.insights + (data.demo_mode ? ' (demo mode — enable API key for live data)' : ''))
      setAutoCalcPending(true)
    } catch {
      setAiInsight('Could not fetch AI rates — check that the backend is running with a valid API key.')
    } finally {
      setAiLoading(false)
    }
  }

  // Auto-calculate once AI rates have been set and state has re-rendered
  useEffect(() => {
    if (!autoCalcPending) return
    setAutoCalcPending(false)
    calculateRef.current()
  }, [autoCalcPending])

  // Demo: run AI fetch then signal completion
  useEffect(() => {
    if (!runDemo || demoPaused) return
    fetchAIRates().then(() => {
      setTimeout(() => onDemoComplete?.(), 2000)
    })
  }, [runDemo, demoPaused]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setRate(String(CURRENT_RATES[term])) }, [term])


  useEffect(() => {
    if (!state) return
    if (hasHoa) setMonthlyHoa(fmtInput(STATE_DATA[state].avgHoaMonthly))
    else setMonthlyHoa('')
  }, [hasHoa])

  const getDownDollars = () => {
    const hp = parseCurrency(homePrice)
    if (downMode === 'dollar') return parseCurrency(downDisplay)
    return hp * (parseCurrency(downDisplay) / 100)
  }

  const calculate = () => {
    const hp = parseCurrency(homePrice)
    const down = getDownDollars()
    const baseLoan = hp - down
    const r = parseFloat(rate)
    const t = parseInt(term)
    if (hp <= 0 || baseLoan <= 0 || r <= 0) return

    const downPct = down / hp
    const adjLoan = adjustedLoanAmount(baseLoan, loanType, downPct)
    const ltv = (baseLoan / hp) * 100
    const pi = calcPI(adjLoan, r, t)
    const mi = calcMortgageInsurance(adjLoan, ltv, loanType, t)
    const mTax = parseCurrency(annualTax) / 12
    const mIns = parseCurrency(annualInsurance) / 12
    const mHoa = hasHoa ? parseCurrency(monthlyHoa) : 0
    const mUtils = parseCurrency(utilities) || 0
    const mMaint = includeMaintenance ? hp * 0.01 / 12 : 0
    const total = pi + mi + mTax + mIns + mHoa + mUtils + mMaint

    const n = t * 12
    const totalInterest = pi * n - adjLoan
    const totalCost = hp + totalInterest + (mTax + mIns + mHoa + mMaint) * n + mi * n

    const dropsOff = mortgageInsuranceDropsOff(loanType, downPct)
    const pmiDropMonth = (mi > 0 && dropsOff && loanType === 'conventional')
      ? monthsUntilPmiDrops(adjLoan, hp, r, t) : null

    const income = parseCurrency(annualIncome)
    const frontEndDTI = income > 0 ? ((pi + mi + mTax + mIns + mHoa) / (income / 12)) * 100 : null

    const closing = estimateClosingCosts(hp, baseLoan, loanType)

    setResult({ loanBase: baseLoan, loanAdjusted: adjLoan, ltv, pi, mortgageInsurance: mi,
      monthlyTax: mTax, monthlyInsurance: mIns, monthlyHoa: mHoa, utilities: mUtils,
      maintenance: mMaint, total, totalInterest, totalCost, closingCosts: closing,
      pmiDropMonth, frontEndDTI, down })
  }
  calculateRef.current = calculate

  const downPct = (() => {
    const hp = parseCurrency(homePrice)
    if (hp <= 0) return null
    return ((getDownDollars() / hp) * 100).toFixed(1)
  })()

  return (
    <div className="calc-body">
      {/* AI Rates — always visible at top so users know to press it */}
      <div className="calc-ai-banner">
        <div className="calc-ai-banner-left">
          <span className="calc-ai-badge">AI</span>
          <div>
            <div className="calc-ai-banner-title">Get Live AI-Accurate Rates</div>
            <div className="calc-ai-banner-sub">
              {state
                ? `Claude will fetch current rates, tax, and insurance for ${STATE_DATA[state]?.name ?? state} based on your credit profile.`
                : 'Select your state below, then press this button to auto-fill current rates.'}
            </div>
          </div>
        </div>
        <button
          className="calc-ai-btn"
          onClick={fetchAIRates}
          disabled={aiLoading || !state}
        >
          {aiLoading ? '⏳ Claude is researching rates...' : '🤖 Have Claude Research Rates for You'}
        </button>
      </div>
      {aiInsight && <div className="calc-ai-insight">{aiInsight}</div>}

      <div className="calc-form-grid">
        <div className="calc-col">
          <Field label="Home Price">
            <CurrencyInput value={homePrice} onChange={setHomePrice} placeholder="400,000" />
          </Field>

          <Field label="">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span className="calc-label" style={{ margin: 0 }}>Down Payment</span>
              <div className="calc-toggle-group">
                <button className={`calc-toggle${downMode === 'dollar' ? ' active' : ''}`} onClick={() => setDownMode('dollar')}>$</button>
                <button className={`calc-toggle${downMode === 'percent' ? ' active' : ''}`} onClick={() => setDownMode('percent')}>%</button>
              </div>
            </div>
            <CurrencyInput value={downDisplay} onChange={setDownDisplay} placeholder={downMode === 'dollar' ? '80,000' : '20'} />
            {downPct !== null && (
              <div className="calc-sub-hint">
                {downMode === 'dollar' ? `${downPct}% of home price` : `$${fmt(getDownDollars())}`}
                {downPct !== null && parseFloat(downPct) < 20 ? ' · PMI / MIP will apply' : ' · No PMI'}
              </div>
            )}
          </Field>

          <Field label="Loan Type">
            <SegGroup
              options={[
                { label: 'Conv.', value: 'conventional' },
                { label: 'FHA',   value: 'fha'          },
                { label: 'VA',    value: 'va'            },
                { label: 'USDA',  value: 'usda'          },
              ]}
              value={loanType}
              onChange={v => setLoanType(v as LoanType)}
            />
            <div className="calc-sub-hint">
              {loanType === 'fha'  && 'Includes 1.75% upfront MIP (financed) + 0.55%/yr monthly MIP'}
              {loanType === 'va'   && 'VA funding fee financed in — no monthly mortgage insurance'}
              {loanType === 'usda' && 'Includes 1% upfront fee + 0.35%/yr annual guarantee fee'}
              {loanType === 'conventional' && (parseFloat(downPct ?? '20') < 20 ? 'PMI applies until 80% LTV (~0.75%/yr est.)' : 'No PMI with 20%+ down')}
            </div>
          </Field>

          <Field label="Loan Term">
            <SegGroup options={[{label:'10yr',value:'10'},{label:'15yr',value:'15'},{label:'20yr',value:'20'},{label:'30yr',value:'30'}]} value={term} onChange={v => setTerm(v as typeof term)} />
          </Field>

          <Field label="Interest Rate" hint={`National avg ${RATE_DATA_DATE}: ${CURRENT_RATES[term]}%`}>
            <div className="calc-input-wrap">
              <input className="calc-input no-prefix" type="number" step="0.05" min="1" max="20" value={rate} onChange={e => setRate(e.target.value)} />
              <span className="calc-suffix">%</span>
            </div>
          </Field>

          <Field label="Annual Income (optional)" hint="Used to calculate front-end DTI ratio">
            <CurrencyInput value={annualIncome} onChange={setAnnualIncome} placeholder="80,000" suffix="/yr" />
          </Field>
        </div>

        <div className="calc-col">
          <StateSelect value={state} onChange={setState} label="State" />

          <Field label="Annual Property Tax" hint={state ? `${(STATE_DATA[state].propertyTaxRate * 100).toFixed(2)}% of home value in ${STATE_DATA[state].name}` : undefined}>
            <CurrencyInput value={annualTax} onChange={setAnnualTax} placeholder="4,000" suffix="/yr" />
          </Field>

          <Field label="Annual Homeowner's Insurance" hint={state ? `State avg: $${fmt(STATE_DATA[state].avgInsuranceAnnual)}/yr` : undefined}>
            <CurrencyInput value={annualInsurance} onChange={setAnnualInsurance} placeholder="1,500" suffix="/yr" />
          </Field>

          <div className="calc-field">
            <div className="calc-label-row">
              <label className="calc-label">HOA</label>
              <button className={`calc-toggle-pill${hasHoa ? ' active' : ''}`} onClick={() => setHasHoa(h => !h)}>
                {hasHoa ? '✓ Has HOA' : 'No HOA'}
              </button>
            </div>
            {hasHoa && (
              <>
                <CurrencyInput value={monthlyHoa} onChange={setMonthlyHoa} placeholder="250" suffix="/mo" />
                {state && <div className="calc-sub-hint">State avg: ${fmt(STATE_DATA[state].avgHoaMonthly)}/mo</div>}
              </>
            )}
          </div>

          <Field label="Monthly Utilities" hint={state ? `State avg: $${fmt(STATE_DATA[state].avgUtilitiesMonthly)}/mo (elec, gas, water, trash)` : 'electricity, gas, water, trash'}>
            <CurrencyInput value={utilities} onChange={setUtilities} placeholder="250" suffix="/mo" />
          </Field>

          <div className="calc-field">
            <div className="calc-label-row">
              <label className="calc-label">Maintenance Reserve</label>
              <button className={`calc-toggle-pill${includeMaintenance ? ' active' : ''}`} onClick={() => setIncludeMaintenance(v => !v)}>
                {includeMaintenance ? '✓ Included' : 'Excluded'}
              </button>
            </div>
            <div className="calc-sub-hint">1% of home value per year — industry standard for repairs &amp; upkeep</div>
          </div>
        </div>
      </div>

      <button className="calc-submit-btn" onClick={calculate}>Calculate True Monthly Cost →</button>

      {result && (
        <div className="calc-result">
          <div className="calc-result-header">
            <div className="calc-total-payment">${fmt(result.total)}<span>/mo</span></div>
            <div className="calc-total-label">True Total Monthly Cost</div>
            {result.frontEndDTI !== null && (
              <div className={`calc-dti-badge${result.frontEndDTI > 28 ? ' warn' : ' ok'}`}>
                Front-end DTI: {result.frontEndDTI.toFixed(1)}% {result.frontEndDTI <= 28 ? '✓' : '— above 28% guideline'}
              </div>
            )}
          </div>

          {(() => {
            const rows = [
              { label: 'Principal & Interest',       value: result.pi,                  always: true, locked: true },
              { label: `Mortgage Insurance (${['fha','usda'].includes(loanType) ? 'MIP/fee' : 'PMI'})`, value: result.mortgageInsurance, always: result.mortgageInsurance > 0, locked: false },
              { label: 'Property Tax',               value: result.monthlyTax,          always: true, locked: false },
              { label: "Homeowner's Insurance",      value: result.monthlyInsurance,    always: true, locked: false },
              { label: 'HOA',                        value: result.monthlyHoa,          always: hasHoa, locked: false },
              { label: 'Utilities',                  value: result.utilities,           always: result.utilities > 0, locked: false },
              { label: 'Maintenance Reserve (1%/yr)',value: result.maintenance,         always: includeMaintenance, locked: false },
            ].filter(r => r.always && r.value > 0)

            const activeTotal = rows.reduce((s, r) => s + (r.locked || !disabledRows.has(r.label) ? r.value : 0), 0)

            return (
              <div className="calc-breakdown">
                <div className="calc-breakdown-row header-row">
                  <span>Component</span><span>Monthly</span><span>Annual</span>
                </div>
                {rows.map(row => {
                  const off = !row.locked && disabledRows.has(row.label)
                  return (
                    <div key={row.label}
                      className={`calc-breakdown-row${off ? ' row-disabled' : ''}${!row.locked ? ' row-toggleable' : ''}`}
                      onClick={() => {
                        if (row.locked) return
                        setDisabledRows(prev => {
                          const next = new Set(prev)
                          if (next.has(row.label)) next.delete(row.label)
                          else next.add(row.label)
                          return next
                        })
                      }}>
                      <span>
                        {!row.locked && <span className={`row-toggle${off ? ' off' : ''}`}>{off ? '○' : '●'}</span>}
                        {row.label}
                      </span>
                      <span>{off ? '—' : `$${fmt(row.value)}`}</span>
                      <span className="calc-annual">{off ? '—' : `$${fmt(row.value * 12)}`}</span>
                    </div>
                  )
                })}
                <div className="calc-breakdown-divider" />
                <div className="calc-breakdown-row total-line">
                  <span>Total Monthly</span>
                  <span>${fmt(activeTotal)}</span>
                  <span className="calc-annual">${fmt(activeTotal * 12)}</span>
                </div>
              </div>
            )
          })()}

          {/* Mortgage Insurance notes */}
          {result.mortgageInsurance > 0 && (
            <div className="calc-mi-note">
              {loanType === 'fha' && downPct !== null && parseFloat(downPct) < 10 &&
                '⚠️ FHA MIP is for the life of the loan with <10% down. Consider refinancing to conventional once you reach 20% equity.'}
              {loanType === 'fha' && downPct !== null && parseFloat(downPct) >= 10 &&
                'FHA MIP drops off after 11 years (10%+ down).'}
              {loanType === 'conventional' && result.pmiDropMonth !== null &&
                `PMI drops off after ~${Math.ceil(result.pmiDropMonth / 12)} years (when balance reaches 80% LTV).`}
              {loanType === 'usda' && 'USDA annual guarantee fee (0.35%/yr) for the life of the loan.'}
            </div>
          )}

          {/* Lifetime summary */}
          <div className="calc-lifetime">
            <div className="calc-lifetime-item">
              <div className="calc-lifetime-label">Loan Amount</div>
              <div className="calc-lifetime-value">{fmtK(result.loanAdjusted)}</div>
              {result.loanAdjusted > result.loanBase && (
                <div className="calc-lifetime-sub">+{fmtK(result.loanAdjusted - result.loanBase)} financed fee</div>
              )}
            </div>
            <div className="calc-lifetime-item">
              <div className="calc-lifetime-label">Total Interest</div>
              <div className="calc-lifetime-value">{fmtK(result.totalInterest)}</div>
            </div>
            <div className="calc-lifetime-item">
              <div className="calc-lifetime-label">LTV Ratio</div>
              <div className="calc-lifetime-value">{result.ltv.toFixed(1)}%</div>
            </div>
          </div>

          {/* Extra payment calculator */}
          <div className="calc-expand-section">
            <div className="calc-expand-header" onClick={() => setShowAmort(v => !v)}>
              <span>📅 Extra Payment Savings</span>
              <span>{showAmort ? '▲' : '▼'}</span>
            </div>
            {showAmort && (
              <div className="calc-expand-body">
                <p className="calc-expand-desc">See how much you save by paying a little extra each month.</p>
                <Field label="Extra Monthly Payment">
                  <CurrencyInput value={extraPayment} onChange={setExtraPayment} placeholder="200" suffix="/mo" />
                </Field>
                {parseCurrency(extraPayment) > 0 && (() => {
                  const extra = parseCurrency(extraPayment)
                  const origMonths = parseInt(term) * 12
                  const newMonths = monthsWithExtraPayment(result.loanAdjusted, parseFloat(rate), parseInt(term), extra)
                  const monthsSaved = origMonths - newMonths
                  const interestSaved = result.totalInterest - (calcPI(result.loanAdjusted, parseFloat(rate), parseInt(term)) * newMonths - result.loanAdjusted)
                  return (
                    <div className="extra-payment-result">
                      <div className="extra-stat">
                        <div className="extra-stat-value">{Math.floor(monthsSaved / 12)}yr {monthsSaved % 12}mo</div>
                        <div className="extra-stat-label">Earlier payoff</div>
                      </div>
                      <div className="extra-stat">
                        <div className="extra-stat-value">{fmtK(Math.max(0, interestSaved))}</div>
                        <div className="extra-stat-label">Interest saved</div>
                      </div>
                      <div className="extra-stat">
                        <div className="extra-stat-value">{Math.ceil(newMonths / 12)} yr</div>
                        <div className="extra-stat-label">New payoff time</div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* Closing costs */}
          <div className="calc-expand-section">
            <div className="calc-expand-header" onClick={() => setShowClosing(v => !v)}>
              <span>🏁 Estimated Closing Costs</span>
              <span>{showClosing ? '▲' : '▼'}</span>
            </div>
            {showClosing && (
              <div className="calc-expand-body">
                <p className="calc-expand-desc">Typical range: ${fmt(result.closingCosts.range[0])} – ${fmt(result.closingCosts.range[1])} (2–5% of loan).</p>

                <div className="closing-section-label">Cash You Need at Closing</div>
                <div className="closing-item highlight-item">
                  <span>Down payment</span>
                  <span>${fmt(result.down)}</span>
                </div>
                {result.closingCosts.cashItems.map(item => (
                  <div key={item.label} className="closing-item">
                    <span>{item.label}</span>
                    <span>${fmt(item.amount)}</span>
                  </div>
                ))}
                <div className="closing-total">
                  <span>Total Cash to Close</span>
                  <span>${fmt(result.down + result.closingCosts.cashTotal)}</span>
                </div>

                {result.closingCosts.financedItems.length > 0 && (
                  <>
                    <div className="closing-section-label financed">Financed Into Your Loan (not out-of-pocket)</div>
                    {result.closingCosts.financedItems.map(item => (
                      <div key={item.label} className="closing-item financed-item">
                        <span>{item.label}</span>
                        <span>${fmt(item.amount)}</span>
                      </div>
                    ))}
                    <div className="closing-financed-note">
                      These fees are added to your loan balance — you don't pay them upfront, but they increase your monthly payment.
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* FHA/VA/USDA Refinance comparison */}
          {loanType !== 'conventional' && result.mortgageInsurance > 0 && (() => {
            const hp = parseCurrency(homePrice)
            const t = parseInt(term)
            const r = parseFloat(rate)
            const baseLoan = hp - result.down
            const adjLoan = result.loanAdjusted
            const pmiDropMonth = monthsUntilPmiDrops(adjLoan, hp, r, t)
            const yearsToEquity = Math.ceil(pmiDropMonth / 12)

            // Remaining balance at 80% LTV point
            const bal80 = hp * 0.80

            // Show refinance at a few rates
            const refiRates = [r - 1, r - 0.5, r, r + 0.5, r + 1].filter(x => x > 0)

            return (
              <div className="calc-expand-section">
                <div className="calc-expand-header" onClick={() => setShowRefi(v => !v)}>
                  <span>🔄 Refinance Comparison (after 20% equity)</span>
                  <span>{showRefi ? '▲' : '▼'}</span>
                </div>
                {showRefi && (
                  <div className="calc-expand-body">
                    <p className="calc-expand-desc">
                      With {loanType.toUpperCase()}, you pay monthly {loanType === 'fha' ? 'MIP' : 'fees'} until you refinance to a conventional loan.
                      Based on your current loan, you'll hit 20% equity in ~<strong>{yearsToEquity} years</strong>.
                    </p>

                    <div className="refi-comparison">
                      <div className="refi-current">
                        <div className="refi-label">Current {loanType.toUpperCase()} Payment</div>
                        <div className="refi-value">${fmt(result.pi + result.mortgageInsurance)}<span>/mo</span></div>
                        <div className="refi-detail">P&I ${fmt(result.pi)} + {loanType === 'fha' ? 'MIP' : 'MI'} ${fmt(result.mortgageInsurance)}</div>
                      </div>

                      <div className="refi-arrow">→</div>

                      <div className="refi-scenarios">
                        <div className="refi-label">After Refinance to Conventional (no MI)</div>
                        <div className="refi-grid">
                          {refiRates.map(refiRate => {
                            const remainingYears = t - yearsToEquity
                            const newPI = calcPI(bal80, refiRate, remainingYears > 0 ? remainingYears : 15)
                            const savings = (result.pi + result.mortgageInsurance) - newPI
                            return (
                              <div key={refiRate} className={`refi-scenario${Math.abs(refiRate - r) < 0.01 ? ' current' : ''}`}>
                                <div className="refi-scenario-rate">{refiRate.toFixed(1)}%{Math.abs(refiRate - r) < 0.01 ? ' (same)' : ''}</div>
                                <div className="refi-scenario-payment">${fmt(newPI)}<span>/mo</span></div>
                                <div className={`refi-scenario-savings${savings > 0 ? ' positive' : ''}`}>
                                  {savings > 0 ? `Save $${fmt(savings)}/mo` : `+$${fmt(Math.abs(savings))}/mo`}
                                </div>
                                <div className="refi-scenario-term">{remainingYears > 0 ? remainingYears : 15}yr term</div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>

                    <div className="refi-note">
                      Refinancing has closing costs (~$3k–$6k). Factor those in when deciding. Rates shown are hypothetical.
                    </div>
                  </div>
                )}
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

// ── What Can I Afford ─────────────────────────────────────────────────────────

const GRID_RATES = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0]
const GRID_DOWN_PCTS = [0, 3, 5, 10, 15, 20]

function AffordCalc({ prefill, runDemo, onDemoComplete, demoPaused }: { prefill?: MortgageInput | null; runDemo?: boolean; onDemoComplete?: () => void; demoPaused?: boolean }) {
  const [targetPayment, setTargetPayment] = useState('')
  const [state, setState] = useState(prefill?.state ?? '')
  const [loanType, setLoanType] = useState<LoanType>(prefill?.loan_type as LoanType ?? 'conventional')
  const [term, setTerm] = useState<'15'|'30'>('30')
  const [monthlyHoa, setMonthlyHoa] = useState('0')
  const [includeUtils, setIncludeUtils] = useState(true)
  const [result, setResult] = useState<{grid: {downPct:number;rate:number;homePrice:number;hasMi:boolean}[][]}>( null!)
  const [popup, setPopup] = useState<{downPct:number;rate:number;homePrice:number} | null>(null)
  const calculateRef = useRef<() => void>(() => {})
  const [aiTaxRate, setAiTaxRate] = useState<number | null>(null)
  const [aiInsuranceAnnual, setAiInsuranceAnnual] = useState<number | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiInsight, setAiInsight] = useState<string | null>(null)
  const [autoCalcPending, setAutoCalcPending] = useState(false)

  const fetchAIRates = async () => {
    if (!state) return
    setAiLoading(true)
    setAiInsight(null)
    try {
      const res = await fetch('/api/market-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          state_code: state,
          state_name: STATE_DATA[state]?.name ?? state,
          credit_score: prefill?.credit_score ?? 720,
          loan_type: loanType,
          term_years: parseInt(term),
        }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      setAiTaxRate(data.property_tax_rate)
      setAiInsuranceAnnual(data.avg_insurance_annual)
      setAiInsight(data.insights + (data.demo_mode ? ' (demo mode — enable API key for live data)' : ''))
      setAutoCalcPending(true)
    } catch {
      setAiInsight('Could not fetch AI rates — check that the backend is running with a valid API key.')
    } finally {
      setAiLoading(false)
    }
  }

  useEffect(() => {
    if (!autoCalcPending) return
    setAutoCalcPending(false)
    calculateRef.current()
  }, [autoCalcPending])

  const suggestedPayment = prefill?.annual_income
    ? Math.round(prefill.annual_income / 12 * 0.28) : null

  // Demo: fetch AI rates, fill target payment, calculate
  useEffect(() => {
    if (!runDemo || !suggestedPayment || demoPaused) return
    setTargetPayment(suggestedPayment.toLocaleString())
    fetchAIRates().then(() => {
      setTimeout(() => {
        calculateRef.current()
        setTimeout(() => onDemoComplete?.(), 1200)
      }, 600)
    })
  }, [runDemo, demoPaused]) // eslint-disable-line react-hooks/exhaustive-deps

  const calculate = () => {
    const target = parseCurrency(targetPayment)
    if (target <= 0) return

    const mHoa = parseCurrency(monthlyHoa)
    const taxRateValue = aiTaxRate ?? (state ? STATE_DATA[state].propertyTaxRate : 0)
    const annualIns = aiInsuranceAnnual ?? (state ? STATE_DATA[state].avgInsuranceAnnual : 1500)
    const mIns = annualIns / 12
    const mUtils = state && includeUtils ? STATE_DATA[state].avgUtilitiesMonthly : 0
    const t = parseInt(term)

    const grid = GRID_DOWN_PCTS.map(downPct => {
      return GRID_RATES.map(rate => {
        let homePrice = 400000
        for (let i = 0; i < 12; i++) {
          const mTax = homePrice * taxRateValue / 12
          const loan = homePrice * (1 - downPct / 100)
          const adjLoan = adjustedLoanAmount(loan, loanType, downPct / 100)
          const mi = calcMortgageInsurance(adjLoan, (1 - downPct / 100) * 100, loanType, t)
          const availablePI = target - mTax - mIns - mHoa - mi - mUtils
          if (availablePI <= 0) { homePrice = 0; break }
          const newLoan = maxLoanFromPI(availablePI, rate, t)
          homePrice = newLoan / (1 - downPct / 100)
        }
        const loan = homePrice * (1 - downPct / 100)
        const ltv = (1 - downPct / 100) * 100
        const mi = calcMortgageInsurance(loan, ltv, loanType, t)
        return { downPct, rate, homePrice: Math.max(0, Math.round(homePrice / 5000) * 5000), hasMi: mi > 0 }
      })
    })

    setResult({ grid })
  }
  calculateRef.current = calculate

  const maxPrice = result ? Math.max(...result.grid.flat().map(c => c.homePrice)) : 0
  const cellColor = (hp: number) => {
    if (hp <= 0) return 'cell-none'
    const ratio = hp / maxPrice
    return ratio > 0.75 ? 'cell-high' : ratio > 0.45 ? 'cell-mid' : 'cell-low'
  }

  return (
    <div className="calc-body">
      {/* AI Rates — always visible at top */}
      <div className="calc-ai-banner">
        <div className="calc-ai-banner-left">
          <span className="calc-ai-badge">AI</span>
          <div>
            <div className="calc-ai-banner-title">Get Live AI-Accurate Rates</div>
            <div className="calc-ai-banner-sub">
              {state
                ? `Claude will fetch current tax and insurance data for ${STATE_DATA[state]?.name ?? state} to sharpen your affordability estimate.`
                : 'Select your state below, then press this button to auto-fill current rates.'}
            </div>
          </div>
        </div>
        <button
          className="calc-ai-btn"
          onClick={fetchAIRates}
          disabled={aiLoading || !state}
        >
          {aiLoading ? '⏳ Claude is researching rates...' : '🤖 Have Claude Research Rates for You'}
        </button>
      </div>
      {aiInsight && <div className="calc-ai-insight">{aiInsight}</div>}

      <div className="calc-afford-intro">
        Enter your target total monthly housing budget and see the home prices you can afford across different rates and down payments.
      </div>

      <div className="calc-form-grid">
        <div className="calc-col">
          <Field label="Target Monthly Budget" hint="Total you want to spend — P&I, taxes, insurance, HOA, utilities, and MI">
            <div style={{display:'flex', gap:'0.5rem', alignItems:'flex-end', flexWrap:'wrap'}}>
              <div style={{flex:1, minWidth:'150px'}}>
                <CurrencyInput value={targetPayment} onChange={setTargetPayment} placeholder="2,500" suffix="/mo" />
              </div>
              {suggestedPayment && (
                <button className="calc-suggest-btn" onClick={() => setTargetPayment(suggestedPayment.toLocaleString())}>
                  28% rule: ${fmt(suggestedPayment)}
                </button>
              )}
            </div>
          </Field>

          <Field label="Loan Type">
            <SegGroup options={[{label:'Conv.',value:'conventional'},{label:'FHA',value:'fha'},{label:'VA',value:'va'},{label:'USDA',value:'usda'}]} value={loanType} onChange={v => setLoanType(v as LoanType)} />
          </Field>

          <Field label="Loan Term">
            <SegGroup options={[{label:'15yr',value:'15'},{label:'30yr',value:'30'}]} value={term} onChange={v => setTerm(v as typeof term)} />
          </Field>
        </div>

        <div className="calc-col">
          <StateSelect value={state} onChange={setState} label="State (for tax, insurance, utilities)" />
          <Field label="Monthly HOA (0 if none)">
            <CurrencyInput value={monthlyHoa} onChange={setMonthlyHoa} placeholder="0" suffix="/mo" />
          </Field>
          <div className="calc-field">
            <div className="calc-label-row">
              <label className="calc-label">Include Utilities in Budget</label>
              <button className={`calc-toggle-pill${includeUtils ? ' active' : ''}`} onClick={() => setIncludeUtils(v => !v)}>
                {includeUtils ? '✓ Included' : 'Excluded'}
              </button>
            </div>
            {state && includeUtils && <div className="calc-sub-hint">Using state avg: ${fmt(STATE_DATA[state].avgUtilitiesMonthly)}/mo</div>}
          </div>
        </div>
      </div>

      <button className="calc-submit-btn" onClick={calculate}>Show What I Can Afford →</button>

      {result && (
        <div className="calc-afford-result">
          <div className="afford-grid-wrapper">
            <table className="afford-grid">
              <thead>
                <tr>
                  <th className="afford-corner">Down ↓ / Rate →</th>
                  {GRID_RATES.map(r => (
                    <th key={r} className={`afford-rate-header${Math.abs(r - CURRENT_RATES[term]) < 0.01 ? ' current-rate' : ''}`}>
                      {r}%{Math.abs(r - CURRENT_RATES[term]) < 0.01 ? ' ★' : ''}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.grid.map((row, ri) => (
                  <tr key={ri}>
                    <td className="afford-down-label">
                      {GRID_DOWN_PCTS[ri] === 0 ? 'No down (VA/USDA)' : `${GRID_DOWN_PCTS[ri]}% down`}
                    </td>
                    {row.map((cell, ci) => (
                      <td key={ci} className={`afford-cell ${cellColor(cell.homePrice)}${cell.homePrice > 0 ? ' clickable' : ''}`}
                        onClick={() => cell.homePrice > 0 && setPopup({ downPct: cell.downPct, rate: cell.rate, homePrice: cell.homePrice })}>
                        {cell.homePrice > 0 ? (
                          <>
                            <span className="afford-price">{fmtK(cell.homePrice)}</span>
                            {cell.hasMi && <span className="afford-pmi-flag">+MI</span>}
                          </>
                        ) : <span className="afford-impossible">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="afford-legend">
            <span className="legend-dot cell-high" /> Highest range
            <span className="legend-dot cell-mid" /> Mid range
            <span className="legend-dot cell-low" /> Lower range
            <span className="afford-pmi-flag" style={{marginLeft:'1rem'}}>+MI</span> = mortgage insurance applies
            <span style={{marginLeft:'0.5rem', fontStyle:'italic'}}>★ = current avg rate</span>
          </div>
          <div className="afford-disclaimer">
            Figures are estimates assuming {term}-year loan. VA/USDA 0% row includes respective fees. Consult a lender for exact qualification.
          </div>
        </div>
      )}

      {popup && (() => {
        const hp = popup.homePrice
        const dp = popup.downPct
        const r = popup.rate
        const t = parseInt(term)
        const downAmt = hp * dp / 100
        const baseLoan = hp - downAmt
        const adjLoan = adjustedLoanAmount(baseLoan, loanType, dp / 100)
        const financedFee = adjLoan - baseLoan
        const pi = calcPI(adjLoan, r, t)
        const ltv = (baseLoan / hp) * 100
        const mi = calcMortgageInsurance(adjLoan, ltv, loanType, t)
        const mTax = state ? hp * STATE_DATA[state].propertyTaxRate / 12 : 0
        const annualIns = state ? STATE_DATA[state].avgInsuranceAnnual : 1500
        const mIns = annualIns / 12
        const mHoa = parseCurrency(monthlyHoa)
        const mUtils = state && includeUtils ? STATE_DATA[state].avgUtilitiesMonthly : 0
        const totalMonthly = pi + mi + mTax + mIns + mHoa + mUtils
        const totalInterest = pi * t * 12 - adjLoan

        const rows: {label: string; value: number; note?: string}[] = [
          { label: 'Principal & Interest', value: pi },
          ...(mi > 0 ? [{ label: `Mortgage Insurance (${['fha','usda'].includes(loanType) ? 'MIP' : 'PMI'})`, value: mi }] : []),
          ...(mTax > 0 ? [{ label: 'Property Tax', value: mTax }] : []),
          { label: 'Homeowner\'s Insurance', value: mIns },
          ...(mHoa > 0 ? [{ label: 'HOA', value: mHoa }] : []),
          ...(mUtils > 0 ? [{ label: 'Utilities', value: mUtils }] : []),
        ]

        return (
          <div className="afford-popup-overlay" onClick={() => setPopup(null)}>
            <div className="afford-popup" onClick={e => e.stopPropagation()}>
              <button className="afford-popup-close" onClick={() => setPopup(null)}>✕</button>
              <div className="afford-popup-title">{fmtK(hp)} Home</div>
              <div className="afford-popup-subtitle">{dp}% down · {r}% rate · {t}-year {loanType}</div>

              <div className="afford-popup-stats">
                <div className="afford-popup-stat">
                  <div className="afford-popup-stat-label">Down Payment</div>
                  <div className="afford-popup-stat-value">${fmt(downAmt)}</div>
                </div>
                <div className="afford-popup-stat">
                  <div className="afford-popup-stat-label">Loan Amount</div>
                  <div className="afford-popup-stat-value">${fmt(financedFee > 0 ? adjLoan : baseLoan)}</div>
                  {financedFee > 0 && <div className="afford-popup-stat-note">incl. ${fmt(financedFee)} fee</div>}
                </div>
                <div className="afford-popup-stat">
                  <div className="afford-popup-stat-label">Total Interest</div>
                  <div className="afford-popup-stat-value">${fmt(totalInterest)}</div>
                </div>
              </div>

              <div className="afford-popup-breakdown-title">Monthly Payment Breakdown</div>
              <div className="afford-popup-breakdown">
                {rows.map(r => (
                  <div key={r.label} className="afford-popup-row">
                    <span>{r.label}</span>
                    <span>${fmt(r.value)}</span>
                  </div>
                ))}
                <div className="afford-popup-row total">
                  <span>Total Monthly</span>
                  <span>${fmt(totalMonthly)}</span>
                </div>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

type DemoPhase = 'idle' | 'payment' | 'afford' | 'done'

export default function MortgageCalculator({ onBack, prefill, isDemoRun, demoPaused, inDashboard }: Props) {
  const [mode, setMode] = useState<Mode>('payment')
  const [demoPhase, setDemoPhase] = useState<DemoPhase>('idle')
  const [paymentDone, setPaymentDone] = useState(false)

  useEffect(() => {
    if (!isDemoRun) return
    const t = setTimeout(() => setDemoPhase('payment'), 800)
    return () => clearTimeout(t)
  }, [isDemoRun])

  // 10-second pause between payment and afford demos; respects demoPaused
  useEffect(() => {
    if (!paymentDone || demoPaused) return
    const t = setTimeout(() => {
      setMode('afford')
      setTimeout(() => setDemoPhase('afford'), 600)
    }, 10000)
    return () => clearTimeout(t)
  }, [paymentDone, demoPaused])

  const handlePaymentDemoComplete = () => {
    setPaymentDone(true)
  }

  return (
    <div className="calc-page">
      <div className="calc-page-header">
        {!inDashboard && <button className="calc-back-btn" onClick={onBack}>← Back</button>}
        <div>
          <h2 className="calc-page-title">Mortgage Calculator</h2>
          <p className="calc-page-subtitle">Rates as of {RATE_DATA_DATE} · All figures are estimates</p>
        </div>
      </div>

      <div className="calc-card">
        <div className="calc-tabs">
          <button className={`calc-tab${mode === 'payment' ? ' active' : ''}`} onClick={() => setMode('payment')}>
            🏠 Calculate Payment
          </button>
          <button className={`calc-tab${mode === 'afford' ? ' active' : ''}`} onClick={() => setMode('afford')}>
            💰 What Can I Afford?
          </button>
        </div>

        {mode === 'payment' && (
          <PaymentCalc
            prefill={prefill}
            runDemo={demoPhase === 'payment'}
            onDemoComplete={handlePaymentDemoComplete}
            demoPaused={demoPaused}
          />
        )}
        {mode === 'afford' && (
          <AffordCalc
            prefill={prefill}
            runDemo={demoPhase === 'afford'}
            onDemoComplete={() => setDemoPhase('done')}
            demoPaused={demoPaused}
          />
        )}
      </div>
    </div>
  )
}
