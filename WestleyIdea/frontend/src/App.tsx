import { useState, useEffect } from 'react'
import MortgageForm from './components/MortgageForm'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import Dashboard from './components/Dashboard'
import BrandingSettings from './components/BrandingSettings'
import BrandMark from './components/BrandMark'
import LoanOfficerCard from './components/LoanOfficerCard'
import { MortgageInput } from './types'
import { useBranding } from './hooks/useBranding'
import { APP_VERSION } from './version'

type Stage = 'form' | 'dashboard'

// Sample data for the ?preview=calc dev shortcut
const PREVIEW_INPUT: MortgageInput = {
  annual_income: 95000,
  monthly_debts: 450,
  credit_score: 720,
  down_payment: 42000,
  home_price: 420000,
  employment_years: 3.5,
  loan_type: 'conventional',
  state: 'UT',
}

export default function App() {
  const [stage, setStage] = useState<Stage>('form')
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const [lastProfile, setLastProfile] = useState<MortgageInput | null>(null)
  const { branding, save: saveBranding, reset: resetBranding } = useBranding()
  const [showBranding, setShowBranding] = useState(false)

  const handleFieldCommit = (field: string, value: string | number) => {
    setTrackerEntries(prev => {
      const filtered = prev.filter(e => e.field !== field)
      return [...filtered, { field, value }]
    })
  }

  const handleSubmit = (data: MortgageInput) => {
    setLastProfile(data)
    setStage('dashboard')
  }

  const restart = () => {
    setStage('form')
    setTrackerEntries([])
    setLastProfile(null)
  }

  // Dev shortcut: ?preview=calc jumps straight to the dashboard with sample data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('preview') === 'calc') {
      setLastProfile(PREVIEW_INPUT)
      setStage('dashboard')
    }
  }, [])

  const showHeader = stage === 'form'
  const inNarrowFlow = stage === 'form'
  const showTracker = stage === 'form'

  return (
    <div className={`app${stage === 'dashboard' ? ' app--full' : ''}`}>
      {/* Top navigation — landing & error stages (dashboard has its own topbar) */}
      {showHeader && (
        <nav className="top-nav">
          <div className="brand-version-lockup">
            <BrandMark branding={branding} size="sm" />
            <span className="brand-version">Version {APP_VERSION}</span>
          </div>
          <div className="top-nav-actions">
            <button className="brand-customize-btn" onClick={() => setShowBranding(true)}>
              ⚙️ Customize
            </button>
          </div>
        </nav>
      )}

      {showBranding && (
        <BrandingSettings
          branding={branding}
          onSave={saveBranding}
          onReset={resetBranding}
          onClose={() => setShowBranding(false)}
        />
      )}

      {showHeader && (
        <header className="app-header">
          <h1>Your path to <span>homeownership</span> starts here</h1>
          <p>Answer a few quick questions to get mortgage estimates personalized to your numbers.</p>
          <div className="hero-pills">
            <span className="hero-pill">⚡ About 2 minutes</span>
            <span className="hero-pill">🔒 No credit pull</span>
            <span className="hero-pill">🏔️ Built for Utah buyers</span>
          </div>
          <LoanOfficerCard branding={branding} />
        </header>
      )}

      {inNarrowFlow && (
        <div className="quiz-main">
          {stage === 'form' && (
            <MortgageForm
              onSubmit={handleSubmit}
              loading={false}
              onFieldCommit={handleFieldCommit}
            />
          )}

        </div>
      )}

      {stage === 'dashboard' && lastProfile && (
        <Dashboard
          lastProfile={lastProfile}
          onBack={restart}
          branding={branding}
          onCustomize={() => setShowBranding(true)}
        />
      )}

      {showTracker && (
        <div className="tracker-fixed">
          <ValueTracker entries={trackerEntries} />
        </div>
      )}

      <footer className="disclaimer-footer">
        <strong>Estimates Only — Not Financial Advice.</strong> This tool is provided by {branding.companyName} for educational purposes only. All calculations and results are estimates and do not constitute a loan offer, pre-approval, or guarantee of any kind. Actual loan eligibility, rates, and terms vary and are subject to underwriting. Always consult a licensed mortgage professional before making any financial decisions.
        {branding.officerName && branding.nmlsId && <> {branding.officerName}, NMLS #{branding.nmlsId}.</>}
        {branding.phone && <> Questions? Call {branding.phone}.</>}
        {' '}This application is currently offered for testing and evaluation purposes only. It is not operated by a licensed mortgage broker, lender, or financial advisor, and nothing presented here should be relied upon as professional financial guidance.
      </footer>
    </div>
  )
}
