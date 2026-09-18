"""Category model."""

import uuid

from sqlalchemy import Boolean, String, Text, UniqueConstraint
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base, RegionScopedMixin, TimestampMixin


class Category(Base, RegionScopedMixin, TimestampMixin):
    """Item category / classification."""

    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(
        SAUuid, primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String(100), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    __table_args__ = (
        UniqueConstraint("region_id", "name", name="uq_categories_region_name"),
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Category {self.name}>"
