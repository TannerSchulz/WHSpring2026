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


class TeamInviteCreate(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    display_name: str = Field(min_length=2, max_length=200)
    role: Literal["admin", "loan_officer", "reviewer"] = "loan_officer"


class TeamMemberUpdate(BaseModel):
    role: Literal["admin", "loan_officer", "reviewer"] | None = None
    status: Literal["active", "disabled"] | None = None


class BrandingUpdate(BaseModel):
    company_display_name: str = Field(min_length=2, max_length=200)
    primary_color: str = Field(min_length=7, max_length=7)
    secondary_color: str = Field(min_length=7, max_length=7)
    logo_url: str | None = Field(default=None, max_length=500)
    call_to_action_label: str | None = Field(default=None, max_length=120)
    disclosure_text: str | None = Field(default=None, max_length=2000)


class WorkspaceUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class ProfileUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=150)
    nmls_id: str | None = Field(default=None, max_length=50)
    phone: str | None = Field(default=None, max_length=40)
    branch_name: str | None = Field(default=None, max_length=200)


def slugify(value: str, *, fallback: str, max_length: int = 80) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return (slug or fallback)[:max_length]


def optional_text(value: str | None) -> str | None:
    normalized = value.strip() if value else ""
    return normalized or None


def require_management_role(membership: OrganizationMembership) -> None:
    if membership.role not in {"owner", "admin"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Owner or admin access is required")


def validate_hex_color(value: str) -> str:
    normalized = value.strip().lower()
    if not re.fullmatch(r"#[0-9a-f]{6}", normalized):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Brand colors must be six-digit hex values")
    return normalized


def validate_logo_url(value: str | None) -> str | None:
    normalized = optional_text(value)
    if normalized and not re.fullmatch(r"https://[^\s]+", normalized, flags=re.IGNORECASE):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Logo URL must use HTTPS")
    return normalized


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
    if user.status == "invited":
        user.status = "active"
    if user.status == "active":
        for membership in db.scalars(select(OrganizationMembership).where(
            OrganizationMembership.user_id == user.id,
            OrganizationMembership.status == "invited",
        )):
            membership.status = "active"
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


def has_disabled_membership(db: Session, user: User) -> bool:
    return db.scalar(select(OrganizationMembership.id).where(
        OrganizationMembership.user_id == user.id,
        OrganizationMembership.status == "disabled",
    ).limit(1)) is not None


def require_membership(db: Session, identity: PortalIdentity) -> tuple[User, OrganizationMembership, Organization]:
    user = get_or_create_user(db, identity)
    membership = active_membership(db, user)
    if membership is None:
        db.commit()
        detail = "Workspace access is disabled" if has_disabled_membership(db, user) else "Organization onboarding is required"
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)
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
    if membership is None and has_disabled_membership(db, user):
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workspace access is disabled")
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
    if user.status == "disabled" or has_disabled_membership(db, user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Workspace access is disabled")
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
    profile = db.scalar(select(LoanOfficerProfile).where(LoanOfficerProfile.membership_id == membership.id))
    branding = db.scalar(select(BrandingSettings).where(BrandingSettings.organization_id == organization.id))
    member_rows = db.execute(
        select(OrganizationMembership, User, LoanOfficerProfile)
        .join(User, User.id == OrganizationMembership.user_id)
        .outerjoin(LoanOfficerProfile, LoanOfficerProfile.membership_id == OrganizationMembership.id)
        .where(OrganizationMembership.organization_id == organization.id)
        .order_by(OrganizationMembership.created_at)
    ).all()
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
        "team": [{
            "membership_id": str(member.id),
            "user_id": str(member_user.id),
            "display_name": member_user.display_name,
            "email": member_user.email,
            "role": member.role,
            "status": member.status,
            "title": member_profile.title if member_profile else None,
            "joined_at": member.created_at.isoformat(),
        } for member, member_user, member_profile in member_rows],
        "branding": {
            "company_display_name": branding.company_display_name if branding else organization.name,
            "primary_color": branding.primary_color if branding else "#103d37",
            "secondary_color": branding.secondary_color if branding else "#d9f36f",
            "logo_url": branding.logo_asset_key if branding else None,
            "call_to_action_label": branding.call_to_action_label if branding else None,
            "disclosure_text": branding.disclosure_text if branding else None,
        },
        "profile": {
            "title": profile.title if profile else None,
            "nmls_id": profile.nmls_id if profile else None,
            "phone": profile.phone if profile else None,
            "branch_name": profile.branch_name if profile else None,
            "public_slug": profile.public_slug if profile else None,
        },
        "permissions": {
            "manage_team": membership.role in {"owner", "admin"},
            "manage_branding": membership.role in {"owner", "admin"},
            "manage_workspace": membership.role in {"owner", "admin"},
        },
        "top_link_id": str(top_link.id) if top_link else None,
        "current_user_id": str(user.id),
    }


