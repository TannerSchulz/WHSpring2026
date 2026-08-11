import { Dashboard } from "./components/Dashboard";
import { getPortalUser } from "./lib/auth";

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

  return <Dashboard user={user} />;
}
