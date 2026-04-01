import { useState, useRef, useEffect } from 'react'
import type { UserProfile } from '../types/profile'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  profile: UserProfile
  currentStep: string
}

function getStepHint(stepText: string, profile: UserProfile): string {
  const s = stepText.toLowerCase()
  const firstName = profile.name && profile.name !== 'Guest' ? profile.name.split(' ')[0] : null
  const hi = firstName ? `${firstName}, ` : ''
  const { credit_score, annual_income, monthly_debts, down_payment } = profile.mortgageInput
  const dti = profile.assessment.dti_ratio

  if (s.includes('know your') || s.includes('know their') || (s.includes('credit') && s.includes('dti'))) {
    return `${hi}your credit score is ${credit_score} and your DTI is ${dti}%. ${credit_score >= 700 ? "That's a solid credit score — most lenders will be happy to work with you." : credit_score >= 640 ? "Your credit is workable, though improving it before applying could get you a better rate." : "Your credit score is on the lower end — we should talk about what you can do to improve it before applying."} Your $${down_payment.toLocaleString()} down payment covers ${Math.round((down_payment / profile.mortgageInput.home_price) * 100)}% of the home price.`
  }

  if (s.includes('gather') || s.includes('document') || s.includes('tax return') || s.includes('pay stub') || s.includes('bank statement')) {
    return `${hi}lenders will need to verify your income of $${annual_income.toLocaleString()}/yr and your $${down_payment.toLocaleString()} in assets. The 3 documents below cover everything — you can drop the files right here to keep track of what you've gathered.`
  }

  if (s.includes('pre-approv') || s.includes('lender') || s.includes('approv')) {
    const monthlyIncome = Math.round(annual_income / 12)
    const maxPayment = Math.round((monthlyIncome * 0.28))
    return `${hi}with $${annual_income.toLocaleString()}/yr income and $${monthly_debts.toLocaleString()}/mo in debts, you can likely afford up to ~$${maxPayment.toLocaleString()}/mo in mortgage payments. Apply with 2–3 lenders within the same 45-day window — it only counts as one credit inquiry.`
  }

  return `${hi}I'm here to help you work through this step. Ask me anything about what to do next, what lenders look for, or what to expect.`
}

const STARTER_PROMPTS = [
  'How long will this take?',
  'What do lenders look for?',
  'Any tips to speed this up?',
]

export default function PlanChatbot({ profile, currentStep }: Props) {
  const [messages, setMessages] = useState<Message[]>(() => [
    { role: 'assistant', content: getStepHint(currentStep, profile) },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset chat when step changes
  useEffect(() => {
    setMessages([{ role: 'assistant', content: getStepHint(currentStep, profile) }])
    setInput('')
  }, [currentStep])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, loading])

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    const userMsg: Message = { role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: nextMessages,
          current_step: currentStep,
          user_profile: profile.mortgageInput,
        }),
      })

      if (!res.ok) throw new Error('Request failed')
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.response }])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: "Sorry, I couldn't connect right now. For free guidance, a HUD-approved counselor is always available at hud.gov/counseling.",
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="chatbot-panel">
      <div className="chatbot-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`chat-msg chat-msg--${msg.role}`}>
            {msg.role === 'assistant' && <div className="chat-avatar">🤖</div>}
            <div className="chat-bubble">{msg.content}</div>
          </div>
        ))}
        {loading && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-avatar">🤖</div>
            <div className="chat-bubble chat-bubble--typing">
              <span /><span /><span />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length === 1 && (
        <div className="chatbot-starters">
          {STARTER_PROMPTS.map(p => (
            <button key={p} className="chatbot-starter-btn" onClick={() => send(p)}>
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="chatbot-input-row">
        <input
          ref={inputRef}
          type="text"
          className="chatbot-input"
          placeholder="Ask anything about your plan…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send(input)}
          disabled={loading}
        />
        <button
          className="chatbot-send-btn"
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          aria-label="Send"
        >
          ➤
        </button>
      </div>
    </div>
  )
}
