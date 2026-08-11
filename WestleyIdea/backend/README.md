# MortgageAI API

The shared FastAPI service for the borrower and loan-officer applications. The production image is published as `mortgageai-api` and listens on port `8080`.

## Database configuration

Set these non-secret environment variables on the API container and migration job:

```text
SQL_SERVER=server-name.database.windows.net
SQL_DATABASE=database-name
```

The container authenticates using Azure managed identity. For a user-assigned identity, also set `AZURE_CLIENT_ID` to that identity's client ID. Do not configure a SQL username or password.

## Portal service configuration

Set the same high-entropy secret on the API and loan-officer Container Apps:

```text
PORTAL_API_KEY=<random secret>
```

The portal uses this credential only for server-to-server requests inside the Container Apps environment. Browser requests never receive it. The API still derives organization access from the authenticated user's database membership on every CRM request.

## Migrations

Apply migrations once before starting a new API revision:

```bash
alembic upgrade head
```

Application startup never creates or changes tables. The API exposes `/api/health` for process health and `/api/health/database` for an explicit database connectivity check.

## Borrower proxy

The borrower image serves `/api` through an nginx reverse proxy. Configure its `API_UPSTREAM` environment variable with this API's origin, without a trailing slash.

Tracked borrower URLs use the public link endpoints under `/api/public/links/{slug}`. The API resolves the organization and loan officer from the stored link; the browser never supplies an organization ID. Consented submissions are idempotent by public reference and persist the questionnaire, three affordability scenarios, link attribution, activity, and audit records in one transaction.
