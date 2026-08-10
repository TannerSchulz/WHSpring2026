import { useState } from 'react'
import MortgageForm from './components/MortgageForm'
import HomeBudgetResults from './components/HomeBudgetResults'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import BrandingSettings from './components/BrandingSettings'
import BrandMark from './components/BrandMark'
import LoanOfficerCard from './components/LoanOfficerCard'
import LegalFooter from './components/LegalFooter'
import { MortgageInput } from './types'
import { useBranding } from './hooks/useBranding'
import { APP_VERSION } from './version'

export default function App() {
  const [profile, setProfile] = useState<MortgageInput | null>(null)
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const { branding, save: saveBranding, reset: resetBranding } = useBranding()
  const [showBranding, setShowBranding] = useState(false)

  const handleFieldCommit = (field: string, value: string | number) => setTrackerEntries(previous => [
    ...previous.filter(entry => entry.field !== field), { field, value },
  ])

  const restart = () => { setProfile(null); setTrackerEntries([]) }

  return <div className={`app${profile ? ' app--full' : ''}`}>
    {!profile && <>
      <nav className="top-nav">
        <div className="brand-version-lockup"><BrandMark branding={branding} size="sm" /><span className="brand-version">Version {APP_VERSION}</span></div>
        <button className="brand-customize-btn" onClick={() => setShowBranding(true)}>Customize</button>
      </nav>
      <header className="app-header">
        <h1>Your path to <span>homeownership</span> starts here</h1>
        <p>Answer a few quick questions to see a personalized home budget.</p>
        <div className="hero-pills"><span className="hero-pill">About 2 minutes</span><span className="hero-pill">No credit pull</span><span className="hero-pill">No pass/fail screening</span></div>
        <LoanOfficerCard branding={branding} />
      </header>
      <div className="quiz-main"><MortgageForm onSubmit={setProfile} loading={false} onFieldCommit={handleFieldCommit} /></div>
      <div className="tracker-fixed"><ValueTracker entries={trackerEntries} /></div>
    </>}

    {profile && <HomeBudgetResults profile={profile} onBack={restart} branding={branding} />}

    {showBranding && <BrandingSettings branding={branding} onSave={saveBranding} onReset={resetBranding} onClose={() => setShowBranding(false)} />}

    <LegalFooter branding={branding} />
  </div>
}
