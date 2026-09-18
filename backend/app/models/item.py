"""Item model."""

import uuid

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin


class Item(Base, TimestampMixin):
    """An inventory item / stock-keeping unit."""

    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(
        SAUuid, primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200), index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        SAUuid, ForeignKey("categories.id"), nullable=True
    )
    unit: Mapped[str | None] = mapped_column(String(50), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    minimum_quantity: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )
    location: Mapped[str | None] = mapped_column(String(150), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    # Relationships
    category: Mapped["Category"] = relationship(  # noqa: F821
        "Category", backref="items", lazy="joined"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Item {self.code} {self.name}>"
