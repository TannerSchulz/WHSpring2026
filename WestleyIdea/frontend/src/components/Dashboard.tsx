import { useState } from 'react'
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
  initialTab = 'calculator',
  isDemoRun = false,
  demoPaused = false,
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(existingProfile ?? null)

  const handleProfileSave = (p: UserProfile) => {
    setSavedProfile(p)
    onProfileSave(p)
    if (!isDemoRun) setTab('calculator')
  }

  const handleCalcDemoComplete = () => {
    setTab('plan')
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
            className={`dashboard-tab${tab === 'calculator' ? ' active' : ''}`}
            onClick={() => setTab('calculator')}
          >
            🧮 Calculator
          </button>
          <button
            className={`dashboard-tab${tab === 'plan' ? ' active' : ''}`}
            onClick={() => setTab('plan')}
          >
            📋 Action Plan
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
              isDemoRun={isDemoRun}
              demoPaused={demoPaused}
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
              demoPaused={demoPaused}
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
            onDemoComplete={handleCalcDemoComplete}
          />
        )}
      </div>
    </div>
  )
}
