import { useState } from 'react'
import MortgageForm from './components/MortgageForm'
import AssessmentResult from './components/AssessmentResult'
import { MortgageInput, AssessmentResponse } from './types'

export default function App() {
  const [result, setResult] = useState<AssessmentResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (data: MortgageInput) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || 'Something went wrong')
      }

      const assessment: AssessmentResponse = await res.json()
      setResult(assessment)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container">
      <header>
        <h1>MortgageAI</h1>
        <p>Find out if you qualify for a home loan — powered by AI</p>
      </header>

      {error && <div className="error-msg">{error}</div>}

      <MortgageForm onSubmit={handleSubmit} loading={loading} />

      {result && <AssessmentResult result={result} />}
    </div>
  )
}
