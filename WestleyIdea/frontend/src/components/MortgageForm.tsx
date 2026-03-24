import { useState, FormEvent } from 'react'
import { MortgageInput } from '../types'

interface Props {
  onSubmit: (data: MortgageInput) => void
  loading: boolean
}

const defaultValues: MortgageInput = {
  annual_income: 0,
  monthly_debts: 0,
  credit_score: 700,
  down_payment: 0,
  home_price: 0,
  employment_years: 2,
  loan_type: 'conventional',
}

export default function MortgageForm({ onSubmit, loading }: Props) {
  const [form, setForm] = useState<MortgageInput>(defaultValues)

  const set = (field: keyof MortgageInput, value: string) => {
    setForm(prev => ({
      ...prev,
      [field]: field === 'loan_type' ? value : Number(value),
    }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    onSubmit(form)
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="card">
        <h2>Your Financial Profile</h2>
        <div className="form-grid">
          <div className="field">
            <label>Annual Income ($)</label>
            <input
              type="number"
              min={0}
              value={form.annual_income || ''}
              onChange={e => set('annual_income', e.target.value)}
              placeholder="75000"
              required
            />
          </div>
          <div className="field">
            <label>Monthly Debt Payments ($)</label>
            <input
              type="number"
              min={0}
              value={form.monthly_debts || ''}
              onChange={e => set('monthly_debts', e.target.value)}
              placeholder="500"
              required
            />
          </div>
          <div className="field">
            <label>Credit Score</label>
            <input
              type="number"
              min={300}
              max={850}
              value={form.credit_score || ''}
              onChange={e => set('credit_score', e.target.value)}
              placeholder="700"
              required
            />
          </div>
          <div className="field">
            <label>Years at Current Job</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.employment_years || ''}
              onChange={e => set('employment_years', e.target.value)}
              placeholder="2"
              required
            />
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Property & Loan Details</h2>
        <div className="form-grid">
          <div className="field">
            <label>Home Price ($)</label>
            <input
              type="number"
              min={0}
              value={form.home_price || ''}
              onChange={e => set('home_price', e.target.value)}
              placeholder="350000"
              required
            />
          </div>
          <div className="field">
            <label>Down Payment ($)</label>
            <input
              type="number"
              min={0}
              value={form.down_payment || ''}
              onChange={e => set('down_payment', e.target.value)}
              placeholder="35000"
              required
            />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Loan Type</label>
            <select
              value={form.loan_type}
              onChange={e => set('loan_type', e.target.value)}
            >
              <option value="conventional">Conventional</option>
              <option value="fha">FHA</option>
              <option value="va">VA (Veterans)</option>
              <option value="usda">USDA (Rural)</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading}>
          {loading && <span className="spinner" />}
          {loading ? 'Analyzing with AI...' : 'Check My Qualification'}
        </button>
      </div>
    </form>
  )
}
