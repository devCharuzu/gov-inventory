"""Database-backed counters used for collision-free human-readable numbers."""

from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class NumberCounter(Base):
    """A small locked counter table shared by concurrent API workers."""

    __tablename__ = "number_counters"

    key: Mapped[str] = mapped_column(String(80), primary_key=True)
    next_value: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
