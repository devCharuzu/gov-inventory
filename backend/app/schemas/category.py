"""Category schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class CategoryBase(BaseModel):
    """Shared category fields."""

    name: str
    description: str | None = None


class CategoryCreate(CategoryBase):
    """Payload for creating a category."""


class CategoryUpdate(BaseModel):
    """Payload for updating a category; all fields optional."""

    name: str | None = None
    description: str | None = None
    is_active: bool | None = None


class CategoryOut(CategoryBase):
    """Category representation returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime
