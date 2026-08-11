from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlalchemy import select, true, update
from sqlalchemy.orm import Session

from .database import get_session
from .models import (
    AffordabilityScenario,
    AuditEvent,
    BorrowerLink,
    BorrowerSubmission,
    BrandingSettings,
    LeadActivity,
    LoanOfficerProfile,
    Organization,
    OrganizationMembership,
    User,
)


router = APIRouter(prefix="/api/public", tags=["public borrower workflow"])
CONSENT_TEXT_VERSION = "borrower-crm-v1"


class ScenarioCreate(BaseModel):
    label: Literal["low", "average", "stretch"]
    target_income_ratio: Decimal = Field(ge=Decimal("0.10"), le=Decimal("0.75"))
    home_price: Decimal = Field(ge=0, le=100_000_000)
    monthly_payment: Decimal = Field(ge=0, le=10_000_000)
    principal_and_interest: Decimal = Field(ge=0, le=10_000_000)
    property_tax: Decimal = Field(ge=0, le=1_000_000)
    homeowners_insurance: Decimal = Field(ge=0, le=1_000_000)
    pmi: Decimal | None = Field(default=None, ge=0, le=1_000_000)
    interest_rate: Decimal = Field(ge=0, le=25)
    assumptions: dict | None = None


class SubmissionCreate(BaseModel):
    submission_reference: UUID
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=3, max_length=320)
    phone: str | None = Field(default=None, max_length=40)
    state: str = Field(min_length=2, max_length=2)
    county: str = Field(min_length=1, max_length=150)
    employment_path: Literal["employment", "specialized_schooling"]
    employment_years: int | None = Field(default=None, ge=0, le=100)
    annual_income: Decimal | None = Field(default=None, gt=0, le=100_000_000)
    schooling_program: str | None = Field(default=None, max_length=200)
    graduation_date: date | None = None
    gpa: Decimal | None = Field(default=None, ge=0, le=4)
    expected_income: Decimal | None = Field(default=None, gt=0, le=100_000_000)
    credit_range: Literal["500-580", "580-620", "620-660", "660+"]
    monthly_debts: Decimal = Field(ge=0, le=10_000_000)
    available_funds: Decimal = Field(ge=0, le=100_000_000)
    loan_type: Literal["conventional", "fha", "va", "usda"]
    consent: bool
    scenarios: list[ScenarioCreate] = Field(min_length=3, max_length=3)
    website: str | None = Field(default=None, max_length=200)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        local, separator, domain = normalized.partition("@")
        if not separator or not local or "." not in domain:
            raise ValueError("A valid email address is required")
        return normalized

    @field_validator("first_name", "last_name", "county")
    @classmethod
    def trim_required_text(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Value cannot be blank")
        return normalized

    @field_validator("phone", "schooling_program")
    @classmethod
    def trim_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip() or None

    @field_validator("state")
    @classmethod
    def normalize_state(cls, value: str) -> str:
        normalized = value.strip().upper()
        if not normalized.isalpha():
            raise ValueError("State must be a two-letter code")
        return normalized

    @model_validator(mode="after")
    def validate_workflow(self):
        if not self.consent:
            raise ValueError("Consent is required to share this questionnaire")
        if self.website:
            raise ValueError("Submission could not be accepted")
        if {scenario.label for scenario in self.scenarios} != {"low", "average", "stretch"}:
            raise ValueError("Low, average, and stretch scenarios are required")
        if self.employment_path == "employment":
            if self.employment_years is None or self.annual_income is None:
                raise ValueError("Employment years and annual income are required")
        elif not all((self.schooling_program, self.graduation_date, self.gpa is not None, self.expected_income)):
            raise ValueError("Specialized schooling details and expected income are required")
        return self


def active_link_query(slug: str):
    return (
        select(
            BorrowerLink,
            LoanOfficerProfile,
            OrganizationMembership,
            User,
            Organization,
            BrandingSettings,
        )
        .join(LoanOfficerProfile, LoanOfficerProfile.id == BorrowerLink.loan_officer_profile_id)
        .join(OrganizationMembership, OrganizationMembership.id == LoanOfficerProfile.membership_id)
        .join(User, User.id == OrganizationMembership.user_id)
        .join(Organization, Organization.id == BorrowerLink.organization_id)
        .outerjoin(BrandingSettings, BrandingSettings.organization_id == Organization.id)
        .where(
            BorrowerLink.slug == slug,
            BorrowerLink.is_active == true(),
            Organization.status == "active",
            OrganizationMembership.status == "active",
            User.status == "active",
        )
    )


def get_active_link(db: Session, slug: str):
    normalized = slug.strip().strip("/").lower()
    if not normalized or len(normalized) > 160:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower link was not found")

    rows = db.execute(active_link_query(normalized).limit(2)).all()
    if len(rows) != 1:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower link was not found")

    link = rows[0][0]
    if link.expires_at:
        expires_at = link.expires_at
        now = datetime.now(expires_at.tzinfo) if expires_at.tzinfo else datetime.now()
        if expires_at <= now:
            raise HTTPException(status_code=status.HTTP_410_GONE, detail="Borrower link has expired")
    return rows[0]


def public_link_payload(row) -> dict:
    link, profile, _, user, organization, branding = row
    return {
        "slug": link.slug,
        "name": link.name,
        "source": link.source,
        "branding": {
            "companyName": branding.company_display_name if branding else organization.name,
            "logoDataUrl": branding.logo_asset_key if branding else None,
            "officerName": user.display_name,
            "officerTitle": profile.title or "Loan Officer",
            "officerPhotoDataUrl": None,
            "primaryColor": branding.primary_color if branding else "#103d37",
            "accentColor": branding.secondary_color if branding else "#d9f36f",
            "phone": profile.phone or "",
            "email": user.email,
            "website": "",
            "nmlsId": profile.nmls_id or "",
        },
    }


@router.get("/links/{slug:path}")
def public_link(slug: str, db: Session = Depends(get_session), record_visit: bool = Query(default=True)):
    row = get_active_link(db, slug)
    link = row[0]
    if record_visit:
        db.execute(
            update(BorrowerLink)
            .where(BorrowerLink.id == link.id)
            .values(visit_count=BorrowerLink.visit_count + 1)
        )
        db.commit()
    return public_link_payload(row)


@router.post("/links/{slug:path}/submissions", status_code=status.HTTP_201_CREATED)
def create_public_submission(slug: str, payload: SubmissionCreate, db: Session = Depends(get_session)):
    row = get_active_link(db, slug)
    link, profile, _, _, organization, _ = row

    existing = db.scalar(
        select(BorrowerSubmission).where(BorrowerSubmission.public_reference == payload.submission_reference)
    )
    if existing:
        if existing.borrower_link_id != link.id:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission reference is already in use")
        return {"reference": str(existing.public_reference), "status": existing.status, "created": False}

    schooling = payload.employment_path == "specialized_schooling"
    submission = BorrowerSubmission(
        organization_id=organization.id,
        borrower_link_id=link.id,
        assigned_loan_officer_id=profile.id,
        public_reference=payload.submission_reference,
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        phone=payload.phone,
        state=payload.state,
        county=payload.county,
        employment_path=payload.employment_path,
        employment_years=None if schooling else payload.employment_years,
        annual_income=None if schooling else payload.annual_income,
        schooling_program=payload.schooling_program if schooling else None,
        graduation_date=payload.graduation_date if schooling else None,
        gpa=payload.gpa if schooling else None,
        expected_income=payload.expected_income if schooling else None,
        credit_range=payload.credit_range,
        monthly_debts=payload.monthly_debts,
        available_funds=payload.available_funds,
        consent_at=datetime.now(timezone.utc),
        consent_text_version=CONSENT_TEXT_VERSION,
        raw_answers={
            "loan_type": payload.loan_type,
            "source": link.source,
            "consent": True,
        },
        status="new",
    )
    db.add(submission)
    db.flush()

    for scenario in payload.scenarios:
        db.add(AffordabilityScenario(
            borrower_submission_id=submission.id,
            label=scenario.label,
            target_income_ratio=scenario.target_income_ratio,
            home_price=scenario.home_price,
            monthly_payment=scenario.monthly_payment,
            principal_and_interest=scenario.principal_and_interest,
            property_tax=scenario.property_tax,
            homeowners_insurance=scenario.homeowners_insurance,
            pmi=scenario.pmi,
            interest_rate=scenario.interest_rate,
            assumptions=scenario.assumptions,
        ))

    db.add(LeadActivity(
        organization_id=organization.id,
        borrower_submission_id=submission.id,
        activity_type="submission.created",
        to_status="new",
        details={"borrower_link_id": str(link.id), "source": link.source},
    ))
    db.add(AuditEvent(
        organization_id=organization.id,
        event_type="borrower.submitted",
        entity_type="borrower_submission",
        entity_id=submission.id,
        event_data={"borrower_link_id": str(link.id), "consent_text_version": CONSENT_TEXT_VERSION},
    ))
    db.execute(
        update(BorrowerLink)
        .where(BorrowerLink.id == link.id)
        .values(submission_count=BorrowerLink.submission_count + 1)
    )
    db.commit()
    return {"reference": str(submission.public_reference), "status": submission.status, "created": True}
