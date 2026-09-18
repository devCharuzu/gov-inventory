"""Transaction model."""

import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin


class TransactionType(str, enum.Enum):
    """Direction of stock movement."""

    IN = "IN"
    OUT = "OUT"


class Transaction(Base, TimestampMixin):
    """A stock-in or stock-out movement against an item."""

    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        SAUuid, primary_key=True, default=uuid.uuid4
    )
    transaction_type: Mapped[TransactionType] = mapped_column(
        Enum(TransactionType), nullable=False
    )
    reference_number: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )
    item_id: Mapped[uuid.UUID] = mapped_column(
        SAUuid, ForeignKey("items.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    recipient_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    recipient_department: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )
    purpose: Mapped[str | None] = mapped_column(Text, nullable=True)
    condition: Mapped[str | None] = mapped_column(String(100), nullable=True)
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_by: Mapped[uuid.UUID] = mapped_column(
        SAUuid, ForeignKey("users.id"), nullable=False
    )
    voided: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    # Relationships
    item: Mapped["Item"] = relationship("Item", lazy="joined")  # noqa: F821
    creator: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[created_by], lazy="joined"
    )

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Transaction {self.reference_number} {self.transaction_type}>"