@router.post("/team/invitations", status_code=status.HTTP_201_CREATED)
def invite_team_member(payload: TeamInviteCreate, db: DbSession, identity: Identity):
    actor, actor_membership, organization = require_membership(db, identity)
    require_management_role(actor_membership)
    if actor_membership.role == "admin" and payload.role == "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can invite another admin")
    email = payload.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a valid email address")

    invited_user = db.scalar(select(User).where(func.lower(User.email) == email))
    if invited_user is None:
        invited_user = User(
            external_subject=f"invited:{secrets.token_urlsafe(24)}",
            email=email,
            display_name=payload.display_name.strip(),
            status="invited",
        )
        db.add(invited_user)
        db.flush()
    else:
        other_membership = db.scalar(select(OrganizationMembership).where(
            OrganizationMembership.user_id == invited_user.id,
            OrganizationMembership.organization_id != organization.id,
            OrganizationMembership.status.in_(("active", "invited")),
        ))
        if other_membership:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This account already belongs to another active workspace")
        invited_user.display_name = payload.display_name.strip()
        invited_user.status = "invited"

    membership = db.scalar(select(OrganizationMembership).where(
        OrganizationMembership.organization_id == organization.id,
        OrganizationMembership.user_id == invited_user.id,
    ))
    if membership and membership.status == "active":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This person is already an active team member")
    if membership is None:
        membership = OrganizationMembership(
            organization_id=organization.id,
            user_id=invited_user.id,
            role=payload.role,
            status="invited",
        )
        db.add(membership)
        db.flush()
    else:
        membership.role = payload.role
        membership.status = "invited"

    profile = db.scalar(select(LoanOfficerProfile).where(LoanOfficerProfile.membership_id == membership.id))
    if profile is None and payload.role != "reviewer":
        profile = LoanOfficerProfile(
            organization_id=organization.id,
            membership_id=membership.id,
            public_slug=f"{slugify(payload.display_name, fallback='advisor', max_length=70)}-{secrets.token_hex(6)}",
            title="Loan officer",
        )
        db.add(profile)

    db.add(AuditEvent(
        organization_id=organization.id,
        actor_user_id=actor.id,
        event_type="team.invited",
        entity_type="organization_membership",
        entity_id=membership.id,
        event_data={"email": email, "role": payload.role},
    ))
    db.commit()
    return {
        "membership_id": str(membership.id),
        "user_id": str(invited_user.id),
        "display_name": invited_user.display_name,
        "email": invited_user.email,
        "role": membership.role,
        "status": membership.status,
        "title": profile.title if profile else None,
        "joined_at": membership.created_at.isoformat(),
    }


