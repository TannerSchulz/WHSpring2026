import { useState } from 'react'
import MortgageForm from './components/MortgageForm'
import AssessmentResult from './components/AssessmentResult'
import ValueTracker, { TrackerEntry } from './components/ValueTracker'
import LoadingScreen from './components/LoadingScreen'
import AccountSetupPage from './components/AccountSetupPage'
import { MortgageInput, AssessmentResponse } from './types'

type Stage = 'form' | 'loading' | 'result' | 'error' | 'help'

export default function App() {
  const [stage, setStage] = useState<Stage>('form')
  const [result, setResult] = useState<AssessmentResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [trackerEntries, setTrackerEntries] = useState<TrackerEntry[]>([])
  const [lastProfile, setLastProfile] = useState<MortgageInput | null>(null)
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

  const showTracker = stage === 'form' || stage === 'loading' || stage === 'result'

  return (
    <div className="app">
      {stage !== 'help' && (
        <header className="app-header">
          <h1>Mortgage<span>AI</span></h1>
          <p>Find out if you qualify for a home loan in minutes</p>
        </header>
      )}

      <div className="quiz-main">
        {stage === 'form' && (
          <MortgageForm onSubmit={handleSubmit} loading={false} onFieldCommit={handleFieldCommit} />
        )}

        {stage === 'loading' && <LoadingScreen />}

        {stage === 'result' && result && (
          <AssessmentResult result={result} onRestart={restart} onGetStarted={() => setStage('help')} />
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

        {stage === 'help' && result && lastProfile && (
          <AccountSetupPage
            result={result}
            userProfile={lastProfile}
            onBack={() => setStage('result')}
          />
        )}
      </div>

      {showTracker && (
        <div className="tracker-fixed">
          <ValueTracker entries={trackerEntries} />
        </div>
      )}
    </div>
  )
}
