import { useState } from 'react'
import { getStateResources } from '../data/localResources'
import type { UserProfile } from '../types/profile'
import PlanChatbot from './PlanChatbot'

interface Resource {
  icon: string
  label: string
  description: string
  url?: string
  note?: string
}

function getResources(stepText: string, stateCode: string): Resource[] {
  const localRes = getStateResources(stateCode)
  const s = stepText.toLowerCase()
  const stateName = localRes.stateName
  const ha = localRes.housingAuthority
  const dpa = localRes.downPaymentAssistance[0] ?? null
  const ftb = localRes.firstTimeBuyerPrograms[0] ?? null
  const hudLocal: Resource = {
    icon: '🤝',
    label: `Free HUD Counseling — ${stateName}`,
    description: `Connect with a HUD-approved housing counselor in ${stateName} for free, unbiased mortgage guidance.`,
    url: localRes.hudCounselingUrl,
  }
  const stateAuthority: Resource = {
    icon: '🏛️',
    label: ha.name,
    description: ha.description,
    url: ha.url,
  }

  // Step 1 — Know your numbers
  if (s.includes('know your') || s.includes('know their') || (s.includes('credit') && s.includes('dti'))) return [
    {
      icon: '📊',
      label: 'Get Your Free Credit Report',
      description: 'Pull reports from all three bureaus (Equifax, Experian, TransUnion) for free once a year — required by federal law.',
      url: 'https://www.annualcreditreport.com',
    },
    {
      icon: '📱',
      label: 'Monitor Weekly with Credit Karma',
      description: 'Free weekly score updates with personalized tips on what\'s hurting your credit and how to improve it.',
      url: 'https://www.creditkarma.com',
    },
    {
      icon: '🧮',
      label: 'CFPB DTI Calculator',
      description: 'Use the CFPB\'s free tool to see exactly how your monthly debts affect your mortgage eligibility.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    hudLocal,
  ]

  // Step 2 — Gather documents
  if (s.includes('gather') || s.includes('document') || s.includes('tax return') || s.includes('pay stub') || s.includes('bank statement')) return [
    hudLocal,
    {
      icon: '📄',
      label: 'IRS Get Transcript (Tax Returns)',
      description: 'Download your official tax transcripts directly from the IRS — accepted by all lenders as proof of income.',
      url: 'https://www.irs.gov/individuals/get-transcript',
    },
    {
      icon: '🏦',
      label: 'Download Bank Statements',
      description: 'Log into your bank\'s online portal to download the last 2–3 months of statements for all accounts you\'ll use.',
      note: 'Log in to your bank\'s website or app',
    },
    stateAuthority,
  ]

  if (s.includes('credit') || s.includes('score')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '📊',
      label: 'Get Your Free Credit Report',
      description: 'Pull reports from all three bureaus (Equifax, Experian, TransUnion) for free once a year — required by federal law.',
      url: 'https://www.annualcreditreport.com',
    },
    {
      icon: '📱',
      label: 'Monitor Weekly with Credit Karma',
      description: 'Free weekly score updates with personalized tips on what\'s hurting your credit and how to improve it.',
      url: 'https://www.creditkarma.com',
    },
  ]

  if (s.includes('debt') || s.includes('dti') || s.includes('ratio')) return [
    hudLocal,
    stateAuthority,
    {
      icon: '🧮',
      label: 'CFPB DTI Calculator',
      description: 'Use the Consumer Financial Protection Bureau\'s free tool to see exactly how your monthly debts affect your mortgage eligibility.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    {
      icon: '🎓',
      label: 'Income-Driven Student Loan Repayment',
      description: 'If student loans are raising your DTI, income-driven plans can significantly lower your required monthly payment.',
      url: 'https://studentaid.gov/manage-loans/repayment/plans/income-driven',
    },
  ]

  if (s.includes('down') || s.includes('saving') || s.includes('payment') || s.includes('fund')) return [
    stateAuthority,
    ...(dpa ? [{
      icon: '💰',
      label: dpa.label,
      description: dpa.description,
      url: dpa.url,
    }] : []),
    ...(ftb ? [{
      icon: '🏠',
      label: ftb.label,
      description: ftb.description,
      url: ftb.url,
    }] : []),
    hudLocal,
    {
      icon: '📈',
      label: 'High-Yield Savings Accounts',
      description: 'Park your down payment savings in a HYSA to earn 4–5% APY while you save — far better than a standard savings account.',
      note: 'Search "HYSA" at your bank or credit union',
    },
  ]

  if (s.includes('employ') || s.includes('job') || s.includes('income') || s.includes('self-employ')) return [
    hudLocal,
    stateAuthority,
    {
      icon: '📄',
      label: 'Employment Documentation Guide (CFPB)',
      description: 'Learn exactly what pay stubs, W-2s, tax returns, and employer letters lenders require before they approve your application.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    {
      icon: '📋',
      label: 'Self-Employed Borrower Guide',
      description: 'If you\'re self-employed, lenders need 2 years of tax returns and may require a CPA letter. This guide explains what to prepare.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
  ]

  if (s.includes('pre-approv') || s.includes('lender') || s.includes('approv') || s.includes('loan officer')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '🏦',
      label: 'Compare Mortgage Rates — Bankrate',
      description: 'Get live rate quotes from multiple lenders side-by-side. Even a 0.25% rate difference saves thousands over the life of your loan.',
      url: 'https://www.bankrate.com/mortgages/mortgage-rates/',
    },
    {
      icon: '🤝',
      label: 'Find a Local Credit Union',
      description: 'Credit unions are member-owned and typically offer lower rates and fees than traditional banks — worth checking before you commit.',
      url: 'https://www.mycreditunion.gov/about-credit-unions/credit-union-locator',
    },
    {
      icon: '📋',
      label: 'Pre-Approval Document Checklist',
      description: 'Gather pay stubs, W-2s, bank statements, tax returns, and ID before applying — having everything ready speeds up approval.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
  ]

  if (s.includes('inspect') || s.includes('apprais')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '🔍',
      label: 'Find a Certified Home Inspector',
      description: 'ASHI-certified inspectors meet strict standards. Always attend the inspection and ask questions about every item flagged.',
      url: 'https://www.homeinspector.org/FindAnInspector',
    },
    {
      icon: '📋',
      label: 'What Home Inspectors Look For',
      description: 'Learn what inspectors check so you can spot red flags before making an offer — roof, foundation, HVAC, plumbing, and electrical.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
  ]

  if (s.includes('offer') || s.includes('negot') || s.includes('purchas') || s.includes('contract')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '🏘️',
      label: 'Understanding the Purchase Contract',
      description: 'Learn key clauses: inspection contingency, financing contingency, earnest money, and closing timeline before you sign anything.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    {
      icon: '📊',
      label: 'Research Comparable Sales (Comps)',
      description: 'Check recent sold prices in the neighborhood on Zillow or Redfin to make sure your offer is in line with the market.',
      url: 'https://www.zillow.com',
    },
  ]

  if (s.includes('clos') || s.includes('title') || s.includes('escrow')) return [
    stateAuthority,
    hudLocal,
    {
      icon: '📄',
      label: 'Understand Your Closing Disclosure',
      description: 'You\'ll receive this 3 days before closing. Review every fee line by line — lenders are required to explain any changes from your loan estimate.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    {
      icon: '🏦',
      label: 'Wire Transfer Safety Guide',
      description: 'Closing wire fraud is common. Always verify wire instructions by phone with your title company — never trust email instructions alone.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
  ]

  // Default — works for any step
  return [
    stateAuthority,
    hudLocal,
    {
      icon: '📚',
      label: 'CFPB Home Buying Guide',
      description: 'The Consumer Financial Protection Bureau\'s free, step-by-step guide covers every stage of the mortgage and home buying process.',
      url: 'https://www.consumerfinance.gov/owning-a-home/',
    },
    ...(ftb ? [{
      icon: '🏠',
      label: ftb.label,
      description: ftb.description,
      url: ftb.url,
    }] : []),
  ]
}

interface ChecklistItem { text: string; url?: string }

function getStepChecklist(stepText: string): ChecklistItem[] {
  const s = stepText.toLowerCase()

  // Step 1 — Know your numbers
  if (s.includes('know your') || s.includes('know their') || (s.includes('credit') && s.includes('dti'))) return [
    { text: 'Pull your free credit report from all 3 bureaus', url: 'https://www.annualcreditreport.com' },
    { text: 'Calculate your DTI: add up all monthly debt payments ÷ gross monthly income' },
    { text: 'Confirm exactly how much you have saved for a down payment' },
  ]

  // Step 2 — Gather documents
  if (s.includes('gather') || s.includes('document') || s.includes('tax return') || s.includes('pay stub') || s.includes('bank statement')) return [
    { text: '2 years of tax returns (W-2s or 1040s)', url: 'https://www.irs.gov/individuals/get-transcript' },
    { text: 'Recent pay stubs (last 30 days)' },
    { text: '2–3 months of bank statements' },
  ]

  // Step 3 — Get pre-approved
  if (s.includes('pre-approv') || s.includes('lender') || s.includes('approv') || s.includes('loan officer')) return [
    { text: 'Compare rates from at least 3 lenders (bank, credit union, mortgage broker)', url: 'https://www.bankrate.com/mortgages/mortgage-rates/' },
    { text: 'Submit pre-approval applications — multiple within 45 days counts as one credit inquiry' },
    { text: 'Review and compare Loan Estimates side by side (look at APR, not just the rate)', url: 'https://www.consumerfinance.gov/owning-a-home/loan-estimate/' },
  ]

  if (s.includes('credit') || s.includes('score')) return [
    { text: 'Pull your free credit report from all 3 bureaus', url: 'https://www.annualcreditreport.com' },
    { text: 'Dispute any errors or inaccuracies you find' },
    { text: 'Pay down credit card balances to below 30% utilization' },
    { text: 'Avoid opening any new credit accounts' },
  ]

  if (s.includes('debt') || s.includes('dti') || s.includes('ratio')) return [
    { text: 'List every monthly debt payment (car, student loans, cards)' },
    { text: 'Calculate your current DTI ratio', url: 'https://www.consumerfinance.gov/owning-a-home/' },
    { text: 'Pay off or aggressively reduce your highest-interest debt first' },
    { text: 'Explore income-driven repayment if student loans are raising your DTI', url: 'https://studentaid.gov/manage-loans/repayment/plans/income-driven' },
  ]

  if (s.includes('down') || s.includes('saving') || s.includes('payment') || s.includes('fund')) return [
    { text: 'Open a high-yield savings account dedicated to your down payment' },
    { text: 'Set up automatic monthly transfers into that account' },
    { text: 'Research down payment assistance programs in your state', url: 'https://www.hud.gov/topics/buying_a_home' },
    { text: 'Calculate your target amount (3–20% of target home price)' },
  ]

  if (s.includes('inspect') || s.includes('apprais')) return [
    { text: 'Research and hire an ASHI-certified home inspector', url: 'https://www.homeinspector.org/FindAnInspector' },
    { text: 'Schedule and attend the inspection in person' },
    { text: 'Review the full inspection report carefully' },
    { text: 'Request repairs or seller credits for any major issues found' },
  ]

  if (s.includes('offer') || s.includes('negot') || s.includes('purchas') || s.includes('contract')) return [
    { text: 'Research recent comparable sales (comps) in the neighborhood', url: 'https://www.zillow.com' },
    { text: 'Decide on your offer price and escalation limit with your agent' },
    { text: 'Ensure your offer includes inspection and financing contingencies' },
    { text: 'Submit your earnest money deposit once the offer is accepted' },
  ]

  if (s.includes('clos') || s.includes('title') || s.includes('escrow')) return [
    { text: 'Review your Closing Disclosure line by line 3 days before closing', url: 'https://www.consumerfinance.gov/owning-a-home/closing-disclosure/' },
    { text: 'Do a final walkthrough of the property' },
    { text: 'Verify wire transfer instructions by phone — never trust email alone' },
    { text: 'Sign all closing documents and collect your keys' },
  ]

  return [
    { text: 'Research this step thoroughly before taking action' },
    { text: 'Connect with a HUD-approved housing counselor for guidance', url: 'https://www.hud.gov/counseling' },
    { text: 'Document your progress and keep records of everything' },
  ]
}

function isDocItem(text: string): boolean {
  const t = text.toLowerCase()
  return t.includes('tax return') || t.includes('pay stub') || t.includes('bank statement') ||
    t.includes('w-2') || t.includes('1040') || t.includes('gather') || t.includes('collect') ||
    t.includes('profit/loss') || t.includes('docs:') || t.includes('document')
}

interface StepState { text: string; done: boolean }

interface Props {
  profile: UserProfile
  onProfileUpdate: (p: UserProfile) => void
  onBack: () => void
  inDashboard?: boolean
}

export default function ActionPlanView({ profile, onProfileUpdate, onBack, inDashboard }: Props) {
  const { assessment: result, stateCode, name } = profile
  const localRes = getStateResources(stateCode)

  const [steps, setSteps] = useState<StepState[]>(() =>
    result.action_steps.map((text, i) => ({
      text,
      done: profile.stepProgress[i] ?? false,
    }))
  )

  const [activeIdx, setActiveIdx] = useState(() => {
    const first = steps.findIndex(s => !s.done)
    return first === -1 ? 0 : first
  })

  const [checklistProgress, setChecklistProgress] = useState<Record<number, boolean[]>>({})
  const [fileAttachments, setFileAttachments] = useState<Record<string, File[]>>({})
  const [dragOver, setDragOver] = useState<string | null>(null)

  const toggleChecklist = (stepIdx: number, itemIdx: number) => {
    const checklist = getStepChecklist(steps[stepIdx].text)
    const current = checklistProgress[stepIdx] ?? checklist.map(() => false)
    const updated = current.map((v, i) => i === itemIdx ? !v : v)
    setChecklistProgress(prev => ({ ...prev, [stepIdx]: updated }))
  }

  const addFiles = (key: string, incoming: FileList | File[]) => {
    const arr = Array.from(incoming)
    setFileAttachments(prev => ({ ...prev, [key]: [...(prev[key] ?? []), ...arr] }))
  }

  const removeFile = (key: string, fileIdx: number) => {
    setFileAttachments(prev => ({
      ...prev,
      [key]: (prev[key] ?? []).filter((_, i) => i !== fileIdx),
    }))
  }

  const [showEmailForm, setShowEmailForm] = useState(false)
  const [emailInput, setEmailInput] = useState(profile.email || '')
  const [emailSaved, setEmailSaved] = useState(!!profile.email)

  const handleSaveEmail = () => {
    if (!emailInput.trim()) return
    onProfileUpdate({ ...profile, email: emailInput.trim() })
    setEmailSaved(true)
    setShowEmailForm(false)
  }

  // Progress derived from checklist completion
  const totalItems = steps.reduce((sum, step) => sum + getStepChecklist(step.text).length, 0)
  const checkedItems = steps.reduce((sum, _, si) => {
    const count = getStepChecklist(steps[si].text).length
    const prog = checklistProgress[si] ?? []
    return sum + Array.from({ length: count }, (_, ii) => prog[ii] ?? false).filter(Boolean).length
  }, 0)
  const phasePct = totalItems > 0 ? Math.round((checkedItems / totalItems) * 100) : 0

  const active = steps[activeIdx]
  const allDone = checkedItems === totalItems && totalItems > 0
  const resources = active ? getResources(active.text, stateCode) : []

  const isStepDone = (si: number) => {
    const items = getStepChecklist(steps[si].text)
    const prog = checklistProgress[si] ?? []
    return items.every((_, ii) => prog[ii] ?? false)
  }

  return (
    <div className="plan-layout">

      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="plan-topbar">
        {!inDashboard && <button className="help-back-btn" onClick={onBack}>← Back</button>}
        <div className="plan-topbar-title">
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="plan-topbar-heading">
              {name && name !== 'Guest' ? `${name.split(' ')[0]}'s` : 'Your'} Action Plan
            </span>
            <div className="plan-topbar-sub">
              {stateCode && `📍 ${localRes.stateName} · `}
              <span className={result.qualifies ? 'plan-status-green' : 'plan-status-yellow'}>
                {result.qualifies ? '✓ Likely Qualifies' : '⚠ Needs Work'}
              </span>
            </div>
            <div className="plan-phase-progress">
              <div className="plan-phase-bar">
                <div className="plan-phase-fill" style={{ width: `${phasePct}%` }} />
              </div>
              <span className="plan-phase-pct">{phasePct}%</span>
              <span className="plan-topbar-phase-badge">
                {allDone ? '✓ ' : ''}Phase 1 · Pre-Approval
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column body ─────────────────────────────────── */}
      <div className="plan-body">

        {/* ═══ LEFT: Focused step ════════════════════════════ */}
        <div className="plan-main">

          {allDone && (
            <div className="phase-recap-card">
              <div className="phase-recap-top">
                <span className="phase-recap-icon">🏆</span>
                <div>
                  <div className="phase-recap-title">Phase 1 Complete!</div>
                  <div className="phase-recap-sub">You're pre-approval ready</div>
                </div>
              </div>
              <ul className="phase-recap-list">
                <li>✓ Reviewed your credit score, DTI, and down payment</li>
                <li>✓ Gathered your tax returns, pay stubs, and bank statements</li>
                <li>✓ Ready to compare lenders and submit applications</li>
              </ul>
              <button className="phase-next-btn" onClick={() => alert('Phase 2 coming soon!')}>
                Continue to Phase 2: Finding a Home →
              </button>
            </div>
          )}

          {/* Step card — always visible so completed steps can be reviewed */}
          {(() => {
            const stepDone = isStepDone(activeIdx)
            return (
            <div className="step-focus-card">
              {/* Step title */}
              <div className="step-focus-meta">
                <span className="step-focus-label">Step {activeIdx + 1} of {steps.length}</span>
                {activeIdx === 0 && !stepDone && (
                  <span className="step-focus-badge step-focus-badge--start">Start Here</span>
                )}
                {stepDone && (
                  <span className="step-focus-badge step-focus-badge--done">✓ Complete</span>
                )}
              </div>
              <p className="step-focus-text">{active.text}</p>

              {/* Checklist */}
              <div className="step-checklist">
                {getStepChecklist(active.text).map((item, i) => {
                  const checked = (checklistProgress[activeIdx] ?? [])[i] ?? false
                  const docItem = isDocItem(item.text)
                  const fileKey = `${activeIdx}-${i}`
                  const attached = fileAttachments[fileKey] ?? []
                  const isOver = dragOver === fileKey
                  return (
                    <div key={i} className="step-checklist-row">
                      <label className={`step-checklist-item${checked ? ' step-checklist-item--done' : ''}`}>
                        <input
                          type="checkbox"
                          className="step-checklist-checkbox"
                          checked={checked}
                          onChange={() => toggleChecklist(activeIdx, i)}
                        />
                        <span className="step-checklist-label">{item.text}</span>
                      </label>

                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="checklist-item-resource"
                          onClick={e => e.stopPropagation()}
                        >
                          <span className="checklist-item-resource-domain">{new URL(item.url).hostname.replace('www.', '')}</span>
                          <span className="checklist-item-resource-btn">Go →</span>
                        </a>
                      )}

                      {docItem && (
                        <div
                          className={`doc-drop-zone${isOver ? ' doc-drop-zone--over' : ''}${attached.length > 0 ? ' doc-drop-zone--has-files' : ''}`}
                          onDragOver={e => { e.preventDefault(); setDragOver(fileKey) }}
                          onDragLeave={() => setDragOver(null)}
                          onDrop={e => { e.preventDefault(); setDragOver(null); addFiles(fileKey, e.dataTransfer.files) }}
                          onClick={() => document.getElementById(`file-input-${fileKey}`)?.click()}
                        >
                          <input
                            id={`file-input-${fileKey}`}
                            type="file"
                            multiple
                            style={{ display: 'none' }}
                            onChange={e => e.target.files && addFiles(fileKey, e.target.files)}
                          />
                          {attached.length === 0 ? (
                            <span className="doc-drop-hint">📎 Drop files here or click to attach <span className="doc-drop-optional">(optional)</span></span>
                          ) : (
                            <ul className="doc-file-list" onClick={e => e.stopPropagation()}>
                              {attached.map((f, fi) => (
                                <li key={fi} className="doc-file-item">
                                  <span className="doc-file-name">📄 {f.name}</span>
                                  <button className="doc-file-remove" onClick={() => removeFile(fileKey, fi)}>✕</button>
                                </li>
                              ))}
                              <li className="doc-file-add" onClick={() => document.getElementById(`file-input-${fileKey}`)?.click()}>+ Add more</li>
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="step-focus-divider" />

              {/* Actions at the bottom */}
              <div className="step-actions-bar">
                <div className="step-nav-btns">
                  <button className="step-nav-btn" onClick={() => setActiveIdx(i => Math.max(0, i - 1))} disabled={activeIdx === 0}>
                    ← Prev
                  </button>
                  <button className="step-nav-btn step-nav-btn--fwd" onClick={() => setActiveIdx(i => Math.min(steps.length - 1, i + 1))} disabled={activeIdx === steps.length - 1}>
                    Next →
                  </button>
                </div>
              </div>
            </div>
            )
          })()}

          {/* Save CTA */}
          {!emailSaved ? (
            <div className="plan-save-cta">
              {!showEmailForm ? (
                <>
                  <span className="plan-save-cta-text">💾 Save your profile — enter your email to pick up where you left off</span>
                  <button className="plan-save-btn" onClick={() => setShowEmailForm(true)}>Save Profile</button>
                </>
              ) : (
                <div className="plan-save-form">
                  <input
                    type="email"
                    className="plan-save-input"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={e => setEmailInput(e.target.value)}
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && handleSaveEmail()}
                  />
                  <button className="plan-save-btn" onClick={handleSaveEmail} disabled={!emailInput.trim()}>Save →</button>
                  <button className="plan-save-cancel" onClick={() => setShowEmailForm(false)}>Cancel</button>
                </div>
              )}
            </div>
          ) : (
            <div className="plan-saved-banner">✓ Plan saved to {profile.email}</div>
          )}
        </div>

        {/* ═══ RIGHT: AI assistant ════════════════════════════ */}
        <aside className="plan-sidebar">
          <div className="sidebar-ai-header">
            <span className="sidebar-ai-icon">🤖</span>
            <div>
              <div className="sidebar-ai-title">AI can help!</div>
              <div className="sidebar-ai-sub">Ask anything about your current step</div>
            </div>
          </div>
          {active && <PlanChatbot profile={profile} currentStep={active.text} />}

          {/* My Documents */}
          {(() => {
            const allDocs: { stepLabel: string; itemLabel: string; file: File; key: string; fileIdx: number }[] = []
            steps.forEach((step, si) => {
              getStepChecklist(step.text).forEach((item, ii) => {
                const key = `${si}-${ii}`
                ;(fileAttachments[key] ?? []).forEach((file, fi) => {
                  allDocs.push({ stepLabel: `Step ${si + 1}`, itemLabel: item.text, file, key, fileIdx: fi })
                })
              })
            })
            if (allDocs.length === 0) return null
            return (
              <div className="sidebar-docs">
                <div className="sidebar-docs-heading">My Documents</div>
                <ul className="sidebar-docs-list">
                  {allDocs.map((d, i) => (
                    <li key={i} className="sidebar-docs-item">
                      <span className="sidebar-docs-icon">📄</span>
                      <div className="sidebar-docs-info">
                        <div className="sidebar-docs-filename">{d.file.name}</div>
                        <div className="sidebar-docs-for">{d.stepLabel} · {d.itemLabel}</div>
                      </div>
                      <button className="sidebar-docs-remove" onClick={() => removeFile(d.key, d.fileIdx)}>✕</button>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()}
        </aside>
      </div>
    </div>
  )
}
