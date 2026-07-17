import { useState, useEffect, useRef } from 'react'
import MortgageForm from './components/MortgageForm'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import LoadingScreen from './components/LoadingScreen'
import Dashboard from './components/Dashboard'
import BrandingSettings from './components/BrandingSettings'
import BrandMark from './components/BrandMark'
import LoanOfficerCard from './components/LoanOfficerCard'
import { MortgageInput } from './types'
import { useBranding } from './hooks/useBranding'
import { APP_VERSION } from './version'

type Stage = 'form' | 'loading' | 'dashboard'

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
  const loadingTimerRef = useRef<number | null>(null)
  const { branding, save: saveBranding, reset: resetBranding } = useBranding()
  const [showBranding, setShowBranding] = useState(false)

  const handleFieldCommit = (field: string, value: string | number) => {
    setTrackerEntries(prev => {
      const filtered = prev.filter(e => e.field !== field)
      return [...filtered, { field, value }]
    })
  }

  const handleSubmit = (data: MortgageInput) => {
    if (loadingTimerRef.current !== null) window.clearTimeout(loadingTimerRef.current)
    setLastProfile(data)
    setStage('loading')
    loadingTimerRef.current = window.setTimeout(() => {
      loadingTimerRef.current = null
      setStage('dashboard')
    }, 3000)
  }

  const restart = () => {
    if (loadingTimerRef.current !== null) {
      window.clearTimeout(loadingTimerRef.current)
      loadingTimerRef.current = null
    }
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

  useEffect(() => () => {
    if (loadingTimerRef.current !== null) window.clearTimeout(loadingTimerRef.current)
  }, [])

  const showHeader = stage === 'form'
  const inNarrowFlow = stage === 'form' || stage === 'loading'
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

          {stage === 'loading' && <LoadingScreen branding={branding} />}

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
        <div className="disclaimer-title">Estimates Only — Not Financial, Legal, or Professional Advice</div>
        <p>
          This application is a demonstration tool offered strictly for testing and evaluation
          purposes. It is not operated by a licensed mortgage broker, lender, attorney, financial
          advisor, tax professional, or any other licensed professional, and nothing presented here
          constitutes mortgage, legal, tax, investment, or financial advice of any kind.
        </p>
        <p>
          All calculations, rates, and results are unverified estimates for illustration only. They
          may be inaccurate, incomplete, or out of date, must not be relied upon for any real
          financial decision, and do not constitute a loan offer, quote, pre-qualification,
          pre-approval, or commitment to lend. Actual eligibility, rates, fees, and terms are
          determined solely by licensed lenders through their own underwriting.
        </p>
        <p>
          Always consult a licensed mortgage professional, attorney, or financial advisor before
          making any decision related to a home purchase or loan. By using this tool, you
          acknowledge that it is provided "as is" for evaluation only and that no liability is
          accepted for decisions made in reliance on it.
        </p>
      </footer>
    </div>
  )
}
