import { useEffect, useState } from 'react'
import MortgageForm from './components/MortgageForm'
import HomeBudgetResults from './components/HomeBudgetResults'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import BrandMark from './components/BrandMark'
import LoanOfficerCard from './components/LoanOfficerCard'
import LegalFooter from './components/LegalFooter'
import { MortgageInput } from './types'
import { applyBranding, useBranding } from './hooks/useBranding'
import { useTrackedLink } from './hooks/useTrackedLink'

export default function App() {
  const [profile, setProfile] = useState<MortgageInput | null>(null)
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const { branding: localBranding } = useBranding()
  const tracking = useTrackedLink()
  const branding = tracking.status === 'ready' ? tracking.link.branding : localBranding

  useEffect(() => { applyBranding(branding) }, [branding])

  const handleFieldCommit = (field: string, value: string | number) => setTrackerEntries(previous => [
    ...previous.filter(entry => entry.field !== field), { field, value },
  ])

  const restart = () => { setProfile(null); setTrackerEntries([]) }

  if (tracking.status === 'loading') return <main className="link-state-shell"><section className="link-state-card"><span className="link-state-spinner" /><p>Loading your personalized home-budget planner…</p></section></main>

  if (tracking.status === 'not_found' || tracking.status === 'error') return <main className="link-state-shell"><section className="link-state-card"><BrandMark branding={localBranding} size="md" /><h1>This borrower link is unavailable.</h1><p>{tracking.message}</p><button type="button" onClick={() => window.location.reload()}>Try again</button></section></main>

  const trackedLink = tracking.status === 'ready' ? tracking.link : null

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
      <div className="quiz-main"><MortgageForm onSubmit={setProfile} loading={false} onFieldCommit={handleFieldCommit} trackedLink={trackedLink} /></div>
      <div className="tracker-fixed"><ValueTracker entries={trackerEntries} /></div>
    </>}

    {profile && <HomeBudgetResults profile={profile} onBack={restart} branding={branding} trackedLink={trackedLink} />}

    <LegalFooter branding={branding} tracked={!!trackedLink} />
  </div>
}
