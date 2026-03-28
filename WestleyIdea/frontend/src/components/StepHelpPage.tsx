import { useEffect, useState } from 'react'
import { MortgageInput, StepHelpResponse, ChecklistItem } from '../types'

interface Props {
  stepText: string
  userProfile: MortgageInput
  onBack: () => void
}

export default function StepHelpPage({ stepText, userProfile, onBack }: Props) {
  const [data, setData] = useState<StepHelpResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checklist, setChecklist] = useState<(ChecklistItem & { done: boolean })[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    const minDelay = new Promise(res => setTimeout(res, 1200))
    fetch('/api/step-help', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step_text: stepText, user_profile: userProfile }),
    })
      .then(async res => {
        await minDelay
        if (!res.ok) throw new Error((await res.json()).detail)
        return res.json()
      })
      .then((d: StepHelpResponse) => {
        setData(d)
        setChecklist(d.checklist.map(item => ({ ...item, done: false })))
      })
      .catch(e => setError(e.message))
  }, [])

  const toggle = (i: number) => setChecklist(c => c.map((item, idx) => idx === i ? { ...item, done: !item.done } : item))
  const doneCount = checklist.filter(c => c.done).length

  return (
    <div className="help-page">
      <button className="help-back-btn" onClick={onBack}>
        ← Back to Results
      </button>

      {!data && !error && (
        <div className="help-loading">
          <div className="help-loading-ring" />
          <p>Building your guide...</p>
        </div>
      )}

      {error && (
        <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>⚠️</div>
          <p style={{ color: '#ef4444' }}>{error}</p>
          <button className="btn-restart" style={{ marginTop: '1rem' }} onClick={onBack}>Go Back</button>
        </div>
      )}

      {data && (
        <div className="help-content">
          {/* Header */}
          <div className="help-header card">
            <div className="help-step-label">You're working on</div>
            <div className="help-step-text">"{stepText}"</div>
            <h1 className="help-title">{data.title}</h1>
            <p className="help-explanation">{data.explanation}</p>
            {data.demo_mode && (
              <div className="demo-notice" style={{ marginTop: '0.75rem' }}>
                Demo mode — guidance based on standard mortgage best practices.
              </div>
            )}
          </div>

          {/* Checklist */}
          <div className="card help-section">
            <div className="help-section-header">
              <span>✅ Action Checklist</span>
              <span className="help-progress-badge">{doneCount}/{checklist.length} done</span>
            </div>
            <div className="help-progress-bar">
              <div className="help-progress-fill" style={{ width: `${(doneCount / checklist.length) * 100}%` }} />
            </div>
            <ul className="help-checklist">
              {checklist.map((item, i) => (
                <li key={i} className={`help-check-item${item.done ? ' done' : ''}`}>
                  <button className="help-check-box" onClick={() => toggle(i)}>
                    {item.done ? '✓' : ''}
                  </button>
                  <div className="help-check-body">
                    <button className="help-check-task" onClick={() => setExpanded(expanded === i ? null : i)}>
                      <span>{item.task}</span>
                      <span className="help-expand-icon">{expanded === i ? '▲' : '▼'}</span>
                    </button>
                    {expanded === i && (
                      <div className="help-check-detail">{item.detail}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Documents */}
          <div className="card help-section">
            <div className="help-section-header">📄 Documents & Resources to Gather</div>
            <ul className="help-doc-list">
              {data.documents.map((doc, i) => (
                <li key={i} className="help-doc-item">
                  <span className="help-doc-icon">📎</span>
                  <span>{doc}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Tips */}
          <div className="card help-section">
            <div className="help-section-header">💡 Insider Tips</div>
            <ul className="help-tips-list">
              {data.tips.map((tip, i) => (
                <li key={i} className="help-tip-item">
                  <span className="help-tip-num">{i + 1}</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Timeline */}
          <div className="card help-section help-timeline">
            <span className="help-timeline-icon">⏱️</span>
            <div>
              <div className="help-timeline-label">Estimated Timeline</div>
              <div className="help-timeline-value">{data.timeline}</div>
            </div>
          </div>

          <button className="btn-restart" onClick={onBack}>← Back to My Results</button>
        </div>
      )}
    </div>
  )
}
