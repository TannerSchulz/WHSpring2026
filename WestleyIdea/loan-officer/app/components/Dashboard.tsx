"use client";

import { useMemo, useState } from "react";

import type { PortalUser } from "../lib/auth";

type Status = "New" | "Contacted" | "Reviewing" | "Closed";
type View = "Overview" | "Borrowers" | "Links";

type Borrower = {
  id: number;
  initials: string;
  name: string;
  email: string;
  market: string;
  homePrice: number;
  payment: number;
  scenario: "Low" | "Average" | "Stretch";
  status: Status;
  submitted: string;
  source: string;
  credit: string;
  income: number;
  funds: number;
};

const borrowers: Borrower[] = [
  { id: 1, initials: "AM", name: "Alex Morgan", email: "alex.m@example.com", market: "Larimer County, CO", homePrice: 425000, payment: 2825, scenario: "Average", status: "New", submitted: "12 minutes ago", source: "First-time buyer seminar", credit: "660+", income: 92000, funds: 38000 },
  { id: 2, initials: "JR", name: "Jordan Rivera", email: "jordan.r@example.com", market: "Weld County, CO", homePrice: 360000, payment: 2140, scenario: "Low", status: "Contacted", submitted: "Yesterday", source: "Instagram bio", credit: "620–660", income: 78000, funds: 26000 },
  { id: 3, initials: "SK", name: "Sam Kim", email: "sam.k@example.com", market: "Arapahoe County, CO", homePrice: 510000, payment: 3430, scenario: "Stretch", status: "Reviewing", submitted: "Aug 8", source: "Realtor partner", credit: "660+", income: 118000, funds: 54000 },
  { id: 4, initials: "TP", name: "Taylor Price", email: "taylor.p@example.com", market: "Denver County, CO", homePrice: 395000, payment: 2580, scenario: "Average", status: "New", submitted: "Aug 7", source: "Email signature", credit: "620–660", income: 86000, funds: 31000 },
  { id: 5, initials: "MC", name: "Morgan Chen", email: "morgan.c@example.com", market: "Douglas County, CO", homePrice: 580000, payment: 3710, scenario: "Average", status: "Closed", submitted: "Aug 4", source: "Past client referral", credit: "660+", income: 132000, funds: 72000 },
];

