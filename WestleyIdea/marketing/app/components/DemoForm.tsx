export function DemoForm() {
  return (
    <div className="demo-form" aria-label="Pilot request form preview">
      <div className="form-heading"><span>REQUEST A PILOT</span><small>Form preview</small></div>
      <div className="field-row">
        <label>First name<input name="firstName" autoComplete="given-name" /></label>
        <label>Last name<input name="lastName" autoComplete="family-name" /></label>
      </div>
      <label>Work email<input name="email" type="email" autoComplete="email" /></label>
      <label>Company<input name="company" autoComplete="organization" /></label>
      <div className="field-row">
        <label>Your role
          <select name="role" defaultValue="">
            <option value="" disabled>Select role</option>
            <option>Loan officer</option>
            <option>Branch manager</option>
            <option>Company owner</option>
            <option>Marketing or operations</option>
            <option>Other</option>
          </select>
        </label>
        <label>Team size
          <select name="teamSize" defaultValue="">
            <option value="" disabled>Select size</option>
            <option>Just me</option>
            <option>2–10 people</option>
            <option>11–50 people</option>
            <option>51+ people</option>
          </select>
        </label>
      </div>
      <label>What would you like to improve?<textarea name="message" rows={3} /></label>
      <button className="button button-primary submit-button" type="button" disabled>
        Request form coming soon<span aria-hidden="true">→</span>
      </button>
      <p className="form-message preview" role="note">Preview only. Information entered here stays in this browser tab and is never submitted or stored.</p>
    </div>
  );
}
