import { useState, useEffect, useRef } from 'react'
import {
  UTAH_COUNTIES, DEFAULT_COUNTY, UTAH_AVERAGES,
  rateForTerm, LiveRates, pmiAnnualRate,
} from '../data/utahData'
import { MortgageInput } from '../types'

interface Props {
  onBack: () => void
  prefill?: MortgageInput | null
  isDemoRun?: boolean
  demoPaused?: boolean
  inDashboard?: boolean
  onDemoComplete?: () => void
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

// Returns adjusted loan amount (after FHA upfront MIP financed in, or VA/USDA fee)
function adjustedLoanAmount(baseLoan: number, loanType: LoanType, downPct: number): number {
  if (loanType === 'fha') {
    return baseLoan * 1.0175 // 1.75% upfront MIP, financed
  }
  if (loanType === 'va') {
    // VA funding fee, first use: 2.15% under 5% down, 1.5% at 5%+, 1.25% at 10%+
    const fee = downPct >= 0.10 ? 0.0125 : downPct >= 0.05 ? 0.015 : 0.0215
    return baseLoan * (1 + fee)
  }
  if (loanType === 'usda') {
    return baseLoan * 1.01 // 1% upfront guarantee fee
  }
  return baseLoan
}

function calcMortgageInsurance(
  loan: number, ltv: number, loanType: LoanType, termYears: number, creditScore: number,
): number {
  if (loanType === 'fha') {
    // FHA annual MIP (post-2023 schedule, base loan amounts)
    const annual = termYears <= 15
      ? (ltv > 90 ? 0.0040 : 0.0015)
      : (ltv > 95 ? 0.0055 : 0.0050)
    return loan * annual / 12
  }
  if (loanType === 'conventional' && ltv > 80) {
    return loan * pmiAnnualRate(creditScore) / 12
  }
  if (loanType === 'usda') {
    return loan * 0.0035 / 12 // annual guarantee fee
  }
  // VA: no monthly MI
  return 0
}

function mortgageInsuranceDropsOff(loanType: LoanType, downPct: number): boolean {
  if (loanType === 'conventional') return true // PMI drops at 80% LTV
  if (loanType === 'fha') return downPct >= 0.10 // MIP drops after 11yr if ≥10% down
  return false
}

// How many months of mortgage insurance are actually paid over the loan's life
function miDurationMonths(
  loanType: LoanType, downPct: number, termYears: number, pmiDropMonth: number | null,
): number {
  const n = termYears * 12
  if (loanType === 'va') return 0
  if (loanType === 'usda') return n
  if (loanType === 'fha') return downPct >= 0.10 ? Math.min(132, n) : n // 11 years with 10%+ down
  return pmiDropMonth ?? 0
}

// Find month when LTV drops to 80% of original value (borrower can request PMI removal)
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

// Amortize with an extra monthly payment — months to payoff and total interest paid
function payoffWithExtra(
  loan: number, annualRatePct: number, termYears: number, extraMonthly: number,
): { months: number; interest: number } {
  if (loan <= 0 || annualRatePct <= 0) return { months: 0, interest: 0 }
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

// Closing cost estimate — Utah-typical figures. Utah has no real estate
// transfer tax, and title companies (not attorneys) handle closings.
function estimateClosingCosts(homePrice: number, loan: number, loanType: LoanType): {
  cashItems: { label: string; amount: number }[]
  financedItems: { label: string; amount: number }[]
  cashTotal: number
  financedTotal: number
  range: [number, number]
} {
  const cashItems = [
    { label: 'Loan origination fee (0.5–1%)',            amount: Math.round(loan * 0.0075) },
    { label: 'Underwriting & processing',                 amount: 695 },
    { label: 'Appraisal',                                 amount: 550 },
    { label: 'Home inspection',                           amount: 450 },
    { label: "Lender's title insurance (~0.4% of loan)",  amount: Math.round(loan * 0.004) },
    { label: "Owner's title insurance (recommended)",     amount: Math.round(homePrice * 0.003) },
    { label: 'Title search & settlement fee',             amount: 600 },
    { label: 'Recording fees (Utah flat-fee)',            amount: 60 },
    { label: 'Credit report',                             amount: 45 },
  ]
  // Prepaid: first-year homeowners insurance + prepaid interest (15 days) + 2–3 mo escrow reserves
  const prepaidEscrow = Math.round(homePrice * 0.01)
  cashItems.push({ label: 'Prepaid insurance, interest & escrow reserves', amount: prepaidEscrow })

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

function CountySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const county = UTAH_COUNTIES[value]
  return (
    <Field label="Utah County">
      <select className="calc-select" value={value} onChange={e => onChange(e.target.value)}>
        {Object.entries(UTAH_COUNTIES).map(([key, c]) => (
          <option key={key} value={key}>{c.name}</option>
        ))}
      </select>
      {county && (
        <div className="calc-sub-hint">
          Effective property tax: <strong>{(county.taxRate * 100).toFixed(2)}%/yr</strong> on a primary
          residence (Utah's 45% residential exemption included)
        </div>
      )}
    </Field>
  )
}

// Live Utah rates banner — data from Freddie Mac PMMS via the backend
function RatesCard({ rates, loading }: { rates: LiveRates | null; loading: boolean }) {
  return (
    <div className="rates-card">
      <div className="rates-card-header">
        <span className="rates-flag">🏔️ Utah Mortgage Rates</span>
        {rates?.live && <span className="rates-live-badge">● LIVE</span>}
      </div>
      {loading ? (
        <div className="rates-loading">Loading current rates…</div>
      ) : rates ? (
        <>
          <div className="rates-values">
            <div className="rates-value">
              <div className="rates-value-num">{rates.rate_30yr.toFixed(2)}%</div>
              <div className="rates-value-label">30-yr fixed</div>
            </div>
            <div className="rates-value">
              <div className="rates-value-num">{rates.rate_15yr.toFixed(2)}%</div>
              <div className="rates-value-label">15-yr fixed</div>
            </div>
          </div>
          <div className="rates-source">
            {rates.source} · week of {rates.as_of}. National weekly average — Utah lenders
            typically quote within ~0.1%. Your rate depends on credit, points, and lender.
          </div>
        </>
      ) : (
        <div className="rates-loading">Rates unavailable — enter a rate manually below.</div>
      )}
    </div>
  )
}

// ── Payment Calculator ────────────────────────────────────────────────────────

interface PaymentResult {
  loanBase: number; loanAdjusted: number; ltv: number
  pi: number; mortgageInsurance: number; monthlyTax: number; monthlyInsurance: number
  monthlyHoa: number; utilities: number; maintenance: number; total: number
  totalInterest: number; totalCost: number; closingCosts: ReturnType<typeof estimateClosingCosts>
  pmiDropMonth: number | null; frontEndDTI: number | null; down: number
  rateUsed: number; termYears: number
}

function PaymentCalc({ prefill, liveRates, ratesLoading, runDemo, onDemoComplete, demoPaused }: {
  prefill?: MortgageInput | null; liveRates: LiveRates | null; ratesLoading: boolean
  runDemo?: boolean; onDemoComplete?: () => void; demoPaused?: boolean
}) {
  const [homePrice, setHomePrice] = useState(prefill ? fmtInput(prefill.home_price) : '')
  const [downDisplay, setDownDisplay] = useState(prefill ? fmtInput(prefill.down_payment) : '')
  const [downMode, setDownMode] = useState<'dollar' | 'percent'>('dollar')
  const [loanType, setLoanType] = useState<LoanType>(prefill?.loan_type as LoanType ?? 'conventional')
  const [term, setTerm] = useState<'10'|'15'|'20'|'30'>('30')
  const [rate, setRate] = useState('')
  const [rateTouched, setRateTouched] = useState(false)
  const [county, setCounty] = useState(DEFAULT_COUNTY)
  const [annualTax, setAnnualTax] = useState('')
  const [taxTouched, setTaxTouched] = useState(false)
  const [annualInsurance, setAnnualInsurance] = useState(fmtInput(UTAH_AVERAGES.insuranceAnnual))
  const [monthlyHoa, setMonthlyHoa] = useState('')
  const [hasHoa, setHasHoa] = useState(false)
  const [utilities, setUtilities] = useState(fmtInput(UTAH_AVERAGES.utilitiesMonthly))
  const [includeMaintenance, setIncludeMaintenance] = useState(true)
  const [annualIncome, setAnnualIncome] = useState(prefill ? fmtInput(prefill.annual_income) : '')
  const [extraPayment, setExtraPayment] = useState('')
  const [showAmort, setShowAmort] = useState(false)
  const [showClosing, setShowClosing] = useState(false)
  const [showRefi, setShowRefi] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [disabledRows, setDisabledRows] = useState<Set<string>>(new Set())
  const calculateRef = useRef<() => void>(() => {})

  const creditScore = prefill?.credit_score ?? 720
  const defaultRate = rateForTerm(liveRates, term)

  // Prefill the rate from the live feed until the user types their own
  useEffect(() => {
    if (rateTouched) return
    setRate(String(defaultRate.rate))
  }, [liveRates, term]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-compute property tax from county + home price until the user edits it
  useEffect(() => {
    if (taxTouched) return
    const hp = parseCurrency(homePrice)
    setAnnualTax(hp > 0 ? fmtInput(Math.round(hp * UTAH_COUNTIES[county].taxRate)) : '')
  }, [county, homePrice]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (hasHoa) setMonthlyHoa(fmtInput(UTAH_AVERAGES.hoaMonthly))
    else setMonthlyHoa('')
  }, [hasHoa])

  // Demo: wait a beat for rates/prefill, run the calculation, then move on
  useEffect(() => {
    if (!runDemo || demoPaused) return
    const t = setTimeout(() => {
      calculateRef.current()
      setTimeout(() => onDemoComplete?.(), 2200)
    }, 1200)
    return () => clearTimeout(t)
  }, [runDemo, demoPaused]) // eslint-disable-line react-hooks/exhaustive-deps

  const getDownDollars = () => {
    const hp = parseCurrency(homePrice)
    if (downMode === 'dollar') return parseCurrency(downDisplay)
    return hp * (parseCurrency(downDisplay) / 100)
  }

  const calculate = () => {
    const hp = parseCurrency(homePrice)
    const down = getDownDollars()
    const baseLoan = hp - down
    const r = parseFloat(rate) || defaultRate.rate
    const t = parseInt(term)
    if (hp <= 0 || baseLoan <= 0 || r <= 0) return

    const downPct = down / hp
    const adjLoan = adjustedLoanAmount(baseLoan, loanType, downPct)
    const ltv = (baseLoan / hp) * 100
    const pi = calcPI(adjLoan, r, t)
    const mi = calcMortgageInsurance(adjLoan, ltv, loanType, t, creditScore)
    const mTax = parseCurrency(annualTax) / 12
    const mIns = parseCurrency(annualInsurance) / 12
    const mHoa = hasHoa ? parseCurrency(monthlyHoa) : 0
    const mUtils = parseCurrency(utilities) || 0
    const mMaint = includeMaintenance ? hp * 0.01 / 12 : 0
    const total = pi + mi + mTax + mIns + mHoa + mUtils + mMaint

    const n = t * 12
    const totalInterest = pi * n - adjLoan

    const dropsOff = mortgageInsuranceDropsOff(loanType, downPct)
    const pmiDropMonth = (mi > 0 && dropsOff && loanType === 'conventional')
      ? monthsUntilPmiDrops(adjLoan, hp, r, t) : null

    // MI is only paid until it drops off — don't count it for the full term
    const miMonths = mi > 0 ? miDurationMonths(loanType, downPct, t, pmiDropMonth) : 0
    const totalCost = hp + totalInterest + (mTax + mIns + mHoa + mMaint) * n + mi * miMonths

    const income = parseCurrency(annualIncome)
    const frontEndDTI = income > 0 ? ((pi + mi + mTax + mIns + mHoa) / (income / 12)) * 100 : null

    const closing = estimateClosingCosts(hp, baseLoan, loanType)

    setResult({ loanBase: baseLoan, loanAdjusted: adjLoan, ltv, pi, mortgageInsurance: mi,
      monthlyTax: mTax, monthlyInsurance: mIns, monthlyHoa: mHoa, utilities: mUtils,
      maintenance: mMaint, total, totalInterest, totalCost, closingCosts: closing,
      pmiDropMonth, frontEndDTI, down, rateUsed: r, termYears: t })
  }
  calculateRef.current = calculate

  const downPct = (() => {
    const hp = parseCurrency(homePrice)
    if (hp <= 0) return null
    return ((getDownDollars() / hp) * 100).toFixed(1)
  })()

  return (
    <div className="calc-body">
      <RatesCard rates={liveRates} loading={ratesLoading} />

      <div className="calc-form-grid">
        <div className="calc-col">
          <Field label="Home Price">
            <CurrencyInput value={homePrice} onChange={setHomePrice} placeholder="450,000" />
          </Field>

          <Field label="">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span className="calc-label" style={{ margin: 0 }}>Down Payment</span>
              <div className="calc-toggle-group">
                <button className={`calc-toggle${downMode === 'dollar' ? ' active' : ''}`} onClick={() => setDownMode('dollar')}>$</button>
                <button className={`calc-toggle${downMode === 'percent' ? ' active' : ''}`} onClick={() => setDownMode('percent')}>%</button>
              </div>
            </div>
            <CurrencyInput value={downDisplay} onChange={setDownDisplay} placeholder={downMode === 'dollar' ? '90,000' : '20'} />
            {downPct !== null && parseFloat(downPct) >= 100 ? (
              <div className="calc-sub-hint calc-hint-error">
                ⚠️ Down payment can't be equal to or more than the home price
              </div>
            ) : downPct !== null && (
              <div className="calc-sub-hint">
                {downMode === 'dollar' ? `${downPct}% of home price` : `$${fmt(getDownDollars())}`}
                {parseFloat(downPct) < 20 ? ' · PMI / MIP will apply' : ' · No PMI'}
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
              {loanType === 'fha'  && 'Includes 1.75% upfront MIP (financed) + annual MIP'}
              {loanType === 'va'   && 'VA funding fee financed in — no monthly mortgage insurance'}
              {loanType === 'usda' && 'Includes 1% upfront fee + 0.35%/yr annual guarantee fee'}
              {loanType === 'conventional' && (parseFloat(downPct ?? '20') < 20
                ? `PMI applies until 80% LTV (~${(pmiAnnualRate(creditScore) * 100).toFixed(2)}%/yr at your credit score)`
                : 'No PMI with 20%+ down')}
            </div>
          </Field>

          <Field label="Loan Term">
            <SegGroup options={[{label:'10yr',value:'10'},{label:'15yr',value:'15'},{label:'20yr',value:'20'},{label:'30yr',value:'30'}]} value={term} onChange={v => setTerm(v as typeof term)} />
          </Field>

          <Field
            label="Interest Rate"
            hint={rateTouched
              ? undefined
              : defaultRate.estimated && liveRates
                ? `Estimated from this week's survey (PMMS publishes 30yr & 15yr only)`
                : `Auto-filled from this week's survey — edit to match your quote`}
          >
            <div className="calc-input-wrap">
              <input
                className="calc-input no-prefix" type="number" step="0.05" min="1" max="20"
                value={rate}
                onChange={e => { setRateTouched(true); setRate(e.target.value) }}
                placeholder={String(defaultRate.rate)}
              />
              <span className="calc-suffix">%</span>
            </div>
          </Field>

          <Field label="Annual Income (optional)" hint="Used to calculate front-end DTI ratio">
            <CurrencyInput value={annualIncome} onChange={setAnnualIncome} placeholder="80,000" suffix="/yr" />
          </Field>
        </div>

        <div className="calc-col">
          <CountySelect value={county} onChange={setCounty} />

          <Field label="Annual Property Tax" hint={taxTouched ? undefined : 'Auto-calculated from your county — edit if you know the exact amount'}>
            <CurrencyInput
              value={annualTax}
              onChange={v => { setTaxTouched(true); setAnnualTax(v) }}
              placeholder="2,500" suffix="/yr"
            />
          </Field>

          <Field label="Annual Homeowner's Insurance" hint={`Utah average: ~$${fmt(UTAH_AVERAGES.insuranceAnnual)}/yr`}>
            <CurrencyInput value={annualInsurance} onChange={setAnnualInsurance} placeholder="1,150" suffix="/yr" />
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
                <CurrencyInput value={monthlyHoa} onChange={setMonthlyHoa} placeholder="235" suffix="/mo" />
                <div className="calc-sub-hint">Utah average: ${fmt(UTAH_AVERAGES.hoaMonthly)}/mo</div>
              </>
            )}
          </div>

          <Field label="Monthly Utilities" hint={`Utah average: $${fmt(UTAH_AVERAGES.utilitiesMonthly)}/mo (electricity, gas, water, trash)`}>
            <CurrencyInput value={utilities} onChange={setUtilities} placeholder="240" suffix="/mo" />
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
                `PMI drops off after ~${Math.ceil(result.pmiDropMonth / 12)} years (when balance reaches 80% of original value).`}
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
                  const origMonths = result.termYears * 12
                  const payoff = payoffWithExtra(result.loanAdjusted, result.rateUsed, result.termYears, extra)
                  const monthsSaved = origMonths - payoff.months
                  const interestSaved = result.totalInterest - payoff.interest
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
                        <div className="extra-stat-value">{Math.ceil(payoff.months / 12)} yr</div>
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
                <p className="calc-expand-desc">
                  Typical range: ${fmt(result.closingCosts.range[0])} – ${fmt(result.closingCosts.range[1])} (2–5% of loan).
                  Good news: Utah has <strong>no real estate transfer tax</strong>.
                </p>

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
            const t = result.termYears
            const r = result.rateUsed
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

function AffordCalc({ prefill, liveRates, ratesLoading, runDemo, onDemoComplete, demoPaused }: {
  prefill?: MortgageInput | null; liveRates: LiveRates | null; ratesLoading: boolean
  runDemo?: boolean; onDemoComplete?: () => void; demoPaused?: boolean
}) {
  const [targetPayment, setTargetPayment] = useState('')
  const [county, setCounty] = useState(DEFAULT_COUNTY)
  const [loanType, setLoanType] = useState<LoanType>(prefill?.loan_type as LoanType ?? 'conventional')
  const [term, setTerm] = useState<'15'|'30'>('30')
  const [monthlyHoa, setMonthlyHoa] = useState('0')
  const [includeUtils, setIncludeUtils] = useState(true)
  const [result, setResult] = useState<{grid: {downPct:number;rate:number;homePrice:number;hasMi:boolean}[][]}>( null!)
  const [popup, setPopup] = useState<{downPct:number;rate:number;homePrice:number} | null>(null)
  const calculateRef = useRef<() => void>(() => {})

  const creditScore = prefill?.credit_score ?? 720
  const liveRate = rateForTerm(liveRates, term)

  const suggestedPayment = prefill?.annual_income
    ? Math.round(prefill.annual_income / 12 * 0.28) : null

  // Demo: fill target payment from the 28% rule, then calculate
  useEffect(() => {
    if (!runDemo || !suggestedPayment || demoPaused) return
    setTargetPayment(suggestedPayment.toLocaleString())
    const t = setTimeout(() => {
      calculateRef.current()
      setTimeout(() => onDemoComplete?.(), 1500)
    }, 900)
    return () => clearTimeout(t)
  }, [runDemo, demoPaused]) // eslint-disable-line react-hooks/exhaustive-deps

  const calculate = () => {
    const target = parseCurrency(targetPayment)
    if (target <= 0) return

    const mHoa = parseCurrency(monthlyHoa)
    const taxRateValue = UTAH_COUNTIES[county].taxRate
    const mIns = UTAH_AVERAGES.insuranceAnnual / 12
    const mUtils = includeUtils ? UTAH_AVERAGES.utilitiesMonthly : 0
    const t = parseInt(term)

    const grid = GRID_DOWN_PCTS.map(downPct => {
      // P&I is paid on the ADJUSTED loan (financed FHA MIP / VA / USDA fees),
      // so back the fee multiplier out when converting max loan → home price
      const feeMult = adjustedLoanAmount(1, loanType, downPct / 100)
      return GRID_RATES.map(rate => {
        let homePrice = 400000
        for (let i = 0; i < 12; i++) {
          const mTax = homePrice * taxRateValue / 12
          const loan = homePrice * (1 - downPct / 100)
          const adjLoan = loan * feeMult
          const mi = calcMortgageInsurance(adjLoan, (1 - downPct / 100) * 100, loanType, t, creditScore)
          const availablePI = target - mTax - mIns - mHoa - mi - mUtils
          if (availablePI <= 0) { homePrice = 0; break }
          const maxAdjLoan = maxLoanFromPI(availablePI, rate, t)
          homePrice = (maxAdjLoan / feeMult) / (1 - downPct / 100)
        }
        const loan = homePrice * (1 - downPct / 100)
        const ltv = (1 - downPct / 100) * 100
        const mi = calcMortgageInsurance(loan * feeMult, ltv, loanType, t, creditScore)
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
      <RatesCard rates={liveRates} loading={ratesLoading} />

      <div className="calc-afford-intro">
        Enter your target total monthly housing budget and see the Utah home prices you can afford across different rates and down payments.
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
          <CountySelect value={county} onChange={setCounty} />
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
            {includeUtils && <div className="calc-sub-hint">Using Utah avg: ${fmt(UTAH_AVERAGES.utilitiesMonthly)}/mo</div>}
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
                  {GRID_RATES.map(r => {
                    const isCurrent = Math.abs(r - liveRate.rate) <= 0.25
                    return (
                      <th key={r} className={`afford-rate-header${isCurrent ? ' current-rate' : ''}`}>
                        {r}%{isCurrent ? ' ★' : ''}
                      </th>
                    )
                  })}
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
            <span style={{marginLeft:'0.5rem', fontStyle:'italic'}}>★ = closest to this week's {term}yr rate ({liveRate.rate}%)</span>
          </div>
          <div className="afford-disclaimer">
            Figures are estimates assuming {term}-year loan with {UTAH_COUNTIES[county].name} property taxes. VA/USDA 0% row includes respective fees. Consult a lender for exact qualification.
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
        const mi = calcMortgageInsurance(adjLoan, ltv, loanType, t, creditScore)
        const mTax = hp * UTAH_COUNTIES[county].taxRate / 12
        const mIns = UTAH_AVERAGES.insuranceAnnual / 12
        const mHoa = parseCurrency(monthlyHoa)
        const mUtils = includeUtils ? UTAH_AVERAGES.utilitiesMonthly : 0
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

export default function MortgageCalculator({ onBack, prefill, isDemoRun, demoPaused, inDashboard, onDemoComplete }: Props) {
  const [mode, setMode] = useState<Mode>('payment')
  const [demoPhase, setDemoPhase] = useState<DemoPhase>('idle')
  const [paymentDone, setPaymentDone] = useState(false)
  const [liveRates, setLiveRates] = useState<LiveRates | null>(null)
  const [ratesLoading, setRatesLoading] = useState(true)

  // Fetch this week's Utah rates once for both calculator modes
  useEffect(() => {
    let cancelled = false
    fetch('/api/utah-rates')
      .then(res => { if (!res.ok) throw new Error('failed'); return res.json() })
      .then((data: LiveRates) => { if (!cancelled) setLiveRates(data) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setRatesLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!isDemoRun) return
    const t = setTimeout(() => setDemoPhase('payment'), 800)
    return () => clearTimeout(t)
  }, [isDemoRun])

  // 5-second pause between payment and afford demos; respects demoPaused
  useEffect(() => {
    if (!paymentDone || demoPaused) return
    const t = setTimeout(() => {
      setMode('afford')
      setTimeout(() => setDemoPhase('afford'), 600)
    }, 5000)
    return () => clearTimeout(t)
  }, [paymentDone, demoPaused])

  // When afford demo finishes, signal parent to move on
  useEffect(() => {
    if (demoPhase !== 'done' || demoPaused) return
    const t = setTimeout(() => onDemoComplete?.(), 2000)
    return () => clearTimeout(t)
  }, [demoPhase, demoPaused]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePaymentDemoComplete = () => {
    setPaymentDone(true)
  }

  return (
    <div className="calc-page">
      <div className="calc-page-header">
        {!inDashboard && <button className="calc-back-btn" onClick={onBack}>← Back</button>}
        <div>
          <h2 className="calc-page-title">Utah Mortgage Calculator</h2>
          <p className="calc-page-subtitle">
            {liveRates
              ? `Rates: ${liveRates.source}, week of ${liveRates.as_of} · All figures are estimates`
              : 'All figures are estimates'}
          </p>
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
            liveRates={liveRates}
            ratesLoading={ratesLoading}
            runDemo={demoPhase === 'payment'}
            onDemoComplete={handlePaymentDemoComplete}
            demoPaused={demoPaused}
          />
        )}
        {mode === 'afford' && (
          <AffordCalc
            prefill={prefill}
            liveRates={liveRates}
            ratesLoading={ratesLoading}
            runDemo={demoPhase === 'afford'}
            onDemoComplete={() => setDemoPhase('done')}
            demoPaused={demoPaused}
          />
        )}
      </div>
    </div>
  )
}
