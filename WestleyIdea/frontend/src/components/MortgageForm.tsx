import { useEffect, useRef, useState } from 'react'
import { MortgageInput } from '../types'
import { STATE_DATA } from '../data/stateData'
import { UTAH_COUNTIES } from '../data/utahData'

interface Props {
  onSubmit: (data: MortgageInput) => void
  loading: boolean
  onFieldCommit: (field: string, value: string | number) => void
}

type StepType = 'employment' | 'currency' | 'credit' | 'location' | 'loan'

export const STEPS: Array<{ field: string; question: string; hint: string; type: StepType }> = [
  { field: 'income_source', question: 'Tell us about your employment or specialized schooling', hint: 'Choose the path that best describes how your future mortgage income will be supported.', type: 'employment' },
  { field: 'annual_income', question: "What's your annual income?", hint: 'Enter gross income before taxes from all sources.', type: 'currency' },
  { field: 'monthly_debts', question: 'What are your monthly debt payments?', hint: 'Include loan and minimum card payments. Enter 0 if you have none.', type: 'currency' },
  { field: 'credit_range', question: 'Which credit range are you in?', hint: 'An estimate is enough. Every range can continue to the results.', type: 'credit' },
  { field: 'location', question: 'What county and state are you looking in?', hint: 'Location helps estimate property taxes and homeowners insurance.', type: 'location' },
  { field: 'loan_type', question: 'Which loan type interests you?', hint: 'Choose “Not sure” if you want a conventional planning estimate.', type: 'loan' },
  { field: 'available_savings', question: 'How much do you have available for a down payment?', hint: 'Enter a number only. Enter 0 if you are just getting started.', type: 'currency' },
]

const CREDIT_RANGES: Array<{ value: MortgageInput['credit_range']; score: number }> = [
  { value: '500-580', score: 540 },
  { value: '580-620', score: 600 },
  { value: '620-660', score: 640 },
  { value: '660+', score: 700 },
]

const LOANS: Array<{ value: MortgageInput['loan_type']; title: string; detail: string }> = [
  { value: 'conventional', title: 'Not sure / Conventional', detail: 'A useful general planning estimate' },
  { value: 'fha', title: 'FHA', detail: 'Lower-down-payment planning option' },
  { value: 'va', title: 'VA', detail: 'For eligible service members and veterans' },
  { value: 'usda', title: 'USDA', detail: 'For eligible rural locations and households' },
]

const stateOptions = Object.entries(STATE_DATA).sort((a, b) => a[1].name.localeCompare(b[1].name))

