import { useState, useEffect } from 'react'
import { STATE_DATA, CURRENT_RATES, MORTGAGE_INSURANCE, RATE_DATA_DATE } from '../data/stateData'
import { MortgageInput } from '../types'

interface Props {
  onBack: () => void
  prefill?: MortgageInput | null
}

type Mode = 'payment' | 'afford' | 'rentvsbuy'
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
function remainingBalance(loan: number, annualRatePct: number, termYears: number, paymentsMade: number): number {
  if (loan <= 0) return 0
  const r = annualRatePct / 100 / 12
  const n = termYears * 12
  const pi = calcPI(loan, annualRatePct, termYears)
  let bal = loan
  for (let i = 0; i < Math.min(paymentsMade, n); i++) {
    const interest = bal * r
    bal = bal - (pi - interest)
  }
  return Math.max(0, bal)
}

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
  items: { label: string; amount: number }[]
  total: number
  range: [number, number]
} {
  const items = [
    { label: 'Loan origination fee (0.5–1%)',  amount: Math.round(loan * 0.0075) },
    { label: 'Appraisal',                       amount: 550 },
    { label: 'Home inspection',                 amount: 400 },
    { label: 'Title insurance',                 amount: Math.round(homePrice * 0.005) },
    { label: 'Title search & attorney',         amount: 850 },
    { label: 'Recording fees',                  amount: 250 },
    { label: 'Credit report',                   amount: 50 },
    ...(loanType === 'fha' ? [{ label: 'FHA upfront MIP (1.75% — usually financed)', amount: Math.round(loan * 0.0175) }] : []),
    ...(loanType === 'va'  ? [{ label: 'VA funding fee (est. — usually financed)',    amount: Math.round(loan * 0.0215) }] : []),
  ]
  const total = items.reduce((s, i) => s + i.amount, 0)
  const prepaidEscrow = Math.round(homePrice * 0.012) // ~2 months tax + 1mo insurance
  return {
    items: [...items, { label: 'Prepaid items & escrow setup (est.)', amount: prepaidEscrow }],
    total: total + prepaidEscrow,
    range: [Math.round(loan * 0.02), Math.round(loan * 0.05)],
  }
}

