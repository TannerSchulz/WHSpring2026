import { useState } from 'react'
import { getStateResources } from '../data/localResources'
import type { UserProfile } from '../types/profile'

interface Resource { icon: string; label: string; url?: string; note?: string }

function getResources(stepText: string, stateCode: string): Resource[] {
  const localRes = getStateResources(stateCode)
  const s = stepText.toLowerCase()

  // Step 1 / getting started — show state-local resources first
  if (s.includes('research') || s.includes('assess') || s.includes('eligib') || s.includes('afford') || s.includes('start') || s.includes('learn')) {
    return [
      { icon: '🏛️', label: localRes.housingAuthority.name, url: localRes.housingAuthority.url },
      { icon: '🤝', label: `Free HUD Counseling — ${localRes.stateName}`, url: localRes.hudCounselingUrl },
      { icon: '📚', label: 'CFPB Home Buying Guide', url: 'https://www.consumerfinance.gov/owning-a-home/' },
    ]
  }
  if (s.includes('credit')) return [
    { icon: '📊', label: 'Get Your Free Credit Report', url: 'https://www.annualcreditreport.com' },
    { icon: '📱', label: 'Monitor Score with Credit Karma', url: 'https://www.creditkarma.com' },
    { icon: '🤝', label: 'Free HUD Counseling', url: 'https://www.hud.gov/counseling' },
  ]
  if (s.includes('debt') || s.includes('dti')) return [
    { icon: '🧮', label: 'CFPB DTI Calculator', url: 'https://www.consumerfinance.gov/owning-a-home/' },
    { icon: '🎓', label: 'Income-Driven Repayment Plans', url: 'https://studentaid.gov/manage-loans/repayment/plans/income-driven' },
    { icon: '🤝', label: 'Free HUD Counseling', url: 'https://www.hud.gov/counseling' },
  ]
  if (s.includes('down') || s.includes('save') || s.includes('payment')) {
    const dpa = localRes.downPaymentAssistance[0]
    return [
      dpa
        ? { icon: '💰', label: dpa.label, url: dpa.url }
        : { icon: '💰', label: 'HUD Down Payment Programs', url: 'https://www.hud.gov/topics/buying_a_home' },
      { icon: '🏠', label: 'First-Time Buyer Programs', url: 'https://www.consumerfinance.gov/owning-a-home/' },
      { icon: '📈', label: 'High-Yield Savings Accounts', note: 'Search "HYSA" at your bank' },
    ]
  }
  if (s.includes('employ') || s.includes('job') || s.includes('income')) return [
    { icon: '📄', label: 'Employment Doc Guide (CFPB)', url: 'https://www.consumerfinance.gov/owning-a-home/' },
    { icon: '🤝', label: 'Free HUD Counseling', url: 'https://www.hud.gov/counseling' },
  ]
  if (s.includes('pre-approv') || s.includes('lender') || s.includes('approv')) return [
    { icon: '🏦', label: 'Compare Mortgage Rates', url: 'https://www.bankrate.com/mortgages/mortgage-rates/' },
    { icon: '🤝', label: 'Find a Local Credit Union', url: 'https://www.mycreditunion.gov/about-credit-unions/credit-union-locator' },
    { icon: '📋', label: 'Pre-Approval Document Checklist', url: 'https://www.consumerfinance.gov/owning-a-home/' },
  ]
  // Default — always include state authority + HUD
  return [
    { icon: '🏛️', label: localRes.housingAuthority.name, url: localRes.housingAuthority.url },
    { icon: '🤝', label: `Free HUD Counseling — ${localRes.stateName}`, url: localRes.hudCounselingUrl },
    { icon: '📚', label: 'CFPB Home Buying Guide', url: 'https://www.consumerfinance.gov/owning-a-home/' },
  ]
}

interface StepState { text: string; done: boolean }

interface Props {
  profile: UserProfile
  onProfileUpdate: (p: UserProfile) => void
  onBack: () => void
}

