from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, String, Unicode, UniqueConstraint
from sqlalchemy.dialects import mssql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .borrower import BorrowerLink, BorrowerSubmission
    from .organization import Organization


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("[status] IN ('invited', 'active', 'disabled')", name="status_values"),
        {"schema": "crm"},
    )

    external_subject: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(Unicode(200), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="invited")

    memberships: Mapped[list[OrganizationMembership]] = relationship(back_populates="user")


class OrganizationMembership(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organization_memberships"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_membership_organization_user"),
        CheckConstraint("[role] IN ('owner', 'admin', 'loan_officer', 'reviewer')", name="role_values"),
        CheckConstraint("[status] IN ('invited', 'active', 'disabled')", name="status_values"),
        {"schema": "crm"},
    )

    organization_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organizations.id"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.users.id"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False, server_default="loan_officer")
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="invited")

    organization: Mapped[Organization] = relationship(back_populates="memberships")
    user: Mapped[User] = relationship(back_populates="memberships")
    loan_officer_profile: Mapped[LoanOfficerProfile | None] = relationship(back_populates="membership", uselist=False)


class LoanOfficerProfile(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "loan_officer_profiles"
    __table_args__ = (
        UniqueConstraint("organization_id", "public_slug", name="uq_loan_officer_organization_slug"),
        {"schema": "crm"},
    )

    organization_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organizations.id"),
        nullable=False,
        index=True,
    )
    membership_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organization_memberships.id"),
        nullable=False,
        unique=True,
    )
    public_slug: Mapped[str] = mapped_column(String(100), nullable=False)
    nmls_id: Mapped[str | None] = mapped_column(String(50))
    title: Mapped[str | None] = mapped_column(Unicode(150))
    phone: Mapped[str | None] = mapped_column(String(40))
    branch_name: Mapped[str | None] = mapped_column(Unicode(200))

    membership: Mapped[OrganizationMembership] = relationship(back_populates="loan_officer_profile")
    links: Mapped[list[BorrowerLink]] = relationship(back_populates="loan_officer")
    assigned_submissions: Mapped[list[BorrowerSubmission]] = relationship(back_populates="assigned_loan_officer")
