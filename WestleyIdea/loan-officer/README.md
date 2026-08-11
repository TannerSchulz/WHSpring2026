# MortgageAI Loan Officer

The loan-officer workspace for reviewing borrower affordability submissions, managing shareable links, and organizing follow-up.

## Local development

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Validation

```bash
pnpm lint
pnpm build
```

## Authentication

Production authentication is handled by Azure Container Apps Easy Auth using the `externalid` OpenID Connect provider. The portal reads the verified `X-MS-CLIENT-PRINCIPAL-*` request headers on the server and refuses to render the dashboard when they are absent.

After signing in, `/api/auth/me` returns a safe summary of the current identity. Sign-out is handled by `/.auth/logout?post_logout_redirect_uri=/`.

For local development only, an identity can be supplied with `PORTAL_DEV_USER_ID`, `PORTAL_DEV_USER_EMAIL`, and `PORTAL_DEV_USER_NAME`. These values are ignored in production.

## Current scope

The workspace now consumes the authenticated portal identity, while borrower and link records are still realistic in-memory data. Database-backed organization onboarding and CRM records are the next integration milestone.

## Container

The container listens on port `8080` and is published by the `Loan Officer` GitHub Actions workflow as `mortgageai-loan-officer`.
