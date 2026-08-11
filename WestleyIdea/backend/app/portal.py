from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import re
import secrets
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .config import get_portal_settings
from .database import get_session
from .models import (
    AffordabilityScenario,
    AuditEvent,
    BorrowerLink,
    BorrowerNote,
    BorrowerSubmission,
    BrandingSettings,
    LeadActivity,
    LoanOfficerProfile,
    Organization,
    OrganizationMembership,
    User,
)


router = APIRouter(prefix="/api/portal", tags=["portal"])
DbSession = Annotated[Session, Depends(get_session)]


@dataclass(frozen=True)
class PortalIdentity:
    subject: str
    email: str
    display_name: str
    provider: str

    @property
    def external_subject(self) -> str:
        return f"{self.provider}:{self.subject}"[:255]


def require_portal_identity(
    api_key: Annotated[str | None, Header(alias="X-Portal-Api-Key")] = None,
    subject: Annotated[str | None, Header(alias="X-Portal-Subject")] = None,
    email: Annotated[str | None, Header(alias="X-Portal-Email")] = None,
    display_name: Annotated[str | None, Header(alias="X-Portal-Name")] = None,
    provider: Annotated[str | None, Header(alias="X-Portal-Provider")] = None,
) -> PortalIdentity:
    try:
        expected_key = get_portal_settings().require_api_key()
    except RuntimeError as error:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Portal API is not configured") from error

    if not api_key or not secrets.compare_digest(api_key, expected_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid portal service credential")
    if not subject or not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verified portal identity is incomplete")

    normalized_email = email.strip().lower()
    if len(subject) > 220 or len(normalized_email) > 320 or "@" not in normalized_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verified portal identity is invalid")

    return PortalIdentity(
        subject=subject.strip(),
        email=normalized_email,
        display_name=(display_name or normalized_email).strip()[:200],
        provider=(provider or "externalid").strip()[:30],
    )


Identity = Annotated[PortalIdentity, Depends(require_portal_identity)]


class OrganizationCreate(BaseModel):
    company_name: str = Field(min_length=2, max_length=200)
    nmls_id: str | None = Field(default=None, max_length=50)
    phone: str | None = Field(default=None, max_length=40)
    branch_name: str | None = Field(default=None, max_length=200)


class LinkCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    source: str | None = Field(default=None, max_length=120)


class StatusUpdate(BaseModel):
    status: Literal["new", "contacted", "reviewing", "closed", "archived"]


class NoteCreate(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


def slugify(value: str, *, fallback: str, max_length: int = 80) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return (slug or fallback)[:max_length]


def get_or_create_user(db: Session, identity: PortalIdentity) -> User:
    user = db.scalar(select(User).where(User.external_subject == identity.external_subject))
    if user is None:
        user = db.scalar(select(User).where(func.lower(User.email) == identity.email))
        if user is None:
            user = User(
                external_subject=identity.external_subject,
                email=identity.email,
                display_name=identity.display_name,
                status="active",
            )
            db.add(user)
            db.flush()
        elif user.status == "invited":
            user.external_subject = identity.external_subject
            user.status = "active"

    user.email = identity.email
    user.display_name = identity.display_name
    return user


def active_membership(db: Session, user: User) -> tuple[OrganizationMembership, Organization] | None:
    row = db.execute(
        select(OrganizationMembership, Organization)
        .join(Organization, Organization.id == OrganizationMembership.organization_id)
        .where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.status == "active",
            Organization.status == "active",
        )
        .order_by(OrganizationMembership.created_at)
    ).first()
    return (row[0], row[1]) if row else None


def require_membership(db: Session, identity: PortalIdentity) -> tuple[User, OrganizationMembership, Organization]:
    user = get_or_create_user(db, identity)
    membership = active_membership(db, user)
    if membership is None:
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Organization onboarding is required")
    return user, membership[0], membership[1]


def membership_payload(membership: OrganizationMembership, organization: Organization) -> dict:
    return {
        "id": str(membership.id),
        "role": membership.role,
        "organization": {
            "id": str(organization.id),
            "name": organization.name,
            "slug": organization.slug,
        },
    }


@router.post("/session")
def portal_session(db: DbSession, identity: Identity):
    user = get_or_create_user(db, identity)
    membership = active_membership(db, user)
    db.commit()
    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
            "status": user.status,
        },
        "membership": membership_payload(*membership) if membership else None,
        "onboarding_required": membership is None,
    }


