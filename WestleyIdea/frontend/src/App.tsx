import { useState } from 'react'
import MortgageForm from './components/MortgageForm'
import AssessmentResult from './components/AssessmentResult'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import LoadingScreen from './components/LoadingScreen'
import Dashboard from './components/Dashboard'
import ProfileWidget from './components/ProfileWidget'
import { MortgageInput, AssessmentResponse } from './types'
import { useProfile } from './hooks/useProfile'

type Stage = 'form' | 'loading' | 'result' | 'error' | 'dashboard'

const DEMO_INPUT: MortgageInput = {
  annual_income: 95000,
  monthly_debts: 450,
  credit_score: 720,
  down_payment: 42000,
  home_price: 420000,
  employment_years: 3.5,
  loan_type: 'conventional',
  state: 'TX',
}

export default function App() {
  const [stage, setStage] = useState<Stage>('form')
  const [result, setResult] = useState<AssessmentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const [lastProfile, setLastProfile] = useState<MortgageInput | null>(null)
  const [demoMode, setDemoMode] = useState(false)
  const { profile, save: saveProfile, clear: clearProfile } = useProfile()

  const handleFieldCommit = (field: string, value: string | number) => {
    setTrackerEntries(prev => {
      const filtered = prev.filter(e => e.field !== field)
      return [...filtered, { field, value }]
    })
  }

  const handleSubmit = async (data: MortgageInput) => {
    setDemoMode(false)
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
      setStage('result')
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
    setDemoMode(false)
  }

  const startDemo = () => {
    restart()
    // Small delay so restart's state clears first, then trigger demo
    setTimeout(() => setDemoMode(true), 50)
  }

  const inNarrowFlow = ['form', 'loading', 'result', 'error'].includes(stage)
  const showTracker = ['form', 'loading', 'result'].includes(stage)

  return (
    <div className="app">
      {/* Persistent profile widget */}
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

      {/* Demo button — visible on form page */}
      {stage === 'form' && (
        <button className="demo-launch-btn" onClick={startDemo}>
          ▶ Live Demo
        </button>
      )}

      {inNarrowFlow && (
        <header className="app-header">
          <h1>Mortgage<span>AI</span></h1>
          <p>Find out if you qualify for a home loan in minutes</p>
        </header>
      )}

      {inNarrowFlow && (
        <div className="quiz-main">
          {stage === 'form' && (
            <MortgageForm
              onSubmit={handleSubmit}
              loading={false}
              onFieldCommit={handleFieldCommit}
              demoMode={demoMode}
              demoData={DEMO_INPUT}
            />
          )}

          {stage === 'loading' && <LoadingScreen />}

          {stage === 'result' && result && (
            <AssessmentResult
              result={result}
              onRestart={restart}
              onOpenDashboard={() => setStage('dashboard')}
            />
          )}

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
          onBack={() => setStage('result')}
          onProfileSave={saveProfile}
          existingProfile={profile}
        />
      )}

      {showTracker && (
        <div className="tracker-fixed">
          <ValueTracker entries={trackerEntries} />
        </div>
      )}
    </div>
  )
}
