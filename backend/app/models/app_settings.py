"""Key-value app settings stored in the database.

Keys are plain strings; values are stored as text (JSON-safe).
"""

from sqlalchemy import PrimaryKeyConstraint, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, RegionScopedMixin, TimestampMixin


class AppSetting(Base, RegionScopedMixin, TimestampMixin):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(100))
    value: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        PrimaryKeyConstraint("region_id", "key", name="pk_app_settings"),
    )
