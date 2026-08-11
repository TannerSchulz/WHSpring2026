import { useEffect, useMemo, useRef, useState } from 'react'

import { UTAH_COUNTIES } from '../data/utahData'
import { STATE_DATA } from '../data/stateData'
import { MortgageInput } from '../types'
import { TrackedLinkContext } from '../types/branding'

interface Props {
  onSubmit: (data: MortgageInput) => void
  loading: boolean
  onFieldCommit: (field: string, value: string | number) => void
  trackedLink: TrackedLinkContext | null
}

type StepType = 'employment' | 'currency' | 'credit' | 'location' | 'loan' | 'contact'
type StepDefinition = { field: string; question: string; hint: string; type: StepType }

export const STEPS: StepDefinition[] = [
  { field: 'income_source', question: 'Tell us about your employment or specialized schooling', hint: 'Choose one path and enter the details used to estimate your home budget.', type: 'employment' },
  { field: 'monthly_debts', question: 'What are your monthly debt payments?', hint: 'Include loan and minimum card payments. Enter 0 if you have none.', type: 'currency' },
  { field: 'credit_range', question: 'Which credit range are you in?', hint: 'An estimate is enough. Every range can continue to the results.', type: 'credit' },
  { field: 'location', question: 'What county and state are you looking in?', hint: 'Location helps estimate property taxes and homeowners insurance.', type: 'location' },
  { field: 'loan_type', question: 'Which loan type interests you?', hint: 'Choose “Not sure” if you want a conventional planning estimate.', type: 'loan' },
  { field: 'available_savings', question: 'How much do you have available for a down payment?', hint: 'Enter a number only. Enter 0 if you are just getting started.', type: 'currency' },
]

const CONTACT_STEP: StepDefinition = {
  field: 'contact',
  question: 'Where should your mortgage professional follow up?',
  hint: 'Your contact details, answers, and planning results will be shared securely after you continue.',
  type: 'contact',
}

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

function validEmail(value: string | undefined): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value?.trim() ?? '')
}

