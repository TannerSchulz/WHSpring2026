import { useState, useEffect, useRef } from 'react'
import { MortgageInput } from '../types'

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
  { field: 'annual_income',   question: "What's your annual income?",               hint: 'Before taxes — include all sources of income.',              prefix: '$', placeholder: '75,000',  type: 'number' },
  { field: 'monthly_debts',   question: "What are your monthly debt payments?",      hint: 'Car loans, student loans, credit cards — not rent.',          prefix: '$', placeholder: '500',     type: 'number' },
  { field: 'credit_score',    question: "What's your credit score?",                 hint: 'Check Credit Karma or your bank app for a free estimate.',    prefix: null, placeholder: '700',   type: 'number' },
  { field: 'employment_years',question: "How long have you been at your current job?",hint: 'Lenders like to see at least 2 years of steady employment.', prefix: null, placeholder: '2',    type: 'number' },
  { field: 'home_price',      question: "What's the home price you have in mind?",   hint: 'Enter your target purchase price.',                           prefix: '$', placeholder: '350,000', type: 'number' },
  { field: 'down_payment',    question: "How much can you put down?",                hint: 'A larger down payment improves your odds and lowers your rate.',prefix: '$', placeholder: '35,000', type: 'number' },
  { field: 'loan_type',       question: "Which loan type interests you?",            hint: 'Not sure? Conventional works for most buyers.',               prefix: null, placeholder: null,   type: 'select' },
]

export default function MortgageForm({ onSubmit, loading, onFieldCommit }: Props) {
  const [step, setStep] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [values, setValues] = useState<Partial<MortgageInput>>({ loan_type: 'conventional' })
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current && STEPS[step].type !== 'select') {
      setTimeout(() => inputRef.current?.focus(), 350)
    }
  }, [step])

  const current = STEPS[step]
  const value = values[current.field as keyof MortgageInput]

  const isValid = () => {
    if (current.type === 'select') return !!values.loan_type
    const v = Number(value)
    if (!value && value !== 0) return false
    if (current.field === 'credit_score') return v >= 300 && v <= 850
    return v > 0
  }

  const advance = () => {
    if (!isValid()) return

    // Commit the current field's value to the tracker
    const fieldValue = current.type === 'select'
      ? (values.loan_type ?? 'conventional')
      : (value as number)
    onFieldCommit(current.field, fieldValue)

    if (step < STEPS.length - 1) {
      setAnimating(true)
      setTimeout(() => {
        setStep(s => s + 1)
        setAnimating(false)
      }, 280)
    } else {
      onSubmit(values as MortgageInput)
    }
  }

  const back = () => {
    if (step === 0) return
    setAnimating(true)
    setTimeout(() => {
      setStep(s => s - 1)
      setAnimating(false)
    }, 280)
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') advance()
  }

  const progress = ((step + 1) / STEPS.length) * 100

  return (
    <div className="card">
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className={`step${animating ? ' exit' : ''}`} key={step}>
        <div className="step-counter">Step {step + 1} of {STEPS.length}</div>
        <div className="step-question">{current.question}</div>
        <div className="step-hint">{current.hint}</div>

        {current.type === 'select' ? (
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
        ) : (
          <div className="input-wrap">
            {current.prefix && <span className="input-prefix">{current.prefix}</span>}
            <input
              ref={inputRef}
              className={`step-input${current.prefix ? '' : ' no-prefix'}`}
              type="number"
              inputMode="numeric"
              placeholder={current.placeholder ?? ''}
              value={value ?? ''}
              onChange={e => setValues(v => ({ ...v, [current.field]: e.target.value === '' ? '' : Number(e.target.value) }))}
              onKeyDown={handleKey}
              min={0}
            />
          </div>
        )}

        <div className="step-nav">
          {step > 0 && (
            <button className="btn-back" type="button" onClick={back}>← Back</button>
          )}
          <button
            className="btn-next"
            type="button"
            onClick={advance}
            disabled={!isValid() || loading}
          >
            {step === STEPS.length - 1
              ? loading ? 'Analyzing...' : '✨ Get My Assessment'
              : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