@router.patch("/team/members/{membership_id}")
def update_team_member(membership_id: UUID, payload: TeamMemberUpdate, db: DbSession, identity: Identity):
    actor, actor_membership, organization = require_membership(db, identity)
    require_management_role(actor_membership)
    row = db.execute(
        select(OrganizationMembership, User, LoanOfficerProfile)
        .join(User, User.id == OrganizationMembership.user_id)
        .outerjoin(LoanOfficerProfile, LoanOfficerProfile.membership_id == OrganizationMembership.id)
        .where(
            OrganizationMembership.id == membership_id,
            OrganizationMembership.organization_id == organization.id,
        )
    ).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team member was not found")
    target, target_user, profile = row
    if target.role == "owner":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The workspace owner cannot be changed here")
    if target.id == actor_membership.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You cannot change your own access")
    if actor_membership.role == "admin" and target.role == "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the owner can change another admin")
    if payload.role is None and payload.status is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Choose a role or status change")

    previous = {"role": target.role, "status": target.status}
    if payload.role is not None:
        target.role = payload.role
        if profile is None and payload.role != "reviewer":
            profile = LoanOfficerProfile(
                organization_id=organization.id,
                membership_id=target.id,
                public_slug=f"{slugify(target_user.display_name, fallback='advisor', max_length=70)}-{secrets.token_hex(6)}",
                title="Loan officer",
            )
            db.add(profile)
    if payload.status is not None:
        target.status = payload.status
        target_user.status = payload.status

    db.add(AuditEvent(
        organization_id=organization.id,
        actor_user_id=actor.id,
        event_type="team.updated",
        entity_type="organization_membership",
        entity_id=target.id,
        event_data={"previous": previous, "role": target.role, "status": target.status},
    ))
    db.commit()
    return {
        "membership_id": str(target.id),
        "user_id": str(target_user.id),
        "display_name": target_user.display_name,
        "email": target_user.email,
        "role": target.role,
        "status": target.status,
        "title": profile.title if profile else None,
        "joined_at": target.created_at.isoformat(),
    }


@router.put("/branding")
def update_branding(payload: BrandingUpdate, db: DbSession, identity: Identity):
    actor, membership, organization = require_membership(db, identity)
    require_management_role(membership)
    branding = db.scalar(select(BrandingSettings).where(BrandingSettings.organization_id == organization.id))
    if branding is None:
        branding = BrandingSettings(organization_id=organization.id, company_display_name=payload.company_display_name.strip())
        db.add(branding)
    branding.company_display_name = payload.company_display_name.strip()
    branding.primary_color = validate_hex_color(payload.primary_color)
    branding.secondary_color = validate_hex_color(payload.secondary_color)
    branding.logo_asset_key = validate_logo_url(payload.logo_url)
    branding.call_to_action_label = optional_text(payload.call_to_action_label)
    branding.disclosure_text = optional_text(payload.disclosure_text)
    db.flush()
    db.add(AuditEvent(
        organization_id=organization.id,
        actor_user_id=actor.id,
        event_type="branding.updated",
        entity_type="branding_settings",
        entity_id=branding.id,
        event_data={"company_display_name": branding.company_display_name},
    ))
    db.commit()
    return {
        "company_display_name": branding.company_display_name,
        "primary_color": branding.primary_color,
        "secondary_color": branding.secondary_color,
        "logo_url": branding.logo_asset_key,
        "call_to_action_label": branding.call_to_action_label,
        "disclosure_text": branding.disclosure_text,
    }


@router.patch("/settings/workspace")
def update_workspace(payload: WorkspaceUpdate, db: DbSession, identity: Identity):
    actor, membership, organization = require_membership(db, identity)
    require_management_role(membership)
    organization.name = payload.name.strip()
    db.add(AuditEvent(
        organization_id=organization.id,
        actor_user_id=actor.id,
        event_type="organization.updated",
        entity_type="organization",
        entity_id=organization.id,
        event_data={"name": organization.name},
    ))
    db.commit()
    return membership_payload(membership, organization)


@router.put("/settings/profile")
def update_profile(payload: ProfileUpdate, db: DbSession, identity: Identity):
    actor, membership, organization = require_membership(db, identity)
    profile = db.scalar(select(LoanOfficerProfile).where(LoanOfficerProfile.membership_id == membership.id))
    if profile is None:
        profile = LoanOfficerProfile(
            organization_id=organization.id,
            membership_id=membership.id,
            public_slug=f"{slugify(actor.display_name, fallback='advisor', max_length=70)}-{secrets.token_hex(6)}",
        )
        db.add(profile)
    profile.title = optional_text(payload.title)
    profile.nmls_id = optional_text(payload.nmls_id)
    profile.phone = optional_text(payload.phone)
    profile.branch_name = optional_text(payload.branch_name)
    db.flush()
    db.add(AuditEvent(
        organization_id=organization.id,
        actor_user_id=actor.id,
        event_type="profile.updated",
        entity_type="loan_officer_profile",
        entity_id=profile.id,
        event_data={"membership_id": str(membership.id)},
    ))
    db.commit()
    return {
        "title": profile.title,
        "nmls_id": profile.nmls_id,
        "phone": profile.phone,
        "branch_name": profile.branch_name,
        "public_slug": profile.public_slug,
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
