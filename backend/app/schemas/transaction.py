"""Transaction schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import TransactionType
from app.schemas.item import ItemOut
from app.schemas.user import UserOut


class StockInCreate(BaseModel):
    """Payload for recording a stock-in (received) transaction."""

    item_id: uuid.UUID
    reference_number: str = Field(min_length=1, max_length=50)
    quantity: int = Field(gt=0)
    condition: str | None = None
    purpose: str | None = None
    remarks: str | None = None
    transaction_date: datetime | None = None

    @field_validator("reference_number", mode="before")
    @classmethod
    def validate_reference(cls, value):
        if isinstance(value, str):
            value = value.strip()
            if any(ord(char) < 32 or ord(char) == 127 for char in value):
                raise ValueError("Reference number must not contain control characters")
            if value.upper().startswith("REL-"):
                raise ValueError("REL- is reserved for stock-out references")
        return value


class StockOutCreate(BaseModel):
    """Payload for recording a stock-out (released) transaction."""

    item_id: uuid.UUID
    quantity: int = Field(gt=0)
    recipient_name: str | None = None
    recipient_department: str | None = None
    condition: str | None = None
    purpose: str | None = None
    remarks: str | None = None
    transaction_date: datetime | None = None


class TransactionOut(BaseModel):
    """Transaction representation returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    transaction_type: TransactionType
    reference_number: str
    item_id: uuid.UUID
    quantity: int
    recipient_name: str | None = None
    recipient_department: str | None = None
    purpose: str | None = None
    condition: str | None = None
    remarks: str | None = None
    transaction_date: datetime
    created_by: uuid.UUID
    voided: bool
    created_at: datetime

    # Embedded relationships so clients can render names without extra lookups.
    item: ItemOut | None = None
    creator: UserOut | None = None


class PaginatedTransactions(BaseModel):
    """Paginated list of transactions."""

    total: int
    page: int
    size: int
    items: list[TransactionOut]
