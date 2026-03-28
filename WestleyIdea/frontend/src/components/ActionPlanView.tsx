import { useState } from 'react'
import { getStateResources } from '../data/localResources'
import type { UserProfile } from '../types/profile'

interface SupportResource {
  label: string
  description: string
  url?: string
  action?: string
}

function getSupportResources(step: string): SupportResource[] {
  const s = step.toLowerCase()
  if (s.includes('credit')) return [
    { label: '📊 Check Your Credit Report', description: 'Get your free report from all 3 bureaus — required by law once per year.', url: 'https://www.annualcreditreport.com', action: 'Visit Site' },
    { label: '📱 Monitor Your Score', description: 'Credit Karma gives you free weekly credit score updates with tips.', url: 'https://www.creditkarma.com', action: 'Visit Site' },
    { label: '🏛️ Talk to a HUD Counselor', description: 'Free, unbiased housing counseling from a HUD-approved advisor.', url: 'https://www.hud.gov/counseling', action: 'Find a Counselor' },
  ]
  if (s.includes('debt') || s.includes('dti') || s.includes('income')) return [
    { label: '🧮 DTI Calculator', description: "Use the CFPB's tool to see exactly how your debts affect your mortgage eligibility.", url: 'https://www.consumerfinance.gov/owning-a-home/', action: 'Open Tool' },
    { label: '🎓 Student Loan Help', description: 'Explore income-driven repayment plans to reduce your monthly student loan obligation.', url: 'https://studentaid.gov/manage-loans/repayment/plans/income-driven', action: 'Learn More' },
    { label: '🏛️ Talk to a HUD Counselor', description: 'A counselor can help you build a personalized debt reduction plan.', url: 'https://www.hud.gov/counseling', action: 'Find a Counselor' },
  ]
  if (s.includes('down') || s.includes('save') || s.includes('payment')) return [
    { label: '🏠 Down Payment Assistance', description: 'HUD lists state and local programs that can help with your down payment.', url: 'https://www.hud.gov/topics/buying_a_home', action: 'Find Programs' },
    { label: '💰 First-Time Buyer Programs', description: 'Many states offer grants and low-interest loans specifically for first-time buyers.', url: 'https://www.consumerfinance.gov/owning-a-home/', action: 'Explore Options' },
    { label: '📈 High-Yield Savings', description: 'Park your down payment in a high-yield savings account to earn more while you save.', action: 'Search "HYSA" at your bank' },
  ]
  if (s.includes('employ') || s.includes('job') || s.includes('work')) return [
    { label: '📄 What Lenders Look For', description: "The CFPB explains exactly what employment documentation you'll need.", url: 'https://www.consumerfinance.gov/owning-a-home/', action: 'Read Guide' },
    { label: '🏛️ Talk to a HUD Counselor', description: 'A counselor can advise on how your employment situation affects your options.', url: 'https://www.hud.gov/counseling', action: 'Find a Counselor' },
  ]
  if (s.includes('pre-approv') || s.includes('lender') || s.includes('approv')) return [
    { label: '🏦 Compare Lenders', description: 'Bankrate lets you compare current mortgage rates from multiple lenders.', url: 'https://www.bankrate.com/mortgages/mortgage-rates/', action: 'Compare Rates' },
    { label: '🤝 Find a Credit Union', description: 'Credit unions often offer lower rates than traditional banks for members.', url: 'https://www.mycreditunion.gov/about-credit-unions/credit-union-locator', action: 'Find One Near Me' },
    { label: '📋 Document Checklist', description: "The CFPB's mortgage checklist helps you gather everything lenders need.", url: 'https://www.consumerfinance.gov/owning-a-home/', action: 'Get Checklist' },
  ]
  return [
    { label: '🏛️ Talk to a HUD Counselor', description: 'Free, unbiased mortgage counseling from a certified advisor.', url: 'https://www.hud.gov/counseling', action: 'Find a Counselor' },
    { label: '📚 CFPB Home Buying Guide', description: "The Consumer Financial Protection Bureau's free guide to buying a home.", url: 'https://www.consumerfinance.gov/owning-a-home/', action: 'Read Guide' },
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

  // Which step is focused in the left panel — default to first incomplete
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
    // Advance to next incomplete step after marking done
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

  return (
    <div className="plan-layout">
      {/* ── Top bar ──────────────────────────────────────────── */}
      <div className="plan-topbar">
        <button className="help-back-btn" onClick={onBack}>← Back to Results</button>
        <div className="plan-topbar-title">
          <span className="plan-topbar-icon">🗺️</span>
          <div>
            <div className="plan-topbar-heading">
              {name && name !== 'Guest' ? `${name.split(' ')[0]}'s` : 'Your'} Mortgage Action Plan
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

      {/* ── Two-column body ──────────────────────────────────── */}
      <div className="plan-body">

        {/* ════ LEFT: Current Step Detail ════════════════════ */}
        <div className="plan-main">

          {allDone ? (
            <div className="plan-all-done-card">
              <div className="plan-done-icon">🏆</div>
              <h2>All steps complete!</h2>
              <p>You've finished every step in your action plan. Your next move is to get pre-approved with a lender.</p>
              <a href="https://www.bankrate.com/mortgages/mortgage-rates/" target="_blank" rel="noopener noreferrer" className="plan-resource-btn" style={{ fontSize: '0.9rem', padding: '0.6rem 1.25rem' }}>
                Compare Lenders →
              </a>
            </div>
          ) : (
            <>
              {/* Step header */}
              <div className="plan-step-header">
                <div className="plan-step-label-row">
                  <span className="plan-step-label">Step {activeIdx + 1} of {steps.length}</span>
                  {activeIdx === 0 && !active.done && <span className="plan-step-badge">Start Here</span>}
                  {active.done && <span className="plan-step-badge plan-step-badge--done">✓ Complete</span>}
                </div>
                <h2 className="plan-step-title">{active.text}</h2>

                <div className="plan-step-actions">
                  <button
                    className={`plan-mark-btn${active.done ? ' plan-mark-btn--done' : ''}`}
                    onClick={() => toggleDone(activeIdx)}
                  >
                    {active.done ? '↩ Mark Incomplete' : '✓ Mark as Done'}
                  </button>
                  <div className="plan-nav-btns">
                    <button
                      className="plan-nav-btn"
                      onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                      disabled={activeIdx === 0}
                    >← Prev</button>
                    <button
                      className="plan-nav-btn plan-nav-btn--next"
                      onClick={() => setActiveIdx(i => Math.min(steps.length - 1, i + 1))}
                      disabled={activeIdx === steps.length - 1}
                    >Next →</button>
                  </div>
                </div>
              </div>

              {/* Local resources for step 1 */}
              {activeIdx === 0 && (
                <div className="local-resources-section" style={{ marginBottom: '1.25rem' }}>
                  <div className="local-res-heading">
                    <span>📍</span>
                    <span>Local Resources for {localRes.stateName}</span>
                  </div>

                  <div className="local-res-block">
                    <div className="local-res-block-title">🏛️ State Housing Authority</div>
                    <div className="plan-resource-item local-res-highlight">
                      <div className="plan-resource-header">
                        <span className="plan-resource-name">{localRes.housingAuthority.name}</span>
                        <a href={localRes.housingAuthority.url} target="_blank" rel="noopener noreferrer" className="plan-resource-btn">Visit Site →</a>
                      </div>
                      <p className="plan-resource-desc">{localRes.housingAuthority.description}</p>
                    </div>
                  </div>

                  {localRes.firstTimeBuyerPrograms.length > 0 && (
                    <div className="local-res-block">
                      <div className="local-res-block-title">🏠 First-Time Buyer Programs</div>
                      <div className="plan-resource-list">
                        {localRes.firstTimeBuyerPrograms.map((res, ri) => (
                          <div key={ri} className="plan-resource-item">
                            <div className="plan-resource-header">
                              <span className="plan-resource-name">{res.label}</span>
                              <a href={res.url} target="_blank" rel="noopener noreferrer" className="plan-resource-btn">Learn More →</a>
                            </div>
                            <p className="plan-resource-desc">{res.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {localRes.downPaymentAssistance.length > 0 && (
                    <div className="local-res-block">
                      <div className="local-res-block-title">💰 Down Payment Assistance</div>
                      <div className="plan-resource-list">
                        {localRes.downPaymentAssistance.map((res, ri) => (
                          <div key={ri} className="plan-resource-item">
                            <div className="plan-resource-header">
                              <span className="plan-resource-name">{res.label}</span>
                              <a href={res.url} target="_blank" rel="noopener noreferrer" className="plan-resource-btn">Apply →</a>
                            </div>
                            <p className="plan-resource-desc">{res.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="local-res-block">
                    <div className="local-res-block-title">🤝 Free HUD Counseling in {localRes.stateName}</div>
                    <div className="plan-resource-item">
                      <div className="plan-resource-header">
                        <span className="plan-resource-name">HUD-Approved Housing Counselors</span>
                        <a href={localRes.hudCounselingUrl} target="_blank" rel="noopener noreferrer" className="plan-resource-btn">Find Near Me →</a>
                      </div>
                      <p className="plan-resource-desc">Free, unbiased mortgage advice from a certified counselor in {localRes.stateName}. No cost, no sales pitch.</p>
                    </div>
                  </div>

                  {localRes.additionalResources.length > 0 && (
                    <div className="local-res-block">
                      <div className="local-res-block-title">📚 More Local Resources</div>
                      <div className="plan-resource-list">
                        {localRes.additionalResources.map((res, ri) => (
                          <div key={ri} className="plan-resource-item">
                            <div className="plan-resource-header">
                              <span className="plan-resource-name">{res.label}</span>
                              <a href={res.url} target="_blank" rel="noopener noreferrer" className="plan-resource-btn">Visit →</a>
                            </div>
                            <p className="plan-resource-desc">{res.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Support resources */}
              <div className="plan-resources-section">
                <div className="plan-resources-label">
                  {activeIdx === 0 ? 'General support resources' : 'Ways we can support you'}
                </div>
                <div className="plan-resource-list">
                  {getSupportResources(active.text).map((res, ri) => (
                    <div key={ri} className="plan-resource-item">
                      <div className="plan-resource-header">
                        <span className="plan-resource-name">{res.label}</span>
                        {res.url
                          ? <a href={res.url} target="_blank" rel="noopener noreferrer" className="plan-resource-btn">{res.action} →</a>
                          : res.action && <span className="plan-resource-note">{res.action}</span>
                        }
                      </div>
                      <p className="plan-resource-desc">{res.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Support footer */}
              <div className="plan-support-footer">
                <div className="plan-support-item">
                  <span className="plan-support-icon">🏛️</span>
                  <div>
                    <div className="plan-support-title">Free HUD Counseling</div>
                    <div className="plan-support-desc">Speak with a certified, unbiased mortgage advisor at no cost.</div>
                  </div>
                  <a href="https://www.hud.gov/counseling" target="_blank" rel="noopener noreferrer" className="plan-resource-btn">Find One →</a>
                </div>
                <div className="plan-support-item">
                  <span className="plan-support-icon">📞</span>
                  <div>
                    <div className="plan-support-title">CFPB Helpline</div>
                    <div className="plan-support-desc">Call 1-855-411-2372 for free mortgage questions, Mon–Fri 8am–8pm ET.</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Save progress CTA ────────────────────────────── */}
          {!emailSaved ? (
            <div className="account-cta-card">
              {!showEmailForm ? (
                <>
                  <div className="account-cta-left">
                    <div className="account-cta-icon">🔔</div>
                    <div>
                      <div className="account-cta-title">Save your progress</div>
                      <div className="account-cta-desc">Add your email to save this plan and get reminders as you work through each step.</div>
                    </div>
                  </div>
                  <button className="btn-create-account" onClick={() => setShowEmailForm(true)}>
                    Save My Plan
                  </button>
                </>
              ) : (
                <div className="account-form" style={{ width: '100%' }}>
                  <div className="account-form-title">Save your plan to {name ? name.split(' ')[0] : 'your'}'s profile</div>
                  <div className="account-form-fields">
                    <input
                      type="email"
                      placeholder="Email address"
                      value={emailInput}
                      onChange={e => setEmailInput(e.target.value)}
                      autoFocus
                      onKeyDown={e => e.key === 'Enter' && handleSaveEmail()}
                    />
                  </div>
                  <div className="account-form-actions">
                    <button className="btn-back" onClick={() => setShowEmailForm(false)}>Cancel</button>
                    <button className="btn-next" onClick={handleSaveEmail} disabled={!emailInput.trim()} style={{ flex: 1 }}>
                      Save →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="account-created-banner">
              <span>✓</span>
              <div><strong>Plan saved!</strong> Progress is tracked to {profile.email}.</div>
            </div>
          )}
        </div>

        {/* ════ RIGHT: Progress Sidebar ══════════════════════ */}
        <aside className="plan-sidebar">
          {/* Overall progress */}
          <div className="sidebar-progress-card">
            <div className="sidebar-progress-header">
              <span className="sidebar-progress-title">Your Progress</span>
              <span className="sidebar-progress-count">{doneCount}/{steps.length}</span>
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
                  {/* Connector line */}
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
              <span className="sidebar-stat-label">DTI Ratio</span>
            </div>
            <div className="sidebar-stat">
              <span className="sidebar-stat-val">{result.ltv_ratio}%</span>
              <span className="sidebar-stat-label">LTV Ratio</span>
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
