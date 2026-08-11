"use client";

import { FormEvent, useRef, useState } from "react";

import type { PortalUser } from "../lib/auth";

export function Onboarding({ user }: { user: PortalUser }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch("/api/crm/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_name: form.get("companyName"),
          nmls_id: form.get("nmlsId") || null,
          phone: form.get("phone") || null,
          branch_name: form.get("branchName") || null,
        }),
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setError(payload?.error || "Your workspace could not be created.");
        return;
      }
      window.location.reload();
    } catch {
      setError(controller.signal.aborted
        ? "Workspace setup timed out. Please try again."
        : "The Portal could not reach the CRM service. Please try again.");
    } finally {
      window.clearTimeout(timeout);
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <main className="onboarding-shell">
    <section className="onboarding-copy">
      <div className="brand onboarding-brand"><span className="brand-symbol"><i /></span><strong>Mortgage<span>AI</span></strong></div>
      <p className="eyebrow">WELCOME, {user.displayName.toUpperCase()}</p>
      <h1>Create your mortgage workspace.</h1>
      <span>Set up the company and loan-officer profile that will own your borrower links and incoming affordability submissions.</span>
      <div className="onboarding-points">
        <p><b>1</b><span><strong>Your company workspace</strong>Separates your borrowers, links, team, and branding from every other organization.</span></p>
        <p><b>2</b><span><strong>Your first borrower link</strong>We create a general-purpose link automatically so you can begin sharing immediately.</span></p>
        <p><b>3</b><span><strong>Your review queue</strong>Completed borrower questionnaires will appear in the portal for follow-up.</span></p>
      </div>
    </section>
    <form className="onboarding-form" onSubmit={submit}>
      <div><span>WORKSPACE SETUP</span><small>Signed in as {user.email}</small></div>
      <label>Company or team name<input name="companyName" required minLength={2} maxLength={200} autoComplete="organization" /></label>
      <label>Branch name <small>Optional</small><input name="branchName" maxLength={200} /></label>
      <div className="field-row">
        <label>NMLS ID <small>Optional</small><input name="nmlsId" maxLength={50} /></label>
        <label>Phone <small>Optional</small><input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={saving}>{saving ? "Creating workspace…" : "Create my workspace →"}</button>
      <p className="form-note">You will be the workspace owner. Team invitations and subscription setup can be added afterward.</p>
    </form>
  </main>;
}
