"""User model."""

import enum
import uuid

from sqlalchemy import Boolean, Enum, String
from sqlalchemy import Uuid as SAUuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base, RegionScopedMixin, TimestampMixin


class UserRole(str, enum.Enum):
    """Authorization roles for application users."""

    admin = "admin"
    encoder = "encoder"
    viewer = "viewer"


class User(Base, RegionScopedMixin, TimestampMixin):
    """Application user account."""

    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        SAUuid, primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(150))
    position: Mapped[str | None] = mapped_column(String(200), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.viewer, nullable=False
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    must_change_password: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
    )

    region: Mapped["Region"] = relationship("Region", back_populates="users")  # noqa: F821

    def __repr__(self) -> str:  # pragma: no cover
        return f"<User {self.username} ({self.role})>"
