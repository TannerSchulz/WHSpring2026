# MortgageAI

MortgageAI is organized as separate product surfaces so each application can evolve and ship independently.

## Project structure

- `marketing/` — B2B sales site for loan officers and mortgage companies (Next.js)
- `borrower/` — borrower affordability questionnaire and results experience (React + Vite)
- `loan-officer/` — loan-officer workspace for borrower review, links, and follow-up (Next.js)
- `backend/` — shared FastAPI API, Azure SQL models, and Alembic migrations
- `borrower/Dockerfile` — static production borrower container
- `marketing/Dockerfile` — production marketing container
- `loan-officer/Dockerfile` — production loan-officer container
- `backend/Dockerfile` — production API container

## Local development

Run the marketing and loan-officer sites with `pnpm dev` from their respective directories. Run the borrower with `npm run dev` and the API with:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

The borrower development server proxies `/api` to `http://localhost:8000`.

## Production boundaries

The borrower and API are separate production images. The borrower container proxies `/api` requests to its runtime `API_UPSTREAM`; only the API container receives Azure SQL access. Apply Alembic migrations from the API image before starting a new API revision.

## Container images

GitHub Actions publishes these images to Azure Container Registry:

- `mortgageai-borrower`
- `mortgageai-api`
- `mortgageai-marketing`
- `mortgageai-loan-officer`

Pushes to `main` and `demo` publish versioned and branch-channel tags. The `Borrower`, `API`, and `Loan Officer` workflows stop after publishing images; Azure deployment is handled separately.
