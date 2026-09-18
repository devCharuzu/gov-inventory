"""Audit log schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    """Audit log entry returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID | None = None
    user_name: str | None = None
    action: str
    entity_type: str | None = None
    entity_id: str | None = None
    details: dict | None = None
    ip_address: str | None = None
    created_at: datetime


class PaginatedAuditLogs(BaseModel):
    """Paginated list of audit log entries."""

    total: int
    page: int
    size: int
    items: list[AuditLogOut]
