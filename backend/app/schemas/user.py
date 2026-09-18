"""User schemas."""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models import UserRole


class UserBase(BaseModel):
    """Shared user fields."""

    username: str
    full_name: str
    role: UserRole = UserRole.viewer


class UserCreate(UserBase):
    """Payload for creating a new user. No email required — the account
    is identified by username only; a placeholder email is generated
    server-side to satisfy the (legacy) unique-email DB constraint."""

    password: str


class UserUpdate(BaseModel):
    """Payload for updating a user's role / active status."""

    role: UserRole | None = None
    is_active: bool | None = None


class DeleteUserRequest(BaseModel):
    """Payload for deleting another user — requires the acting admin's
    own password as a confirmation step."""

    password: str


class UserOut(UserBase):
    """User representation returned to clients."""

    model_config = ConfigDict(from_attributes=True)

    # Output is already-persisted data; keep as plain str so reserved TLDs
    # (e.g. the seeded admin@gov.local) serialize without re-validation.
    email: str

    id: uuid.UUID
    position: str | None = None
    is_active: bool
    created_at: datetime
    # True only for the very first admin account seeded by the system.
    # That account can never be deleted, regardless of who is asking.
    is_main_admin: bool = False
    # True when the account still uses a blank/default password. Only
    # computed on login and /me (bcrypt checks are too slow for lists).
    must_change_password: bool = False


class ProfileUpdate(BaseModel):
    """Payload for editing the current user's own profile."""

    full_name: str | None = None
    position: str | None = None


class ChangePassword(BaseModel):
    """Payload for changing the current user's password."""

    old_password: str
    new_password: str


class Token(BaseModel):
    """JWT access token response with the authenticated user."""

    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PaginatedUsers(BaseModel):
    """Paginated list of users."""

    total: int
    page: int
    size: int
    items: list[UserOut]
