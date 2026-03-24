import { AssessmentResponse } from '../types'

interface Props {
  result: AssessmentResponse
}

export default function AssessmentResult({ result }: Props) {
  const qualifies = result.qualifies

  return (
    <div className={`result-card ${qualifies ? 'qualify' : 'no-qualify'}`}>
      <div className="result-header">
        <span className="result-icon">{qualifies ? '✅' : '📋'}</span>
        <h2>{qualifies ? 'You Likely Qualify!' : 'Not Quite Yet'}</h2>
      </div>

      {result.demo_mode && (
        <p style={{ fontSize: '0.82rem', color: '#6b7280', background: '#f3f4f6', borderRadius: '6px', padding: '0.5rem 0.75rem', marginBottom: '1rem' }}>
          Running in demo mode (no API key) — results based on standard mortgage guidelines.
        </p>
      )}
      <p className="summary">{result.summary}</p>

      <div className="metrics">
        <div className="metric">
          <div className="label">Debt-to-Income</div>
          <div className="value">{result.dti_ratio}%</div>
        </div>
        <div className="metric">
          <div className="label">Loan-to-Value</div>
          <div className="value">{result.ltv_ratio}%</div>
        </div>
        {result.estimated_monthly_payment && (
          <div className="metric">
            <div className="label">Est. Monthly Payment</div>
            <div className="value">
              ${result.estimated_monthly_payment.toLocaleString()}
            </div>
          </div>
        )}
      </div>

      {result.details.length > 0 && (
        <>
          <div className="section-title">Key Factors</div>
          <ul className="detail-list">
            {result.details.map((d, i) => <li key={i}>{d}</li>)}
          </ul>
        </>
      )}

      <div className="section-title">
        {qualifies ? 'Next Steps' : 'Steps to Improve Your Chances'}
      </div>
      <ol className="steps-list">
        {result.action_steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
    </div>
  )
}
