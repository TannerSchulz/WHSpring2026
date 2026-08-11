from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import CheckConstraint, ForeignKey, Index, Numeric, SmallInteger, String, Unicode, UniqueConstraint, text
from sqlalchemy.dialects import mssql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .activity import BorrowerNote, LeadActivity
    from .identity import LoanOfficerProfile


class BorrowerLink(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "borrower_links"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_borrower_link_organization_slug"),
        Index("ix_borrower_links_profile_active", "loan_officer_profile_id", "is_active"),
        {"schema": "crm"},
    )

    organization_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organizations.id"),
        nullable=False,
        index=True,
    )
    loan_officer_profile_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.loan_officer_profiles.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(Unicode(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(160), nullable=False)
    source: Mapped[str | None] = mapped_column(Unicode(120))
    is_active: Mapped[bool] = mapped_column(mssql.BIT, nullable=False, server_default=text("1"))
    expires_at: Mapped[datetime | None] = mapped_column(mssql.DATETIMEOFFSET)
    visit_count: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))
    submission_count: Mapped[int] = mapped_column(nullable=False, server_default=text("0"))

    loan_officer: Mapped[LoanOfficerProfile] = relationship(back_populates="links")
    submissions: Mapped[list[BorrowerSubmission]] = relationship(back_populates="borrower_link")


class BorrowerSubmission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "borrower_submissions"
    __table_args__ = (
        CheckConstraint("[status] IN ('new', 'contacted', 'reviewing', 'closed', 'archived')", name="status_values"),
        CheckConstraint("[employment_path] IN ('employment', 'specialized_schooling')", name="employment_path_values"),
        CheckConstraint("[credit_range] IN ('500-580', '580-620', '620-660', '660+')", name="credit_range_values"),
        CheckConstraint("[employment_years] IS NULL OR [employment_years] >= 0", name="employment_years_nonnegative"),
        CheckConstraint("[gpa] IS NULL OR ([gpa] >= 0 AND [gpa] <= 4.00)", name="gpa_range"),
        CheckConstraint("[raw_answers] IS NULL OR ISJSON([raw_answers]) = 1", name="raw_answers_json"),
        Index("ix_borrower_submissions_org_status_created", "organization_id", "status", "created_at"),
        Index("ix_borrower_submissions_assignee_status", "assigned_loan_officer_id", "status"),
        {"schema": "crm"},
    )

    organization_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organizations.id"),
        nullable=False,
        index=True,
    )
    borrower_link_id: Mapped[UUID | None] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.borrower_links.id"),
    )
    assigned_loan_officer_id: Mapped[UUID | None] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.loan_officer_profiles.id"),
    )
    public_reference: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        nullable=False,
        unique=True,
        server_default=text("NEWID()"),
    )
    first_name: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    last_name: Mapped[str] = mapped_column(Unicode(100), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(40))
    state: Mapped[str] = mapped_column(String(2), nullable=False)
    county: Mapped[str] = mapped_column(Unicode(150), nullable=False)
    employment_path: Mapped[str] = mapped_column(String(30), nullable=False)
    employment_years: Mapped[int | None] = mapped_column(SmallInteger)
    annual_income: Mapped[Decimal | None] = mapped_column(Numeric(19, 2))
    schooling_program: Mapped[str | None] = mapped_column(Unicode(200))
    graduation_date: Mapped[date | None] = mapped_column(mssql.DATE)
    gpa: Mapped[Decimal | None] = mapped_column(Numeric(3, 2))
    expected_income: Mapped[Decimal | None] = mapped_column(Numeric(19, 2))
    credit_range: Mapped[str] = mapped_column(String(20), nullable=False)
    monthly_debts: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False, server_default=text("0"))
    available_funds: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False, server_default=text("0"))
    consent_at: Mapped[datetime] = mapped_column(mssql.DATETIMEOFFSET, nullable=False)
    consent_text_version: Mapped[str] = mapped_column(String(50), nullable=False)
    raw_answers: Mapped[dict | None] = mapped_column(mssql.JSON)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="new")

    borrower_link: Mapped[BorrowerLink | None] = relationship(back_populates="submissions")
    assigned_loan_officer: Mapped[LoanOfficerProfile | None] = relationship(back_populates="assigned_submissions")
    scenarios: Mapped[list[AffordabilityScenario]] = relationship(back_populates="submission")
    activities: Mapped[list[LeadActivity]] = relationship(back_populates="submission")
    notes: Mapped[list[BorrowerNote]] = relationship(back_populates="submission")


class AffordabilityScenario(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "affordability_scenarios"
    __table_args__ = (
        UniqueConstraint("borrower_submission_id", "label", name="uq_scenario_submission_label"),
        CheckConstraint("[label] IN ('low', 'average', 'stretch')", name="label_values"),
        CheckConstraint("[assumptions] IS NULL OR ISJSON([assumptions]) = 1", name="assumptions_json"),
        {"schema": "crm"},
    )

    borrower_submission_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.borrower_submissions.id"),
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(20), nullable=False)
    target_income_ratio: Mapped[Decimal] = mapped_column(Numeric(6, 5), nullable=False)
    home_price: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    monthly_payment: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    principal_and_interest: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    property_tax: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    homeowners_insurance: Mapped[Decimal] = mapped_column(Numeric(19, 2), nullable=False)
    pmi: Mapped[Decimal | None] = mapped_column(Numeric(19, 2))
    interest_rate: Mapped[Decimal] = mapped_column(Numeric(7, 4), nullable=False)
    assumptions: Mapped[dict | None] = mapped_column(mssql.JSON)
    calculated_at: Mapped[datetime] = mapped_column(
        mssql.DATETIMEOFFSET,
        nullable=False,
        server_default=text("SYSDATETIMEOFFSET()"),
    )

    submission: Mapped[BorrowerSubmission] = relationship(back_populates="scenarios")
