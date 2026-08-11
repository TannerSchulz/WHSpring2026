import { useEffect, useState } from 'react'
import { Branding } from '../types/branding'

type LegalPanel = 'privacy' | 'terms' | 'methodology'

interface Props { branding: Branding; tracked: boolean }

const PANEL_COPY: Record<LegalPanel, { title: string; content: JSX.Element }> = {
  privacy: {
    title: 'Privacy',
    content: <>
      <p>Your questionnaire answers are used to create the home-budget estimates shown in this experience. Do not enter Social Security numbers, bank-account numbers, or other information the questionnaire does not request.</p>
      <p>When you use a tracked loan-officer link and provide consent, your contact information, questionnaire answers, and planning results are sent to that mortgage professional&apos;s workspace for follow-up.</p>
    </>,
  },
  terms: {
    title: 'Terms of use',
    content: <>
      <p>This tool provides educational planning estimates. It does not provide a Loan Estimate, credit decision, pre-qualification, pre-approval, commitment to lend, or financial, legal, or tax advice.</p>
      <p>Do not rely on these results as a substitute for reviewing actual loan terms with a licensed mortgage professional. Availability, eligibility, rates, payments, taxes, insurance, fees, and closing costs can change.</p>
    </>,
  },
  methodology: {
    title: 'Calculation methodology',
    content: <>
      <p>The Low, Average, and Stretch ranges allocate 25%, 33%, and 40% of gross monthly income to housing and existing monthly debts combined.</p>
      <p>Estimated home prices use a 30-year planning rate, the selected loan program, entered down-payment funds, location-based property-tax and homeowners-insurance estimates, and estimated mortgage insurance when applicable.</p>
      <p>Mortgage rates are national planning benchmarks. Utah taxes and insurance use county estimates; other locations use state averages. Property-specific costs and lender underwriting will produce different results.</p>
    </>,
  },
}

export default function LegalFooter({ branding, tracked }: Props) {
  const [panel, setPanel] = useState<LegalPanel | null>(null)

  useEffect(() => {
    if (!panel) return
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setPanel(null) }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [panel])

  return <>
    <footer className="legal-footer">
      <div className="legal-footer-identity">
        <strong>{branding.companyName}</strong>
        {branding.officerName && <span>{branding.officerName}</span>}
        {branding.nmlsId && <span>NMLS #{branding.nmlsId}</span>}
        {tracked && <span className="legal-tracked-label">Secure tracked questionnaire</span>}
      </div>
      <nav className="legal-footer-links" aria-label="Legal information">
        <button type="button" onClick={() => setPanel('privacy')}>Privacy</button>
        <button type="button" onClick={() => setPanel('terms')}>Terms of Use</button>
        <button type="button" onClick={() => setPanel('methodology')}>Calculation Methodology</button>
      </nav>
      <div className="legal-footer-contact">
        {branding.email && <a href={`mailto:${branding.email}`}>{branding.email}</a>}
        {branding.phone && <a href={`tel:${branding.phone}`}>{branding.phone}</a>}
      </div>
    </footer>

    {panel && <div className="legal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setPanel(null) }}>
      <section className="legal-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-dialog-title">
        <div className="legal-dialog-header">
          <h2 id="legal-dialog-title">{PANEL_COPY[panel].title}</h2>
          <button type="button" aria-label="Close" onClick={() => setPanel(null)}>×</button>
        </div>
        <div className="legal-dialog-copy">{PANEL_COPY[panel].content}</div>
      </section>
    </div>}
  </>
}
