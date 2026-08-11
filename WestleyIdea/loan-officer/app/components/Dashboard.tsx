"use client";

import { FormEvent, useMemo, useState } from "react";

import type { PortalUser } from "../lib/auth";
import type { Borrower, BorrowerLink, BorrowerNote, BorrowerStatus, DashboardData } from "../lib/crm-types";

type View = "Overview" | "Borrowers" | "Links";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function Brand() {
  return <div className="brand"><span className="brand-symbol"><i /></span><strong>Mortgage<span>AI</span></strong></div>;
}

function initialsFor(name: string, email: string | null = null) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts.at(-1)?.[0]}`.toUpperCase();
  if (parts.length === 1 && parts[0] !== "MortgageAI User") return parts[0].slice(0, 2).toUpperCase();
  return (email || "MA").slice(0, 2).toUpperCase();
}

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function relativeDate(value: string) {
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 172800) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

async function crmRequest<T>(path: string, method: "POST" | "PATCH", body: unknown): Promise<T> {
  const response = await fetch(`/api/crm/${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null) as (T & { error?: string }) | null;
  if (!response.ok) throw new Error(payload?.error || "The CRM operation could not be completed.");
  return payload as T;
}

export function Dashboard({ user, initialData }: { user: PortalUser; initialData: DashboardData }) {
  const [view, setView] = useState<View>("Overview");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BorrowerStatus | "all">("all");
  const [borrowers, setBorrowers] = useState(initialData.borrowers);
  const [links, setLinks] = useState(initialData.links);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [linkFormOpen, setLinkFormOpen] = useState(false);
  const selected = borrowers.find((borrower) => borrower.id === selectedId) || null;
  const firstName = user.displayName.split(/\s+/)[0] || "there";
  const initials = initialsFor(user.displayName, user.email);
  const organization = initialData.membership.organization;

  const filtered = useMemo(() => borrowers.filter((borrower) => {
    const matchesQuery = `${borrower.name} ${borrower.market} ${borrower.email}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "all" || borrower.status === status);
  }), [borrowers, query, status]);

  const metrics = {
    newBorrowers: borrowers.filter((item) => item.status === "new").length,
    completionRate: initialData.metrics.completion_rate,
    activeLinks: links.filter((item) => item.is_active).length,
    followUps: borrowers.filter((item) => item.status === "new" || item.status === "reviewing").length,
  };

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  async function copyLink(slug?: string) {
    const target = slug || links[0]?.slug;
    if (!target) {
      setView("Links");
      setLinkFormOpen(true);
      return;
    }
    await navigator.clipboard?.writeText(`https://estimate.muddy-puppy.com/${target}`);
    showToast("Borrower link copied");
  }

  async function createLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      const link = await crmRequest<BorrowerLink>("links", "POST", {
        name: values.get("name"),
        source: values.get("source") || null,
      });
      setLinks((current) => [link, ...current]);
      setLinkFormOpen(false);
      form.reset();
      showToast("Borrower link created");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Link creation failed");
    }
  }

  async function updateStatus(borrower: Borrower, nextStatus: BorrowerStatus) {
    try {
      await crmRequest(`borrowers/${borrower.id}/status`, "PATCH", { status: nextStatus });
      setBorrowers((current) => current.map((item) => item.id === borrower.id ? { ...item, status: nextStatus } : item));
      showToast(`Borrower marked ${label(nextStatus).toLowerCase()}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Status update failed");
    }
  }

  async function addNote(borrower: Borrower, note: string) {
    const saved = await crmRequest<BorrowerNote>(`borrowers/${borrower.id}/notes`, "POST", { body: note });
    setBorrowers((current) => current.map((item) => item.id === borrower.id
      ? { ...item, notes: [saved, ...item.notes] }
      : item));
    showToast("Note saved");
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
          <button disabled title="Team management is the next milestone"><span className="nav-icon icon-team" aria-hidden="true" />Team <small>SOON</small></button>
          <button disabled title="Branding controls are the next milestone"><span className="nav-icon icon-branding" aria-hidden="true" />Branding <small>SOON</small></button>
          <button disabled title="Workspace settings are the next milestone"><span className="nav-icon icon-settings" aria-hidden="true" />Settings <small>SOON</small></button>
        </nav>
        <div className="workspace-card"><span>ACTIVE WORKSPACE</span><strong>{organization.name}</strong><p>{label(initialData.membership.role)} access</p></div>
        <div className="profile-wrap">
          {profileOpen && <div className="profile-menu">
            <span>SIGNED IN</span><strong>{user.displayName}</strong>{user.email && <small>{user.email}</small>}
            <a href="/.auth/logout?post_logout_redirect_uri=/">Sign out</a>
          </div>}
          <button className="profile" aria-expanded={profileOpen} onClick={() => setProfileOpen((open) => !open)}>
            <span>{initials}</span><div><strong>{user.displayName}</strong><small>{label(initialData.membership.role)}</small></div><i>•••</i>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <button className="mobile-brand" aria-label="Open navigation"><Brand /></button>
          <div className="global-search"><span aria-hidden="true" /><input aria-label="Search borrowers" placeholder="Search borrowers" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <div className="top-actions"><button className="icon-button" aria-label="Notifications">●<i /></button><button className="primary-button" onClick={() => { setView("Links"); setLinkFormOpen(true); }}>＋ New borrower link</button></div>
        </header>

        {view === "Overview" && <Overview firstName={firstName} data={initialData} borrowers={borrowers} links={links} metrics={metrics} onViewAll={() => setView("Borrowers")} onSelect={(item) => setSelectedId(item.id)} onCopy={copyLink} />}
        {view === "Borrowers" && <BorrowerView borrowers={filtered} allBorrowers={borrowers} query={query} setQuery={setQuery} status={status} setStatus={setStatus} links={links} onSelect={(item) => setSelectedId(item.id)} onCopy={copyLink} />}
        {view === "Links" && <LinksView links={links} formOpen={linkFormOpen} setFormOpen={setLinkFormOpen} onCreate={createLink} onCopy={copyLink} />}
      </section>

      {selected && <BorrowerDrawer borrower={selected} onClose={() => setSelectedId(null)} onStatus={updateStatus} onNote={addNote} onToast={showToast} />}
      {toast && <div className="toast" role="status"><span>✓</span>{toast}</div>}
    </main>
  );
}

function Overview({ firstName, data, borrowers, links, metrics, onViewAll, onSelect, onCopy }: {
  firstName: string;
  data: DashboardData;
  borrowers: Borrower[];
  links: BorrowerLink[];
  metrics: { newBorrowers: number; completionRate: number; activeLinks: number; followUps: number };
  onViewAll: () => void;
  onSelect: (borrower: Borrower) => void;
  onCopy: (slug?: string) => void;
}) {
  const followUps = borrowers.filter((item) => item.status === "new" || item.status === "reviewing").slice(0, 3);
  const topLink = links.find((item) => item.id === data.top_link_id) || links[0];
  const maxActivity = Math.max(...data.activity.map((item) => item.count), 1);
  return <div className="page-content">
    <div className="page-heading"><div><p>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }).toUpperCase()}</p><h1>Good morning, {firstName}.</h1><span>Here is what is happening across your borrower pipeline.</span></div><button className="secondary-button" onClick={() => onCopy()}>↗ Share your link</button></div>
    <div className="metrics">
      <article><div className="metric-top"><span>NEW BORROWERS</span><i className="metric-icon">↗</i></div><strong>{metrics.newBorrowers}</strong><p>Awaiting first review</p></article>
      <article><div className="metric-top"><span>COMPLETION RATE</span><i className="metric-icon">◔</i></div><strong>{metrics.completionRate}%</strong><p>Across tracked links</p></article>
      <article><div className="metric-top"><span>ACTIVE LINKS</span><i className="metric-icon">⌁</i></div><strong>{metrics.activeLinks}</strong><p>Ready to share</p></article>
      <article><div className="metric-top"><span>FOLLOW-UPS DUE</span><i className="metric-icon warm">!</i></div><strong>{metrics.followUps}</strong><p><em>New or reviewing</em></p></article>
    </div>
    <div className="overview-grid">
      <section className="panel activity-panel">
        <PanelHeading title="Recent borrower activity" subtitle="Latest submissions for your organization" action={borrowers.length ? "View all" : undefined} onAction={onViewAll} />
        {borrowers.length ? <BorrowerTable borrowers={borrowers.slice(0, 5)} onSelect={onSelect} /> : <EmptyState title="No borrower submissions yet" detail="Share your borrower link to begin building a real review queue." action="Copy borrower link" onAction={() => onCopy()} />}
      </section>
      <section className="panel follow-panel">
        <PanelHeading title="Follow-up queue" subtitle="New and in-review borrowers" />
        {followUps.length ? <><div className="follow-list">{followUps.map((borrower, index) => <button key={borrower.id} onClick={() => onSelect(borrower)}><span className={`avatar tone-${index}`}>{initialsFor(borrower.name)}</span><div><strong>{borrower.name}</strong><small>{label(borrower.status)} · {relativeDate(borrower.submitted_at)}</small></div><i className={borrower.status === "new" ? "hot" : ""}>{borrower.status === "new" ? "NEW" : "REVIEW"}</i></button>)}</div><button className="queue-button" onClick={onViewAll}>Open follow-up queue <span>→</span></button></> : <div className="compact-empty"><strong>You’re caught up</strong><span>New borrower submissions will appear here.</span></div>}
      </section>
      <section className="panel performance-panel">
        <PanelHeading title="Borrower activity" subtitle="Submissions over the last 7 days" action="Last 7 days" />
        <div className="chart" aria-label="Seven day borrower activity chart">{data.activity.map((item) => <div key={item.date}><span style={{ height: `${Math.max(4, item.count / maxActivity * 92)}%` }} title={`${item.count} submissions`} /><small>{new Date(`${item.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "narrow" })}</small></div>)}</div>
        <div className="chart-summary"><strong>{data.activity.reduce((sum, item) => sum + item.count, 0)}</strong><span>submissions this week</span></div>
      </section>
      <section className="panel link-panel">
        <PanelHeading title={topLink ? "Top-performing link" : "Your borrower link"} subtitle={topLink?.name || "Create a link to get started"} />
        {topLink ? <><div className="link-callout"><div><span>YOUR LINK</span><strong>estimate.muddy-puppy.com/{topLink.slug}</strong></div><button onClick={() => onCopy(topLink.slug)}>Copy</button></div><div className="link-stats"><div><strong>{topLink.visits}</strong><span>Visits</span></div><div><strong>{topLink.submissions}</strong><span>Submissions</span></div><div><strong>{topLink.conversion_rate}%</strong><span>Conversion</span></div></div></> : <EmptyState title="No active links" detail="Create your first tracked borrower link." />}
      </section>
    </div>
  </div>;
}

