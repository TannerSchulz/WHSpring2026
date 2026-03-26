import { useState } from 'react'
import { MortgageInput, AssessmentResponse } from '../types'

interface Props {
  result: AssessmentResponse
  userProfile: MortgageInput
  onBack: () => void
}

const SETUP_STEPS = [
  { id: 'goals', icon: '🎯', label: 'Your Goals' },
  { id: 'plan',  icon: '🗺️', label: 'Your Plan' },
]

interface GoalsForm {
  timeline: string
  firstHome: boolean
  workingWithAgent: boolean
  topConcern: string
}

const defaultGoals: GoalsForm = {
  timeline: '', firstHome: true, workingWithAgent: false, topConcern: '',
}

const TIMELINE_OPTIONS = [
  'As soon as possible (< 3 months)',
  'Within 6 months',
  'Within 1 year',
  'Just exploring for now',
]

const CONCERN_OPTIONS = [
  'Understanding if I qualify',
  'Improving my credit score',
  'Saving enough for a down payment',
  'Finding the right loan type',
  'Understanding the home buying process',
]

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

function ActionPlanView({ result, onBack }: { result: AssessmentResponse; onBack: () => void }) {
  const [steps, setSteps] = useState<ActionStep[]>(
    result.action_steps.map(text => ({ text, done: false, expanded: false }))
  )
  const [showAccountForm, setShowAccountForm] = useState(false)
  const [accountForm, setAccountForm] = useState({ name: '', email: '' })
  const [accountCreated, setAccountCreated] = useState(false)

  const toggleDone = (i: number) =>
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, done: !step.done } : step))
  const toggleExpand = (i: number) =>
    setSteps(s => s.map((step, idx) => idx === i ? { ...step, expanded: !step.expanded } : step))

  const doneCount = steps.filter(s => s.done).length

  const handleCreateAccount = () => {
    if (!accountForm.name || !accountForm.email) return
    setAccountCreated(true)
    setShowAccountForm(false)
  }

  return (
    <div className="setup-page">
      <button className="help-back-btn" onClick={onBack}>← Back to Results</button>

      <div className="plan-welcome">
        <div className="plan-welcome-icon">🗺️</div>
        <div>
          <h2 className="plan-welcome-title">Your Mortgage Action Plan</h2>
          <p className="plan-welcome-sub">Work through these steps at your own pace. Expand each one for tools and resources.</p>
        </div>
      </div>

      {/* Progress */}
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

      {/* Steps */}
      <div className="plan-steps">
        {steps.map((step, i) => (
          <div key={i} className={`plan-step-card${step.done ? ' plan-step--done' : ''}`}>
            <div className="plan-step-top">
              <button className="plan-check-btn" onClick={() => toggleDone(i)}>
                {step.done ? '✓' : ''}
              </button>
              <div className="plan-step-content">
                <div className="plan-step-num">Step {i + 1}</div>
                <div className="plan-step-text">{step.text}</div>
              </div>
              <button className="plan-expand-btn" onClick={() => toggleExpand(i)}>
                {step.expanded ? '▲' : '▼'}
              </button>
            </div>
            {step.expanded && (
              <div className="plan-step-resources">
                <div className="plan-resources-label">Ways we can support you</div>
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

      {/* Account CTA */}
      {!accountCreated ? (
        <div className="account-cta-card">
          {!showAccountForm ? (
            <>
              <div className="account-cta-left">
                <div className="account-cta-icon">🔔</div>
                <div>
                  <div className="account-cta-title">Want to track your progress?</div>
                  <div className="account-cta-desc">Create a free account to save your plan, get reminders, and access useful tools as you work through each step.</div>
                </div>
              </div>
              <button className="btn-create-account" onClick={() => setShowAccountForm(true)}>
                Create Free Account
              </button>
            </>
          ) : (
            <div className="account-form" style={{ width: '100%' }}>
              <div className="account-form-title">Create your free account</div>
              <div className="account-form-fields">
                <input
                  type="text"
                  placeholder="Your name"
                  value={accountForm.name}
                  onChange={e => setAccountForm(f => ({ ...f, name: e.target.value }))}
                  autoFocus
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={accountForm.email}
                  onChange={e => setAccountForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="account-form-actions">
                <button className="btn-back" onClick={() => setShowAccountForm(false)}>Cancel</button>
                <button
                  className="btn-next"
                  onClick={handleCreateAccount}
                  disabled={!accountForm.name || !accountForm.email}
                  style={{ flex: 1 }}
                >
                  Create Account →
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="account-created-banner">
          <span>✓</span>
          <div>
            <strong>Account created!</strong> We'll send your plan and progress updates to {accountForm.email}.
          </div>
        </div>
      )}
    </div>
  )
}

export default function AccountSetupPage({ result, userProfile, onBack }: Props) {
  const [setupStep, setSetupStep] = useState(0)
  const [goals, setGoals] = useState<GoalsForm>(defaultGoals)
  const [submitted, setSubmitted] = useState(false)
  const [animating, setAnimating] = useState(false)

  const set = (field: keyof GoalsForm, value: string | boolean) =>
    setGoals(f => ({ ...f, [field]: value }))

  const advance = () => {
    if (setupStep < SETUP_STEPS.length - 1) {
      setAnimating(true)
      setTimeout(() => { setSetupStep(s => s + 1); setAnimating(false) }, 280)
    } else {
      setSubmitted(true)
    }
  }

  const back = () => {
    if (setupStep === 0) { onBack(); return }
    setAnimating(true)
    setTimeout(() => { setSetupStep(s => s - 1); setAnimating(false) }, 280)
  }

  if (submitted) {
    return <ActionPlanView result={result} onBack={onBack} />
  }

  return (
    <div className="setup-page">
      <button className="help-back-btn" onClick={back}>← Back</button>

      <div className="setup-header">
        <h1 className="setup-title">Build your mortgage plan</h1>
        <p className="setup-subtitle">Answer two quick questions and we'll create your personalized roadmap.</p>
      </div>

      <div className="setup-steps-indicator">
        {SETUP_STEPS.map((s, i) => (
          <div key={s.id} className={`setup-step-dot ${i < setupStep ? 'done' : ''} ${i === setupStep ? 'active' : ''}`}>
            <div className="setup-dot-icon">{i < setupStep ? '✓' : s.icon}</div>
            <div className="setup-dot-label">{s.label}</div>
            {i < SETUP_STEPS.length - 1 && <div className={`setup-dot-line ${i < setupStep ? 'done' : ''}`} />}
          </div>
        ))}
      </div>

      <div className={`card setup-card${animating ? ' exit' : ''}`}>
        {setupStep === 0 && (
          <div className="setup-step">
            <div className="setup-step-heading">🎯 What are your goals?</div>
            <div className="setup-field">
              <label>When are you hoping to buy?</label>
              <div className="setup-options">
                {TIMELINE_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`setup-option${goals.timeline === opt ? ' selected' : ''}`} onClick={() => set('timeline', opt)}>{opt}</button>
                ))}
              </div>
            </div>
            <div className="setup-field" style={{ marginTop: '1.25rem' }}>
              <label>Is this your first home?</label>
              <div className="setup-toggle-group">
                <button type="button" className={`setup-toggle${goals.firstHome ? ' selected' : ''}`} onClick={() => set('firstHome', true)}>Yes, first home</button>
                <button type="button" className={`setup-toggle${!goals.firstHome ? ' selected' : ''}`} onClick={() => set('firstHome', false)}>No, I've owned before</button>
              </div>
            </div>
            <div className="setup-field" style={{ marginTop: '1.25rem' }}>
              <label>Are you working with a real estate agent?</label>
              <div className="setup-toggle-group">
                <button type="button" className={`setup-toggle${goals.workingWithAgent ? ' selected' : ''}`} onClick={() => set('workingWithAgent', true)}>Yes</button>
                <button type="button" className={`setup-toggle${!goals.workingWithAgent ? ' selected' : ''}`} onClick={() => set('workingWithAgent', false)}>Not yet</button>
              </div>
            </div>
          </div>
        )}

        {setupStep === 1 && (
          <div className="setup-step">
            <div className="setup-step-heading">🗺️ What's your biggest concern?</div>
            <div className="setup-field">
              <label>Pick the one that matters most right now</label>
              <div className="setup-options">
                {CONCERN_OPTIONS.map(opt => (
                  <button key={opt} type="button" className={`setup-option${goals.topConcern === opt ? ' selected' : ''}`} onClick={() => set('topConcern', opt)}>{opt}</button>
                ))}
              </div>
            </div>
            <div className="setup-summary">
              <div className="setup-summary-title">Your snapshot</div>
              <div className="setup-summary-row"><span>Status</span><span className={result.qualifies ? 'text-success' : 'text-warn'}>{result.qualifies ? '✓ Likely qualifies' : '⚠ Needs improvement'}</span></div>
              <div className="setup-summary-row"><span>DTI Ratio</span><span>{result.dti_ratio}%</span></div>
              <div className="setup-summary-row"><span>Loan Type</span><span>{userProfile.loan_type.toUpperCase()}</span></div>
              {result.estimated_monthly_payment && (
                <div className="setup-summary-row"><span>Est. Payment</span><span>${result.estimated_monthly_payment.toLocaleString()}/mo</span></div>
              )}
            </div>
          </div>
        )}

        <div className="step-nav" style={{ marginTop: '1.5rem' }}>
          <button className="btn-back" type="button" onClick={back}>← Back</button>
          <button
            className="btn-next"
            type="button"
            onClick={advance}
            disabled={
              (setupStep === 0 && !goals.timeline) ||
              (setupStep === 1 && !goals.topConcern)
            }
          >
            {setupStep === SETUP_STEPS.length - 1 ? '🚀 Build My Plan' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}
