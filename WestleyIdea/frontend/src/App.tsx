import { useState } from 'react'
import MortgageForm from './components/MortgageForm'
import AssessmentResult from './components/AssessmentResult'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import LoadingScreen from './components/LoadingScreen'
import AccountSetupPage from './components/AccountSetupPage'
import ActionPlanView from './components/ActionPlanView'
import MortgageCalculator from './components/MortgageCalculator'
import { MortgageInput, AssessmentResponse } from './types'
import { useProfile } from './hooks/useProfile'

type Stage = 'form' | 'loading' | 'result' | 'error' | 'help' | 'calculator' | 'resume'

export default function App() {
  const [stage, setStage] = useState<Stage>('form')
  const [result, setResult] = useState<AssessmentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const [lastProfile, setLastProfile] = useState<MortgageInput | null>(null)
  const [dismissedWelcome, setDismissedWelcome] = useState(false)

  const { profile, save: saveProfile, clear: clearProfile } = useProfile()

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
  }

  const inNarrowFlow = ['form', 'loading', 'result', 'error'].includes(stage)
  const showTracker = ['form', 'loading', 'result'].includes(stage)
  const showWelcomeBack = profile && stage === 'form' && !dismissedWelcome

  return (
    <div className="app">
      {/* Welcome back banner */}
      {showWelcomeBack && (
        <div className="welcome-back-bar">
          <div className="welcome-back-content">
            <span className="welcome-back-avatar">
              {profile.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
            </span>
            <div className="welcome-back-text">
              <span className="welcome-back-title">Welcome back{profile.name !== 'Guest' ? `, ${profile.name.split(' ')[0]}` : ''}!</span>
              <span className="welcome-back-sub">You have a saved plan — {profile.stepProgress.filter(Boolean).length} of {profile.stepProgress.length} steps complete.</span>
            </div>
          </div>
          <div className="welcome-back-actions">
            <button className="btn-resume" onClick={() => setStage('resume')}>
              Resume My Plan →
            </button>
            <button className="welcome-dismiss" onClick={() => setDismissedWelcome(true)} title="Dismiss">✕</button>
          </div>
        </div>
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
            <MortgageForm onSubmit={handleSubmit} loading={false} onFieldCommit={handleFieldCommit} />
          )}

          {stage === 'loading' && <LoadingScreen />}

          {stage === 'result' && result && (
            <AssessmentResult
              result={result}
              onRestart={restart}
              onGetStarted={() => setStage('help')}
              onOpenCalculator={() => setStage('calculator')}
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

      {stage === 'help' && result && lastProfile && (
        <AccountSetupPage
          result={result}
          userProfile={lastProfile}
          onBack={() => setStage('result')}
          onProfileSave={saveProfile}
          existingProfile={profile}
        />
      )}

      {stage === 'resume' && profile && (
        <ActionPlanView
          profile={profile}
          onProfileUpdate={p => { saveProfile(p) }}
          onBack={() => { setDismissedWelcome(false); setStage('form') }}
        />
      )}

      {stage === 'calculator' && (
        <MortgageCalculator
          onBack={() => setStage(result ? 'result' : 'form')}
          prefill={lastProfile}
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
