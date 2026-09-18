"""Office regions used as the inventory tenancy boundary."""

import uuid

from sqlalchemy import Boolean, String
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, TimestampMixin


class Region(Base, TimestampMixin):
    """A regional office with its fixed administrator login identity."""

    __tablename__ = "regions"

    id: Mapped[uuid.UUID] = mapped_column(
        SAUuid, primary_key=True, default=uuid.uuid4
    )
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(150), unique=True)
    admin_username: Mapped[str] = mapped_column(
        String(50), unique=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    users: Mapped[list["User"]] = relationship("User", back_populates="region")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<Region {self.code} {self.name}>"
