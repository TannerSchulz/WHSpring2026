# MortgageAI

MortgageAI is organized as separate product surfaces so each site can evolve and ship independently.

## Project structure

- `marketing/` — B2B sales site for loan officers and mortgage companies (Next.js)
- `borrower/` — borrower affordability questionnaire and results experience (React + Vite)
- `backend/` — FastAPI service used by the borrower app
- `Dockerfile` — production container for the borrower app and backend

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
