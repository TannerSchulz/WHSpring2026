import { useState } from 'react'

export interface TrackerEntry { field: string; value: string | number }
interface Props { entries: TrackerEntry[] }

const FIELD_META: Record<string, { label: string; format: (value: string | number) => string }> = {
  income_source: { label: 'Income path', format: value => value === 'schooling' ? 'Specialized schooling' : 'Employment' },
  employment_years: { label: 'Employment', format: value => `${value} years` },
  school_program: { label: 'Program', format: String },
  expected_salary: { label: 'Expected income', format: value => `$${Number(value).toLocaleString()}` },
  annual_income: { label: 'Annual income', format: value => `$${Number(value).toLocaleString()}` },
  monthly_debts: { label: 'Monthly debts', format: value => `$${Number(value).toLocaleString()}` },
  credit_range: { label: 'Credit range', format: String },
  state: { label: 'State', format: String },
  county: { label: 'County', format: String },
  loan_type: { label: 'Loan type', format: value => String(value).toUpperCase() },
  available_savings: { label: 'Down payment funds', format: value => `$${Number(value).toLocaleString()}` },
}

export default function ValueTracker({ entries }: Props) {
  const [collapsed, setCollapsed] = useState(false)
  return <div className={`tracker-panel${collapsed ? ' tracker-panel--collapsed' : ''}`}>
    <button className="tracker-toggle" onClick={() => setCollapsed(value => !value)}>
      <div className="tracker-toggle-left"><span className="tracker-icon">✎</span>{!collapsed && <span className="tracker-title">Your Profile</span>}</div>
      <span className="tracker-chevron">{collapsed ? '‹' : '›'}</span>
    </button>
    {!collapsed && <div className="tracker-body">{entries.length === 0 ? <div className="tracker-empty">Your answers will appear here as you go.</div> : <ul className="tracker-list">{entries.map(entry => {
      const meta = FIELD_META[entry.field]
      return meta ? <li key={entry.field} className="tracker-item"><div className="tracker-item-body"><div className="tracker-item-label">{meta.label}</div><div className="tracker-item-value">{meta.format(entry.value)}</div></div><span className="tracker-item-check">✓</span></li> : null
    })}</ul>}</div>}
  </div>
}
