import { DemoForm } from "./components/DemoForm";

const productSteps = [
  {
    number: "01",
    title: "Create a branded link",
    copy: "Give every loan officer a simple, trackable path to share in texts, emails, social posts, and partner follow-ups.",
  },
  {
    number: "02",
    title: "Borrowers explore privately",
    copy: "A short, approachable questionnaire turns income, credit range, debts, and location into useful affordability scenarios.",
  },
  {
    number: "03",
    title: "Your team gets the handoff",
    copy: "Review the borrower context behind each result and start the next conversation with fewer discovery questions.",
  },
];

const capabilities = [
  {
    label: "BRANDED EXPERIENCE",
    title: "Keep your name on the journey",
    copy: "A consistent experience from the link a borrower opens to the results they review with your team.",
  },
  {
    label: "BORROWER INTENT",
    title: "Capture the why behind the numbers",
    copy: "Understand employment, income, credit range, debts, available funds, and the county where they want to buy.",
  },
  {
    label: "CLEAR SCENARIOS",
    title: "Make affordability easier to discuss",
    copy: "Show Low, Average, and Stretch paths with estimated payment details borrowers can understand at a glance.",
  },
  {
    label: "TEAM WORKFLOW",
    title: "Know which lead needs a conversation",
    copy: "Bring borrower submissions into one review-ready workspace instead of chasing screenshots and partial text threads.",
  },
  {
    label: "LOCATION AWARE",
    title: "Ground estimates in the local market",
    copy: "Use county and state context to account for estimated property tax, homeowners insurance, and PMI when applicable.",
  },
  {
    label: "NO LEAD MARKETPLACE",
    title: "Your relationships stay yours",
    copy: "MortgageAI is designed as software for your team—not a marketplace that resells the borrower relationships you create.",
  },
];