// Rent vs Buy: returns net worth at various years
function rentVsBuyAnalysis(params: {
  homePrice: number; down: number; closingCosts: number; loanAmount: number
  annualRatePct: number; termYears: number; monthlyTotal: number
  monthlyRent: number; annualAppreciation: number; annualInvestReturn: number
  annualRentIncrease: number; years: number
}) {
  const { homePrice, down, closingCosts, loanAmount, annualRatePct, termYears, monthlyTotal,
          monthlyRent, annualAppreciation, annualInvestReturn, annualRentIncrease, years } = params

  // Buying: net worth = home value - remaining loan - total cash spent
  const homeValue = homePrice * Math.pow(1 + annualAppreciation / 100, years)
  const remBal = remainingBalance(loanAmount, annualRatePct, termYears, years * 12)
  const equity = homeValue - remBal
  const buyNetWorth = equity // home equity

  // Renting: down payment + closing costs invested; monthly savings invested too
  const initialInvested = (down + closingCosts) * Math.pow(1 + annualInvestReturn / 100, years)
  // Monthly rent increases each year; delta vs buying cost reinvested
  let rentalInvestment = down + closingCosts
  let rentNow = monthlyRent
  let buyingCost = monthlyTotal
  let monthlyInvested = 0
  for (let y = 0; y < years; y++) {
    for (let m = 0; m < 12; m++) {
      monthlyInvested += Math.max(0, buyingCost - rentNow)
      rentalInvestment = rentalInvestment * (1 + annualInvestReturn / 100 / 12) + Math.max(0, buyingCost - rentNow)
    }
    rentNow *= (1 + annualRentIncrease / 100)
  }
  const rentNetWorth = rentalInvestment

  // Total cash out of pocket
  const buyingCashSpent = (down + closingCosts) + monthlyTotal * years * 12
  const rentingCashSpent = monthlyRent * (Math.pow(1 + annualRentIncrease / 100, years) - 1) / (annualRentIncrease / 100) * 12 // rough

  return { buyNetWorth, rentNetWorth, homeValue, remBal, equity, buyingCashSpent, rentingCashSpent: Math.round(rentingCashSpent) }
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
        onChange={e => onChange(e.target.value.replace(/[^\d,]/g, ''))}
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

function PaymentCalc({ prefill }: { prefill?: MortgageInput | null }) {
  const [homePrice, setHomePrice] = useState(prefill ? fmtInput(prefill.home_price) : '')
  const [downDisplay, setDownDisplay] = useState(prefill ? fmtInput(prefill.down_payment) : '')
  const [downMode, setDownMode] = useState<'dollar' | 'percent'>('dollar')
  const [loanType, setLoanType] = useState<LoanType>(prefill?.loan_type as LoanType ?? 'conventional')
  const [term, setTerm] = useState<'10'|'15'|'20'|'30'>('30')
  const [rate, setRate] = useState(String(CURRENT_RATES['30']))
  const [state, setState] = useState('')
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
  const [result, setResult] = useState<PaymentResult | null>(null)

  useEffect(() => { setRate(String(CURRENT_RATES[term])) }, [term])

  useEffect(() => {
    if (!state) return
    const hp = parseCurrency(homePrice)
    if (hp > 0) setAnnualTax(fmtInput(Math.round(hp * STATE_DATA[state].propertyTaxRate)))
    setAnnualInsurance(fmtInput(STATE_DATA[state].avgInsuranceAnnual))
    setUtilities(fmtInput(STATE_DATA[state].avgUtilitiesMonthly))
    if (hasHoa) setMonthlyHoa(fmtInput(STATE_DATA[state].avgHoaMonthly))
  }, [state])

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

  const downPct = (() => {
    const hp = parseCurrency(homePrice)
    if (hp <= 0) return null
    return ((getDownDollars() / hp) * 100).toFixed(1)
  })()

  return (
    <div className="calc-body">
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
          <StateSelect value={state} onChange={setState} label="State (auto-fills local costs)" />

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

          <div className="calc-breakdown">
            <div className="calc-breakdown-row header-row">
              <span>Component</span><span>Monthly</span><span>Annual</span>
            </div>
            {[
              { label: 'Principal & Interest',       value: result.pi,                  always: true  },
              { label: `Mortgage Insurance (${['fha','usda'].includes(loanType) ? 'MIP/fee' : 'PMI'})`, value: result.mortgageInsurance, always: result.mortgageInsurance > 0 },
              { label: 'Property Tax',               value: result.monthlyTax,          always: true  },
              { label: "Homeowner's Insurance",      value: result.monthlyInsurance,    always: true  },
              { label: 'HOA',                        value: result.monthlyHoa,          always: hasHoa },
              { label: 'Utilities',                  value: result.utilities,           always: result.utilities > 0 },
              { label: 'Maintenance Reserve (1%/yr)',value: result.maintenance,         always: includeMaintenance },
            ].filter(r => r.always && r.value > 0).map(row => (
              <div key={row.label} className="calc-breakdown-row">
                <span>{row.label}</span>
                <span>${fmt(row.value)}</span>
                <span className="calc-annual">${fmt(row.value * 12)}</span>
              </div>
            ))}
            <div className="calc-breakdown-divider" />
            <div className="calc-breakdown-row total-line">
              <span>Total Monthly</span>
              <span>${fmt(result.total)}</span>
              <span className="calc-annual">${fmt(result.total * 12)}</span>
            </div>
          </div>

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
                <p className="calc-expand-desc">Typical range: ${fmt(result.closingCosts.range[0])} – ${fmt(result.closingCosts.range[1])} (2–5% of loan). These are paid at closing.</p>
                <div className="closing-item">
                  <span>Down payment</span>
                  <span>${fmt(result.down)}</span>
                </div>
                {result.closingCosts.items.map(item => (
                  <div key={item.label} className="closing-item">
                    <span>{item.label}</span>
                    <span>${fmt(item.amount)}</span>
                  </div>
                ))}
                <div className="closing-total">
                  <span>Estimated Closing Costs</span>
                  <span>${fmt(result.closingCosts.total)}</span>
                </div>
                <div className="closing-total" style={{ marginTop: '0.5rem', borderTop: '2px solid #1d4ed8', paddingTop: '0.5rem' }}>
                  <span>Total Cash to Close</span>
                  <span>${fmt(result.down + result.closingCosts.total)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── What Can I Afford ─────────────────────────────────────────────────────────

const GRID_RATES = [5.0, 5.5, 6.0, 6.5, 7.0, 7.5, 8.0]
const GRID_DOWN_PCTS = [0, 3, 5, 10, 15, 20]

function AffordCalc({ prefill }: { prefill?: MortgageInput | null }) {
  const [targetPayment, setTargetPayment] = useState('')
  const [state, setState] = useState('')
  const [loanType, setLoanType] = useState<LoanType>('conventional')
  const [term, setTerm] = useState<'15'|'30'>('30')
  const [monthlyHoa, setMonthlyHoa] = useState('0')
  const [includeUtils, setIncludeUtils] = useState(true)
  const [result, setResult] = useState<{grid: {downPct:number;rate:number;homePrice:number;hasMi:boolean}[][]}>( null!)

  const suggestedPayment = prefill?.annual_income
    ? Math.round(prefill.annual_income / 12 * 0.28) : null

  const calculate = () => {
    const target = parseCurrency(targetPayment)
    if (target <= 0) return

    const mHoa = parseCurrency(monthlyHoa)
    const annualIns = state ? STATE_DATA[state].avgInsuranceAnnual : 1500
    const mIns = annualIns / 12
    const mUtils = state && includeUtils ? STATE_DATA[state].avgUtilitiesMonthly : 0
    const t = parseInt(term)

    const grid = GRID_DOWN_PCTS.map(downPct => {
      return GRID_RATES.map(rate => {
        let homePrice = 400000
        for (let i = 0; i < 12; i++) {
          const mTax = state ? homePrice * STATE_DATA[state].propertyTaxRate / 12 : 0
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

  const maxPrice = result ? Math.max(...result.grid.flat().map(c => c.homePrice)) : 0
  const cellColor = (hp: number) => {
    if (hp <= 0) return 'cell-none'
    const ratio = hp / maxPrice
    return ratio > 0.75 ? 'cell-high' : ratio > 0.45 ? 'cell-mid' : 'cell-low'
  }

  return (
    <div className="calc-body">
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
                      <td key={ci} className={`afford-cell ${cellColor(cell.homePrice)}`}>
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
    </div>
  )
}

// ── Rent vs Buy ───────────────────────────────────────────────────────────────

function RentVsBuy({ prefill }: { prefill?: MortgageInput | null }) {
  const [homePrice, setHomePrice] = useState(prefill ? fmtInput(prefill.home_price) : '')
  const [downPct, setDownPct] = useState('10')
  const [rate, setRate] = useState(String(CURRENT_RATES['30']))
  const [term, setTerm] = useState('30')
  const [state, setState] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [appreciation, setAppreciation] = useState('3.5')
  const [investReturn, setInvestReturn] = useState('7.0')
  const [rentIncrease, setRentIncrease] = useState('3.0')
  const [loanType, setLoanType] = useState<LoanType>('conventional')
  const [result, setResult] = useState<{yr5: ReturnType<typeof rentVsBuyAnalysis>; yr10: ReturnType<typeof rentVsBuyAnalysis>; yr20: ReturnType<typeof rentVsBuyAnalysis>; breakEven: number | null; monthlyBuy: number; monthlyRent: number} | null>(null)

  useEffect(() => {
    if (!state) return
    const hp = parseCurrency(homePrice)
    if (hp > 0) { /* auto fill not needed here */ }
  }, [state])

  const calculate = () => {
    const hp = parseCurrency(homePrice)
    const down = hp * parseFloat(downPct) / 100
    const baseLoan = hp - down
    const adjLoan = adjustedLoanAmount(baseLoan, loanType, parseFloat(downPct) / 100)
    const r = parseFloat(rate)
    const t = parseInt(term)
    const rent = parseCurrency(monthlyRent)
    if (hp <= 0 || rent <= 0) return

    const mTax = state ? hp * STATE_DATA[state].propertyTaxRate / 12 : hp * 0.01 / 12
    const mIns = state ? STATE_DATA[state].avgInsuranceAnnual / 12 : 125
    const mHoa = state ? STATE_DATA[state].avgHoaMonthly * 0.3 : 0 // assume 30% chance of HOA
    const mUtils = state ? STATE_DATA[state].avgUtilitiesMonthly : 250
    const mMaint = hp * 0.01 / 12
    const pi = calcPI(adjLoan, r, t)
    const mi = calcMortgageInsurance(adjLoan, (baseLoan / hp) * 100, loanType, t)
    const monthlyBuy = pi + mi + mTax + mIns + mHoa + mUtils + mMaint

    const closing = estimateClosingCosts(hp, baseLoan, loanType)
    const params = {
      homePrice: hp, down, closingCosts: closing.total, loanAmount: adjLoan,
      annualRatePct: r, termYears: t, monthlyTotal: monthlyBuy,
      monthlyRent: rent, annualAppreciation: parseFloat(appreciation),
      annualInvestReturn: parseFloat(investReturn), annualRentIncrease: parseFloat(rentIncrease),
    }

    // Find break-even year
    let breakEven: number | null = null
    for (let y = 1; y <= 30; y++) {
      const b = rentVsBuyAnalysis({ ...params, years: y })
      if (b.buyNetWorth > b.rentNetWorth) { breakEven = y; break }
    }

    setResult({
      yr5:  rentVsBuyAnalysis({ ...params, years: 5  }),
      yr10: rentVsBuyAnalysis({ ...params, years: 10 }),
      yr20: rentVsBuyAnalysis({ ...params, years: 20 }),
      breakEven,
      monthlyBuy,
      monthlyRent: rent,
    })
  }

  return (
    <div className="calc-body">
      <div className="calc-afford-intro">
        Compare the true long-term cost of buying vs. renting, accounting for equity buildup, appreciation, and the opportunity cost of your down payment.
      </div>

      <div className="calc-form-grid">
        <div className="calc-col">
          <Field label="Home Price">
            <CurrencyInput value={homePrice} onChange={setHomePrice} placeholder="400,000" />
          </Field>
          <Field label="Down Payment">
            <div className="calc-input-wrap">
              <input className="calc-input no-prefix" type="number" min="0" max="100" value={downPct} onChange={e => setDownPct(e.target.value)} />
              <span className="calc-suffix">%</span>
            </div>
          </Field>
          <Field label="Loan Type">
            <SegGroup options={[{label:'Conv.',value:'conventional'},{label:'FHA',value:'fha'},{label:'VA',value:'va'},{label:'USDA',value:'usda'}]} value={loanType} onChange={v => setLoanType(v as LoanType)} />
          </Field>
          <Field label="Interest Rate">
            <div className="calc-input-wrap">
              <input className="calc-input no-prefix" type="number" step="0.05" min="1" max="20" value={rate} onChange={e => setRate(e.target.value)} />
              <span className="calc-suffix">%</span>
            </div>
          </Field>
          <StateSelect value={state} onChange={setState} label="State (optional, improves accuracy)" />
        </div>

        <div className="calc-col">
          <Field label="Current Monthly Rent" hint="What you pay (or would pay) to rent a comparable home">
            <CurrencyInput value={monthlyRent} onChange={setMonthlyRent} placeholder="1,800" suffix="/mo" />
          </Field>
          <Field label="Expected Home Appreciation" hint="Historical avg: 3–4%/yr nationally">
            <div className="calc-input-wrap">
              <input className="calc-input no-prefix" type="number" step="0.5" value={appreciation} onChange={e => setAppreciation(e.target.value)} />
              <span className="calc-suffix">%/yr</span>
            </div>
          </Field>
          <Field label="Expected Investment Return" hint="If down payment were invested instead (S&P 500 ~10%, conservative ~7%)">
            <div className="calc-input-wrap">
              <input className="calc-input no-prefix" type="number" step="0.5" value={investReturn} onChange={e => setInvestReturn(e.target.value)} />
              <span className="calc-suffix">%/yr</span>
            </div>
          </Field>
          <Field label="Annual Rent Increase" hint="Historical avg: 3%/yr">
            <div className="calc-input-wrap">
              <input className="calc-input no-prefix" type="number" step="0.5" value={rentIncrease} onChange={e => setRentIncrease(e.target.value)} />
              <span className="calc-suffix">%/yr</span>
            </div>
          </Field>
        </div>
      </div>

      <button className="calc-submit-btn" onClick={calculate}>Compare Rent vs. Buy →</button>

      {result && (
        <div className="rvb-result">
          <div className="rvb-monthly-compare">
            <div className="rvb-monthly-card buy">
              <div className="rvb-monthly-label">Buying — Month 1</div>
              <div className="rvb-monthly-value">${fmt(result.monthlyBuy)}<span>/mo</span></div>
              <div className="rvb-monthly-note">true total cost incl. maintenance</div>
            </div>
            <div className="rvb-vs">vs</div>
            <div className="rvb-monthly-card rent">
              <div className="rvb-monthly-label">Renting — Month 1</div>
              <div className="rvb-monthly-value">${fmt(result.monthlyRent)}<span>/mo</span></div>
              <div className="rvb-monthly-note">{result.monthlyBuy > result.monthlyRent ? `$${fmt(result.monthlyBuy - result.monthlyRent)}/mo more to buy` : `$${fmt(result.monthlyRent - result.monthlyBuy)}/mo less to buy`}</div>
            </div>
          </div>

          {result.breakEven !== null ? (
            <div className="rvb-breakeven">
              🎯 Buying becomes the better financial choice in approximately <strong>Year {result.breakEven}</strong>
            </div>
          ) : (
            <div className="rvb-breakeven warn">
              At these assumptions, renting may be financially superior over 30 years. Consider adjusting appreciation or investment return assumptions.
            </div>
          )}

          <div className="rvb-grid">
            <div className="rvb-grid-header"><span></span><span>5 Years</span><span>10 Years</span><span>20 Years</span></div>
            {[
              { label: '🏠 Home Equity (Buying)', buy: (r: ReturnType<typeof rentVsBuyAnalysis>) => r.equity },
              { label: '💼 Investment (Renting)', buy: (r: ReturnType<typeof rentVsBuyAnalysis>) => r.rentNetWorth },
            ].map(row => (
              <div key={row.label} className="rvb-grid-row">
                <span className="rvb-row-label">{row.label}</span>
                {[result.yr5, result.yr10, result.yr20].map((r, i) => (
                  <span key={i} className={`rvb-cell${row.buy(r) === Math.max(result.yr5.equity, result.yr5.rentNetWorth, result.yr10.equity, result.yr10.rentNetWorth) && i === 0 ? ' winner' : ''}`}>
                    {fmtK(row.buy(r))}
                  </span>
                ))}
              </div>
            ))}
            <div className="rvb-grid-divider" />
            <div className="rvb-grid-row highlight">
              <span>Net Worth Advantage</span>
              {[result.yr5, result.yr10, result.yr20].map((r, i) => {
                const diff = r.equity - r.rentNetWorth
                return (
                  <span key={i} className={diff > 0 ? 'winner' : 'loser'}>
                    {diff > 0 ? '+' : ''}{fmtK(diff)} {diff > 0 ? '(buy)' : '(rent)'}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="rvb-disclaimer">
            Net worth estimates assume: {appreciation}%/yr appreciation · {investReturn}%/yr investment return · {rentIncrease}%/yr rent increase.
            Does not include tax benefits (mortgage interest deduction), actual selling costs, or capital gains tax. Past performance ≠ future results.
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MortgageCalculator({ onBack, prefill }: Props) {
  const [mode, setMode] = useState<Mode>('payment')

  return (
    <div className="calc-page">
      <div className="calc-page-header">
        <button className="calc-back-btn" onClick={onBack}>← Back to Results</button>
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
          <button className={`calc-tab${mode === 'rentvsbuy' ? ' active' : ''}`} onClick={() => setMode('rentvsbuy')}>
            ⚖️ Rent vs. Buy
          </button>
        </div>

        {mode === 'payment'    && <PaymentCalc  prefill={prefill} />}
        {mode === 'afford'     && <AffordCalc   prefill={prefill} />}
        {mode === 'rentvsbuy'  && <RentVsBuy    prefill={prefill} />}
      </div>
    </div>
  )
}
