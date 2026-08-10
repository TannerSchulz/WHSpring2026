import { useState } from 'react'
import MortgageForm from './components/MortgageForm'
import HomeBudgetResults from './components/HomeBudgetResults'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import BrandMark from './components/BrandMark'
import LoanOfficerCard from './components/LoanOfficerCard'
import LegalFooter from './components/LegalFooter'
import { MortgageInput } from './types'
import { useBranding } from './hooks/useBranding'

export default function App() {
  const [profile, setProfile] = useState<MortgageInput | null>(null)
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const { branding } = useBranding()

  const handleFieldCommit = (field: string, value: string | number) => setTrackerEntries(previous => [
    ...previous.filter(entry => entry.field !== field), { field, value },
  ])

  const restart = () => { setProfile(null); setTrackerEntries([]) }

  return <div className={`app${profile ? ' app--full' : ''}`}>
    {!profile && <>
      <nav className="top-nav">
        <BrandMark branding={branding} size="sm" />
        <span className="borrower-nav-label">Home budget planner</span>
      </nav>
      <header className="app-header">
        {branding.officerName && <div className="borrower-shared-by">Shared with you by {branding.officerName}</div>}
        <h1>Explore your path to <span>homeownership</span></h1>
        <p>Answer a few quick questions to see a personalized home budget.</p>
        <div className="hero-pills"><span className="hero-pill">About 2 minutes</span><span className="hero-pill">No credit pull</span><span className="hero-pill">No pass/fail screening</span></div>
        <LoanOfficerCard branding={branding} />
      </header>
      <div className="quiz-main"><MortgageForm onSubmit={setProfile} loading={false} onFieldCommit={handleFieldCommit} /></div>
      <div className="tracker-fixed"><ValueTracker entries={trackerEntries} /></div>
    </>}

    {profile && <HomeBudgetResults profile={profile} onBack={restart} branding={branding} />}

    <LegalFooter branding={branding} />
  </div>
}
