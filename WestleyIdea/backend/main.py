import json
import os

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
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
            f"Know your numbers — your credit score is {data.credit_score}, DTI is {dti}%, and you have ${data.down_payment:,.0f} saved for a down payment",
            "Gather your documents: 2 years of tax returns, recent pay stubs, and 2–3 months of bank statements",
            "Get pre-approved with 2–3 lenders and compare their loan offers",
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
    return f"""You are a mortgage advisor AI. Analyze this application and give a direct, concise assessment.

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
  "summary": "1-2 sentences max. Be direct. Bold key numbers like **DTI: {dti:.1f}%** using markdown.",
  "details": ["short detail — bold the key number or factor", "short detail", "short detail"],
  "action_steps": ["step 1 (know their numbers — include credit score, DTI%, down payment)", "step 2 (gather documents — tax returns, pay stubs, bank statements)", "step 3 (get pre-approved — compare lenders)"],
  "estimated_monthly_payment": estimated monthly P&I payment as a number or null
}}

Always return exactly 3 action_steps following this structure: (1) know their numbers — credit score, DTI, down payment, (2) gather documents — tax returns, pay stubs, bank statements, (3) get pre-approved — compare lenders and apply. Personalize each step with their actual numbers. Be direct and brief. Bold the most important numbers."""


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
        "title": "Boost Your Credit Score",
        "explanation": "**Credit score** is the #1 factor lenders check — raising it 20–40 points can unlock better rates.",
        "checklist": [
            {"task": "Pay down credit card balances", "detail": "Keep utilization **below 30%** on each card — this has the biggest impact."},
            {"task": "Dispute errors on your report", "detail": "Check all 3 bureaus at **annualcreditreport.com** for mistakes."},
            {"task": "Don't open new credit accounts", "detail": "Each hard inquiry drops your score — hold off until after closing."},
            {"task": "Keep old accounts open", "detail": "Credit history length matters — don't close old cards."},
            {"task": "Set up autopay", "detail": "One missed payment can hurt badly — automate at least the minimum."},
        ],
        "documents": [
            "Credit reports from all 3 bureaus (annualcreditreport.com — free)",
            "List of open accounts and balances",
            "Dispute letters (if correcting errors)",
        ],
        "tips": [
            "**Credit Karma** gives free weekly score updates.",
            "Becoming an authorized user on a family member's old card can boost your score fast.",
            "Pay down the card **closest to its limit** first for the quickest gain.",
        ],
        "timeline": "3–6 months for meaningful improvement",
    },
    "dti": {
        "title": "Lower Your DTI Ratio",
        "explanation": "Lenders want your DTI **below 43%** — eliminate even one monthly payment to make a real impact.",
        "checklist": [
            {"task": "List all monthly debt payments", "detail": "Include car loans, student loans, credit card minimums, and any recurring obligations."},
            {"task": "Pay off the smallest debt first", "detail": "The snowball method removes a payment entirely — even **$200/mo** matters."},
            {"task": "Take on no new debt", "detail": "No car loans or credit card balances until after closing."},
            {"task": "Explore income-driven repayment for student loans", "detail": "An IDR plan can cut your required monthly payment and lower your DTI."},
            {"task": "Increase your income", "detail": "Freelance or part-time income helps — document all sources."},
        ],
        "documents": [
            "Statements for all loans and credit cards",
            "Pay stubs (last 30 days)",
            "Side income documentation (1099s, bank statements)",
        ],
        "tips": [
            "Lenders use your **minimum required payment**, not what you actually pay.",
            "A **large down payment** can sometimes offset a high DTI — ask your lender.",
            "A co-borrower with low debt can improve your combined DTI.",
        ],
        "timeline": "3–12 months; paying off one loan can help immediately",
    },
    "employment": {
        "title": "Strengthen Employment History",
        "explanation": "Lenders want **2 years** of stable employment — gaps or industry changes raise flags.",
        "checklist": [
            {"task": "Stay at your current job until closing", "detail": "Changing jobs during the process — even for more pay — can kill your approval."},
            {"task": "Document your employment history", "detail": "Gather **W-2s and pay stubs** for the past 2 years."},
            {"task": "Get an offer letter if you recently switched jobs", "detail": "A formal offer letter with salary and start date helps, especially in the same field."},
            {"task": "Be ready to explain any employment gaps", "detail": "School, medical leave, or caregiving are acceptable — have documentation ready."},
        ],
        "documents": [
            "W-2s (past 2 years)",
            "Pay stubs (last 30 days)",
            "Employment offer letter (if recently hired)",
            "2 years of tax returns (self-employed)",
        ],
        "tips": [
            "Job changes **within the same industry** are generally fine.",
            "**Commission/bonus income** needs a 2-year average to count.",
            "**FHA loans** are more flexible with shorter employment history.",
        ],
        "timeline": "May require up to 2 years at your current position",
    },
    "down": {
        "title": "Save a Larger Down Payment",
        "explanation": "More down = lower monthly payment and no **PMI** — but many loans accept as little as 3–5%.",
        "checklist": [
            {"task": "Open a high-yield savings account", "detail": "Keep savings separate — many online banks offer **4–5% APY**."},
            {"task": "Automate monthly transfers", "detail": "Move money on payday before you can spend it — even **$300–500/mo** adds up."},
            {"task": "Research down payment assistance programs", "detail": "Many states offer grants for first-time buyers — check **hud.gov**."},
            {"task": "Look into gift funds", "detail": "Family can gift your down payment — you'll need a gift letter."},
            {"task": "Budget for closing costs too", "detail": "Closing costs run **2–5% of the loan** — don't forget them."},
        ],
        "documents": [
            "Bank statements (last 2–3 months)",
            "Gift letter (if using family funds)",
            "Down payment assistance paperwork (if applicable)",
        ],
        "tips": [
            "**20% down** eliminates PMI, but it's not required.",
            "Ask HR — some employers offer **homebuyer assistance** as a benefit.",
            "First-time buyers can withdraw up to **$10,000 from a Roth IRA** penalty-free.",
        ],
        "timeline": "Varies — divide your savings gap by your monthly savings rate",
    },
    "pre-approv": {
        "title": "Get Pre-Approved",
        "explanation": "Pre-approval shows sellers you're serious and tells you **exactly how much you can borrow**.",
        "checklist": [
            {"task": "Gather your financial documents", "detail": "Have income, assets, employment, and ID ready — this speeds things up significantly."},
            {"task": "Apply with 2–3 lenders", "detail": "Multiple inquiries within **14–45 days** count as one credit hit — shop around."},
            {"task": "Compare Loan Estimates side by side", "detail": "Look at **APR** (not just rate) and closing costs — not just the interest rate."},
            {"task": "Don't borrow your maximum", "detail": "Approval for a large amount doesn't mean you should take it — stick to your budget."},
            {"task": "Make no major financial changes after pre-approval", "detail": "No new credit or big purchases — lenders may re-check right before closing."},
        ],
        "documents": [
            "Government-issued photo ID",
            "W-2s (past 2 years)",
            "Pay stubs (last 30 days)",
            "Tax returns (last 2 years)",
            "Bank statements (last 2–3 months)",
        ],
        "tips": [
            "**Credit unions** often beat big bank rates.",
            "A **mortgage broker** shops multiple lenders for you.",
            "Pre-approval letters expire in **60–90 days**.",
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

Give them concise, personalized help. Be direct — no fluff. Respond in this EXACT JSON format (no markdown):
{{
  "title": "Short title (4-6 words)",
  "explanation": "1 sentence. State the key fact and why it matters to them. Bold the most important number like **score: 590**.",
  "checklist": [
    {{"task": "Action item (start with a verb)", "detail": "1 sentence of specific guidance. Bold key numbers."}},
    {{"task": "...", "detail": "..."}},
    {{"task": "...", "detail": "..."}},
    {{"task": "...", "detail": "..."}},
    {{"task": "...", "detail": "..."}}
  ],
  "documents": ["document 1", "document 2", "document 3"],
  "tips": ["short tip — bold the key point", "tip 2", "tip 3"],
  "timeline": "X–Y months" (keep it brief)
}}

Use their exact numbers. Bold the most critical figures. Keep every field as short as possible."""

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


class MarketRatesInput(BaseModel):
    state_code: str
    state_name: str
    credit_score: int
    loan_type: str
    term_years: int = 30


class MarketRatesResponse(BaseModel):
    interest_rate: float
    property_tax_rate: float  # annual, as decimal e.g. 0.018
    avg_insurance_annual: int
    avg_hoa_monthly: int = 0
    avg_utilities_monthly: int = 0
    insights: str
    rate_reasoning: str = ""
    rate_source: str | None = None
    tax_source: str | None = None
    insurance_source: str | None = None
    hoa_source: str | None = None
    utilities_source: str | None = None
    demo_mode: bool = False


@app.post("/api/market-rates", response_model=MarketRatesResponse)
async def market_rates(data: MarketRatesInput):
    if ai_client:
        credit_tier = (
            "excellent (720+)" if data.credit_score >= 720
            else "good (680–719)" if data.credit_score >= 680
            else "fair (640–679)" if data.credit_score >= 640
            else "below average (<640)"
        )
        prompt = f"""You are a mortgage data expert. Provide CURRENT (as of early 2026) accurate estimates for a borrower in {data.state_name} ({data.state_code}).

BORROWER CREDIT SCORE: {data.credit_score} — {credit_tier}
LOAN TYPE: {data.loan_type.upper()}
LOAN TERM: {data.term_years} years

National 30yr average is ~6.65% (early 2026). Adjust for:
- Credit tier: excellent borrowers get ~0.25–0.5% below average; fair gets ~0.25–0.5% above
- VA/USDA loans typically run 0.1–0.25% below conventional; FHA is similar to conventional

For each value, provide a source citation ONLY if you know a real, specific source (e.g. "Freddie Mac PMMS", "Utah State Tax Commission", "Insurance Information Institute"). If no specific public source exists, use null.

Respond ONLY with this JSON (no markdown, no explanation):
{{
  "interest_rate": <float, e.g. 6.25>,
  "rate_reasoning": "<one short sentence: why this rate for this credit tier and loan type>",
  "rate_source": <string or null — real public source only, e.g. "Freddie Mac PMMS">,
  "property_tax_rate": <effective annual rate as decimal, e.g. 0.0057>,
  "tax_source": <string or null, e.g. "Utah State Tax Commission 2024">,
  "avg_insurance_annual": <integer dollars, e.g. 1100>,
  "insurance_source": <string or null, e.g. "Insurance Information Institute 2024">,
  "avg_hoa_monthly": <integer — typical HOA for this state's metro areas, 0 if mostly rural>,
  "hoa_source": <string or null>,
  "avg_utilities_monthly": <integer — avg monthly electric+gas+water for this state>,
  "utilities_source": <string or null, e.g. "U.S. Energy Information Administration 2024">,
  "insights": "<one sentence about what makes housing costs in this state notable>"
}}"""

        try:
            message = ai_client.messages.create(
                model="claude-opus-4-6",
                max_tokens=512,
                messages=[{"role": "user", "content": prompt}],
            )
            content = message.content[0].text.strip()
            ai_response = extract_json(content)
            return MarketRatesResponse(
                interest_rate=float(ai_response["interest_rate"]),
                property_tax_rate=float(ai_response["property_tax_rate"]),
                avg_insurance_annual=int(ai_response["avg_insurance_annual"]),
                avg_hoa_monthly=int(ai_response.get("avg_hoa_monthly", 0)),
                avg_utilities_monthly=int(ai_response.get("avg_utilities_monthly", 0)),
                insights=ai_response["insights"],
                rate_reasoning=ai_response.get("rate_reasoning", ""),
                rate_source=ai_response.get("rate_source") or None,
                tax_source=ai_response.get("tax_source") or None,
                insurance_source=ai_response.get("insurance_source") or None,
                hoa_source=ai_response.get("hoa_source") or None,
                utilities_source=ai_response.get("utilities_source") or None,
                demo_mode=False,
            )
        except Exception:
            pass

    return MarketRatesResponse(
        interest_rate=6.65 if data.term_years == 30 else 5.95,
        property_tax_rate=0.01,
        avg_insurance_annual=1500,
        avg_hoa_monthly=0,
        insights="AI unavailable — showing national averages. Enable the Anthropic API key for personalized state data.",
        demo_mode=True,
    )


class ChatMessage(BaseModel):
    role: str  # "user" or "assistant"
    content: str


class ChatInput(BaseModel):
    messages: list[ChatMessage]
    current_step: str
    user_profile: dict


class ChatResponse(BaseModel):
    response: str


@app.post("/api/chat", response_model=ChatResponse)
async def chat(data: ChatInput):
    if ai_client:
        profile = data.user_profile
        system_prompt = f"""You are a friendly, knowledgeable mortgage advisor helping a first-time home buyer work through their mortgage plan.

CURRENT STEP THE USER IS ON: {data.current_step}

USER FINANCIAL PROFILE:
- Annual Income: ${profile.get('annual_income', 0):,.0f}
- Monthly Debts: ${profile.get('monthly_debts', 0):,.0f}
- Credit Score: {profile.get('credit_score', 'unknown')}
- Down Payment: ${profile.get('down_payment', 0):,.0f}
- Home Price: ${profile.get('home_price', 0):,.0f}
- Employment: {profile.get('employment_years', 0)} years
- Loan Type: {profile.get('loan_type', 'conventional').upper()}

Keep responses short (2-4 sentences max). Be direct and personalized — use their actual numbers. No bullet points. Plain conversational text only."""

        try:
            message = ai_client.messages.create(
                model="claude-opus-4-6",
                max_tokens=300,
                system=system_prompt,
                messages=[{"role": m.role, "content": m.content} for m in data.messages],
            )
            return ChatResponse(response=message.content[0].text.strip())
        except Exception:
            pass

    # Fallback
    step = data.current_step.lower()
    if 'know your' in step or ('credit' in step and 'dti' in step):
        fallback = "Check annualcreditreport.com for your free credit report, then divide your total monthly debt payments by your gross monthly income to get your DTI. These two numbers are what every lender will look at first."
    elif 'gather' in step or 'document' in step or 'tax return' in step:
        fallback = "Your lender needs to verify your income and assets. Grab your last two tax returns from the IRS Get Transcript tool, your most recent pay stubs, and 2-3 months of bank statements — having these ready before you apply speeds things up significantly."
    elif 'pre-approv' in step or 'lender' in step or 'approv' in step:
        fallback = "Apply with at least 3 lenders within the same 45-day window so it only counts as one credit inquiry. Compare the APR on each Loan Estimate — not just the interest rate — since APR includes fees and gives you a true cost comparison."
    else:
        fallback = "I'm here to help! Ask me anything about your current step, what lenders look for, or what to expect next in the home-buying process."

    return ChatResponse(response=fallback)


@app.get("/api/health")
async def health():
    return {"status": "ok", "ai_enabled": ai_client is not None}


# Serve built React frontend in production
_static_dir = os.path.join(os.path.dirname(__file__), "static")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        return FileResponse(os.path.join(_static_dir, "index.html"))
