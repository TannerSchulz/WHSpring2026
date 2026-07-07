import { useState } from 'react'
import AccountSetupPage from './AccountSetupPage'
import ActionPlanView from './ActionPlanView'
import MortgageCalculator from './MortgageCalculator'
import BrandMark from './BrandMark'
import LoanOfficerCard from './LoanOfficerCard'
import { MortgageInput, AssessmentResponse } from '../types'
import type { UserProfile } from '../types/profile'
import type { Branding } from '../types/branding'

interface Props {
  result: AssessmentResponse
  lastProfile: MortgageInput
  onBack: () => void
  onProfileSave: (p: UserProfile) => void
  existingProfile?: UserProfile | null
  initialTab?: 'plan' | 'calculator'
  isDemoRun?: boolean
  demoPaused?: boolean
  branding: Branding
  onCustomize?: () => void
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
  branding,
  onCustomize,
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

  // App always sets lastProfile to the freshest answers — either the quiz the
  // user just finished or the profile they resumed. A previously saved profile
  // in localStorage must not shadow numbers entered moments ago.
  const calcPrefill: MortgageInput = lastProfile

  return (
    <div className="dashboard-shell">
      <div className="dashboard-topbar">
        <div className="dashboard-brand"><BrandMark branding={branding} size="sm" /></div>
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
        <div className="dashboard-topbar-actions">
          {onCustomize && (
            <button className="brand-customize-btn" onClick={onCustomize}>⚙️ Customize</button>
          )}
          <button className="dashboard-start-over" onClick={onBack}>Start Over</button>
        </div>
      </div>

      {branding.officerName && (
        <div className="dashboard-lo-row">
          <LoanOfficerCard branding={branding} />
        </div>
      )}

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
