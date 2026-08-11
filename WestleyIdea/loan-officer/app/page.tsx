import Link from "next/link";

import { Dashboard } from "./components/Dashboard";
import { Onboarding } from "./components/Onboarding";
import { getPortalUser } from "./lib/auth";
import type { DashboardData, PortalSession } from "./lib/crm-types";
import { PortalApiError, portalApi } from "./lib/portal-api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getPortalUser();

  if (!user) {
    return (
      <main className="auth-error-shell">
        <section className="auth-error-card">
          <span className="brand-symbol"><i /></span>
          <p>PORTAL ACCESS</p>
          <h1>We could not verify your account.</h1>
          <span>
            Authentication completed without a verified identity reaching MortgageAI. Sign out and try again,
            or ask your administrator to review the Container App authentication configuration.
          </span>
          <a href="/.auth/logout?post_logout_redirect_uri=/">Sign out and retry</a>
        </section>
      </main>
    );
  }

  let session: PortalSession | null = null;
  let dashboard: DashboardData | null = null;
  let serviceError = "";
  try {
    session = await portalApi<PortalSession>("/session", user, { method: "POST" });
    if (!session.onboarding_required) dashboard = await portalApi<DashboardData>("/dashboard", user);
  } catch (error) {
    serviceError = error instanceof PortalApiError ? error.message : "The CRM service is temporarily unavailable.";
  }

  if (serviceError || !session) return (
    <main className="auth-error-shell">
      <section className="auth-error-card">
        <span className="brand-symbol"><i /></span>
        <p>WORKSPACE UNAVAILABLE</p>
        <h1>We could not load your workspace.</h1>
        <span>{serviceError} Please try again after the service configuration has been checked.</span>
        <Link href="/">Try again</Link>
      </section>
    </main>
  );

  if (session.onboarding_required) return <Onboarding user={user} />;
  if (dashboard) return <Dashboard user={user} initialData={dashboard} />;

  return null;
}
