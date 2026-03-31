import { useState } from 'react'
import { getStateResources } from '../data/localResources'
import type { UserProfile } from '../types/profile'

interface Resource {
  icon: string
  label: string
  description: string
  url?: string
  note?: string
}

function getResources(stepText: string, stateCode: string): Resource[] {
  const localRes = getStateResources(stateCode)
  const s = stepText.toLowerCase()
  const stateName = localRes.stateName
  const ha = localRes.housingAuthority
  const dpa = localRes.downPaymentAssistance[0] ?? null
  const ftb = localRes.firstTimeBuyerPrograms[0] ?? null
  const hudLocal: Resource = {
    icon: '🤝',
    label: `Free HUD Counseling — ${stateName}`,
    description: `Connect with a HUD-approved housing counselor in ${stateName} for free, unbiased mortgage guidance.`,
    url: localRes.hudCounselingUrl,
  }
  const stateAuthority: Resource = {
    icon: '🏛️',
    label: ha.name,
    description: ha.description,
    url: ha.url,
  }

  if (s.includes('credit') || s.includes('score')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '📊',
      label: 'Get Your Free Credit Report',
      description: 'Pull reports from all three bureaus (Equifax, Experian, TransUnion) for free once a year — required by federal law.',
      url: 'https://www.annualcreditreport.com',
    },
    {
      icon: '📱',
      label: 'Monitor Weekly with Credit Karma',
      description: 'Free weekly score updates with personalized tips on what\'s hurting your credit and how to improve it.',
      url: 'https://www.creditkarma.com',
    },
  ]

  if (s.includes('debt') || s.includes('dti') || s.includes('ratio')) return [
    hudLocal,
    stateAuthority,
    {
      icon: '🧮',
      label: 'CFPB DTI Calculator',
      description: 'Use the Consumer Financial Protection Bureau\'s free tool to see exactly how your monthly debts affect your mortgage eligibility.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    {
      icon: '🎓',
      label: 'Income-Driven Student Loan Repayment',
      description: 'If student loans are raising your DTI, income-driven plans can significantly lower your required monthly payment.',
      url: 'https://studentaid.gov/manage-loans/repayment/plans/income-driven',
    },
  ]

  if (s.includes('down') || s.includes('saving') || s.includes('payment') || s.includes('fund')) return [
    stateAuthority,
    ...(dpa ? [{
      icon: '💰',
      label: dpa.label,
      description: dpa.description,
      url: dpa.url,
    }] : []),
    ...(ftb ? [{
      icon: '🏠',
      label: ftb.label,
      description: ftb.description,
      url: ftb.url,
    }] : []),
    hudLocal,
    {
      icon: '📈',
      label: 'High-Yield Savings Accounts',
      description: 'Park your down payment savings in a HYSA to earn 4–5% APY while you save — far better than a standard savings account.',
      note: 'Search "HYSA" at your bank or credit union',
    },
  ]

  if (s.includes('employ') || s.includes('job') || s.includes('income') || s.includes('self-employ')) return [
    hudLocal,
    stateAuthority,
    {
      icon: '📄',
      label: 'Employment Documentation Guide (CFPB)',
      description: 'Learn exactly what pay stubs, W-2s, tax returns, and employer letters lenders require before they approve your application.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    {
      icon: '📋',
      label: 'Self-Employed Borrower Guide',
      description: 'If you\'re self-employed, lenders need 2 years of tax returns and may require a CPA letter. This guide explains what to prepare.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
  ]

  if (s.includes('pre-approv') || s.includes('lender') || s.includes('approv') || s.includes('loan officer')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '🏦',
      label: 'Compare Mortgage Rates — Bankrate',
      description: 'Get live rate quotes from multiple lenders side-by-side. Even a 0.25% rate difference saves thousands over the life of your loan.',
      url: 'https://www.bankrate.com/mortgages/mortgage-rates/',
    },
    {
      icon: '🤝',
      label: 'Find a Local Credit Union',
      description: 'Credit unions are member-owned and typically offer lower rates and fees than traditional banks — worth checking before you commit.',
      url: 'https://www.mycreditunion.gov/about-credit-unions/credit-union-locator',
    },
    {
      icon: '📋',
      label: 'Pre-Approval Document Checklist',
      description: 'Gather pay stubs, W-2s, bank statements, tax returns, and ID before applying — having everything ready speeds up approval.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
  ]

  if (s.includes('inspect') || s.includes('apprais')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '🔍',
      label: 'Find a Certified Home Inspector',
      description: 'ASHI-certified inspectors meet strict standards. Always attend the inspection and ask questions about every item flagged.',
      url: 'https://www.homeinspector.org/FindAnInspector',
    },
    {
      icon: '📋',
      label: 'What Home Inspectors Look For',
      description: 'Learn what inspectors check so you can spot red flags before making an offer — roof, foundation, HVAC, plumbing, and electrical.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
  ]

  if (s.includes('offer') || s.includes('negot') || s.includes('purchas') || s.includes('contract')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '🏘️',
      label: 'Understanding the Purchase Contract',
      description: 'Learn key clauses: inspection contingency, financing contingency, earnest money, and closing timeline before you sign anything.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    {
      icon: '📊',
      label: 'Research Comparable Sales (Comps)',
      description: 'Check recent sold prices in the neighborhood on Zillow or Redfin to make sure your offer is in line with the market.',
      url: 'https://www.zillow.com',
    },
  ]

  if (s.includes('clos') || s.includes('title') || s.includes('escrow')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '📄',
      label: 'Understand Your Closing Disclosure',
      description: 'You\'ll receive this 3 days before closing. Review every fee line by line — lenders are required to explain any changes from your loan estimate.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    {
      icon: '🏦',
      label: 'Wire Transfer Safety Guide',
      description: 'Closing wire fraud is common. Always verify wire instructions by phone with your title company — never trust email instructions alone.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
  ]

  // Default — works for any step
  return [
    stateAuthority,
    hudLocal,
    {
      icon: '📚',
      label: 'CFPB Home Buying Guide',
      description: 'The Consumer Financial Protection Bureau\'s free, step-by-step guide covers every stage of the mortgage and home buying process.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    ...(ftb ? [{
      icon: '🏠',
      label: ftb.label,
      description: ftb.description,
      url: ftb.url,
    }] : []),
  ]
}

