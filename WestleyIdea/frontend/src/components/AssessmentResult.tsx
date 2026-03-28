import { useState } from 'react'
import { AssessmentResponse } from '../types'

function bold(text: string) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return <>{parts.map((p, i) => i % 2 === 1 ? <strong key={i}>{p}</strong> : p)}</>
}

type Status = 'good' | 'borderline' | 'poor' | 'neutral'

function dtiStatus(dti: number): { status: Status; hint: string } {
  if (dti <= 36) return { status: 'good', hint: 'Strong — lenders prefer below 36%' }
  if (dti <= 43) return { status: 'borderline', hint: 'Acceptable, but above the ideal 36%' }
  return { status: 'poor', hint: 'Above the 43% limit — reduce debt or increase income' }
}

function ltvStatus(ltv: number): { status: Status; hint: string } {
  if (ltv <= 80) return { status: 'good', hint: 'No mortgage insurance needed' }
  if (ltv <= 95) return { status: 'borderline', hint: 'Mortgage insurance until you hit 80%' }
  return { status: 'poor', hint: 'Very high — limited options, higher insurance' }
}

interface Props {
  result: AssessmentResponse
  onRestart: () => void
  onGetStarted: () => void
  onOpenCalculator: () => void
}

export default function AssessmentResult({ result, onRestart, onGetStarted, onOpenCalculator }: Props) {
  const q = result.qualifies
  const dti = dtiStatus(result.dti_ratio)
  const ltv = ltvStatus(result.ltv_ratio)
  const [expandedStep, setExpandedStep] = useState<number | null>(0)

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

        <div className="section-label">Your Numbers</div>

        {/* DTI & LTV side by side */}
        <div className="metric-pair">
          <div className={`metric-compact metric-compact--${dti.status}`}>
            <div className="metric-compact-top">
              <span className={`metric-compact-dot metric-compact-dot--${dti.status}`} />
              <span className="metric-compact-label">Debt-to-Income <span>(DTI)</span></span>
            </div>
            <div className="metric-compact-value">{result.dti_ratio}%</div>
            <div className="metric-compact-hint">{dti.hint}</div>
          </div>
          <div className={`metric-compact metric-compact--${ltv.status}`}>
            <div className="metric-compact-top">
              <span className={`metric-compact-dot metric-compact-dot--${ltv.status}`} />
              <span className="metric-compact-label">Loan-to-Value <span>(LTV)</span></span>
            </div>
            <div className="metric-compact-value">{result.ltv_ratio}%</div>
            <div className="metric-compact-hint">{ltv.hint}</div>
          </div>
        </div>

        {/* Payment highlight */}
        {result.estimated_monthly_payment != null && (
          <div className="payment-highlight">
            <div className="payment-highlight-left">
              <div className="payment-highlight-label">Estimated Monthly Payment</div>
              <div className="payment-highlight-sub">Principal & Interest only — excludes taxes, insurance, HOA</div>
            </div>
            <div className="payment-highlight-value">${result.estimated_monthly_payment.toLocaleString()}<span>/mo</span></div>
          </div>
        )}

        {result.details.length > 0 && (
          <>
            <div className="section-label">What This Means</div>
            <div className="factor-grid">
              {result.details.map((d, i) => {
                const dashIdx = d.indexOf(' — ')
                const label = dashIdx !== -1 ? d.slice(0, dashIdx) : d
                const desc = dashIdx !== -1 ? d.slice(dashIdx + 3) : ''
                return (
                  <div className="factor-card" key={i}>
                    <div className="factor-label">{bold(label)}</div>
                    {desc && <div className="factor-desc">{desc}</div>}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className="section-label">
          {q ? 'Your Next Steps' : 'Steps to Improve'}
        </div>
        <div className="steps-accordion">
          {result.action_steps.map((s, i) => {
            const dashIdx = s.indexOf(' — ')
            const title = dashIdx !== -1 ? s.slice(0, dashIdx) : s
            const detail = dashIdx !== -1 ? s.slice(dashIdx + 3) : ''
            const open = expandedStep === i
            return (
              <div key={i} className={`step-card${open ? ' open' : ''}`}>
                <button className="step-card-header" onClick={() => setExpandedStep(open ? null : i)}>
                  <span className="step-card-num">{i + 1}</span>
                  <span className="step-card-title">{bold(title)}</span>
                  <span className={`step-card-chevron${open ? ' open' : ''}`}>›</span>
                </button>
                {open && detail && (
                  <div className="step-card-body">{bold(detail)}</div>
                )}
              </div>
            )
          })}
        </div>

        <div className="result-cta-section">
          <div className="result-cta-heading">What's next?</div>

          <div className="result-cta-cards">
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

            <button className="result-cta-card calc-card" onClick={onOpenCalculator}>
              <div className="result-cta-icon">🧮</div>
              <div className="result-cta-content">
                <div className="result-cta-title">Calculate My Payment</div>
                <div className="result-cta-desc">
                  Monthly cost and rate comparisons.
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
