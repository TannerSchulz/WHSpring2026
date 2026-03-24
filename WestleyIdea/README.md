# MortgageAI

AI-powered mortgage qualification tool. Enter your financial info and get an instant assessment of whether you qualify — and personalized steps to improve your chances if you don't.

## Stack

- **Frontend**: React + TypeScript (Vite)
- **Backend**: Python FastAPI
- **AI**: Claude (Anthropic) for qualification analysis

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env       # Add your ANTHROPIC_API_KEY
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## How It Works

1. User enters income, debts, credit score, down payment, home price, and loan type
2. Backend calculates DTI and LTV ratios
3. Claude analyzes the profile against real mortgage guidelines (Conventional, FHA, VA, USDA)
4. Returns a qualification verdict + personalized action steps
