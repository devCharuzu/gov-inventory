import uuid

from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, RegionScopedMixin, TimestampMixin


class Signatory(Base, RegionScopedMixin, TimestampMixin):
    """An employee: name, position, and unit.

    Used both as a selectable recipient when releasing items and as the
    Certified By / Issued By officer on official slips. ``designation`` holds
    the position; ``unit`` holds the office/section.
    """

    __tablename__ = "signatories"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    designation: Mapped[str] = mapped_column(String(200), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
