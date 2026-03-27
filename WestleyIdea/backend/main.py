import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

app = FastAPI(title="MortgageAI API")


def extract_json(text: str) -> dict:
    """Parse JSON from Claude's response, stripping any markdown code fences."""
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ``` wrappers
    if text.startswith("```"):
        text = text.split("```", 2)[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.rsplit("```", 1)[0].strip()
    return json.loads(text)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ai_client = None

if ANTHROPIC_API_KEY and ANTHROPIC_API_KEY.startswith("sk-ant-"):
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
            ai_response = extract_json(content)

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
        except Exception:
            # AI response parsing failed — fall back to rule-based
            pass

    # No API key or AI parse failure — use rule-based fallback

    # No API key or AI parse failure — use rule-based fallback
    result = rule_based_assessment(data)
    return AssessmentResponse(
        **result,
        dti_ratio=dti,
        ltv_ratio=ltv,
        demo_mode=True,
    )


class StepHelpInput(BaseModel):
    step_text: str
    user_profile: dict


class ChecklistItem(BaseModel):
    task: str
    detail: str


class StepHelpResponse(BaseModel):
    title: str
    explanation: str
    checklist: list[ChecklistItem]
    documents: list[str]
    tips: list[str]
    timeline: str
    demo_mode: bool = False


STEP_HELP_FALLBACKS = {
    "credit": {
        "title": "Improving Your Credit Score",
        "explanation": "Your credit score is one of the most important factors lenders consider. It reflects your history of repaying debts on time. Raising it even 20–40 points can unlock better loan terms and lower rates.",
        "checklist": [
            {"task": "Pay down revolving balances (credit cards)", "detail": "Aim to use less than 30% of your available credit limit on each card. This is called your credit utilization ratio and has a big impact on your score."},
            {"task": "Dispute errors on your credit report", "detail": "Get your free report at annualcreditreport.com and review all three bureaus (Equifax, Experian, TransUnion) for inaccurate accounts or late payments."},
            {"task": "Avoid opening new credit accounts", "detail": "Each hard inquiry can drop your score a few points. Hold off on applying for new credit cards, car loans, or any new lines of credit."},
            {"task": "Keep old accounts open", "detail": "The length of your credit history matters. Don't close old credit cards even if you're not using them."},
            {"task": "Set up autopay for all bills", "detail": "A single missed payment can drop your score significantly. Automate at least the minimum payment on all accounts."},
        ],
        "documents": [
            "Credit reports from all 3 bureaus (annualcreditreport.com — free once/year)",
            "List of all open accounts and balances",
            "Any dispute letters if correcting errors",
        ],
        "tips": [
            "Credit Karma and Experian offer free score monitoring with weekly updates.",
            "Becoming an authorized user on a family member's old, low-balance card can boost your score.",
            "Paying down the card closest to its limit first gives the quickest score bump.",
        ],
        "timeline": "3–6 months for meaningful improvement; 12+ months for major gains",
    },
    "dti": {
        "title": "Lowering Your Debt-to-Income Ratio",
        "explanation": "Your DTI ratio is your total monthly debt payments divided by your gross monthly income. Lenders use it to measure how much of your income is already committed to debt. Getting it below 43% (ideally below 36%) significantly improves your chances.",
        "checklist": [
            {"task": "List all monthly debt payments", "detail": "Include car loans, student loans, credit card minimums, personal loans, and any other recurring debt obligations."},
            {"task": "Pay off the smallest debt balance first", "detail": "The 'snowball' method eliminates a monthly payment entirely, immediately lowering your DTI. Even removing a $200/mo payment makes a real difference."},
            {"task": "Avoid taking on new debt", "detail": "No new car loans, furniture financing, or credit card balances until after you close on your home."},
            {"task": "Explore income-driven repayment for student loans", "detail": "If student loans are dragging up your DTI, an IDR plan can reduce your required monthly payment, lowering your DTI ratio."},
            {"task": "Look for ways to increase your income", "detail": "A part-time job, freelance work, or raise can improve your DTI from the income side. Document all income sources carefully."},
        ],
        "documents": [
            "Most recent statements for all loans and credit cards",
            "Pay stubs (last 30 days)",
            "Any side income documentation (1099s, bank statements)",
        ],
        "tips": [
            "Lenders use your minimum required payment, not what you actually pay, to calculate DTI.",
            "If you're close to the limit, ask your lender if they offer a higher DTI allowance with compensating factors like a large down payment or high credit score.",
            "A co-borrower with income but low debt can also help improve your combined DTI.",
        ],
        "timeline": "3–12 months depending on debt amounts; paying off one loan can help immediately",
    },
    "employment": {
        "title": "Building a Stronger Employment History",
        "explanation": "Lenders want to see stable, consistent income. Two years of employment history at the same job (or in the same field) shows you're a reliable borrower. Job-hopping within the same industry is usually fine — gaps or industry changes are what raise flags.",
        "checklist": [
            {"task": "Stay at your current job through the home purchase", "detail": "Changing jobs during the mortgage process — even for more money — can delay or kill your approval. Wait until after closing."},
            {"task": "Document your employment history accurately", "detail": "Gather W-2s and pay stubs for the past 2 years. Self-employed borrowers need 2 years of tax returns showing consistent income."},
            {"task": "Get an offer letter if you recently changed jobs", "detail": "If you switched jobs in the last 6 months, a formal offer letter with your salary and start date can help your case, especially if it's in the same field."},
            {"task": "Track any gaps in employment", "detail": "Be prepared to explain gaps. Lenders will ask. School, medical leave, or caregiving are generally acceptable explanations with documentation."},
        ],
        "documents": [
            "W-2s for the past 2 years",
            "Pay stubs (most recent 30 days)",
            "Employment offer letter (if recently hired)",
            "2 years of federal tax returns (self-employed)",
            "Explanation letter for any employment gaps",
        ],
        "tips": [
            "Switching from hourly to salaried (or vice versa) in the same company is usually fine.",
            "Commission or bonus income typically requires a 2-year average to be counted by lenders.",
            "FHA loans can be more flexible with shorter employment history than conventional loans.",
        ],
        "timeline": "You may need to wait until you accumulate 2 years at your current position",
    },
    "down": {
        "title": "Saving a Larger Down Payment",
        "explanation": "Your down payment directly affects your loan amount, monthly payment, and whether you'll need to pay private mortgage insurance (PMI). Saving more upfront is one of the most reliable ways to improve your mortgage terms.",
        "checklist": [
            {"task": "Open a dedicated high-yield savings account", "detail": "Keep your down payment savings separate so you're not tempted to spend it. Many online banks offer 4–5% APY."},
            {"task": "Automate monthly transfers to your savings account", "detail": "Set a recurring transfer on payday so the money moves before you can spend it. Even $300–500/month adds up."},
            {"task": "Research down payment assistance programs", "detail": "Many states and counties offer grants or low-interest loans for first-time buyers. Utah has several — search the HUD website for local programs."},
            {"task": "Look into gift funds", "detail": "Most loan programs allow down payment funds to be gifted by a family member. You'll need a gift letter stating the money doesn't need to be repaid."},
            {"task": "Calculate how much you actually need", "detail": "Remember to budget for closing costs (2–5% of loan amount) in addition to your down payment. Underestimating is a common mistake."},
        ],
        "documents": [
            "Bank statements (last 2–3 months) showing savings",
            "Gift letter (if receiving funds from family)",
            "Down payment assistance program documentation (if applicable)",
        ],
        "tips": [
            "20% down eliminates PMI, but you don't need it — many loans accept 3–5%.",
            "Some employers offer homebuyer assistance as a benefit — worth asking HR.",
            "A Roth IRA allows first-time homebuyers to withdraw up to $10,000 penalty-free for a home purchase.",
        ],
        "timeline": "Varies — calculate your gap and divide by your monthly savings rate",
    },
    "pre-approv": {
        "title": "Getting Pre-Approved for a Mortgage",
        "explanation": "A pre-approval letter shows sellers you're a serious buyer and tells you exactly how much you can borrow. It's different from pre-qualification — pre-approval involves verifying your actual income and credit, making it much more meaningful.",
        "checklist": [
            {"task": "Gather your financial documents", "detail": "Lenders will ask for proof of income, assets, employment, and identity. Having these ready speeds up the process significantly."},
            {"task": "Apply with 2–3 lenders", "detail": "Shopping multiple lenders lets you compare rates and fees. Multiple mortgage inquiries within 14–45 days typically count as a single credit hit."},
            {"task": "Review the Loan Estimate carefully", "detail": "Each lender must give you a Loan Estimate within 3 days. Compare APR (not just rate), closing costs, and loan terms side by side."},
            {"task": "Understand your pre-approval limits", "detail": "Just because you're approved for a certain amount doesn't mean you should borrow that much. Make sure the monthly payment fits your actual budget."},
            {"task": "Don't make major financial changes after pre-approval", "detail": "No new credit, big purchases, or job changes. Lenders may re-pull your credit right before closing."},
        ],
        "documents": [
            "Government-issued photo ID",
            "Social Security number",
            "W-2s for the past 2 years",
            "Pay stubs (last 30 days)",
            "Federal tax returns (last 2 years)",
            "Bank and investment account statements (last 2–3 months)",
            "List of all monthly debt payments",
        ],
        "tips": [
            "Credit unions and community banks often offer more competitive rates than big banks.",
            "A mortgage broker shops multiple lenders for you — useful if your situation is non-standard.",
            "Pre-approval letters typically expire in 60–90 days.",
        ],
        "timeline": "1–5 business days once documents are submitted",
    },
}


def fallback_step_help(step_text: str) -> dict:
    step_lower = step_text.lower()
    for keyword, data in STEP_HELP_FALLBACKS.items():
        if keyword in step_lower:
            return data
    # Generic fallback
    return {
        "title": "Taking This Next Step",
        "explanation": f"Here's a guide to help you work through this step: {step_text}",
        "checklist": [
            {"task": "Research what's required", "detail": "Start by understanding exactly what lenders look for regarding this specific factor."},
            {"task": "Consult a HUD-approved housing counselor", "detail": "Free counseling is available at hud.gov/counseling — they can give you personalized, unbiased advice."},
            {"task": "Set a measurable goal and timeline", "detail": "Break this step into concrete monthly targets so you can track progress."},
        ],
        "documents": ["Any statements or paperwork relevant to this area of your finances"],
        "tips": ["Don't hesitate to ask your lender directly what they need to see for this specific factor."],
        "timeline": "Varies — speak with a mortgage advisor for a personalized estimate",
    }


@app.post("/api/step-help", response_model=StepHelpResponse)
async def step_help(data: StepHelpInput):
    if ai_client:
        profile = data.user_profile
        prompt = f"""You are a helpful mortgage advisor. A user is working on this specific next step for their mortgage journey:

STEP: {data.step_text}

USER PROFILE:
- Annual Income: ${profile.get('annual_income', 0):,.0f}
- Monthly Debts: ${profile.get('monthly_debts', 0):,.0f}
- Credit Score: {profile.get('credit_score', 'unknown')}
- Down Payment: ${profile.get('down_payment', 0):,.0f}
- Home Price: ${profile.get('home_price', 0):,.0f}
- Employment: {profile.get('employment_years', 0)} years
- Loan Type: {profile.get('loan_type', 'conventional').upper()}

Give them personalized, actionable help to complete this step. Respond in this EXACT JSON format (no markdown):
{{
  "title": "Short title for this help guide",
  "explanation": "2-3 sentences explaining why this step matters and how it applies to their specific situation",
  "checklist": [
    {{"task": "Concrete action item", "detail": "1-2 sentences of specific guidance"}},
    {{"task": "...", "detail": "..."}},
    {{"task": "...", "detail": "..."}},
    {{"task": "...", "detail": "..."}},
    {{"task": "...", "detail": "..."}}
  ],
  "documents": ["document or resource 1", "document or resource 2", "document or resource 3"],
  "tips": ["insider tip 1", "insider tip 2", "insider tip 3"],
  "timeline": "realistic timeframe to complete this step"
}}

Be specific to their numbers. If their credit score is 590, mention 590. Make it feel personalized."""

        try:
            message = ai_client.messages.create(
                model="claude-opus-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}],
            )
            content = message.content[0].text.strip()
            ai_response = extract_json(content)
            return StepHelpResponse(
                title=ai_response["title"],
                explanation=ai_response["explanation"],
                checklist=[ChecklistItem(**item) for item in ai_response["checklist"]],
                documents=ai_response["documents"],
                tips=ai_response["tips"],
                timeline=ai_response["timeline"],
                demo_mode=False,
            )
        except Exception:
            pass  # fall through to rule-based fallback below

    result = fallback_step_help(data.step_text)
    return StepHelpResponse(
        title=result["title"],
        explanation=result["explanation"],
        checklist=[ChecklistItem(**item) for item in result["checklist"]],
        documents=result["documents"],
        tips=result["tips"],
        timeline=result["timeline"],
        demo_mode=True,
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "ai_enabled": ai_client is not None}