interface StepState { text: string; done: boolean }

interface Props {
  profile: UserProfile
  onProfileUpdate: (p: UserProfile) => void
  onBack: () => void
  inDashboard?: boolean
}

export default function ActionPlanView({ profile, onProfileUpdate, onBack, inDashboard }: Props) {
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
        {!inDashboard && <button className="help-back-btn" onClick={onBack}>← Back</button>}
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
              <a href="https://www.bankrate.com/mortgages/mortgage-rates/" target="_blank" rel="noopener noreferrer" className="step-resource-link" style={{ display: 'inline-block', marginTop: '1rem', fontSize: '0.9rem', padding: '0.5rem 1.25rem' }}>
                Compare Lenders →
              </a>
            </div>
          ) : (
            <div className="step-focus-card">
              {/* Step title */}
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

              <div className="step-focus-divider" />

              {/* Resources — expanded with descriptions */}
              <div className="step-resources-heading">How to get started</div>
              <div className="step-resource-list">
                {resources.map((res, i) => (
                  <div key={i} className="step-resource-item">
                    <div className="step-resource-top">
                      <span className="step-resource-icon">{res.icon}</span>
                      <span className="step-resource-label">{res.label}</span>
                      {res.url
                        ? <a href={res.url} target="_blank" rel="noopener noreferrer" className="step-resource-link">Open →</a>
                        : res.note && <span className="step-resource-note">{res.note}</span>
                      }
                    </div>
                    <p className="step-resource-desc">{res.description}</p>
                  </div>
                ))}
              </div>

              <div className="step-focus-divider" />

              {/* Actions at the bottom */}
              <div className="step-actions-bar">
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