function currencyValue(value: string): number {
  const parsed = Number(value.replace(/,/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

export default function MortgageForm({ onSubmit, loading, onFieldCommit }: Props) {
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Partial<MortgageInput>>({ loan_type: 'conventional' })
  const [display, setDisplay] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const current = STEPS[step]

  useEffect(() => { inputRef.current?.focus() }, [step])

  const setCurrency = (field: string, raw: string) => {
    const digits = raw.replace(/[^\d]/g, '')
    const formatted = digits === '' ? '' : Number(digits).toLocaleString()
    setDisplay(old => ({ ...old, [field]: formatted }))
    setValues(old => ({ ...old, [field]: digits === '' ? undefined : Number(digits) }))
  }

  const valid = () => {
    if (current.type === 'employment') {
      if (values.income_source === 'employment') return values.employment_years !== undefined
      return values.income_source === 'schooling'
        && !!values.school_program?.trim()
        && !!values.graduation_date
        && values.school_gpa !== undefined
        && values.expected_salary !== undefined
    }
    if (current.type === 'currency') return display[current.field] !== '' && display[current.field] !== undefined
    if (current.type === 'credit') return !!values.credit_range
    if (current.type === 'location') return !!values.state && !!values.county?.trim()
    return !!values.loan_type
  }

  const commit = () => {
    if (!valid()) return
    const commits: Array<[string, string | number]> = []
    if (current.type === 'currency') commits.push([current.field, currencyValue(display[current.field])])
    if (current.type === 'credit') commits.push(['credit_range', values.credit_range!])
    if (current.type === 'location') {
      commits.push(['state', values.state!])
      commits.push(['county', values.county!])
    }
    if (current.type === 'loan') commits.push(['loan_type', values.loan_type!])
    if (current.type === 'employment') {
      commits.push(['income_source', values.income_source!])
      if (values.income_source === 'employment') commits.push(['employment_years', values.employment_years ?? 0])
      else commits.push(['school_program', values.school_program!])
    }
    commits.forEach(([field, value]) => onFieldCommit(field, value))

    if (step < STEPS.length - 1) return setStep(step + 1)

    const range = CREDIT_RANGES.find(item => item.value === values.credit_range)
    const annualIncome = values.annual_income ?? 0
    const savings = values.available_savings ?? 0
    onSubmit({
      ...values,
      annual_income: annualIncome,
      monthly_debts: values.monthly_debts ?? 0,
      credit_score: range?.score ?? 640,
      credit_range: values.credit_range!,
      available_savings: savings,
      down_payment: savings,
      home_price: 0,
      employment_years: values.employment_years ?? 0,
      income_source: values.income_source!,
      loan_type: values.loan_type ?? 'conventional',
      state: values.state!,
      county: values.county!,
    } as MortgageInput)
  }

  const renderEmployment = () => (
    <div className="path-wrap">
      <div className="choice-grid">
        <button type="button" className={`choice-card${values.income_source === 'employment' ? ' selected' : ''}`} onClick={() => setValues(v => ({ ...v, income_source: 'employment' }))}>
          <strong>Employment</strong><span>I have employment or qualifying income</span>
        </button>
        <button type="button" className={`choice-card${values.income_source === 'schooling' ? ' selected' : ''}`} onClick={() => setValues(v => ({ ...v, income_source: 'schooling' }))}>
          <strong>Specialized schooling</strong><span>I am preparing for a specialized career</span>
        </button>
      </div>
      {values.income_source === 'employment' && (
        <label className="field-stack"><span>Years of steady employment or qualifying income</span><input ref={inputRef} className="plain-entry" type="number" min="0" step="0.1" value={values.employment_years ?? ''} onChange={e => setValues(v => ({ ...v, employment_years: e.target.value === '' ? undefined : Number(e.target.value) }))} /></label>
      )}
      {values.income_source === 'schooling' && (
        <div className="school-grid">
          <label className="field-stack"><span>Program or specialization</span><input ref={inputRef} className="plain-entry" value={values.school_program ?? ''} onChange={e => setValues(v => ({ ...v, school_program: e.target.value }))} /></label>
          <label className="field-stack"><span>Expected graduation date</span><input className="plain-entry" type="month" value={values.graduation_date ?? ''} onChange={e => setValues(v => ({ ...v, graduation_date: e.target.value }))} /></label>
          <label className="field-stack"><span>Current GPA</span><input className="plain-entry" type="number" min="0" max="4" step="0.01" value={values.school_gpa ?? ''} onChange={e => setValues(v => ({ ...v, school_gpa: e.target.value === '' ? undefined : Number(e.target.value) }))} /></label>
          <label className="field-stack"><span>Expected annual salary at graduation</span><div className="input-wrap"><span className="input-prefix">$</span><input className="step-input" inputMode="numeric" value={display.expected_salary ?? ''} onChange={e => setCurrency('expected_salary', e.target.value)} /></div></label>
        </div>
      )}
    </div>
  )

  const renderInput = () => {
    if (current.type === 'employment') return renderEmployment()
    if (current.type === 'currency') return <div className="input-wrap"><span className="input-prefix">$</span><input ref={inputRef} className="step-input" inputMode="numeric" value={display[current.field] ?? ''} onChange={e => setCurrency(current.field, e.target.value)} onKeyDown={e => e.key === 'Enter' && commit()} /></div>
    if (current.type === 'credit') return <div className="choice-grid credit-grid">{CREDIT_RANGES.map(item => <button type="button" key={item.value} className={`choice-card score-card${values.credit_range === item.value ? ' selected' : ''}`} onClick={() => setValues(v => ({ ...v, credit_range: item.value, credit_score: item.score }))}>{item.value}</button>)}</div>
    if (current.type === 'loan') return <div className="choice-grid">{LOANS.map(item => <button type="button" key={item.value} className={`choice-card${values.loan_type === item.value ? ' selected' : ''}`} onClick={() => setValues(v => ({ ...v, loan_type: item.value }))}><strong>{item.title}</strong><span>{item.detail}</span></button>)}</div>
    return <div className="location-grid">
      <label className="field-stack"><span>State</span><select className="plain-entry" value={values.state ?? ''} onChange={e => setValues(v => ({ ...v, state: e.target.value, county: undefined }))}><option value="">Select a state</option>{stateOptions.map(([code, data]) => <option key={code} value={code}>{data.name}</option>)}</select></label>
      <label className="field-stack"><span>County</span>{values.state === 'UT' ? <select className="plain-entry" value={values.county ?? ''} onChange={e => setValues(v => ({ ...v, county: e.target.value }))}><option value="">Select a county</option>{Object.entries(UTAH_COUNTIES).map(([key, data]) => <option key={key} value={key}>{data.name}</option>)}</select> : <input ref={inputRef} className="plain-entry" value={values.county ?? ''} onChange={e => setValues(v => ({ ...v, county: e.target.value }))} />}</label>
    </div>
  }

  return <div className="card">
    <div className="progress-bar"><div className="progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
    <div className="step" key={step}>
      <div className="step-counter">Step {step + 1} of {STEPS.length}</div>
      <div className="step-question">{current.question}</div>
      <div className="step-hint">{current.hint}</div>
      {renderInput()}
      <div className="step-nav">
        {step > 0 && <button className="btn-back" type="button" onClick={() => setStep(step - 1)}>← Back</button>}
        <button className="btn-next" type="button" disabled={!valid() || loading} onClick={commit}>{step === STEPS.length - 1 ? 'See My Home Budget' : 'Continue →'}</button>
      </div>
    </div>
  </div>
}
