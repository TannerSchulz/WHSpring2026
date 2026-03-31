import { useState, useEffect } from 'react'
import { MortgageInput, AssessmentResponse } from '../types'
import { US_STATES } from '../data/localResources'
import ActionPlanView from './ActionPlanView'
import type { UserProfile } from '../types/profile'

interface Props {
  result: AssessmentResponse
  userProfile: MortgageInput
  onBack: () => void
  onProfileSave: (p: UserProfile) => void
  existingProfile?: UserProfile | null
  inDashboard?: boolean
  isDemoRun?: boolean
}

const SETUP_STEPS = [
  { id: 'goals', icon: '🎯', label: 'Your Goals' },
  { id: 'plan',  icon: '🗺️', label: 'Your Plan' },
]

interface GoalsForm {
  name: string
  timeline: string
  firstHome: boolean
  workingWithAgent: boolean
  topConcern: string
  stateCode: string
}

const defaultGoals: GoalsForm = {
  name: '', timeline: '', firstHome: true, workingWithAgent: false, topConcern: '', stateCode: '',
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

export default function AccountSetupPage({ result, userProfile, onBack, onProfileSave, existingProfile, inDashboard, isDemoRun }: Props) {
  const [setupStep, setSetupStep] = useState(0)
  const [goals, setGoals] = useState<GoalsForm>(defaultGoals)
  const [activeProfile, setActiveProfile] = useState<UserProfile | null>(existingProfile ?? null)
  const [animating, setAnimating] = useState(false)

  // Demo: auto-fill and auto-advance through setup steps
  useEffect(() => {
    if (!isDemoRun || activeProfile) return
    const timers: ReturnType<typeof setTimeout>[] = []
    timers.push(setTimeout(() => setGoals({
      name: 'Demo User', timeline: 'Within 1 year', firstHome: true,
      workingWithAgent: false, topConcern: '', stateCode: 'UT',
    }), 900))
    timers.push(setTimeout(() => setSetupStep(1), 2800))
    timers.push(setTimeout(() => setGoals(g => ({ ...g, topConcern: 'Understanding the home buying process' })), 4200))
    timers.push(setTimeout(() => {
      const now = new Date().toISOString()
      const profile: UserProfile = {
        id: crypto.randomUUID(), name: 'Demo User', email: '',
        createdAt: now, lastUpdated: now, stateCode: 'UT',
        mortgageInput: userProfile, assessment: result,
        goals: { timeline: 'Within 1 year', firstHome: true, workingWithAgent: false, topConcern: 'Understanding the home buying process' },
        stepProgress: result.action_steps.map(() => false),
      }
      onProfileSave(profile)
      setActiveProfile(profile)
    }, 6000))
    return () => timers.forEach(clearTimeout)
  }, [isDemoRun]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (field: keyof GoalsForm, value: string | boolean) =>
    setGoals(f => ({ ...f, [field]: value }))

  const advance = () => {
    if (setupStep < SETUP_STEPS.length - 1) {
      setAnimating(true)
      setTimeout(() => { setSetupStep(s => s + 1); setAnimating(false) }, 280)
    } else {
      buildProfile()
    }
  }

  const back = () => {
    if (setupStep === 0) { onBack(); return }
    setAnimating(true)
    setTimeout(() => { setSetupStep(s => s - 1); setAnimating(false) }, 280)
  }

  const buildProfile = () => {
    const now = new Date().toISOString()
    const profile: UserProfile = {
      id: crypto.randomUUID(),
      name: goals.name.trim() || 'Guest',
      email: '',
      createdAt: now,
      lastUpdated: now,
      stateCode: goals.stateCode,
      mortgageInput: userProfile,
      assessment: result,
      goals: {
        timeline: goals.timeline,
        firstHome: goals.firstHome,
        workingWithAgent: goals.workingWithAgent,
        topConcern: goals.topConcern,
      },
      stepProgress: result.action_steps.map(() => false),
    }
    onProfileSave(profile)
    setActiveProfile(profile)
  }

  const handleProfileUpdate = (p: UserProfile) => {
    setActiveProfile(p)
    onProfileSave(p)
  }

  if (activeProfile) {
    return (
      <ActionPlanView
        profile={activeProfile}
        onProfileUpdate={handleProfileUpdate}
        onBack={onBack}
        inDashboard={inDashboard}
      />
    )
  }

  return (
    <div className="setup-page">
      {!inDashboard && <button className="help-back-btn" onClick={back}>← Back</button>}

      <div className="setup-header">
        <h1 className="setup-title">Build your mortgage plan</h1>
        <p className="setup-subtitle">Two quick questions, then your personalized roadmap.</p>
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
              <label>What should we call you? <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span></label>
              <input
                type="text"
                className="setup-text-input"
                placeholder="Your name"
                value={goals.name}
                onChange={e => set('name', e.target.value)}
                autoComplete="given-name"
              />
            </div>

            <div className="setup-field" style={{ marginTop: '1.25rem' }}>
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

            <div className="setup-field" style={{ marginTop: '1.25rem' }}>
              <label>What state are you buying in? <span style={{ fontWeight: 400, opacity: 0.6 }}>(for local resources)</span></label>
              <select
                className="setup-select"
                value={goals.stateCode}
                onChange={e => set('stateCode', e.target.value)}
              >
                <option value="">— Select your state —</option>
                {US_STATES.map(s => (
                  <option key={s.code} value={s.code}>{s.name}</option>
                ))}
              </select>
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
          {!inDashboard && <button className="btn-back" type="button" onClick={back}>← Back</button>}
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
