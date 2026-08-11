# MortgageAI API

The shared FastAPI service for the borrower and loan-officer applications. The production image is published as `mortgageai-api` and listens on port `8080`.

## Database configuration

Set these non-secret environment variables on the API container and migration job:

```text
SQL_SERVER=server-name.database.windows.net
SQL_DATABASE=database-name
```

The container authenticates using Azure managed identity. For a user-assigned identity, also set `AZURE_CLIENT_ID` to that identity's client ID. Do not configure a SQL username or password.

## Migrations

Apply migrations once before starting a new API revision:

```bash
alembic upgrade head
```

Application startup never creates or changes tables. The API exposes `/api/health` for process health and `/api/health/database` for an explicit database connectivity check.

## Borrower proxy

The borrower image serves `/api` through an nginx reverse proxy. Configure its `API_UPSTREAM` environment variable with this API's origin, without a trailing slash.
