import { useState, useEffect, useRef } from 'react'
import AccountSetupPage from './AccountSetupPage'
import ActionPlanView from './ActionPlanView'
import MortgageCalculator from './MortgageCalculator'
import { MortgageInput, AssessmentResponse } from '../types'
import type { UserProfile } from '../types/profile'

interface Props {
  result: AssessmentResponse
  lastProfile: MortgageInput
  onBack: () => void
  onProfileSave: (p: UserProfile) => void
  existingProfile?: UserProfile | null
  initialTab?: 'plan' | 'calculator'
  isDemoRun?: boolean
  demoPaused?: boolean
}

type Tab = 'plan' | 'calculator'

export default function Dashboard({
  result,
  lastProfile,
  onBack,
  onProfileSave,
  existingProfile,
  initialTab = 'plan',
  isDemoRun = false,
  demoPaused = false,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(existingProfile ?? null)
  const actionPlanShownRef = useRef(false)

  // Demo: after action plan is built, wait 10s then switch to calculator
  useEffect(() => {
    if (!isDemoRun || !savedProfile || demoPaused || actionPlanShownRef.current) return
    actionPlanShownRef.current = true
    const t = setTimeout(() => setTab('calculator'), 10000)
    return () => clearTimeout(t)
  }, [isDemoRun, savedProfile, demoPaused])

  const handleProfileSave = (p: UserProfile) => {
    setSavedProfile(p)
    onProfileSave(p)
  }

  const calcPrefill: MortgageInput = savedProfile
    ? { ...savedProfile.mortgageInput, state: savedProfile.stateCode || savedProfile.mortgageInput.state }
    : lastProfile

  return (
    <div className="dashboard-shell">
      <div className="dashboard-topbar">
        <div className="dashboard-brand">Mortgage<span>AI</span></div>
        <div className="dashboard-tabs">
          <button
            className={`dashboard-tab${tab === 'plan' ? ' active' : ''}`}
            onClick={() => setTab('plan')}
          >
            📋 Action Plan
          </button>
          <button
            className={`dashboard-tab${tab === 'calculator' ? ' active' : ''}`}
            onClick={() => setTab('calculator')}
          >
            🧮 Calculator
          </button>
        </div>
        <button className="dashboard-start-over" onClick={onBack}>Start Over</button>
      </div>

      <div className="dashboard-content">
        {tab === 'plan' && (
          savedProfile ? (
            <ActionPlanView
              profile={savedProfile}
              onProfileUpdate={p => { setSavedProfile(p); onProfileSave(p) }}
              onBack={onBack}
              inDashboard
            />
          ) : (
            <AccountSetupPage
              result={result}
              userProfile={lastProfile}
              onBack={onBack}
              onProfileSave={handleProfileSave}
              existingProfile={null}
              inDashboard
              isDemoRun={isDemoRun}
            />
          )
        )}

        {tab === 'calculator' && (
          <MortgageCalculator
            onBack={() => setTab('plan')}
            prefill={calcPrefill}
            isDemoRun={isDemoRun}
            demoPaused={demoPaused}
            inDashboard
          />
        )}
      </div>
    </div>
  )
}
