import { AssessmentResponse } from '../types'

interface Props {
  result: AssessmentResponse
  onRestart: () => void
  onGetStarted: () => void
}

export default function AssessmentResult({ result, onRestart, onGetStarted }: Props) {
  const q = result.qualifies

  return (
    <div className="card">
      <div className="result-card">
        <div className={`result-badge ${q ? 'qualify' : 'no-qualify'}`}>
          {q ? '✓ Likely Qualifies' : '✗ Needs Work'}
        </div>

        <div className="result-title">
          {q ? 'Great news — you\'re on track!' : 'Not quite there yet, but you can get there.'}
        </div>

        {result.demo_mode && (
          <div className="demo-notice">
            Running in demo mode — results based on standard mortgage guidelines, not AI.
          </div>
        )}

        <p className="result-summary">{result.summary}</p>

        <div className="metrics">
          <div className="metric">
            <div className="metric-label">Debt-to-Income</div>
            <div className="metric-value">{result.dti_ratio}%</div>
          </div>
          <div className="metric">
            <div className="metric-label">Loan-to-Value</div>
            <div className="metric-value">{result.ltv_ratio}%</div>
          </div>
          {result.estimated_monthly_payment != null && (
            <div className="metric">
              <div className="metric-label">Est. Payment</div>
              <div className="metric-value">${result.estimated_monthly_payment.toLocaleString()}/mo</div>
            </div>
          )}
        </div>

        {result.details.length > 0 && (
          <>
            <div className="section-label">Key Factors</div>
            <ul className="detail-list">
              {result.details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          </>
        )}

        <div className="section-label">
          {q ? 'Recommended Next Steps' : 'Steps to Improve Your Chances'}
        </div>
        <ol className="steps-list">
          {result.action_steps.map((s, i) => <li key={i}>{s}</li>)}
        </ol>

        {/* CTA */}
        <div className="help-cta">
          <div className="help-cta-text">
            <span className="help-cta-heading">Need help getting started?</span>
            <span className="help-cta-sub">We'll walk you through each step and set up your profile.</span>
          </div>
          <button className="btn-get-started" onClick={onGetStarted}>
            We Can Help! →
          </button>
        </div>

        <button className="btn-restart" onClick={onRestart}>
          ↩ Start Over
        </button>
      </div>
    </div>
  )
}