function PanelHeading({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button onClick={onAction}>{action}</button>}</div>;
}

function EmptyState({ title, detail, action, onAction }: { title: string; detail: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state product-empty"><strong>{title}</strong><span>{detail}</span>{action && <button className="secondary-button" onClick={onAction}>{action}</button>}</div>;
}

function BorrowerTable({ borrowers, onSelect }: { borrowers: Borrower[]; onSelect: (borrower: Borrower) => void }) {
  return <div className="table-wrap"><table><thead><tr><th>Borrower</th><th>Market</th><th>Scenario</th><th>Submitted</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{borrowers.map((borrower) => <tr key={borrower.id} onClick={() => onSelect(borrower)}><td><span className="borrower-cell"><i>{initialsFor(borrower.name)}</i><span><strong>{borrower.name}</strong><small>{borrower.email}</small></span></span></td><td>{borrower.market}</td><td>{borrower.home_price ? <><strong>{money.format(borrower.home_price)}</strong><small>{borrower.scenario ? label(borrower.scenario) : "Result"} · {borrower.payment ? `${money.format(borrower.payment)}/mo` : "Payment pending"}</small></> : <small>Results pending</small>}</td><td>{relativeDate(borrower.submitted_at)}</td><td><span className={`status status-${borrower.status}`}>{label(borrower.status)}</span></td><td><button aria-label={`Open ${borrower.name}`}>→</button></td></tr>)}</tbody></table></div>;
}

function BorrowerView({ borrowers, allBorrowers, query, setQuery, status, setStatus, links, onSelect, onCopy }: {
  borrowers: Borrower[];
  allBorrowers: Borrower[];
  query: string;
  setQuery: (value: string) => void;
  status: BorrowerStatus | "all";
  setStatus: (value: BorrowerStatus | "all") => void;
  links: BorrowerLink[];
  onSelect: (borrower: Borrower) => void;
  onCopy: (slug?: string) => void;
}) {
  return <div className="page-content borrowers-page"><div className="page-heading"><div><p>BORROWER PIPELINE</p><h1>Borrowers</h1><span>Review affordability submissions and keep follow-up moving.</span></div><button className="primary-button" onClick={() => onCopy(links[0]?.slug)}>↗ Share borrower link</button></div><section className="panel"><div className="table-tools"><div className="inline-search"><span /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or market" aria-label="Search borrowers" /></div><div className="filter-row">{(["all", "new", "contacted", "reviewing", "closed"] as const).map((item) => <button className={status === item ? "active" : ""} key={item} onClick={() => setStatus(item)}>{label(item)}</button>)}</div></div>{borrowers.length ? <BorrowerTable borrowers={borrowers} onSelect={onSelect} /> : <EmptyState title={allBorrowers.length ? "No borrowers match this view" : "No borrower submissions yet"} detail={allBorrowers.length ? "Try another search or status filter." : "Share a borrower link and completed questionnaires will appear here."} action={allBorrowers.length ? undefined : "Copy borrower link"} onAction={() => onCopy(links[0]?.slug)} />}</section></div>;
}

function LinksView({ links, formOpen, setFormOpen, onCreate, onCopy }: { links: BorrowerLink[]; formOpen: boolean; setFormOpen: (open: boolean) => void; onCreate: (event: FormEvent<HTMLFormElement>) => void; onCopy: (slug?: string) => void }) {
  return <div className="page-content links-page"><div className="page-heading"><div><p>ATTRIBUTION &amp; SHARING</p><h1>Borrower links</h1><span>Create a separate tracked link for each campaign or referral source.</span></div><button className="primary-button" onClick={() => setFormOpen(!formOpen)}>＋ Create link</button></div>{formOpen && <form className="panel link-create-form" onSubmit={onCreate}><div><strong>Create a borrower link</strong><span>Use a descriptive name so you know where each submission originated.</span></div><label>Link name<input name="name" required minLength={2} maxLength={200} placeholder="First-time buyer seminar" /></label><label>Source <small>Optional</small><input name="source" maxLength={120} placeholder="Event, partner, social profile…" /></label><div><button type="button" className="secondary-button" onClick={() => setFormOpen(false)}>Cancel</button><button className="primary-button">Create link</button></div></form>}<section className="panel">{links.length ? <><div className="links-header"><span>LINK NAME</span><span>VISITS</span><span>SUBMISSIONS</span><span>CONVERSION</span><span /></div>{links.map((link) => <div className="link-row" key={link.id}><div><i>⌁</i><span><strong>{link.name}</strong><small>estimate.muddy-puppy.com/{link.slug}</small></span></div><strong>{link.visits}</strong><strong>{link.submissions}</strong><b>{link.conversion_rate}%</b><button onClick={() => onCopy(link.slug)}>Copy link</button></div>)}</> : <EmptyState title="No borrower links" detail="Create a tracked link to start collecting borrower submissions." action="Create link" onAction={() => setFormOpen(true)} />}</section></div>;
}

function BorrowerDrawer({ borrower, onClose, onStatus, onNote, onToast }: { borrower: Borrower; onClose: () => void; onStatus: (borrower: Borrower, status: BorrowerStatus) => Promise<void>; onNote: (borrower: Borrower, note: string) => Promise<void>; onToast: (message: string) => void }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const note = String(new FormData(form).get("note") || "").trim();
    if (!note) return;
    setSaving(true);
    try {
      await onNote(borrower, note);
      form.reset();
      setNoteOpen(false);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Note could not be saved");
    } finally {
      setSaving(false);
    }
  }
  return <div className="drawer-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="drawer" aria-label={`${borrower.name} details`}><div className="drawer-top"><span>BORROWER DETAILS</span><button onClick={onClose} aria-label="Close details">×</button></div><div className="drawer-profile"><span>{initialsFor(borrower.name)}</span><div><h2>{borrower.name}</h2><p>{borrower.email}</p></div><i className={`status status-${borrower.status}`}>{label(borrower.status)}</i></div>{borrower.home_price && <div className="intent-card"><span>{borrower.scenario ? `${label(borrower.scenario)} SCENARIO` : "AFFORDABILITY RESULT"}</span><div><strong>{money.format(borrower.home_price)}</strong></div><p>{borrower.payment ? `${money.format(borrower.payment)} estimated monthly payment` : "Payment estimate pending"}</p></div>}<div className="detail-grid"><div><span>Target market</span><strong>{borrower.market}</strong></div><div><span>Credit range</span><strong>{borrower.credit_range}</strong></div><div><span>Income used</span><strong>{borrower.income ? money.format(borrower.income) : "Not provided"}</strong></div><div><span>Available funds</span><strong>{borrower.available_funds !== null ? money.format(borrower.available_funds) : "Not provided"}</strong></div><div><span>Source</span><strong>{borrower.source}</strong></div><div><span>Submitted</span><strong>{relativeDate(borrower.submitted_at)}</strong></div></div><div className="status-controls"><span>FOLLOW-UP STATUS</span><div>{(["new", "contacted", "reviewing", "closed"] as BorrowerStatus[]).map((item) => <button className={borrower.status === item ? "active" : ""} key={item} onClick={() => onStatus(borrower, item)}>{label(item)}</button>)}</div></div>{borrower.notes.length > 0 && <section className="notes-list"><span>INTERNAL NOTES</span>{borrower.notes.map((note) => <article key={note.id}><p>{note.body}</p><small>{note.author} · {relativeDate(note.created_at)}</small></article>)}</section>}{noteOpen && <form className="note-form" onSubmit={submitNote}><label>Internal note<textarea name="note" required maxLength={4000} rows={4} placeholder="Add context for the next conversation…" /></label><div><button type="button" className="secondary-button" onClick={() => setNoteOpen(false)}>Cancel</button><button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save note"}</button></div></form>}<div className="drawer-actions"><button className="primary-button" onClick={() => onStatus(borrower, "contacted")}>Mark contacted</button><button className="secondary-button" onClick={() => setNoteOpen(true)}>＋ Add note</button></div><p className="estimate-note">Affordability figures are educational estimates, not a prequalification, approval, or commitment to lend.</p></aside></div>;
}