@router.post("/organizations", status_code=status.HTTP_201_CREATED)
def create_organization(payload: OrganizationCreate, db: DbSession, identity: Identity):
    user = get_or_create_user(db, identity)
    if active_membership(db, user):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already belongs to an active organization")

    suffix = secrets.token_hex(6)
    organization_slug = f"{slugify(payload.company_name, fallback='team')}-{suffix}"
    profile_slug = f"{slugify(identity.display_name, fallback='advisor', max_length=70)}-{suffix}"
    organization = Organization(name=payload.company_name.strip(), slug=organization_slug, status="active")
    db.add(organization)
    db.flush()

    membership = OrganizationMembership(
        organization_id=organization.id,
        user_id=user.id,
        role="owner",
        status="active",
    )
    db.add(membership)
    db.flush()

    profile = LoanOfficerProfile(
        organization_id=organization.id,
        membership_id=membership.id,
        public_slug=profile_slug,
        nmls_id=payload.nmls_id.strip() if payload.nmls_id else None,
        phone=payload.phone.strip() if payload.phone else None,
        branch_name=payload.branch_name.strip() if payload.branch_name else None,
        title="Loan officer",
    )
    db.add(profile)
    db.flush()
    db.add_all([
        BrandingSettings(
            organization_id=organization.id,
            company_display_name=organization.name,
        ),
        BorrowerLink(
            organization_id=organization.id,
            loan_officer_profile_id=profile.id,
            name="General borrower link",
            slug=profile_slug,
            source="Portal onboarding",
        ),
        AuditEvent(
            organization_id=organization.id,
            actor_user_id=user.id,
            event_type="organization.created",
            entity_type="organization",
            entity_id=organization.id,
            event_data={"source": "self_service_onboarding"},
        ),
    ])
    user.status = "active"
    db.commit()
    return {"membership": membership_payload(membership, organization)}