const faqs = [
  {
    question: "Is MortgageAI a prequalification or loan approval?",
    answer:
      "No. MortgageAI provides educational affordability estimates that help a borrower prepare for a conversation with a licensed mortgage professional. It does not issue credit decisions, prequalifications, or approvals.",
  },
  {
    question: "Can each loan officer have their own link?",
    answer:
      "That is the core workflow. Each shareable link can be associated with the loan officer or team that created it, so incoming borrower information returns to the right workspace.",
  },
  {
    question: "Can our company customize the borrower experience?",
    answer:
      "Yes. Company identity, loan-officer information, calls to action, and the handoff experience are part of the planned onboarding configuration. We will scope the exact level of customization during your pilot.",
  },
  {
    question: "How is borrower information handled?",
    answer:
      "The production rollout is being designed around clear borrower consent, organization-level data separation, and role-based access. We will document the implemented controls and retention settings before a live deployment.",
  },
  {
    question: "What happens after we request a pilot?",
    answer:
      "We will learn how your team currently captures and follows up with borrower interest, configure a focused pilot, and agree on the success measures before the first link is sent.",
  },
];

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">
      <path d="M4 10h11M11 6l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">
      <path d="m5 10 3.1 3L15 6.7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="MortgageAI home">
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span>Mortgage<span>AI</span></span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#product">Product</a>
          <a href="#workflow">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>
        <a className="button button-small button-dark" href="#demo">Request a pilot <ArrowIcon /></a>
      </header>

      <section className="hero" id="top">
        <div className="hero-noise" aria-hidden="true" />
        <div className="hero-copy">
          <p className="eyebrow"><span /> Built for modern mortgage teams</p>
          <h1>Turn borrower curiosity into <em>qualified conversations.</em></h1>
          <p className="hero-lede">
            Give borrowers a clear way to explore what they may be able to afford—then give your loan officers the context to follow up well.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="#demo">Request a pilot <ArrowIcon /></a>
            <a className="text-link" href="#workflow">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <p className="micro-proof"><span>✓</span> No per-lead fees <span>✓</span> Your brand, your relationships</p>
        </div>

        <div className="product-stage" aria-label="MortgageAI lead workspace preview">
          <div className="stage-glow" />
          <div className="dashboard-window">
            <div className="window-bar">
              <div className="window-brand"><span className="brand-mark mini"><span /></span> MortgageAI</div>
              <div className="window-user">TS</div>
            </div>
            <div className="dashboard-body">
              <aside className="dashboard-nav">
                <span className="active">Overview</span>
                <span>Borrowers</span>
                <span>Links</span>
                <span>Team</span>
                <span>Branding</span>
              </aside>
              <div className="dashboard-content">
                <div className="dashboard-title"><div><small>MONDAY, AUGUST 10</small><strong>Good morning, Tanner</strong></div><button>+ New link</button></div>
                <div className="stat-row">
                  <div><span>NEW BORROWERS</span><strong>18</strong><small>+4 this week</small></div>
                  <div><span>COMPLETION RATE</span><strong>74%</strong><small>Last 30 days</small></div>
                  <div><span>ACTIVE LINKS</span><strong>7</strong><small>Across your channels</small></div>
                </div>
                <div className="lead-panel">
                  <div className="panel-heading"><div><strong>Recent borrower activity</strong><small>Ready for your review</small></div><span>View all</span></div>
                  <div className="lead-row heading"><span>BORROWER</span><span>MARKET</span><span>SCENARIO</span><span>STATUS</span></div>
                  <div className="lead-row"><span><i>AM</i><b>Alex M.</b></span><span>Larimer County, CO</span><span>$425k Average</span><span><mark className="status-new">New</mark></span></div>
                  <div className="lead-row"><span><i>JR</i><b>Jordan R.</b></span><span>Weld County, CO</span><span>$360k Low</span><span><mark>Reviewed</mark></span></div>
                  <div className="lead-row"><span><i>SK</i><b>Sam K.</b></span><span>Arapahoe County, CO</span><span>$510k Stretch</span><span><mark>Reviewed</mark></span></div>
                </div>
              </div>
            </div>
          </div>
          <div className="float-card float-link">
            <span className="float-icon">↗</span>
            <div><small>YOUR BRANDED LINK</small><strong>mortgageai.com/tanner</strong></div>
            <span className="copied">Copied</span>
          </div>
          <div className="float-card float-lead">
            <span className="pulse-dot" />
            <div><small>NEW BORROWER</small><strong>Ready for review</strong></div>
            <span aria-hidden="true">→</span>
          </div>
        </div>
      </section>

      <section className="signal-strip" aria-label="Product benefits">
        <p>A better first mortgage conversation</p>
        <div><span>BRANDED BORROWER LINKS</span><i /> <span>USEFUL AFFORDABILITY SCENARIOS</span><i /> <span>REVIEW-READY CONTEXT</span></div>
      </section>

      <section className="section workflow" id="workflow">
        <div className="section-intro centered">
          <p className="eyebrow dark"><span /> How it works</p>
          <h2>From shared link to warm handoff.</h2>
          <p>MortgageAI makes the space between “What can I afford?” and “Let’s talk” useful for everyone.</p>
        </div>
        <div className="steps-grid">
          {productSteps.map((step) => (
            <article className="step-card" key={step.number}>
              <span className="step-number">{step.number}</span>
              <div className={`step-visual visual-${step.number}`} aria-hidden="true">
                {step.number === "01" && <><div className="link-preview"><small>YOUR PERSONAL LINK</small><strong>mortgageai.com/tanner</strong><button>Copy link</button></div><div className="channel-dots"><span>SMS</span><span>EMAIL</span><span>SOCIAL</span></div></>}
                {step.number === "02" && <><div className="phone-mini"><div className="phone-top" /><small>STEP 4 OF 7</small><strong>Where are you looking?</strong><span>County</span><span>State</span><button>Continue</button></div></>}
                {step.number === "03" && <><div className="handoff-card"><span>NEW SUBMISSION</span><strong>Alex M.</strong><p>Larimer County, CO</p><div><i>Income added</i><i>Credit range added</i><i>Debts added</i></div></div></>}
              </div>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section result-story" id="product">
        <div className="result-copy">
          <p className="eyebrow dark"><span /> A clearer way to talk affordability</p>
          <h2>One borrower. Three useful paths.</h2>
          <p>Instead of presenting one fragile number, MortgageAI frames affordability as a range—so borrowers can compare tradeoffs before they speak with your team.</p>
          <ul>
            <li><CheckIcon /><span><strong>Complete payment context</strong>Principal and interest, estimated taxes, insurance, and PMI when applicable.</span></li>
            <li><CheckIcon /><span><strong>Location-aware estimates</strong>County and state give the calculation a more useful local starting point.</span></li>
            <li><CheckIcon /><span><strong>Responsible handoff</strong>Results remain estimates and direct the borrower to a licensed professional for the next step.</span></li>
          </ul>
        </div>
        <div className="scenario-shell" aria-label="Example borrower affordability results">
          <div className="scenario-heading"><div><small>YOUR HOME-BUYING RANGE</small><strong>Three paths to consider</strong></div><span>Illustrative estimate</span></div>
          <div className="scenario-card low"><div><span>25%</span><small>LOW</small></div><strong>$335,000</strong><p>$2,140 / month</p><i>More monthly flexibility</i></div>
          <div className="scenario-card average"><div><span>33%</span><small>AVERAGE</small></div><strong>$425,000</strong><p>$2,825 / month</p><i>Balanced monthly budget</i></div>
          <div className="scenario-card stretch"><div><span>40%</span><small>STRETCH</small></div><strong>$510,000</strong><p>$3,430 / month</p><i>Higher budget commitment</i></div>
          <div className="scenario-footer"><span>Estimated taxes &amp; insurance included</span><button>Talk through my results →</button></div>
        </div>
      </section>

      <section className="section capabilities">
        <div className="section-intro split">
          <div><p className="eyebrow dark"><span /> Built for the relationship business</p><h2>Better software should make you more human.</h2></div>
          <p>Give borrowers something genuinely useful now, then arrive at the follow-up with the context to have a sharper, more personal conversation.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((item, index) => (
            <article key={item.title}>
              <div className={`cap-icon cap-${index + 1}`} aria-hidden="true"><span /></div>
              <small>{item.label}</small>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section pricing" id="pricing">
        <div className="pricing-copy">
          <p className="eyebrow light"><span /> Founding partner pilot</p>
          <h2>Start focused.<br /><em>Prove the workflow.</em></h2>
          <p>We are onboarding a small number of loan officers and mortgage teams to shape the first production rollout.</p>
          <a className="button button-primary" href="#demo">Talk through a pilot <ArrowIcon /></a>
        </div>
        <div className="pilot-card">
          <div className="pilot-top"><span>PILOT PLAN</span><mark>EARLY ACCESS</mark></div>
          <h3>Configured around your team</h3>
          <p>We will scope the users, branding, borrower flow, and review process before publishing a price—so the pilot matches the value you actually need to prove.</p>
          <div className="pilot-includes">
            <p><CheckIcon /> Branded borrower experience</p>
            <p><CheckIcon /> Individual shareable links</p>
            <p><CheckIcon /> Borrower submission workspace</p>
            <p><CheckIcon /> Guided setup and pilot review</p>
            <p><CheckIcon /> No per-lead resale model</p>
            <p><CheckIcon /> Direct product feedback channel</p>
          </div>
          <div className="pilot-note"><strong>Pricing principle</strong><span>Simple subscription pricing. No surprise lead fees.</span></div>
        </div>
      </section>

      <section className="section faq" id="faq">
        <div className="faq-heading"><p className="eyebrow dark"><span /> Questions, answered</p><h2>What teams ask us first.</h2><p>Have a different workflow in mind? Tell us about it in the pilot request below.</p></div>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <details key={faq.question} open={index === 0}>
              <summary>{faq.question}<span aria-hidden="true">+</span></summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="section demo" id="demo">
        <div className="demo-copy">
          <p className="eyebrow light"><span /> Let’s make the first conversation better</p>
          <h2>See how MortgageAI could fit your team.</h2>
          <p>Tell us a little about your business and current lead flow. We will follow up to scope a focused pilot—no generic sales sequence.</p>
          <div className="demo-points"><span><CheckIcon /> 20-minute discovery call</span><span><CheckIcon /> Workflow and branding review</span><span><CheckIcon /> Clear pilot recommendation</span></div>
        </div>
        <DemoForm />
      </section>

      <footer>
        <div className="footer-main">
          <div><a className="brand footer-brand" href="#top"><span className="brand-mark"><span /></span><span>Mortgage<span>AI</span></span></a><p>Better affordability conversations for modern mortgage teams.</p></div>
          <div><strong>PRODUCT</strong><a href="#workflow">How it works</a><a href="#product">Borrower results</a><a href="#pricing">Pilot</a></div>
          <div><strong>COMPANY</strong><a href="#demo">Request a demo</a><a href="#faq">FAQ</a><a href="#top">Back to top</a></div>
          <div><strong>IMPORTANT</strong><p>MortgageAI provides educational estimates only. It is not a lender and does not issue loan approvals.</p></div>
        </div>
        <div className="footer-bottom"><span>© 2026 MortgageAI. All rights reserved.</span><span>Designed for responsible borrower education.</span></div>
      </footer>
    </main>
  );
}
