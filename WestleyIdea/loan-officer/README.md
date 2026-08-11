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

## CRM service

The portal reads and writes CRM records through the internal API. Configure these environment variables on the portal Container App:

- `API_UPSTREAM=http://api`
- `PORTAL_API_KEY=<high-entropy shared secret>`

Configure the same `PORTAL_API_KEY` value on the API Container App. The key is only sent by the portal server and must never be exposed through a `NEXT_PUBLIC_` variable or committed to the repository.

On first sign-in, a user creates an organization workspace. The API persists the organization, owner membership, loan-officer profile, branding record, and first tracked borrower link in Azure SQL. The dashboard then loads organization-scoped borrowers, links, scenarios, metrics, statuses, and notes from the database.

The next workflow milestone is connecting the borrower questionnaire completion to these borrower links so new submissions populate the portal automatically.

## Container

The container listens on port `8080` and is published by the `Loan Officer` GitHub Actions workflow as `mortgageai-loan-officer`.
