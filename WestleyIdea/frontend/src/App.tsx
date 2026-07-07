import { useState, useEffect } from 'react'
import MortgageForm from './components/MortgageForm'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import LoadingScreen from './components/LoadingScreen'
import Dashboard from './components/Dashboard'
import ProfileWidget from './components/ProfileWidget'
import BrandingSettings from './components/BrandingSettings'
import BrandMark from './components/BrandMark'
import LoanOfficerCard from './components/LoanOfficerCard'
import { MortgageInput, AssessmentResponse } from './types'
import { useProfile } from './hooks/useProfile'
import { useBranding } from './hooks/useBranding'

type Stage = 'form' | 'loading' | 'error' | 'dashboard'

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
  const [result, setResult] = useState<AssessmentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const [lastProfile, setLastProfile] = useState<MortgageInput | null>(null)
  const { profile, save: saveProfile, clear: clearProfile } = useProfile()
  const { branding, save: saveBranding, reset: resetBranding } = useBranding()
  const [showBranding, setShowBranding] = useState(false)

  const handleFieldCommit = (field: string, value: string | number) => {
    setTrackerEntries(prev => {
      const filtered = prev.filter(e => e.field !== field)
      return [...filtered, { field, value }]
    })
  }

  const handleSubmit = async (data: MortgageInput) => {
    setLastProfile(data)
    setStage('loading')
    setError(null)
    const minDelay = new Promise(res => setTimeout(res, 7000))

    try {
      const [res] = await Promise.all([
        fetch('/api/assess', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }),
        minDelay,
      ])

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Something went wrong')
      }

      const assessment: AssessmentResponse = await res.json()
      setResult(assessment)
      setStage('dashboard')
    } catch (e) {
      await minDelay
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStage('error')
    }
  }

  const restart = () => {
    setStage('form')
    setResult(null)
    setError(null)
    setTrackerEntries([])
    setLastProfile(null)
  }

  // Dev shortcut: ?preview=calc jumps straight to the dashboard with sample data
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('preview') === 'calc') {
      setResult({
        qualifies: true,
        summary: 'Sample preview data — **DTI: 39.3%**, credit **720**.',
        details: ['Credit score: 720 ✓', 'DTI ratio: 39.3% ✓', 'Employment: 3.5 years ✓'],
        action_steps: [
          'Know your numbers — credit score 720, DTI 39.3%, $42,000 saved',
          'Gather your documents: 2 years of tax returns, recent pay stubs, and bank statements',
          'Get pre-approved with 2–3 lenders and compare offers',
        ],
        estimated_monthly_payment: 2379,
        dti_ratio: 39.3,
        ltv_ratio: 90,
        demo_mode: true,
      })
      setLastProfile(PREVIEW_INPUT)
      setStage('dashboard')
    }
  }, [])

  // Header shown on form and error — NOT during loading (LoadingScreen has its own branding)
  const showHeader = ['form', 'error'].includes(stage)
  const inNarrowFlow = ['form', 'loading', 'error'].includes(stage)
  const showTracker = stage === 'form'

  return (
    <div className={`app${stage === 'dashboard' ? ' app--full' : ''}`}>
      {/* Top navigation — landing & error stages (dashboard has its own topbar) */}
      {showHeader && (
        <nav className="top-nav">
          <BrandMark branding={branding} size="sm" />
          <div className="top-nav-actions">
            <button className="brand-customize-btn" onClick={() => setShowBranding(true)}>
              ⚙️ Customize
            </button>
            {profile && (
              <ProfileWidget
                profile={profile}
                onResume={() => {
                  setResult(profile.assessment)
                  setLastProfile(profile.mortgageInput)
                  setStage('dashboard')
                }}
                onClear={() => { clearProfile(); setStage('form') }}
              />
            )}
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
          <p>Answer a few quick questions to see where you stand — and get a personal plan to get there.</p>
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

          {stage === 'error' && (
            <div className="card">
              <div className="error-card">
                <div className="error-icon">⚠️</div>
                <h2>Something went wrong</h2>
                <p>{error}</p>
                <button className="btn-next" style={{ width: '100%' }} onClick={restart}>
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {stage === 'dashboard' && result && lastProfile && (
        <Dashboard
          result={result}
          lastProfile={lastProfile}
          onBack={restart}
          onProfileSave={saveProfile}
          existingProfile={profile}
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
