"""Analytics schemas."""

import uuid
from datetime import date

from pydantic import BaseModel


class Summary(BaseModel):
    """Dashboard summary counters."""

    total_items: int
    total_in_today: int
    total_out_today: int
    low_stock_count: int


class TrendPoint(BaseModel):
    """Aggregated stock movement for a single period bucket."""

    period_label: str
    total_in: int
    total_out: int
    net: int


class TopItem(BaseModel):
    """An item ranked by transacted quantity."""

    item_id: uuid.UUID
    item_name: str
    item_code: str
    total_quantity: int
    transaction_count: int


class StockMovementPoint(BaseModel):
    """Daily in/out movement with a running balance for one item."""

    date: date
    quantity_in: int
    quantity_out: int
    running_balance: int


class CategoryBreakdown(BaseModel):
    """Per-category item counts and transacted totals."""

    category_id: uuid.UUID | None
    category_name: str
    item_count: int
    total_in: int
    total_out: int
