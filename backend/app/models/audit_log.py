"""Audit log model."""

import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.models import Base, CreatedAtMixin, RegionScopedMixin


class AuditLog(Base, RegionScopedMixin, CreatedAtMixin):
    """Immutable record of a user action for auditing."""

    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        SAUuid, primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        SAUuid, ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    entity_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="joined")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<AuditLog {self.action} {self.entity_type}:{self.entity_id}>"
