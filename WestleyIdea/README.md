# MortgageAI

MortgageAI is organized as separate product surfaces so each site can evolve and ship independently.

## Project structure

- `loan-officer/` — loan-officer workspace for borrower review, links, and follow-up (Next.js)

- `marketing/` — B2B sales site for loan officers and mortgage companies (Next.js)
- `borrower/` — borrower affordability questionnaire and results experience (React + Vite)
- `backend/` — FastAPI service used by the borrower app
- `borrower/Dockerfile` — production container for the borrower app and backend
- `marketing/Dockerfile` — production container for the marketing site

## Marketing site

```bash
cd marketing
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Borrower app

```bash
cd borrower
npm install
npm run dev
```

Open `http://localhost:5173`.

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend also serves the compiled borrower app from its `static` directory in the production container.

## GitHub Actions and Azure

The `Loan Officer` workflow builds and pushes `mortgageai-loan-officer` to Azure Container Registry. It intentionally does not deploy a Container App.

The `Borrower` and `Marketing` workflows build separate images in Azure Container Registry:

- `mortgageai-borrower`
- `mortgageai-marketing`

Pushes to `main` and `demo` publish versioned and branch-channel image tags. Pushes to `demo` also update the corresponding Azure Container App.

Both workflows use the existing `ACR_*` and `AZURE_*` secrets. Configure these repository variables for the separate Container Apps:

- `AZURE_BORROWER_CONTAINER_APP_NAME` (falls back to the existing `AZURE_CONTAINER_APP_NAME`)
- `AZURE_MARKETING_CONTAINER_APP_NAME`
- `AZURE_RESOURCE_GROUP`, or the optional app-specific `AZURE_BORROWER_RESOURCE_GROUP` and `AZURE_MARKETING_RESOURCE_GROUP`