export default function ActionPlanView({ profile, onProfileUpdate, onBack }: Props) {
  const { assessment: result, stateCode, name } = profile
  const localRes = getStateResources(stateCode)

  const [steps, setSteps] = useState<StepState[]>(() =>
    result.action_steps.map((text, i) => ({
      text,
      done: profile.stepProgress[i] ?? false,
    }))
  )

  const [activeIdx, setActiveIdx] = useState(() => {
    const first = steps.findIndex(s => !s.done)
    return first === -1 ? 0 : first
  })

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailInput, setEmailInput] = useState(profile.email || '')
  const [emailSaved, setEmailSaved] = useState(!!profile.email)

  const toggleDone = (i: number) => {
    const updated = steps.map((s, idx) => idx === i ? { ...s, done: !s.done } : s)
    setSteps(updated)
    onProfileUpdate({ ...profile, stepProgress: updated.map(s => s.done) })
    if (!steps[i].done) {
      const next = updated.findIndex((s, idx) => idx > i && !s.done)
      if (next !== -1) setActiveIdx(next)
    }
  }

  const handleSaveEmail = () => {
    if (!emailInput.trim()) return
    onProfileUpdate({ ...profile, email: emailInput.trim() })
    setEmailSaved(true)
    setShowEmailForm(false)
  }

  const doneCount = steps.filter(s => s.done).length
  const pct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0
  const active = steps[activeIdx]
  const allDone = doneCount === steps.length
  const resources = active ? getResources(active.text, stateCode) : []

  return (
    <div className="plan-layout">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="plan-topbar">
        <button className="help-back-btn" onClick={onBack}>← Back</button>
        <div className="plan-topbar-title">
          <span className="plan-topbar-icon">🗺️</span>
          <div>
            <div className="plan-topbar-heading">
              {name && name !== 'Guest' ? `${name.split(' ')[0]}'s` : 'Your'} Action Plan
            </div>
            <div className="plan-topbar-sub">
              {stateCode && `📍 ${localRes.stateName} · `}
              <span className={result.qualifies ? 'plan-status-green' : 'plan-status-yellow'}>
                {result.qualifies ? '✓ Likely Qualifies' : '⚠ Needs Work'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────── */}
      <div className="plan-body">

        {/* ═══ LEFT: Focused step ════════════════════════════ */}
        <div className="plan-main">

          {allDone ? (
            <div className="plan-all-done-card">
              <div className="plan-done-icon">🏆</div>
              <h2>All steps complete!</h2>
              <p>You've finished every step. Your next move is to get pre-approved with a lender.</p>
              <a href="https://www.bankrate.com/mortgages/mortgage-rates/" target="_blank" rel="noopener noreferrer" className="plan-resource-btn" style={{ fontSize: '0.9rem', padding: '0.6rem 1.25rem', display: 'inline-block', marginTop: '0.5rem' }}>
                Compare Lenders →
              </a>
            </div>
          ) : (
            <>
              {/* Step focus card */}
              <div className="step-focus-card">
                <div className="step-focus-meta">
                  <span className="step-focus-label">Step {activeIdx + 1} of {steps.length}</span>
                  {activeIdx === 0 && !active.done && (
                    <span className="step-focus-badge step-focus-badge--start">Start Here</span>
                  )}
                  {active.done && (
                    <span className="step-focus-badge step-focus-badge--done">✓ Complete</span>
                  )}
                </div>

                <p className="step-focus-text">{active.text}</p>

                <div className="step-focus-footer">
                  <button
                    className={`step-mark-btn${active.done ? ' step-mark-btn--undo' : ''}`}
                    onClick={() => toggleDone(activeIdx)}
                  >
                    {active.done ? '↩ Mark Incomplete' : '✓ Mark as Done'}
                  </button>
                  <div className="step-nav-btns">
                    <button className="step-nav-btn" onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0}>
                      ← Prev
                    </button>
                    <button className="step-nav-btn step-nav-btn--fwd" onClick={() => setActiveIdx(i => Math.min(steps.length - 1, i + 1))} disabled={activeIdx === steps.length - 1}>
                      Next →
                    </button>
                  </div>
                </div>
              </div>

              {/* Resource links — 3 compact rows */}
              <div className="step-resources-card">
                <div className="step-resources-heading">How to get started</div>
                <div className="step-resource-rows">
                  {resources.map((res, i) => (
                    <div key={i} className="step-resource-row">
                      <span className="step-resource-icon">{res.icon}</span>
                      <span className="step-resource-label">{res.label}</span>
                      {res.url
                        ? <a href={res.url} target="_blank" rel="noopener noreferrer" className="step-resource-link">Open →</a>
                        : res.note && <span className="step-resource-note">{res.note}</span>
                      }
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Save CTA */}
          {!emailSaved ? (
            <div className="plan-save-cta">
              {!showEmailForm ? (
                <>
                  <span className="plan-save-cta-text">💾 Save your progress — enter your email to keep this plan</span>
                  <button className="plan-save-btn" onClick={() => setShowEmailForm(true)}>Save Plan</button>
                </>
              ) : (
                <div className="plan-save-form">
                  <input
                    type="email"
                    className="plan-save-input"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSaveEmail()}
                  />
                  <button className="plan-save-btn" onClick={handleSaveEmail} disabled={!emailInput.trim()}>Save →</button>
                  <button className="plan-save-cancel" onClick={() => setShowEmailForm(false)}>Cancel</button>
                </div>
              )}
            </div>
          ) : (
            <div className="plan-saved-banner">✓ Plan saved to {profile.email}</div>
          )}
        </div>

        {/* ═══ RIGHT: Progress sidebar ═══════════════════════ */}
        <aside className="plan-sidebar">

          {/* Progress bar */}
          <div className="sidebar-progress-card">
            <div className="sidebar-progress-header">
              <span className="sidebar-progress-title">Your Progress</span>
              <span className="sidebar-progress-count">{doneCount}/{steps.length} done</span>
            </div>
            <div className="sidebar-progress-track">
              <div className="sidebar-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="sidebar-progress-pct">{pct}% complete</div>
          </div>

          {/* Step list */}
          <div className="sidebar-steps">
            {steps.map((step, i) => {
              const isActive = i === activeIdx
              const isDone = step.done
              return (
                <button
                  key={i}
                  className={`sidebar-step${isActive ? ' sidebar-step--active' : ''}${isDone ? ' sidebar-step--done' : ''}`}
                  onClick={() => setActiveIdx(i)}
                >
                  {i < steps.length - 1 && <div className="sidebar-step-line" />}
                  <div className={`sidebar-step-circle${isDone ? ' done' : isActive ? ' active' : ''}`}>
                    {isDone ? '✓' : i + 1}
                  </div>
                  <div className="sidebar-step-body">
                    <div className="sidebar-step-num">Step {i + 1}</div>
                    <div className="sidebar-step-text">{step.text}</div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Quick stats */}
          <div className="sidebar-stats">
            <div className="sidebar-stat">
              <span className="sidebar-stat-val">{result.dti_ratio}%</span>
              <span className="sidebar-stat-label">DTI</span>
            </div>
            <div className="sidebar-stat">
              <span className="sidebar-stat-val">{result.ltv_ratio}%</span>
              <span className="sidebar-stat-label">LTV</span>
            </div>
            {result.estimated_monthly_payment && (
              <div className="sidebar-stat">
                <span className="sidebar-stat-val">${result.estimated_monthly_payment.toLocaleString()}</span>
                <span className="sidebar-stat-label">Est./mo</span>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
