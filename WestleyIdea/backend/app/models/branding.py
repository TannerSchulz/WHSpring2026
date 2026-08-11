from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, Unicode
from sqlalchemy.dialects import mssql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base, TimestampMixin, UUIDPrimaryKeyMixin

if TYPE_CHECKING:
    from .organization import Organization


class BrandingSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "branding_settings"
    __table_args__ = {"schema": "crm"}

    organization_id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        ForeignKey("crm.organizations.id"),
        nullable=False,
        unique=True,
    )
    company_display_name: Mapped[str] = mapped_column(Unicode(200), nullable=False)
    primary_color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#103d37")
    secondary_color: Mapped[str] = mapped_column(String(7), nullable=False, server_default="#d9f36f")
    logo_asset_key: Mapped[str | None] = mapped_column(String(500))
    call_to_action_label: Mapped[str | None] = mapped_column(Unicode(120))
    disclosure_text: Mapped[str | None] = mapped_column(Unicode(2000))

    organization: Mapped[Organization] = relationship(back_populates="branding")
