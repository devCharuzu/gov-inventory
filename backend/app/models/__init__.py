"""SQLAlchemy ORM models.

Defines the declarative ``Base`` and shared timestamp mixins, then exposes
all model classes for convenient importing (e.g. ``from app.models import Item``).
"""

from datetime import datetime
import uuid

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base class for all ORM models."""


class CreatedAtMixin:
    """Adds a ``created_at`` timestamp set on insert."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class TimestampMixin(CreatedAtMixin):
    """Adds ``created_at`` and an ``updated_at`` that refreshes on update."""

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class RegionScopedMixin:
    """Adds the tenant/region key shared by all regional records."""

    region_id: Mapped[uuid.UUID] = mapped_column(
        SAUuid,
        ForeignKey("regions.id"),
        nullable=False,
        index=True,
    )


# Import models after Base/mixins are defined so they can reference them.
from app.models.region import Region  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402
from app.models.category import Category  # noqa: E402
from app.models.item import Item  # noqa: E402
from app.models.transaction import Transaction, TransactionType  # noqa: E402
from app.models.audit_log import AuditLog  # noqa: E402
from app.models.signatory import Signatory  # noqa: E402
from app.models.app_settings import AppSetting  # noqa: E402
from app.models.number_counter import NumberCounter  # noqa: E402
from app.models.report_document import ReportDocument  # noqa: E402

__all__ = [
    "Base",
    "CreatedAtMixin",
    "TimestampMixin",
    "RegionScopedMixin",
    "Region",
    "User",
    "UserRole",
    "Category",
    "Item",
    "Transaction",
    "TransactionType",
    "AuditLog",
    "Signatory",
    "AppSetting",
    "NumberCounter",
    "ReportDocument",
]
