"""Item model."""

import uuid

from sqlalchemy import (
    Boolean,
    ForeignKey,
    Integer,
    String,
    Text,
    event,
    func,
    select,
)
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, Session, mapped_column, relationship

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


@event.listens_for(Session, "before_flush")
def _generate_item_codes(session: Session, flush_context, instances) -> None:
    """Auto-assign sequential codes like ``ITM-0001`` to new items.

    Runs once per flush so a batch of inserts each receives a distinct,
    contiguous code starting from the current maximum in the table.
    """
    new_items = [
        obj
        for obj in session.new
        if isinstance(obj, Item) and not obj.code
    ]
    if not new_items:
        return
    max_code = session.execute(select(func.max(Item.code))).scalar()
    base = int(max_code.split("-")[1]) if max_code else 0
    for offset, item in enumerate(new_items, start=1):
        item.code = f"ITM-{base + offset:04d}"
