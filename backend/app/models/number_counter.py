"""Database-backed counters used for collision-free human-readable numbers."""

from sqlalchemy import Integer, PrimaryKeyConstraint, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, RegionScopedMixin


class NumberCounter(Base, RegionScopedMixin):
    """A small locked counter table shared by concurrent API workers."""

    __tablename__ = "number_counters"

    key: Mapped[str] = mapped_column(String(80))
    next_value: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    __table_args__ = (
        PrimaryKeyConstraint("region_id", "key", name="pk_number_counters"),
    )