export default function MortgageForm({ onSubmit, loading, onFieldCommit, trackedLink }: Props) {
  const steps = useMemo(() => trackedLink ? [...STEPS, CONTACT_STEP] : STEPS, [trackedLink])
  const [step, setStep] = useState(0)
  const [values, setValues] = useState<Partial<MortgageInput>>({ loan_type: 'conventional' })
  const [display, setDisplay] = useState<Record<string, string>>({})
  const inputRef = useRef<HTMLInputElement>(null)
  const current = steps[step]

  useEffect(() => { inputRef.current?.focus() }, [step])

  const setCurrency = (field: string, raw: string) => {
    const digits = raw.replace(/[^\d]/g, '')
    const formatted = digits === '' ? '' : Number(digits).toLocaleString()
    setDisplay(old => ({ ...old, [field]: formatted }))
    setValues(old => ({ ...old, [field]: digits === '' ? undefined : Number(digits) }))
  }

  const valid = () => {
    if (current.type === 'employment') {
      if (values.income_source === 'employment') {
        return values.employment_years !== undefined && values.annual_income !== undefined
      }
      return values.income_source === 'schooling'
        && !!values.school_program?.trim()
        && !!values.graduation_date
        && values.school_gpa !== undefined
        && values.expected_salary !== undefined
    }
    if (current.type === 'currency') return display[current.field] !== '' && display[current.field] !== undefined
    if (current.type === 'credit') return !!values.credit_range
    if (current.type === 'location') return !!values.state && !!values.county?.trim()
    if (current.type === 'contact') {
      return !!values.first_name?.trim()
        && !!values.last_name?.trim()
        && validEmail(values.email)
        && values.consent_to_share === true
    }
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
      if (values.income_source === 'employment') {
        commits.push(['employment_years', values.employment_years ?? 0])
        commits.push(['annual_income', values.annual_income ?? 0])
      } else {
        commits.push(['school_program', values.school_program!])
        commits.push(['expected_salary', values.expected_salary ?? 0])
      }
    }
    commits.forEach(([field, value]) => onFieldCommit(field, value))

    if (step < steps.length - 1) return setStep(step + 1)

    const range = CREDIT_RANGES.find(item => item.value === values.credit_range)
    const annualIncome = values.income_source === 'schooling'
      ? values.expected_salary ?? 0
      : values.annual_income ?? 0
    const savings = values.available_savings ?? 0
    onSubmit({
      ...values,
      submission_reference: trackedLink ? crypto.randomUUID() : undefined,
      first_name: values.first_name?.trim(),
      last_name: values.last_name?.trim(),
      email: values.email?.trim().toLowerCase(),
      phone: values.phone?.trim(),
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
        <button type="button" className={`choice-card${values.income_source === 'employment' ? ' selected' : ''}`} onClick={() => setValues(value => ({ ...value, income_source: 'employment' }))}>
          <strong>Employment</strong><span>I am currently employed</span>
        </button>
        <button type="button" className={`choice-card${values.income_source === 'schooling' ? ' selected' : ''}`} onClick={() => setValues(value => ({ ...value, income_source: 'schooling' }))}>
          <strong>Specialized schooling</strong><span>I am preparing for a specialized career</span>
        </button>
      </div>
      {values.income_source === 'employment' && <div className="school-grid">
        <label className="field-stack"><span>Years at steady employment</span><input ref={inputRef} className="plain-entry" type="number" inputMode="numeric" min="0" step="1" value={values.employment_years ?? ''} onChange={event => setValues(value => ({ ...value, employment_years: event.target.value === '' ? undefined : Math.max(0, Math.trunc(Number(event.target.value))) }))} /></label>
        <label className="field-stack"><span>Annual income before taxes</span><div className="input-wrap"><span className="input-prefix">$</span><input className="step-input" inputMode="numeric" value={display.annual_income ?? ''} onChange={event => setCurrency('annual_income', event.target.value)} /></div></label>
      </div>}
      {values.income_source === 'schooling' && <div className="school-grid">
        <label className="field-stack"><span>Program or specialization</span><input ref={inputRef} className="plain-entry" value={values.school_program ?? ''} onChange={event => setValues(value => ({ ...value, school_program: event.target.value }))} /></label>
        <label className="field-stack"><span>Expected graduation date</span><input className="plain-entry" type="month" value={values.graduation_date ?? ''} onChange={event => setValues(value => ({ ...value, graduation_date: event.target.value }))} /></label>
        <label className="field-stack"><span>Current GPA</span><input className="plain-entry" type="number" min="0" max="4" step="0.01" value={values.school_gpa ?? ''} onChange={event => setValues(value => ({ ...value, school_gpa: event.target.value === '' ? undefined : Number(event.target.value) }))} /></label>
        <label className="field-stack"><span>Expected annual salary at graduation</span><div className="input-wrap"><span className="input-prefix">$</span><input className="step-input" inputMode="numeric" value={display.expected_salary ?? ''} onChange={event => setCurrency('expected_salary', event.target.value)} /></div></label>
      </div>}
    </div>
  )

  const renderContact = () => {
    const recipient = trackedLink?.branding.officerName || trackedLink?.branding.companyName || 'your mortgage professional'
    return <div className="contact-step">
      <div className="contact-grid">
        <label className="field-stack"><span>First name</span><input ref={inputRef} className="plain-entry" autoComplete="given-name" maxLength={100} value={values.first_name ?? ''} onChange={event => setValues(value => ({ ...value, first_name: event.target.value }))} /></label>
        <label className="field-stack"><span>Last name</span><input className="plain-entry" autoComplete="family-name" maxLength={100} value={values.last_name ?? ''} onChange={event => setValues(value => ({ ...value, last_name: event.target.value }))} /></label>
        <label className="field-stack"><span>Email</span><input className="plain-entry" type="email" autoComplete="email" maxLength={320} value={values.email ?? ''} onChange={event => setValues(value => ({ ...value, email: event.target.value }))} /></label>
        <label className="field-stack"><span>Phone <small>Optional</small></span><input className="plain-entry" type="tel" autoComplete="tel" maxLength={40} value={values.phone ?? ''} onChange={event => setValues(value => ({ ...value, phone: event.target.value }))} /></label>
      </div>
      <label className="honeypot-field" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={values.website ?? ''} onChange={event => setValues(value => ({ ...value, website: event.target.value }))} /></label>
      <label className="consent-check"><input type="checkbox" checked={values.consent_to_share === true} onChange={event => setValues(value => ({ ...value, consent_to_share: event.target.checked }))} /><span>I agree to share my contact information, questionnaire answers, and planning results with {recipient} for follow-up. I understand this is not a credit application or loan approval.</span></label>
      <p className="contact-privacy">Do not enter a Social Security number, bank-account number, or other sensitive information.</p>
    </div>
  }

  const renderInput = () => {
    if (current.type === 'employment') return renderEmployment()
    if (current.type === 'currency') return <div className="input-wrap"><span className="input-prefix">$</span><input ref={inputRef} className="step-input" inputMode="numeric" value={display[current.field] ?? ''} onChange={event => setCurrency(current.field, event.target.value)} onKeyDown={event => event.key === 'Enter' && commit()} /></div>
    if (current.type === 'credit') return <div className="choice-grid credit-grid">{CREDIT_RANGES.map(item => <button type="button" key={item.value} className={`choice-card score-card${values.credit_range === item.value ? ' selected' : ''}`} onClick={() => setValues(value => ({ ...value, credit_range: item.value, credit_score: item.score }))}>{item.value}</button>)}</div>
    if (current.type === 'loan') return <div className="choice-grid">{LOANS.map(item => <button type="button" key={item.value} className={`choice-card${values.loan_type === item.value ? ' selected' : ''}`} onClick={() => setValues(value => ({ ...value, loan_type: item.value }))}><strong>{item.title}</strong><span>{item.detail}</span></button>)}</div>
    if (current.type === 'contact') return renderContact()
    return <div className="location-grid">
      <label className="field-stack"><span>State</span><select className="plain-entry" value={values.state ?? ''} onChange={event => setValues(value => ({ ...value, state: event.target.value, county: undefined }))}><option value="">Select a state</option>{stateOptions.map(([code, data]) => <option key={code} value={code}>{data.name}</option>)}</select></label>
      <label className="field-stack"><span>County</span>{values.state === 'UT' ? <select className="plain-entry" value={values.county ?? ''} onChange={event => setValues(value => ({ ...value, county: event.target.value }))}><option value="">Select a county</option>{Object.entries(UTAH_COUNTIES).map(([key, data]) => <option key={key} value={key}>{data.name}</option>)}</select> : <input ref={inputRef} className="plain-entry" value={values.county ?? ''} onChange={event => setValues(value => ({ ...value, county: event.target.value }))} />}</label>
    </div>
  }

  return <div className="card">
    <div className="progress-bar"><div className="progress-fill" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
    <div className="step" key={step}>
      <div className="step-counter">Step {step + 1} of {steps.length}</div>
      <div className="step-question">{current.question}</div>
      <div className="step-hint">{current.hint}</div>
      {renderInput()}
      <div className="step-nav">
        {step > 0 && <button className="btn-back" type="button" onClick={() => setStep(step - 1)}>← Back</button>}
        <button className="btn-next" type="button" disabled={!valid() || loading} onClick={commit}>{step === steps.length - 1 ? 'See My Home Budget' : 'Continue →'}</button>
      </div>
    </div>
  </div>
}
