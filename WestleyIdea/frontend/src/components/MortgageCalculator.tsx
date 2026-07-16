import { useState, useEffect } from 'react'
import {
  UTAH_COUNTIES, DEFAULT_COUNTY, UTAH_AVERAGES,
  rateForTerm, LiveRates,
} from '../data/utahData'
import { MortgageInput } from '../types'
import {
  adjustedLoanAmount,
  affordableHomePrice,
  calcPI,
  computePaymentScenario,
  downPaymentWarnings,
  firstYearMortgageInsurance,
  minimumDownPercent,
  monthsUntilBalanceRatio,
  payoffWithExtra,
  upfrontFeeRate,
  type LoanType,
  type VaUsage,
} from '../utils/mortgageMath'

interface Props {
  prefill?: MortgageInput | null
}

type Mode = 'payment' | 'afford'

// Closing cost estimate — Utah-typical figures. Utah has no real estate
// transfer tax, and title companies (not attorneys) handle closings.
function estimateClosingCosts(
  homePrice: number,
  loan: number,
  loanType: LoanType,
  downPct: number,
  annualRatePct: number,
  annualTax: number,
  annualInsurance: number,
  feeOptions: { vaUsage?: VaUsage; vaFundingFeeExempt?: boolean },
): {
  cashItems: { label: string; amount: number }[]
  financedItems: { label: string; amount: number }[]
  cashTotal: number
  financedTotal: number
  range: [number, number]
} {
  const cashItems = [
    { label: 'Home inspection',                           amount: 450 },
    { label: "Owner's title insurance (recommended)",     amount: Math.round(homePrice * 0.003) },
    { label: 'Title search & settlement fee',             amount: 600 },
    { label: 'Recording fees (Utah flat-fee)',            amount: 60 },
  ]
  if (loan > 0) {
    cashItems.unshift(
      { label: 'Loan origination fee (0.5–1%)', amount: Math.round(loan * 0.0075) },
      { label: 'Underwriting & processing', amount: 695 },
      { label: 'Appraisal', amount: 550 },
      { label: "Lender's title insurance (~0.4% of loan)", amount: Math.round(loan * 0.004) },
      { label: 'Credit report', amount: 45 },
    )
    // Planning estimate: first-year insurance, 15 days' interest, and three months of escrow.
    const prepaidInsurance = Math.max(0, annualInsurance)
    const prepaidInterest = Math.max(0, loan * annualRatePct / 100 / 365 * 15)
    const initialEscrow = Math.max(0, (annualTax + annualInsurance) / 12 * 3)
    cashItems.push({ label: 'First-year homeowner insurance', amount: Math.round(prepaidInsurance) })
    cashItems.push({ label: 'Prepaid interest (15-day estimate)', amount: Math.round(prepaidInterest) })
    cashItems.push({ label: 'Initial tax & insurance escrow (3-month estimate)', amount: Math.round(initialEscrow) })
  }

  const financedItems: { label: string; amount: number }[] = []
  const financedRate = upfrontFeeRate(loanType, downPct, feeOptions)
  if (financedRate > 0) {
    const label = loanType === 'fha'
      ? 'FHA upfront MIP (1.75%)'
      : loanType === 'va'
        ? `VA funding fee (${(financedRate * 100).toFixed(2)}%)`
        : 'USDA guarantee fee (1%)'
    financedItems.push({ label, amount: Math.round(loan * financedRate) })
  }

  const cashTotal = cashItems.reduce((s, i) => s + i.amount, 0)
  const financedTotal = financedItems.reduce((s, i) => s + i.amount, 0)
  const rangeRates: [number, number] = loan > 0 ? [0.02, 0.05] : [0.01, 0.03]
  return { cashItems, financedItems, cashTotal, financedTotal, range: [Math.round(homePrice * rangeRates[0]), Math.round(homePrice * rangeRates[1])] }
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
          County planning rate: <strong>{(county.taxRate * 100).toFixed(2)}%/yr</strong> on a primary
          residence (45% residential exemption included). Actual tax-area rates and assessed values vary.
        </div>
      )}
    </Field>
  )
}