def decimal_value(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


@router.get("/dashboard")
def dashboard(db: DbSession, identity: Identity):
    user, membership, organization = require_membership(db, identity)
    submissions = list(db.scalars(
        select(BorrowerSubmission)
        .where(BorrowerSubmission.organization_id == organization.id)
        .order_by(BorrowerSubmission.created_at.desc())
        .limit(200)
    ))
    links = list(db.scalars(
        select(BorrowerLink)
        .where(BorrowerLink.organization_id == organization.id)
        .order_by(BorrowerLink.created_at.desc())
    ))
    link_names = {link.id: link.name for link in links}

    scenarios_by_submission: dict[UUID, list[AffordabilityScenario]] = {}
    if submissions:
        scenarios = db.scalars(
            select(AffordabilityScenario).where(
                AffordabilityScenario.borrower_submission_id.in_([item.id for item in submissions])
            )
        )
        for scenario in scenarios:
            scenarios_by_submission.setdefault(scenario.borrower_submission_id, []).append(scenario)

    notes_by_submission: dict[UUID, list[dict]] = {}
    if submissions:
        note_rows = db.execute(
            select(BorrowerNote, User)
            .join(User, User.id == BorrowerNote.author_user_id)
            .where(
                BorrowerNote.organization_id == organization.id,
                BorrowerNote.borrower_submission_id.in_([item.id for item in submissions]),
            )
            .order_by(BorrowerNote.created_at.desc())
        )
        for note, author in note_rows:
            notes_by_submission.setdefault(note.borrower_submission_id, []).append({
                "id": str(note.id),
                "body": note.body,
                "author": author.display_name,
                "created_at": note.created_at.isoformat(),
            })

    borrower_payloads = []
    for submission in submissions:
        available = scenarios_by_submission.get(submission.id, [])
        scenario = next((item for item in available if item.label == "average"), available[0] if available else None)
        borrower_payloads.append({
            "id": str(submission.id),
            "name": f"{submission.first_name} {submission.last_name}",
            "email": submission.email,
            "phone": submission.phone,
            "market": f"{submission.county}, {submission.state}",
            "home_price": decimal_value(scenario.home_price) if scenario else None,
            "payment": decimal_value(scenario.monthly_payment) if scenario else None,
            "scenario": scenario.label if scenario else None,
            "status": submission.status,
            "submitted_at": submission.created_at.isoformat(),
            "source": link_names.get(submission.borrower_link_id, "Direct"),
            "credit_range": submission.credit_range,
            "income": decimal_value(submission.annual_income or submission.expected_income),
            "available_funds": decimal_value(submission.available_funds),
            "employment_path": submission.employment_path,
            "notes": notes_by_submission.get(submission.id, []),
        })

    total_visits = sum(link.visit_count for link in links)
    total_link_submissions = sum(link.submission_count for link in links)
    completion_rate = round(total_link_submissions / total_visits * 100, 1) if total_visits else 0.0
    now = datetime.now(timezone.utc)
    activity = []
    for offset in range(6, -1, -1):
        day = (now - timedelta(days=offset)).date()
        activity.append({
            "date": day.isoformat(),
            "count": sum(1 for item in submissions if item.created_at.date() == day),
        })

    top_link = max(links, key=lambda item: (item.submission_count, item.visit_count), default=None)
    return {
        "membership": membership_payload(membership, organization),
        "metrics": {
            "new_borrowers": sum(1 for item in submissions if item.status == "new"),
            "completion_rate": completion_rate,
            "active_links": sum(1 for item in links if item.is_active),
            "follow_ups_due": sum(1 for item in submissions if item.status in {"new", "reviewing"}),
        },
        "activity": activity,
        "borrowers": borrower_payloads,
        "links": [{
            "id": str(link.id),
            "name": link.name,
            "slug": link.slug,
            "source": link.source,
            "visits": link.visit_count,
            "submissions": link.submission_count,
            "conversion_rate": round(link.submission_count / link.visit_count * 100, 1) if link.visit_count else 0.0,
            "is_active": bool(link.is_active),
        } for link in links],
        "top_link_id": str(top_link.id) if top_link else None,
        "current_user_id": str(user.id),
    }


@router.post("/links", status_code=status.HTTP_201_CREATED)
def create_link(payload: LinkCreate, db: DbSession, identity: Identity):
    _, membership, organization = require_membership(db, identity)
    profile = db.scalar(select(LoanOfficerProfile).where(LoanOfficerProfile.membership_id == membership.id))
    if profile is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Loan officer profile is required")

    slug = f"{profile.public_slug}/{slugify(payload.name, fallback='link', max_length=60)}-{secrets.token_hex(5)}"
    link = BorrowerLink(
        organization_id=organization.id,
        loan_officer_profile_id=profile.id,
        name=payload.name.strip(),
        slug=slug,
        source=payload.source.strip() if payload.source else None,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return {
        "id": str(link.id),
        "name": link.name,
        "slug": link.slug,
        "source": link.source,
        "visits": 0,
        "submissions": 0,
        "conversion_rate": 0.0,
        "is_active": True,
    }


@router.patch("/borrowers/{borrower_id}/status")
def update_borrower_status(borrower_id: UUID, payload: StatusUpdate, db: DbSession, identity: Identity):
    user, _, organization = require_membership(db, identity)
    borrower = db.scalar(select(BorrowerSubmission).where(
        BorrowerSubmission.id == borrower_id,
        BorrowerSubmission.organization_id == organization.id,
    ))
    if borrower is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower was not found")

    previous = borrower.status
    borrower.status = payload.status
    db.add(LeadActivity(
        organization_id=organization.id,
        borrower_submission_id=borrower.id,
        actor_user_id=user.id,
        activity_type="status.changed",
        from_status=previous,
        to_status=payload.status,
    ))
    db.commit()
    return {"id": str(borrower.id), "status": borrower.status}


@router.post("/borrowers/{borrower_id}/notes", status_code=status.HTTP_201_CREATED)
def create_borrower_note(borrower_id: UUID, payload: NoteCreate, db: DbSession, identity: Identity):
    user, _, organization = require_membership(db, identity)
    borrower_exists = db.scalar(select(BorrowerSubmission.id).where(
        BorrowerSubmission.id == borrower_id,
        BorrowerSubmission.organization_id == organization.id,
    ))
    if borrower_exists is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Borrower was not found")

    note = BorrowerNote(
        organization_id=organization.id,
        borrower_submission_id=borrower_id,
        author_user_id=user.id,
        body=payload.body.strip(),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return {
        "id": str(note.id),
        "body": note.body,
        "author": user.display_name,
        "created_at": note.created_at.isoformat(),
    }
