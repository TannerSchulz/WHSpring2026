import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="MortgageAI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ai_client = None

if ANTHROPIC_API_KEY:
    import anthropic
    ai_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


class MortgageInput(BaseModel):
    annual_income: float
    monthly_debts: float
    credit_score: int
    down_payment: float
    home_price: float
    employment_years: float
    loan_type: str  # "conventional", "fha", "va", "usda"


class AssessmentResponse(BaseModel):
    qualifies: bool
    summary: str
    details: list[str]
    action_steps: list[str]
    estimated_monthly_payment: float | None
    dti_ratio: float
    ltv_ratio: float
    demo_mode: bool = False


def calc_metrics(data: MortgageInput) -> tuple[float, float, float]:
    loan_amount = data.home_price - data.down_payment
    monthly_payment_estimate = loan_amount * 0.006  # rough P&I at ~7%
    dti = (data.monthly_debts + monthly_payment_estimate) / (data.annual_income / 12) * 100
    ltv = (loan_amount / data.home_price) * 100 if data.home_price > 0 else 0
    return round(loan_amount, 2), round(dti, 1), round(ltv, 1)


def rule_based_assessment(data: MortgageInput) -> dict:
    """Fallback assessment using standard mortgage qualification rules."""
    loan_amount, dti, ltv = calc_metrics(data)
    issues = []
    steps = []

    # Credit score thresholds by loan type
    min_credit = {"conventional": 620, "fha": 580, "va": 580, "usda": 640}
    max_dti = {"conventional": 43, "fha": 43, "va": 41, "usda": 41}
    loan_name = data.loan_type.upper()

    credit_ok = data.credit_score >= min_credit.get(data.loan_type, 620)
    dti_ok = dti <= max_dti.get(data.loan_type, 43)
    employment_ok = data.employment_years >= 2
    down_ok = data.loan_type in ("va", "usda") or (data.down_payment / data.home_price >= 0.03 if data.home_price > 0 else False)

    if not credit_ok:
        gap = min_credit.get(data.loan_type, 620) - data.credit_score
        issues.append(f"Credit score {data.credit_score} is below the {loan_name} minimum of {min_credit.get(data.loan_type, 620)}")
        steps.append(f"Raise your credit score by at least {gap} points — pay down revolving balances and avoid new hard inquiries")

    if not dti_ok:
        issues.append(f"Debt-to-income ratio of {dti}% exceeds the {loan_name} limit of {max_dti.get(data.loan_type, 43)}%")
        steps.append("Reduce monthly debt payments (pay off a car loan or credit cards) or increase income before applying")

    if not employment_ok:
        issues.append(f"Employment history of {data.employment_years} years is below the preferred 2-year minimum")
        steps.append("Wait until you have at least 2 years of steady employment history at your current job or in the same field")

    if not down_ok:
        min_down_pct = 3.5 if data.loan_type == "fha" else 3
        min_down = data.home_price * (min_down_pct / 100)
        issues.append(f"Down payment of ${data.down_payment:,.0f} is below the {min_down_pct}% minimum (${min_down:,.0f})")
        steps.append(f"Save an additional ${min_down - data.down_payment:,.0f} to meet the minimum down payment requirement")

    qualifies = credit_ok and dti_ok and employment_ok and down_ok

    if qualifies:
        summary = (
            f"Based on your profile, you appear to meet the basic {loan_name} qualification criteria. "
            f"Your credit score of {data.credit_score} and DTI of {dti}% are within acceptable ranges. "
            "We recommend getting pre-approved with a lender to confirm."
        )
        steps = [
            "Get pre-approved with 2-3 lenders to compare rates",
            "Gather documents: 2 years of tax returns, recent pay stubs, and bank statements",
            "Avoid opening new credit accounts or making large purchases before closing",
        ]
    else:
        summary = (
            f"Your profile doesn't quite meet {loan_name} requirements yet, but that's okay — "
            f"many people need to make a few adjustments before qualifying. "
            "Here's what to focus on:"
        )

    monthly_payment = round(loan_amount * 0.006) if loan_amount > 0 else None

    return {
        "qualifies": qualifies,
        "summary": summary,
        "details": issues if issues else [
            f"Credit score: {data.credit_score} ✓",
            f"DTI ratio: {dti}% ✓",
            f"Employment: {data.employment_years} years ✓",
        ],
        "action_steps": steps,
        "estimated_monthly_payment": monthly_payment,
    }


def build_prompt(data: MortgageInput, loan_amount: float, dti: float, ltv: float) -> str:
    return f"""You are a helpful mortgage advisor AI. Analyze this mortgage application and provide a clear, friendly assessment.

APPLICANT FINANCIAL PROFILE:
- Annual Income: ${data.annual_income:,.0f}
- Monthly Debts (existing): ${data.monthly_debts:,.0f}
- Credit Score: {data.credit_score}
- Down Payment: ${data.down_payment:,.0f}
- Home Price: ${data.home_price:,.0f}
- Loan Amount: ${loan_amount:,.0f}
- Employment History: {data.employment_years} years
- Loan Type Requested: {data.loan_type.upper()}
- Calculated DTI (with estimated mortgage): {dti:.1f}%
- Loan-to-Value Ratio: {ltv:.1f}%

QUALIFICATION GUIDELINES BY LOAN TYPE:
- Conventional: Credit 620+, DTI <43%, Down 3%+, LTV <97%
- FHA: Credit 580+ (3.5% down) or 500-579 (10% down), DTI <43%
- VA: No min credit (lenders prefer 620+), DTI <41%, No down payment required
- USDA: Credit 640+, DTI <41%, No down payment required, rural areas only

Please respond in this EXACT JSON format (no markdown, just raw JSON):
{{
  "qualifies": true or false,
  "summary": "2-3 sentence friendly summary of their situation",
  "details": ["detail point 1", "detail point 2", "detail point 3"],
  "action_steps": ["step 1", "step 2", "step 3"],
  "estimated_monthly_payment": estimated monthly P&I payment as a number or null
}}

Be encouraging but honest. If they don't qualify, focus on actionable steps they can take."""


@app.post("/api/assess", response_model=AssessmentResponse)
async def assess_mortgage(data: MortgageInput):
    loan_amount, dti, ltv = calc_metrics(data)

    if ai_client:
        try:
            message = ai_client.messages.create(
                model="claude-opus-4-6",
                max_tokens=1024,
                messages=[{"role": "user", "content": build_prompt(data, loan_amount, dti, ltv)}],
            )
            content = message.content[0].text.strip()
            ai_response = json.loads(content)

            return AssessmentResponse(
                qualifies=ai_response["qualifies"],
                summary=ai_response["summary"],
                details=ai_response["details"],
                action_steps=ai_response["action_steps"],
                estimated_monthly_payment=ai_response.get("estimated_monthly_payment"),
                dti_ratio=dti,
                ltv_ratio=ltv,
                demo_mode=False,
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    # No API key — use rule-based fallback
    result = rule_based_assessment(data)
    return AssessmentResponse(
        **result,
        dti_ratio=dti,
        ltv_ratio=ltv,
        demo_mode=True,
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "ai_enabled": ai_client is not None}
