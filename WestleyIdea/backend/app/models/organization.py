from __future__ import annotations

from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, String, Unicode
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .branding import BrandingSettings
    from .identity import OrganizationMembership


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organizations"
    __table_args__ = (
        CheckConstraint("[status] IN ('active', 'suspended', 'closed')", name="status_values"),
        {"schema": "crm"},
    )

    name: Mapped[str] = mapped_column(Unicode(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, server_default="active")

    memberships: Mapped[list[OrganizationMembership]] = relationship(back_populates="organization")
    branding: Mapped[BrandingSettings | None] = relationship(back_populates="organization", uselist=False)
