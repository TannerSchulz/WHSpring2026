import { useEffect, useState } from 'react'

const STEPS = [
  { icon: '📊', text: 'Reading your financial profile...' },
  { icon: '🧮', text: 'Calculating debt-to-income ratio...' },
  { icon: '🏦', text: 'Checking loan guidelines...' },
  { icon: '🤖', text: 'Running AI analysis...' },
  { icon: '✍️', text: 'Generating your personalized report...' },
]

export default function LoadingScreen() {
  const [activeStep, setActiveStep] = useState(0)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep(prev => {
        const next = prev + 1
        if (next >= STEPS.length) {
          clearInterval(interval)
          return prev
        }
        setCompletedSteps(c => [...c, prev])
        return next
      })
    }, 900)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="loading-screen">
      <div className="ls-brand">Mortgage<span>AI</span></div>

      {/* Orbiting ring */}
      <div className="ls-orbit-wrap">
        <div className="ls-orbit" />
        <div className="ls-orbit ls-orbit--2" />
        <div className="ls-core">
          <div className="ls-core-inner">🏠</div>
        </div>
        {/* Orbiting dots */}
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`ls-dot ls-dot--${i}`} />
        ))}
      </div>

      <h2 className="ls-title">Analyzing Your Profile</h2>
      <p className="ls-subtitle">Our AI is crunching the numbers — hang tight</p>

      <div className="ls-steps">
        {STEPS.map((step, i) => {
          const isComplete = completedSteps.includes(i)
          const isActive = activeStep === i
          const isPending = i > activeStep

          return (
            <div
              key={i}
              className={`ls-step ${isComplete ? 'ls-step--done' : ''} ${isActive ? 'ls-step--active' : ''} ${isPending ? 'ls-step--pending' : ''}`}
            >
              <div className="ls-step-icon">
                {isComplete ? '✓' : step.icon}
              </div>
              <span className="ls-step-text">{step.text}</span>
              {isActive && (
                <span className="ls-step-spinner" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
