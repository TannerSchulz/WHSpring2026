import { useState } from 'react'

export interface TrackerEntry {
  field: string
  value: string | number
}

interface Props {
  entries: TrackerEntry[]
}

const FIELD_META: Record<string, { icon: string; label: string; format: (v: string | number) => string }> = {
  annual_income:    { icon: '💰', label: 'Annual Income',    format: v => `$${Number(v).toLocaleString()}` },
  monthly_debts:    { icon: '💳', label: 'Monthly Debts',    format: v => `$${Number(v).toLocaleString()}/mo` },
  credit_score:     { icon: '⭐', label: 'Credit Score',     format: v => `${v}` },
  employment_years: { icon: '🏢', label: 'Employment',       format: v => `${v} yr${Number(v) !== 1 ? 's' : ''}` },
  home_price:       { icon: '🏠', label: 'Home Price',       format: v => `$${Number(v).toLocaleString()}` },
  down_payment:     { icon: '🏦', label: 'Down Payment',     format: v => `$${Number(v).toLocaleString()}` },
  loan_type:        { icon: '📋', label: 'Loan Type',        format: v => String(v).toUpperCase() },
}

export default function ValueTracker({ entries }: Props) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`tracker-panel${collapsed ? ' tracker-panel--collapsed' : ''}`}>
      <button className="tracker-toggle" onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}>
        <div className="tracker-toggle-left">
          <span className="tracker-icon">📝</span>
          {!collapsed && <span className="tracker-title">Your Profile</span>}
        </div>
        <span className="tracker-chevron">{collapsed ? '‹' : '›'}</span>
      </button>

      {!collapsed && (
        <div className="tracker-body">
          {entries.length === 0 ? (
            <div className="tracker-empty">
              Your answers will appear here as you go.
            </div>
          ) : (
            <ul className="tracker-list">
              {entries.map(entry => {
                const meta = FIELD_META[entry.field]
                if (!meta) return null
                return (
                  <li key={entry.field} className="tracker-item">
                    <span className="tracker-item-icon">{meta.icon}</span>
                    <div className="tracker-item-body">
                      <div className="tracker-item-label">{meta.label}</div>
                      <div className="tracker-item-value">{meta.format(entry.value)}</div>
                    </div>
                    <span className="tracker-item-check">✓</span>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
