import { AssessmentResponse } from '../types'

function bold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return <>{parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}</>
}

interface Props {
  result: AssessmentResponse
  onRestart: () => void
  onGetStarted: () => void
  onOpenCalculator: () => void
}

export default function AssessmentResult({ result, onRestart, onGetStarted, onOpenCalculator }: Props) {
  const q = result.qualifies

  return (
    <div className="card">
      <div className="result-card">
        <div className={`result-badge ${q ? 'qualify' : 'no-qualify'}`}>
          {q ? '✓ Likely Qualifies' : '✗ Needs Work'}
        </div>

        <div className="result-title">
          {q ? "You're on track." : "Not there yet — here's what to fix."}
        </div>

        {result.demo_mode && (
          <div className="demo-notice">
            Running in demo mode — results based on standard mortgage guidelines, not AI.
          </div>
        )}

        <p className="result-summary">{bold(result.summary)}</p>

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
              <div className="metric-label">Est. P&amp;I Payment</div>
              <div className="metric-value">${result.estimated_monthly_payment.toLocaleString()}/mo</div>
            </div>
          )}
        </div>

        {result.details.length > 0 && (
          <>
            <div className="section-label">Key Factors</div>
            <ul className="detail-list">
              {result.details.map((d, i) => <li key={i}>{bold(d)}</li>)}
            </ul>
          </>
        )}

        <div className="section-label">
          {q ? 'Recommended Next Steps' : 'Steps to Improve Your Chances'}
        </div>
        <ol className="steps-list">
          {result.action_steps.map((s, i) => <li key={i}>{bold(s)}</li>)}
        </ol>

        {/* Two-path CTA section */}
        <div className="result-cta-section">
          <div className="result-cta-heading">What's next?</div>

          <div className="result-cta-cards">
            {/* Planning path */}
            <button className="result-cta-card plan-card" onClick={onGetStarted}>
              <div className="result-cta-icon">📋</div>
              <div className="result-cta-content">
                <div className="result-cta-title">Build My Action Plan</div>
                <div className="result-cta-desc">
                  {q
                    ? 'Step-by-step checklist from pre-approval to closing.'
                    : 'Personalized roadmap to fix each issue and qualify sooner.'}
                </div>
              </div>
              <div className="result-cta-arrow">→</div>
            </button>

            {/* Calculator path */}
            <button className="result-cta-card calc-card" onClick={onOpenCalculator}>
              <div className="result-cta-icon">🧮</div>
              <div className="result-cta-content">
                <div className="result-cta-title">Calculate My Payment</div>
                <div className="result-cta-desc">
                  Monthly cost, rate comparisons, and rent vs. buy.
                </div>
              </div>
              <div className="result-cta-arrow">→</div>
            </button>
          </div>
        </div>

        <button className="btn-restart" onClick={onRestart}>
          ↩ Start Over
        </button>
      </div>
    </div>
  )
}