// National conventional benchmark from Freddie Mac PMMS via the backend.
function RatesCard({ rates, loading }: { rates: LiveRates | null; loading: boolean }) {
  return (
    <div className="rates-card">
      <div className="rates-card-header">
        <span className="rates-flag">National Mortgage Rate Benchmark</span>
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
            {rates.source}{rates.live ? ` · week of ${rates.as_of}` : ` · ${rates.as_of}`}. Conventional conforming benchmark for a
            strong-credit, roughly 20%-down borrower. FHA, VA, USDA, low-down-payment, and
            individual lender quotes may differ.
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
  totalInterest: number; closingCosts: ReturnType<typeof estimateClosingCosts>
  pmiRequestMonth: number | null; pmiAutomaticMonth: number | null
  frontEndDTI: number | null; backEndDTI: number | null; down: number
  totalScheduledMortgageInsurance: number; warnings: string[]
  rateUsed: number; termYears: number
}

function PaymentCalc({ prefill, liveRates, ratesLoading }: {
  prefill?: MortgageInput | null; liveRates: LiveRates | null; ratesLoading: boolean
}) {
  const [homePrice, setHomePrice] = useState(prefill ? fmtInput(prefill.home_price) : '')
  const [downDisplay, setDownDisplay] = useState(prefill ? fmtInput(prefill.down_payment) : '')
  const [downMode, setDownMode] = useState<'dollar' | 'percent'>('dollar')
  const [loanType, setLoanType] = useState<LoanType>(prefill?.loan_type as LoanType ?? 'conventional')
  const [vaUsage, setVaUsage] = useState<VaUsage>(prefill?.va_usage ?? 'first')
  const [vaFundingFeeExempt, setVaFundingFeeExempt] = useState(prefill?.va_funding_fee_exempt ?? false)
  const [term, setTerm] = useState<'10'|'15'|'20'|'30'>('30')
  const [rate, setRate] = useState('')
  const [rateTouched, setRateTouched] = useState(false)
  const [county, setCounty] = useState(
    prefill?.county && UTAH_COUNTIES[prefill.county] ? prefill.county : DEFAULT_COUNTY,
  )
  const [annualTax, setAnnualTax] = useState('')
  const [taxTouched, setTaxTouched] = useState(false)
  const [annualInsurance, setAnnualInsurance] = useState(fmtInput(UTAH_AVERAGES.insuranceAnnual))
  const [monthlyHoa, setMonthlyHoa] = useState('')
  const [hasHoa, setHasHoa] = useState(false)
  const [utilities, setUtilities] = useState(fmtInput(UTAH_AVERAGES.utilitiesMonthly))
  const [includeMaintenance, setIncludeMaintenance] = useState(true)
  const [annualIncome, setAnnualIncome] = useState(prefill ? fmtInput(prefill.annual_income) : '')
  const [monthlyDebts, setMonthlyDebts] = useState(prefill ? fmtInput(prefill.monthly_debts) : '')
  const [monthlyPmiOverride, setMonthlyPmiOverride] = useState('')
  const [extraPayment, setExtraPayment] = useState('')
  const [showAmort, setShowAmort] = useState(false)
  const [showClosing, setShowClosing] = useState(false)
  const [showRefi, setShowRefi] = useState(false)
  const [result, setResult] = useState<PaymentResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

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

  // Never leave a result attached to inputs that changed after Calculate was pressed.
  useEffect(() => {
    setResult(null)
    setValidationError(null)
  }, [
    homePrice, downDisplay, downMode, loanType, vaUsage, vaFundingFeeExempt,
    term, rate, county, annualTax, annualInsurance, monthlyHoa, hasHoa, utilities,
    includeMaintenance, annualIncome, monthlyDebts, monthlyPmiOverride,
  ])

  const getDownDollars = () => {
    const hp = parseCurrency(homePrice)
    if (downMode === 'dollar') return parseCurrency(downDisplay)
    return hp * (parseCurrency(downDisplay) / 100)
  }

  const changeDownMode = (nextMode: 'dollar' | 'percent') => {
    if (nextMode === downMode) return
    if (downDisplay.trim() === '') {
      setDownMode(nextMode)
      return
    }
    const hp = parseCurrency(homePrice)
    const downDollars = getDownDollars()
    setDownDisplay(nextMode === 'dollar'
      ? Math.round(downDollars).toLocaleString()
      : hp > 0 ? (downDollars / hp * 100).toFixed(1).replace(/\.0$/, '') : '')
    setDownMode(nextMode)
  }

  const calculate = () => {
    const hp = parseCurrency(homePrice)
    const down = getDownDollars()
    const r = rate.trim() === '' ? defaultRate.rate : Number(rate)
    const t = parseInt(term)
    if (!Number.isFinite(hp) || hp <= 0) { setValidationError('Enter a valid home price greater than $0.'); return }
    if (hp > 50_000_000) { setValidationError('Enter a home price of $50 million or less.'); return }
    if (down < 0) { setValidationError('Down payment cannot be negative.'); return }
    if (down > hp) { setValidationError('Down payment cannot exceed the home price.'); return }
    if (!Number.isFinite(r) || r <= 0 || r > 25 || t <= 0) { setValidationError('Enter an interest rate greater than 0% and no more than 25%.'); return }
    setValidationError(null)

    const feeOptions = { vaUsage, vaFundingFeeExempt }
    const pmiOverride = monthlyPmiOverride.trim() === '' ? null : parseCurrency(monthlyPmiOverride)
    const scenario = computePaymentScenario({
      homePrice: hp,
      downDollars: down,
      loanType,
      termYears: t,
      ratePct: r,
      annualTax: parseCurrency(annualTax),
      annualInsurance: parseCurrency(annualInsurance),
      monthlyHoa: hasHoa ? parseCurrency(monthlyHoa) : 0,
      monthlyUtilities: parseCurrency(utilities) || 0,
      monthlyMaintenance: includeMaintenance ? hp * 0.01 / 12 : 0,
      annualIncome: parseCurrency(annualIncome),
      monthlyDebts: parseCurrency(monthlyDebts),
      creditScore,
      pmiMonthlyOverride: pmiOverride,
      feeOptions,
    })
    const { baseLoan, downPct } = scenario

    const warnings = downPaymentWarnings(loanType, downPct, creditScore)
    if (prefill?.available_savings != null && down > prefill.available_savings) {
      warnings.unshift(`This scenario uses $${fmt(down - prefill.available_savings)} more than the savings entered in the questionnaire.`)
    }
    if (loanType === 'conventional' && baseLoan > 832_750) {
      warnings.push('This is above the 2026 baseline conforming limit; verify the county high-balance limit or use jumbo-loan pricing.')
    }
    if (loanType === 'fha' && baseLoan > 541_287) {
      warnings.push('This is above the 2026 FHA national floor; verify the exact FHA limit for the property county.')
    }
    if (baseLoan === 0) warnings.push('This is a cash-purchase scenario, so no mortgage principal or interest is included.')

    const closing = estimateClosingCosts(
      hp, baseLoan, loanType, downPct, r, scenario.monthlyTax * 12, scenario.monthlyInsurance * 12,
      { vaUsage, vaFundingFeeExempt },
    )

    setResult({ loanBase: baseLoan, loanAdjusted: scenario.adjustedLoan, ltv: scenario.ltv,
      pi: scenario.pi, mortgageInsurance: scenario.mortgageInsurance,
      monthlyTax: scenario.monthlyTax, monthlyInsurance: scenario.monthlyInsurance,
      monthlyHoa: scenario.monthlyHoa, utilities: scenario.monthlyUtilities,
      maintenance: scenario.monthlyMaintenance, total: scenario.total,
      totalInterest: scenario.totalInterest, closingCosts: closing,
      pmiRequestMonth: scenario.pmiRequestMonth, pmiAutomaticMonth: scenario.pmiAutomaticMonth,
      frontEndDTI: scenario.frontEndDTI, backEndDTI: scenario.backEndDTI, down,
      totalScheduledMortgageInsurance: scenario.totalScheduledMortgageInsurance,
      warnings, rateUsed: r, termYears: t })
  }

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
                <button className={`calc-toggle${downMode === 'dollar' ? ' active' : ''}`} onClick={() => changeDownMode('dollar')}>$</button>
                <button className={`calc-toggle${downMode === 'percent' ? ' active' : ''}`} onClick={() => changeDownMode('percent')}>%</button>
              </div>
            </div>
            {downMode === 'dollar' ? (
              <CurrencyInput value={downDisplay} onChange={setDownDisplay} placeholder="90,000" />
            ) : (
              <div className="calc-input-wrap">
                <input
                  className="calc-input no-prefix"
                  type="number"
                  inputMode="decimal"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="20"
                  value={downDisplay}
                  onChange={e => setDownDisplay(e.target.value)}
                />
                <span className="calc-suffix">%</span>
              </div>
            )}
            {downPct !== null && parseFloat(downPct) > 100 ? (
              <div className="calc-sub-hint calc-hint-error">
                Down payment cannot exceed the home price.
              </div>
            ) : downPct !== null && (
              <div className="calc-sub-hint">
                {downMode === 'dollar' ? `${downPct}% of home price` : `$${fmt(getDownDollars())}`}
                {parseFloat(downPct) >= 100
                  ? ' · Cash-purchase scenario'
                  : loanType === 'va'
                    ? ' · No monthly mortgage insurance'
                    : loanType === 'fha'
                      ? ' · FHA annual MIP applies'
                      : loanType === 'usda'
                        ? ' · USDA annual fee applies'
                        : parseFloat(downPct) < 20 ? ' · Estimated PMI applies' : ' · No PMI'}
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
              {loanType === 'va'   && 'VA funding fee is based on usage, exemption, and down payment — no monthly mortgage insurance'}
              {loanType === 'usda' && 'Includes 1% upfront fee + 0.35%/yr annual guarantee fee'}
              {loanType === 'conventional' && (parseFloat(downPct ?? '20') < 20
                ? 'PMI shown is a planning estimate; enter a lender quote below when available'
                : 'No PMI with 20%+ down')}
            </div>
            {loanType === 'va' && (
              <div className="calc-inline-options">
                <SegGroup options={[{label:'First use',value:'first'},{label:'Subsequent',value:'subsequent'}]} value={vaUsage} onChange={v => setVaUsage(v as VaUsage)} />
                <button className={`calc-toggle-pill${vaFundingFeeExempt ? ' active' : ''}`} onClick={() => setVaFundingFeeExempt(v => !v)}>
                  {vaFundingFeeExempt ? '✓ Funding-fee exempt' : 'Not exempt / unsure'}
                </button>
              </div>
            )}
          </Field>

          {loanType === 'conventional' && parseFloat(downPct ?? '20') < 20 && (
            <Field label="Monthly PMI quote (optional)" hint="Leave blank to use the credit-score and LTV planning estimate.">
              <CurrencyInput value={monthlyPmiOverride} onChange={setMonthlyPmiOverride} placeholder="Use estimate" suffix="/mo" />
            </Field>
          )}

          <Field label="Loan Term">
            <SegGroup options={[{label:'10yr',value:'10'},{label:'15yr',value:'15'},{label:'20yr',value:'20'},{label:'30yr',value:'30'}]} value={term} onChange={v => setTerm(v as typeof term)} />
          </Field>

          <Field
            label="Interest Rate"
            hint={rateTouched
              ? undefined
              : defaultRate.estimated && liveRates
                ? `Planning estimate derived from the national conventional benchmark; enter a lender quote when available`
                : `National conventional benchmark — edit to match your program-specific lender quote`}
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

          <Field label="Annual Income (optional)" hint="Used for front-end and total DTI planning ratios">
            <CurrencyInput value={annualIncome} onChange={setAnnualIncome} placeholder="80,000" suffix="/yr" />
          </Field>

          <Field label="Existing Monthly Debts" hint="Car, student, and personal loans, minimum credit-card payments, and child support or alimony — not rent, utilities, or this new housing payment.">
            <CurrencyInput value={monthlyDebts} onChange={setMonthlyDebts} placeholder="500" suffix="/mo" />
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

      <button className="calc-submit-btn" onClick={calculate}>Calculate Monthly Ownership Cost →</button>
      {validationError && <div className="calc-validation-error">{validationError}</div>}

      {result && (
        <div className="calc-result">
          <div className="calc-result-header">
            <div className="calc-total-payment">${fmt(result.total)}<span>/mo</span></div>
            <div className="calc-total-label">Estimated Monthly Ownership Cost</div>
            {result.frontEndDTI !== null && result.backEndDTI !== null && (
              <div className="calc-dti-summary">
                <span className="calc-dti-badge">Housing ratio: {result.frontEndDTI.toFixed(1)}%</span>
                <span className="calc-dti-badge">Total debt ratio: {result.backEndDTI.toFixed(1)}%</span>
                <div className="calc-dti-context">Planning ratios only; lender limits and qualifying income rules vary by program and borrower.</div>
              </div>
            )}
          </div>

          {result.warnings.length > 0 && (
            <div className="calc-warning-list">
              {result.warnings.map(warning => <div key={warning}>{warning}</div>)}
            </div>
          )}

          {(() => {
            const rows = [
              { label: 'Principal & Interest',        value: result.pi,               always: result.loanAdjusted > 0 },
              { label: `Mortgage Insurance (${['fha','usda'].includes(loanType) ? 'MIP/fee' : 'PMI'})`, value: result.mortgageInsurance, always: result.mortgageInsurance > 0 },
              { label: 'Property Tax',                value: result.monthlyTax,       always: result.monthlyTax > 0 },
              { label: "Homeowner's Insurance",      value: result.monthlyInsurance, always: result.monthlyInsurance > 0 },
              { label: 'HOA',                         value: result.monthlyHoa,       always: result.monthlyHoa > 0 },
              { label: 'Utilities',                   value: result.utilities,        always: result.utilities > 0 },
              { label: 'Maintenance Reserve (1%/yr)', value: result.maintenance,      always: result.maintenance > 0 },
            ].filter(r => r.always && r.value > 0)

            const activeTotal = rows.reduce((sum, row) => sum + row.value, 0)

            return (
              <div className="calc-breakdown">
                <div className="calc-breakdown-row header-row">
                  <span>Component</span><span>Monthly</span><span>Annual</span>
                </div>
                {rows.map(row => (
                  <div key={row.label} className="calc-breakdown-row">
                    <span>{row.label}</span>
                    <span>${fmt(row.value)}</span>
                    <span className="calc-annual">${fmt(row.value * 12)}</span>
                  </div>
                ))}
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
                'FHA annual MIP lasts for the loan term with less than 10% down. The amount shown is a first-year estimate and generally declines each year.'}
              {loanType === 'fha' && downPct !== null && parseFloat(downPct) >= 10 &&
                'FHA annual MIP is scheduled for 11 years with at least 10% down. The amount shown is a first-year estimate and generally declines each year.'}
              {loanType === 'conventional' && result.pmiRequestMonth !== null && result.pmiAutomaticMonth !== null &&
                `You may request PMI cancellation around month ${result.pmiRequestMonth} at 80% of original value if legal requirements are met; automatic termination is generally around month ${result.pmiAutomaticMonth} at scheduled 78% LTV.`}
              {loanType === 'usda' && 'The USDA annual guarantee fee lasts for the loan term and generally declines as the scheduled balance falls.'}
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
            {result.totalScheduledMortgageInsurance > 0 && (
              <div className="calc-lifetime-item">
                <div className="calc-lifetime-label">Scheduled MI / Annual Fees</div>
                <div className="calc-lifetime-value">{fmtK(result.totalScheduledMortgageInsurance)}</div>
                <div className="calc-lifetime-sub">Planning estimate over scheduled duration</div>
              </div>
            )}
          </div>

          {/* Extra payment calculator */}
          {result.loanAdjusted > 0 && <div className="calc-expand-section">
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
          </div>}

          {/* Closing costs */}
          <div className="calc-expand-section">
            <div className="calc-expand-header" onClick={() => setShowClosing(v => !v)}>
              <span>🏁 Estimated Closing Costs</span>
              <span>{showClosing ? '▲' : '▼'}</span>
            </div>
            {showClosing && (
              <div className="calc-expand-body">
                <p className="calc-expand-desc">
                  Broad planning range: ${fmt(result.closingCosts.range[0])} – ${fmt(result.closingCosts.range[1])} ({result.loanBase > 0 ? '2–5%' : '1–3%'} of home price).
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
            const equityMonth = monthsUntilBalanceRatio(adjLoan, hp, r, t, 0.80)
            const yearsToEquity = Math.ceil(equityMonth / 12)

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
                      Refinancing is optional and depends on future rates, credit, equity, property value, and closing costs.
                      On the scheduled balance used here, you may reach 20% equity in about <strong>{yearsToEquity} years</strong>.
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

function gridDownPaymentPercents(loanType: LoanType, creditScore: number): number[] {
  // Round away float noise (0.035 × 100 = 3.5000000000000004) — these are row labels
  const minimum = Math.round(minimumDownPercent(loanType, creditScore) * 1000) / 10
  const candidates = loanType === 'conventional'
    ? [minimum, 5, 10, 15, 20]
    : loanType === 'fha'
      ? [minimum, 10, 15, 20]
      : [0, 5, 10, 15, 20]
  return [...new Set(candidates)].sort((a, b) => a - b)
}

function AffordCalc({ prefill, liveRates, ratesLoading }: {
  prefill?: MortgageInput | null; liveRates: LiveRates | null; ratesLoading: boolean
}) {
  const monthlyGrossIncome = (prefill?.annual_income ?? 0) / 12
  const suggestedPayment = monthlyGrossIncome > 0
    ? Math.max(0, Math.round(Math.min(
      monthlyGrossIncome * 0.28,
      monthlyGrossIncome * 0.43 - (prefill?.monthly_debts ?? 0),
    )))
    : null

  // Start from the 28%-rule budget based on the income they entered in the quiz
  const [targetPayment, setTargetPayment] = useState(
    suggestedPayment ? suggestedPayment.toLocaleString() : '',
  )
  const [county, setCounty] = useState(
    prefill?.county && UTAH_COUNTIES[prefill.county] ? prefill.county : DEFAULT_COUNTY,
  )
  const [loanType, setLoanType] = useState<LoanType>(prefill?.loan_type as LoanType ?? 'conventional')
  const [vaUsage, setVaUsage] = useState<VaUsage>(prefill?.va_usage ?? 'first')
  const [vaFundingFeeExempt, setVaFundingFeeExempt] = useState(prefill?.va_funding_fee_exempt ?? false)
  const [term, setTerm] = useState<'15'|'30'>('30')
  const [monthlyHoa, setMonthlyHoa] = useState('0')
  const [includeUtils, setIncludeUtils] = useState(true)
  const [result, setResult] = useState<{grid: {downPct:number;rate:number;homePrice:number;hasMi:boolean}[][]} | null>(null)
  const [popup, setPopup] = useState<{downPct:number;rate:number;homePrice:number} | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  const creditScore = prefill?.credit_score ?? 720
  const liveRate = rateForTerm(liveRates, term)
  const downPaymentPercents = gridDownPaymentPercents(loanType, creditScore)
  const feeOptions = { vaUsage, vaFundingFeeExempt }

  useEffect(() => {
    setResult(null)
    setPopup(null)
    setValidationError(null)
  }, [targetPayment, county, loanType, vaUsage, vaFundingFeeExempt, term, monthlyHoa, includeUtils])

  const calculate = () => {
    const target = parseCurrency(targetPayment)
    if (target <= 0) {
      setValidationError('Enter a monthly housing budget greater than $0.')
      return
    }
    if (target > 100_000) {
      setValidationError('Enter a monthly housing budget of $100,000 or less.')
      return
    }
    setValidationError(null)

    const mHoa = parseCurrency(monthlyHoa)
    const taxRateValue = UTAH_COUNTIES[county].taxRate
    const mUtils = includeUtils ? UTAH_AVERAGES.utilitiesMonthly : 0
    const t = parseInt(term)

    const grid = downPaymentPercents.map(downPct => {
      const feeMult = adjustedLoanAmount(1, loanType, downPct / 100, feeOptions)
      return GRID_RATES.map(rate => {
        const costOptions = {
          loanType, ratePct: rate, termYears: t, taxRate: taxRateValue,
          annualInsurance: UTAH_AVERAGES.insuranceAnnual, monthlyHoa: mHoa,
          monthlyUtilities: mUtils, creditScore, feeOptions,
        }
        const homePrice = affordableHomePrice(target, downPct / 100, costOptions)
        const loan = homePrice * (1 - downPct / 100)
        const ltv = (1 - downPct / 100) * 100
        const mi = firstYearMortgageInsurance(
          loan, loan * feeMult, ltv, loanType, t, rate, creditScore,
        )
        return { downPct, rate, homePrice: Math.max(0, Math.floor(homePrice / 5000) * 5000), hasMi: mi > 0 }
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
                  Planning start: ${fmt(suggestedPayment)}
                </button>
              )}
            </div>
          </Field>

          <Field label="Loan Type">
            <SegGroup options={[{label:'Conv.',value:'conventional'},{label:'FHA',value:'fha'},{label:'VA',value:'va'},{label:'USDA',value:'usda'}]} value={loanType} onChange={v => setLoanType(v as LoanType)} />
            {loanType === 'va' && (
              <div className="calc-inline-options">
                <SegGroup options={[{label:'First use',value:'first'},{label:'Subsequent',value:'subsequent'}]} value={vaUsage} onChange={v => setVaUsage(v as VaUsage)} />
                <button className={`calc-toggle-pill${vaFundingFeeExempt ? ' active' : ''}`} onClick={() => setVaFundingFeeExempt(v => !v)}>
                  {vaFundingFeeExempt ? '✓ Funding-fee exempt' : 'Not exempt / unsure'}
                </button>
              </div>
            )}
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
      {validationError && <div className="calc-validation-error">{validationError}</div>}

      <div className="calc-planning-note">
        This explores a housing budget, not loan approval. The suggested starting point uses the lower of 28% of gross income or 43% total DTI after the debts entered; actual underwriting varies.
      </div>

      {result && (
        <div className="calc-afford-result">
          <div className="afford-swipe-hint">Swipe the table sideways to compare all rates →</div>
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
                      {row[0].downPct === 0 ? '0% down' : `${row[0].downPct}% down`}
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
            Figures are estimates assuming a {term}-year loan with {UTAH_COUNTIES[county].name} property taxes. Program minimums, financed fees, and first-year mortgage insurance estimates are included; eligibility, loan limits, exact insurance, and lender qualification still need verification.
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
        const adjLoan = adjustedLoanAmount(baseLoan, loanType, dp / 100, feeOptions)
        const financedFee = adjLoan - baseLoan
        const pi = calcPI(adjLoan, r, t)
        const ltv = (baseLoan / hp) * 100
        const mi = firstYearMortgageInsurance(
          baseLoan, adjLoan, ltv, loanType, t, r, creditScore,
        )
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

              <div className="afford-disclaimer">
                {downPaymentWarnings(loanType, dp / 100, creditScore).join(' ')} Mortgage insurance shown is a planning estimate; taxes, insurance, eligibility, loan limits, and lender pricing must be verified.
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function MortgageCalculator({ prefill }: Props) {
  const [mode, setMode] = useState<Mode>('payment')
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

  return (
    <div className="calc-page">
      <div className="calc-page-header">
        <div>
          <h2 className="calc-page-title">Utah Mortgage Calculator</h2>
          <p className="calc-page-subtitle">
            {liveRates
              ? `Rates: ${liveRates.source}, ${liveRates.live ? `week of ${liveRates.as_of}` : liveRates.as_of} · All figures are estimates`
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
          />
        )}
        {mode === 'afford' && (
          <AffordCalc
            prefill={prefill}
            liveRates={liveRates}
            ratesLoading={ratesLoading}
          />
        )}
      </div>
    </div>
  )
}