const links = [
  { name: "General borrower link", slug: "tanner", visits: 148, submissions: 24, rate: "16.2%" },
  { name: "First-time buyer seminar", slug: "tanner/first-home", visits: 63, submissions: 14, rate: "22.2%" },
  { name: "Realtor partner — North CO", slug: "tanner/north-co", visits: 41, submissions: 8, rate: "19.5%" },
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Brand() {
  return <div className="brand"><span className="brand-symbol"><i /></span><strong>Mortgage<span>AI</span></strong></div>;
}

function initialsFor(name: string, email: string | null) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts.at(-1)?.[0]}`.toUpperCase();
  if (parts.length === 1 && parts[0] !== "MortgageAI User") return parts[0].slice(0, 2).toUpperCase();
  return (email || "MA").slice(0, 2).toUpperCase();
}

export function Dashboard({ user }: { user: PortalUser }) {
  const [view, setView] = useState<View>("Overview");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "All">("All");
  const [selected, setSelected] = useState<Borrower | null>(null);
  const [toast, setToast] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const firstName = user.displayName.split(/\s+/)[0] || "there";
  const initials = initialsFor(user.displayName, user.email);

  const filtered = useMemo(() => borrowers.filter((borrower) => {
    const matchesQuery = `${borrower.name} ${borrower.market}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "All" || borrower.status === status);
  }), [query, status]);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  async function copyLink(slug = "tanner") {
    await navigator.clipboard?.writeText(`https://estimate.muddy-puppy.com/${slug}`);
    showToast("Borrower link copied");
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav aria-label="Workspace navigation">
          {(["Overview", "Borrowers", "Links"] as View[]).map((item) => (
            <button className={view === item ? "active" : ""} key={item} onClick={() => setView(item)}>
              <span className={`nav-icon icon-${item.toLowerCase()}`} aria-hidden="true" />{item}
            </button>
          ))}
          <div className="nav-label">MANAGE</div>
          <button><span className="nav-icon icon-team" aria-hidden="true" />Team</button>
          <button><span className="nav-icon icon-branding" aria-hidden="true" />Branding</button>
          <button><span className="nav-icon icon-settings" aria-hidden="true" />Settings</button>
        </nav>
        <div className="pilot-card"><span>PILOT WORKSPACE</span><strong>7 days left</strong><p>Invite your team and send feedback before your pilot review.</p><button onClick={() => showToast("Feedback form coming soon")}>Share feedback</button></div>
        <div className="profile-wrap">
          {profileOpen && <div className="profile-menu">
            <span>SIGNED IN</span>
            <strong>{user.displayName}</strong>
            {user.email && <small>{user.email}</small>}
            <a href="/.auth/logout?post_logout_redirect_uri=/">Sign out</a>
          </div>}
          <button className="profile" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
            <span>{initials}</span><div><strong>{user.displayName}</strong><small>Authenticated account</small></div><i>•••</i>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" aria-label="Open navigation"><Brand /></button>
          <div className="global-search"><span aria-hidden="true" /> <input aria-label="Search borrowers" placeholder="Search borrowers" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="top-actions"><button className="icon-button" aria-label="Notifications">●<i /></button><button className="primary-button" onClick={() => copyLink()}>＋ New borrower link</button></div>
        </header>

        {view === "Overview" && <Overview firstName={firstName} onViewAll={() => setView("Borrowers")} onSelect={setSelected} onCopy={copyLink} />}
        {view === "Borrowers" && <BorrowerView borrowers={filtered} query={query} setQuery={setQuery} status={status} setStatus={setStatus} onSelect={setSelected} />}
        {view === "Links" && <LinksView onCopy={copyLink} onToast={showToast} />}
      </section>

      {selected && <BorrowerDrawer borrower={selected} onClose={() => setSelected(null)} onToast={showToast} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}

function Overview({ firstName, onViewAll, onSelect, onCopy }: { firstName: string; onViewAll: () => void; onSelect: (borrower: Borrower) => void; onCopy: (slug?: string) => void }) {
  return <div className="page-content">
    <div className="page-heading"><div><p>MONDAY, AUGUST 10</p><h1>Good morning, {firstName}.</h1><span>Here is what is happening across your borrower pipeline.</span></div><button className="secondary-button" onClick={() => onCopy()}>↗ Share your link</button></div>
    <div className="metrics">
      <article><div className="metric-top"><span>NEW BORROWERS</span><i className="metric-icon">↗</i></div><strong>18</strong><p><b>↑ 4</b> from last week</p></article>
      <article><div className="metric-top"><span>COMPLETION RATE</span><i className="metric-icon">◔</i></div><strong>74%</strong><p><b>↑ 6%</b> over 30 days</p></article>
      <article><div className="metric-top"><span>ACTIVE LINKS</span><i className="metric-icon">⌁</i></div><strong>7</strong><p>3 generated submissions</p></article>
      <article><div className="metric-top"><span>FOLLOW-UPS DUE</span><i className="metric-icon warm">!</i></div><strong>5</strong><p><em>2 are high intent</em></p></article>
    </div>
    <div className="overview-grid">
      <section className="panel activity-panel">
        <PanelHeading title="Recent borrower activity" subtitle="New submissions ready for your review" action="View all" onAction={onViewAll} />
        <BorrowerTable borrowers={borrowers.slice(0, 4)} onSelect={onSelect} />
      </section>
      <section className="panel follow-panel">
        <PanelHeading title="Follow-up queue" subtitle="Prioritized by activity" />
        <div className="follow-list">
          {borrowers.slice(0, 3).map((borrower, index) => <button key={borrower.id} onClick={() => onSelect(borrower)}><span className={`avatar tone-${index}`}>{borrower.initials}</span><div><strong>{borrower.name}</strong><small>{index === 0 ? "New results · 12m ago" : index === 1 ? "Viewed results again" : "Ready for review"}</small></div><i className={index === 0 ? "hot" : ""}>{index === 0 ? "HIGH" : "MED"}</i></button>)}
        </div>
        <button className="queue-button" onClick={onViewAll}>Open follow-up queue <span>→</span></button>
      </section>
      <section className="panel performance-panel">
        <PanelHeading title="Borrower activity" subtitle="Submissions over the last 7 days" action="Last 7 days⌄" />
        <div className="chart" aria-label="Seven day borrower activity chart">
          {[38, 61, 43, 78, 58, 92, 70].map((height, index) => <div key={index}><span style={{ height: `${height}%` }} /><small>{["T", "W", "T", "F", "S", "S", "M"][index]}</small></div>)}
        </div>
        <div className="chart-summary"><strong>31</strong><span>total submissions</span><b>↑ 18.5%</b></div>
      </section>
      <section className="panel link-panel">
        <PanelHeading title="Top-performing link" subtitle="First-time buyer seminar" />
        <div className="link-callout"><div><span>YOUR LINK</span><strong>estimate.muddy-puppy.com/tanner/first-home</strong></div><button onClick={() => onCopy("tanner/first-home")}>Copy</button></div>
        <div className="link-stats"><div><strong>63</strong><span>Visits</span></div><div><strong>14</strong><span>Submissions</span></div><div><strong>22.2%</strong><span>Conversion</span></div></div>
      </section>
    </div>
  </div>;
}

function PanelHeading({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button onClick={onAction}>{action}</button>}</div>;
}

function BorrowerTable({ borrowers: items, onSelect }: { borrowers: Borrower[]; onSelect: (borrower: Borrower) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Borrower</th><th>Market</th><th>Scenario</th><th>Submitted</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{items.map((borrower) => <tr key={borrower.id} onClick={() => onSelect(borrower)}><td><span className="borrower-cell"><i>{borrower.initials}</i><span><strong>{borrower.name}</strong><small>{borrower.email}</small></span></span></td><td>{borrower.market}</td><td><strong>{money.format(borrower.homePrice)}</strong><small>{borrower.scenario} · {money.format(borrower.payment)}/mo</small></td><td>{borrower.submitted}</td><td><span className={`status status-${borrower.status.toLowerCase()}`}>{borrower.status}</span></td><td><button aria-label={`Open ${borrower.name}`}>→</button></td></tr>)}</tbody></table></div>;
}

function BorrowerView({ borrowers: items, query, setQuery, status, setStatus, onSelect }: { borrowers: Borrower[]; query: string; setQuery: (value: string) => void; status: Status | "All"; setStatus: (value: Status | "All") => void; onSelect: (borrower: Borrower) => void }) {
  return <div className="page-content borrowers-page"><div className="page-heading"><div><p>BORROWER PIPELINE</p><h1>Borrowers</h1><span>Review every affordability submission and keep follow-up moving.</span></div><button className="primary-button">＋ Add borrower</button></div><section className="panel"><div className="table-tools"><div className="inline-search"><span /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name or market" aria-label="Search name or market" /></div><div className="filter-row">{(["All", "New", "Contacted", "Reviewing", "Closed"] as const).map((item) => <button className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)}>{item}</button>)}</div><button className="filter-button">☷ Filters</button></div><BorrowerTable borrowers={items} onSelect={onSelect} />{items.length === 0 && <div className="empty-state"><strong>No borrowers found</strong><span>Try a different name, market, or status.</span></div>}</section></div>;
}

function LinksView({ onCopy, onToast }: { onCopy: (slug?: string) => void; onToast: (message: string) => void }) {
  return <div className="page-content links-page"><div className="page-heading"><div><p>ATTRIBUTION &amp; SHARING</p><h1>Borrower links</h1><span>Create a separate link for each campaign or referral source.</span></div><button className="primary-button" onClick={() => onToast("Link creator coming next")}>＋ Create link</button></div><section className="panel"><div className="links-header"><span>LINK NAME</span><span>VISITS</span><span>SUBMISSIONS</span><span>CONVERSION</span><span /></div>{links.map((link) => <div className="link-row" key={link.slug}><div><i>⌁</i><span><strong>{link.name}</strong><small>estimate.muddy-puppy.com/{link.slug}</small></span></div><strong>{link.visits}</strong><strong>{link.submissions}</strong><b>{link.rate}</b><button onClick={() => onCopy(link.slug)}>Copy link</button></div>)}</section></div>;
}

function BorrowerDrawer({ borrower, onClose, onToast }: { borrower: Borrower; onClose: () => void; onToast: (message: string) => void }) {
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="drawer" aria-label={`${borrower.name} details`}><div className="drawer-top"><span>BORROWER DETAILS</span><button onClick={onClose} aria-label="Close details">×</button></div><div className="drawer-profile"><span>{borrower.initials}</span><div><h2>{borrower.name}</h2><p>{borrower.email}</p></div><i className={`status status-${borrower.status.toLowerCase()}`}>{borrower.status}</i></div><div className="intent-card"><span>SELECTED SCENARIO</span><div><strong>{money.format(borrower.homePrice)}</strong><i>{borrower.scenario}</i></div><p>{money.format(borrower.payment)} estimated monthly payment</p></div><div className="detail-grid"><div><span>Target market</span><strong>{borrower.market}</strong></div><div><span>Credit range</span><strong>{borrower.credit}</strong></div><div><span>Annual income</span><strong>{money.format(borrower.income)}</strong></div><div><span>Available funds</span><strong>{money.format(borrower.funds)}</strong></div><div><span>Source</span><strong>{borrower.source}</strong></div><div><span>Submitted</span><strong>{borrower.submitted}</strong></div></div><div className="drawer-note"><span>YOUR NEXT STEP</span><strong>Start with the monthly-payment conversation.</strong><p>This borrower selected the {borrower.scenario.toLowerCase()} scenario. Confirm income, debts, and available funds before discussing loan options.</p></div><div className="drawer-actions"><button className="primary-button" onClick={() => onToast("Marked as contacted")}>Mark contacted</button><button className="secondary-button" onClick={() => onToast("Note saved locally for preview")}>＋ Add note</button></div><p className="estimate-note">Affordability figures are educational estimates, not a prequalification, approval, or commitment to lend.</p></aside></div>;
}
