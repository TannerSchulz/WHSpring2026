"use client";

import { FormEvent, useState } from "react";

type FormState = "idle" | "submitting" | "success" | "error";

export function DemoForm() {
  const [state, setState] = useState<FormState>("idle");
  const [message, setMessage] = useState("");

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("submitting");
    setMessage("");

    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const response = await fetch("/api/demo-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as { error?: string };

      if (!response.ok) throw new Error(result.error ?? "We could not submit your request.");

      form.reset();
      setState("success");
      setMessage("Thanks—we received your request and will be in touch soon.");
    } catch (error) {
      setState("error");
      setMessage(error instanceof Error ? error.message : "We could not submit your request. Please try again.");
    }
  }

  return (
    <form className="demo-form" onSubmit={submitRequest}>
      <div className="form-heading"><span>REQUEST A PILOT</span><small>All fields marked * are required.</small></div>
      <div className="field-row">
        <label>First name *<input name="firstName" autoComplete="given-name" required /></label>
        <label>Last name *<input name="lastName" autoComplete="family-name" required /></label>
      </div>
      <label>Work email *<input name="email" type="email" autoComplete="email" required /></label>
      <label>Company *<input name="company" autoComplete="organization" required /></label>
      <div className="field-row">
        <label>Your role *
          <select name="role" required defaultValue="">
            <option value="" disabled>Select role</option>
            <option>Loan officer</option>
            <option>Branch manager</option>
            <option>Company owner</option>
            <option>Marketing or operations</option>
            <option>Other</option>
          </select>
        </label>
        <label>Team size *
          <select name="teamSize" required defaultValue="">
            <option value="" disabled>Select size</option>
            <option>Just me</option>
            <option>2–10 people</option>
            <option>11–50 people</option>
            <option>51+ people</option>
          </select>
        </label>
      </div>
      <label>What would you like to improve?<textarea name="message" rows={3} /></label>
      <label className="honey-field" aria-hidden="true">Website<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <button className="button button-primary submit-button" type="submit" disabled={state === "submitting"}>
        {state === "submitting" ? "Sending…" : "Request my pilot"}<span aria-hidden="true">→</span>
      </button>
      {message && <p className={`form-message ${state}`} role="status">{message}</p>}
      <p className="form-fineprint">By submitting, you agree that we may contact you about MortgageAI. We do not sell your contact information.</p>
    </form>
  );
}
