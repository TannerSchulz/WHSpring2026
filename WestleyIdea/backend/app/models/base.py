from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import MetaData, text
from sqlalchemy.dialects import mssql
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


NAMING_CONVENTION = {
    "ix": "ix_%(table_name)s_%(column_0_name)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class UUIDPrimaryKeyMixin:
    id: Mapped[UUID] = mapped_column(
        mssql.UNIQUEIDENTIFIER,
        primary_key=True,
        default=uuid4,
        server_default=text("NEWSEQUENTIALID()"),
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        mssql.DATETIMEOFFSET,
        nullable=False,
        server_default=text("SYSDATETIMEOFFSET()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        mssql.DATETIMEOFFSET,
        nullable=False,
        server_default=text("SYSDATETIMEOFFSET()"),
        onupdate=text("SYSDATETIMEOFFSET()"),
    )
