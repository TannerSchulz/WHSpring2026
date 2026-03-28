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

interface ActionStep { text: string; done: boolean; expanded: boolean }

interface Props {
  profile: UserProfile
  onProfileUpdate: (p: UserProfile) => void
  onBack: () => void
}

export default function ActionPlanView({ profile, onProfileUpdate, onBack }: Props) {
  const { assessment: result, stateCode, name } = profile
  const localRes = getStateResources(stateCode)

  const [steps, setSteps] = useState<ActionStep[]>(() =>
    result.action_steps.map((text, i) => ({
      text,
      done: profile.stepProgress[i] ?? false,
      expanded: false,
    }))
  )

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailInput, setEmailInput] = useState(profile.email || '')
  const [emailSaved, setEmailSaved] = useState(!!profile.email)

  const toggleDone = (i: number) => {
    const updated = steps.map((s, idx) => idx === i ? { ...s, done: !s.done } : s)
    setSteps(updated)
    onProfileUpdate({ ...profile, stepProgress: updated.map(s => s.done) })
  }

  const toggleExpand = (i: number) =>
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, expanded: !step.expanded } : step))

  const doneCount = steps.filter(s => s.done).length
  const pct = steps.length > 0 ? Math.round((doneCount / steps.length) * 100) : 0
  const circumference = 2 * Math.PI * 22  // r=22 → ~138.2

  const initials = name
    ? name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  const handleSaveEmail = () => {
    if (!emailInput.trim()) return
    onProfileUpdate({ ...profile, email: emailInput.trim() })
    setEmailSaved(true)
    setShowEmailForm(false)
  }

  return (
    <div className="setup-page">
      <button className="help-back-btn" onClick={onBack}>← Back to Results</button>

      {/* ── Profile Card ────────────────────────────────────── */}
      <div className="profile-card">
        <div className="profile-avatar">{initials}</div>
        <div className="profile-info">
          <div className="profile-name">{name || 'Your Profile'}</div>
          <div className="profile-meta">
            {stateCode && (
              <span className="profile-tag">📍 {localRes.stateName}</span>
            )}
            <span className={`profile-tag ${result.qualifies ? 'profile-tag--green' : 'profile-tag--yellow'}`}>
              {result.qualifies ? '✓ Likely Qualifies' : '⚠ Needs Work'}
            </span>
            <span className="profile-tag">
              Since {new Date(profile.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          {profile.goals.topConcern && (
            <div className="profile-concern">
              <span className="profile-concern-label">Focus:</span> {profile.goals.topConcern}
            </div>
          )}
        </div>
        <div className="profile-ring-wrap">
          <svg width="56" height="56" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />
            <circle
              cx="26" cy="26" r="22"
              fill="none"
              stroke="url(#ringGrad)"
              strokeWidth="4"
              strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
              strokeLinecap="round"
              transform="rotate(-90 26 26)"
            />
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
            </defs>
          </svg>
          <div className="profile-ring-label">
            <span className="profile-ring-pct">{pct}%</span>
          </div>
        </div>
      </div>

      {/* ── Plan header ─────────────────────────────────────── */}
      <div className="plan-welcome">
        <div className="plan-welcome-icon">🗺️</div>
        <div>
          <h2 className="plan-welcome-title">Your Mortgage Action Plan</h2>
          <p className="plan-welcome-sub">Work through these steps at your own pace. Expand each one for tools and resources.</p>
        </div>
      </div>

      {/* ── Progress bar ────────────────────────────────────── */}
      <div className="plan-progress-card">
        <div className="plan-progress-header">
          <span className="plan-progress-label">Your Progress</span>
          <span className="plan-progress-count">{doneCount} of {steps.length} steps complete</span>
        </div>
        <div className="plan-progress-bar">
          <div className="plan-progress-fill" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>
        {doneCount === steps.length && (
          <div className="plan-all-done">🏆 You've completed all your steps! Consider getting pre-approved next.</div>
        )}
      </div>

      {/* ── Steps ───────────────────────────────────────────── */}
      <div className="plan-steps">
        {steps.map((step, i) => (
          <div key={i} className={`plan-step-card${step.done ? ' plan-step--done' : ''}${i === 0 ? ' plan-step-card--featured' : ''}`}>
            <div className="plan-step-top">
              <button className="plan-check-btn" onClick={() => toggleDone(i)}>
                {step.done ? '✓' : ''}
              </button>
              <div className="plan-step-content">
                <div className="plan-step-num">
                  Step {i + 1}
                  {i === 0 && <span className="plan-step-badge">Start Here</span>}
                </div>
                <div className="plan-step-text">{step.text}</div>
              </div>
              <button className="plan-expand-btn" onClick={() => toggleExpand(i)}>
                {step.expanded ? '▲' : '▼'}
              </button>
            </div>

            {step.expanded && (
              <div className="plan-step-resources">
                {/* Step 1: show local resources */}
                {i === 0 && (
                  <div className="local-resources-section">
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

                <div className="plan-resources-label">{i === 0 ? 'General support resources' : 'Ways we can support you'}</div>
                <div className="plan-resource-list">
                  {getSupportResources(step.text).map((res, ri) => (
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
            )}
          </div>
        ))}
      </div>

      {/* ── Support footer ──────────────────────────────────── */}
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

      {/* ── Save progress / account CTA ─────────────────────── */}
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
                <button
                  className="btn-next"
                  onClick={handleSaveEmail}
                  disabled={!emailInput.trim()}
                  style={{ flex: 1 }}
                >
                  Save →
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="account-created-banner">
          <span>✓</span>
          <div>
            <strong>Plan saved!</strong> Progress is tracked to {profile.email}.
          </div>
        </div>
      )}
    </div>
  )
}
