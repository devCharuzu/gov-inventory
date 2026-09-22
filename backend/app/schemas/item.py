"""Item schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.category import CategoryOut


class ItemBase(BaseModel):
    """Shared item fields."""

    name: str
    description: str | None = None
    category_id: uuid.UUID | None = None
    unit: str | None = None
    minimum_quantity: int = 0
    location: str | None = None


class ItemCreate(ItemBase):
    """Payload for creating an item (code is auto-generated)."""

    quantity: int = 0


class ItemUpdate(BaseModel):
    """Payload for updating an item; all fields optional."""

    name: str | None = None
    description: str | None = None
    category_id: uuid.UUID | None = None
    unit: str | None = None
    minimum_quantity: int | None = None
    location: str | None = None
    is_active: bool | None = None


class ItemOut(ItemBase):
    """Item representation returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    code: str
    quantity: int
    is_active: bool
    created_at: datetime
    updated_at: datetime
    category: CategoryOut | None = None


class ItemDetail(ItemOut):
    """Item detail including derived stock status."""

    is_low_stock: bool


class PaginatedItems(BaseModel):
    """Paginated list of items."""

    total: int
    page: int
    size: int
    items: list[ItemOut]
