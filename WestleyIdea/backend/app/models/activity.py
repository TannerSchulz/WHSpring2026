from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import BigInteger, CheckConstraint, ForeignKey, Index, String, Unicode, text
from sqlalchemy.dialects import mssql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .borrower import BorrowerSubmission


class LeadActivity(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "lead_activities"
    __table_args__ = (
        CheckConstraint("[details] IS NULL OR ISJSON([details]) = 1", name="details_json"),
        Index("ix_lead_activities_submission_created", "borrower_submission_id", "created_at"),
        {"schema": "crm"},
    )

    organization_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organizations.id"),
        nullable=False,
        index=True,
    )
    borrower_submission_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.borrower_submissions.id"),
        nullable=False,
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.users.id"),
    )
    activity_type: Mapped[str] = mapped_column(String(60), nullable=False)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str | None] = mapped_column(String(20))
    details: Mapped[dict | None] = mapped_column(mssql.JSON)
    created_at: Mapped[datetime] = mapped_column(
        mssql.DATETIMEOFFSET,
        nullable=False,
        server_default=text("SYSDATETIMEOFFSET()"),
    )

    submission: Mapped[BorrowerSubmission] = relationship(back_populates="activities")


class BorrowerNote(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "borrower_notes"
    __table_args__ = (
        Index("ix_borrower_notes_submission_created", "borrower_submission_id", "created_at"),
        {"schema": "crm"},
    )

    organization_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organizations.id"),
        nullable=False,
        index=True,
    )
    borrower_submission_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.borrower_submissions.id"),
        nullable=False,
    )
    author_user_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.users.id"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Unicode(4000), nullable=False)

    submission: Mapped[BorrowerSubmission] = relationship(back_populates="notes")


class AuditEvent(Base):
    __tablename__ = "audit_events"
    __table_args__ = (
        CheckConstraint("[event_data] IS NULL OR ISJSON([event_data]) = 1", name="event_data_json"),
        Index("ix_audit_events_org_created", "organization_id", "created_at"),
        Index("ix_audit_events_entity", "entity_type", "entity_id"),
        {"schema": "crm"},
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    organization_id: Mapped[UUID | None] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organizations.id"),
    )
    actor_user_id: Mapped[UUID | None] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.users.id"),
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    entity_id: Mapped[UUID | None] = mapped_column(mssql.UNIQUEIDENTIFIER)
    request_id: Mapped[str | None] = mapped_column(String(100))
    ip_address: Mapped[str | None] = mapped_column(String(45))
    event_data: Mapped[dict | None] = mapped_column(mssql.JSON)
    created_at: Mapped[datetime] = mapped_column(
        mssql.DATETIMEOFFSET,
        nullable=False,
        server_default=text("SYSDATETIMEOFFSET()"),
    )
