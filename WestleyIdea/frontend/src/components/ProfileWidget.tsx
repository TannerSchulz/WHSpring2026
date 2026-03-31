import { useState, useEffect, useRef } from 'react'
import type { UserProfile } from '../types/profile'
import { getStateResources } from '../data/localResources'

interface Props {
  profile: UserProfile
  onResume: () => void
  onClear: () => void
}

export default function ProfileWidget({ profile, onResume, onClear }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const initials = profile.name
    .trim()
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '?'

  const doneCount = profile.stepProgress.filter(Boolean).length
  const total = profile.stepProgress.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0
  const stateName = profile.stateCode ? getStateResources(profile.stateCode).stateName : null

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="pw-wrap" ref={ref}>
      <button className="pw-trigger" onClick={() => setOpen(o => !o)} aria-label="Open profile">
        <div className="pw-avatar">{initials}</div>
        <div className="pw-trigger-text">
          <span className="pw-trigger-name">{profile.name !== 'Guest' ? profile.name.split(' ')[0] : 'My Plan'}</span>
          <span className="pw-trigger-sub">{pct}% complete</span>
        </div>
        <span className="pw-chevron">{open ? '▴' : '▾'}</span>
      </button>

      {open && (
        <div className="pw-dropdown">
          {/* Header */}
          <div className="pw-drop-header">
            <div className="pw-drop-avatar">{initials}</div>
            <div>
              <div className="pw-drop-name">{profile.name !== 'Guest' ? profile.name : 'Your Profile'}</div>
              {profile.email && <div className="pw-drop-email">{profile.email}</div>}
              <div className="pw-drop-tags">
                {stateName && <span className="pw-tag">📍 {stateName}</span>}
                <span className={`pw-tag ${profile.assessment.qualifies ? 'pw-tag--green' : 'pw-tag--yellow'}`}>
                  {profile.assessment.qualifies ? '✓ Likely Qualifies' : '⚠ Needs Work'}
                </span>
              </div>
            </div>
          </div>

          {/* Progress */}
          <div className="pw-progress-section">
            <div className="pw-progress-row">
              <span>Plan progress</span>
              <span className="pw-progress-count">{doneCount}/{total} steps</span>
            </div>
            <div className="pw-progress-track">
              <div className="pw-progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Quick stats */}
          <div className="pw-stats">
            <div className="pw-stat">
              <span className="pw-stat-val">{profile.assessment.dti_ratio}%</span>
              <span className="pw-stat-label">DTI</span>
            </div>
            <div className="pw-stat">
              <span className="pw-stat-val">{profile.mortgageInput.loan_type.toUpperCase()}</span>
              <span className="pw-stat-label">Loan</span>
            </div>
            {profile.assessment.estimated_monthly_payment && (
              <div className="pw-stat">
                <span className="pw-stat-val">${profile.assessment.estimated_monthly_payment.toLocaleString()}</span>
                <span className="pw-stat-label">Est./mo</span>
              </div>
            )}
          </div>

          <div className="pw-divider" />

          {/* Actions */}
          <button className="pw-action-primary" onClick={() => { onResume(); setOpen(false) }}>
            🗺️ Resume My Plan
          </button>
          <button className="pw-action-secondary" onClick={() => { if (confirm('Clear your saved profile and start over?')) { onClear(); setOpen(false) } }}>
            Start Fresh
          </button>

          <div className="pw-footer">
            Since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
      )}
    </div>
  )
}
