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
}

type Tab = 'plan' | 'calculator'

export default function Dashboard({
  result,
  lastProfile,
  onBack,
  onProfileSave,
  existingProfile,
  initialTab = 'plan',
}: Props) {
  const [tab, setTab] = useState<Tab>(initialTab)
  const [savedProfile, setSavedProfile] = useState<UserProfile | null>(existingProfile ?? null)

  const handleProfileSave = (p: UserProfile) => {
    setSavedProfile(p)
    onProfileSave(p)
  }

  // Build prefill for calculator merging profile state
  const calcPrefill: MortgageInput = savedProfile
    ? { ...savedProfile.mortgageInput, state: savedProfile.stateCode || savedProfile.mortgageInput.state }
    : lastProfile

  return (
    <div className="dashboard-shell">
      <div className="dashboard-topbar">
        <button className="help-back-btn" onClick={onBack}>← Results</button>
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
        <div className="dashboard-topbar-spacer" />
      </div>

      <div className="dashboard-content">
        {tab === 'plan' && (
          savedProfile ? (
            <ActionPlanView
              profile={savedProfile}
              onProfileUpdate={p => { setSavedProfile(p); onProfileSave(p) }}
              onBack={onBack}
            />
          ) : (
            <AccountSetupPage
              result={result}
              userProfile={lastProfile}
              onBack={onBack}
              onProfileSave={handleProfileSave}
              existingProfile={null}
            />
          )
        )}

        {tab === 'calculator' && (
          <MortgageCalculator
            onBack={() => setTab('plan')}
            prefill={calcPrefill}
          />
        )}
      </div>
    </div>
  )
}
