"""Authentication routes."""

import uuid

from fastapi import APIRouter, Depends, Form, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, Transaction, User, UserRole
from app.schemas.user import (
    ChangePassword,
    DeleteUserRequest,
    PaginatedUsers,
    ProfileUpdate,
    Token,
    UserCreate,
    UserOut,
    UserUpdate,
)
from app.utils.security import (
    create_access_token,
    get_current_user,
    hash_password,
    require_role,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _audit(
    db: Session,
    *,
    user: User | None,
    action: str,
    request: Request | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    details: dict | None = None,
) -> None:
    """Persist an audit log entry."""
    db.add(
        AuditLog(
            user_id=user.id if user else None,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
            ip_address=request.client.host if request and request.client else None,
        )
    )
    db.commit()


def _main_admin_id(db: Session) -> uuid.UUID | None:
    """The very first account ever created (the system-seeded admin).

    This account is protected from deletion regardless of who is asking —
    it's the one guaranteed way back into the system if every other
    account is locked out or removed.
    """
    row = (
        db.query(User.id)
        .order_by(User.created_at.asc(), User.id.asc())
        .first()
    )
    return row[0] if row else None


def _to_out(db: Session, user: User, main_admin_id: uuid.UUID | None = None) -> UserOut:
    """Build a UserOut stamped with whether this is the protected main admin."""
    if main_admin_id is None:
        main_admin_id = _main_admin_id(db)
    out = UserOut.model_validate(user)
    out.is_main_admin = user.id == main_admin_id
    return out


# --------------------------------------------------------------------------- #
# Session
# --------------------------------------------------------------------------- #
@router.post("/login", response_model=Token)
def login(
    request: Request,
    # Explicit Form fields instead of OAuth2PasswordRequestForm: that helper
    # rejects an EMPTY password as "field missing", but a fresh install's
    # admin account legitimately has a blank password until one is set.
    username: str = Form(...),
    password: str = Form(""),
    db: Session = Depends(get_db),
) -> Token:
    """Authenticate with username/password and return a JWT."""
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Inactive user"
        )

    token = create_access_token({"sub": user.username})
    _audit(db, user=user, action="LOGIN", request=request)
    out = _to_out(db, user)
    out.must_change_password = _uses_default_password(user)
    return Token(access_token=token, user=out)


@router.post("/logout")
def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Record a logout event (token invalidation is client-side)."""
    _audit(db, user=current_user, action="LOGOUT", request=request)
    return {"message": "Successfully logged out"}


def _uses_default_password(user: User) -> bool:
    """True when the account still has a blank or shipped-default password."""
    return verify_password("", user.hashed_password) or verify_password(
        "Admin@1234", user.hashed_password
    )


@router.get("/me", response_model=UserOut)
def read_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UserOut:
    """Return the currently authenticated user."""
    out = _to_out(db, current_user)
    out.must_change_password = _uses_default_password(current_user)
    return out


@router.put("/me", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    """Update the current user's own name and position."""
    changes: dict = {}
    if payload.full_name is not None:
        current_user.full_name = payload.full_name.strip()
        changes["full_name"] = current_user.full_name
    if payload.position is not None:
        current_user.position = payload.position.strip() or None
        changes["position"] = current_user.position
    db.commit()
    db.refresh(current_user)
    _audit(
        db,
        user=current_user,
        action="UPDATE_PROFILE",
        request=request,
        entity_type="user",
        entity_id=str(current_user.id),
        details=changes,
    )
    return current_user


@router.post("/change-password")
def change_password(
    payload: ChangePassword,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Change the current user's password after verifying the old one."""
    if len(payload.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters.",
        )
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect current password",
        )
    current_user.hashed_password = hash_password(payload.new_password)
    db.add(current_user)
    db.commit()
    _audit(
        db,
        user=current_user,
        action="CHANGE_PASSWORD",
        request=request,
        entity_type="user",
        entity_id=str(current_user.id),
    )
    return {"message": "Password changed successfully"}


# --------------------------------------------------------------------------- #
# Admin: user management
# --------------------------------------------------------------------------- #
@router.get(
    "/users",
    response_model=PaginatedUsers,
    dependencies=[Depends(require_role(UserRole.admin))],
)
def list_users(
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
) -> PaginatedUsers:
    """List users (admin only), paginated."""
    page = max(page, 1)
    size = min(max(size, 1), 100)
    total = db.query(User).count()
    users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    main_id = _main_admin_id(db)
    return PaginatedUsers(
        total=total,
        page=page,
        size=size,
        items=[_to_out(db, u, main_id) for u in users],
    )


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
)
def create_user(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
) -> UserOut:
    """Create a new user (admin only).

    A user created with role=admin has the exact same permissions as
    every other admin — the only account with special protection is the
    original system-seeded admin (see `_main_admin_id`).
    """
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered",
        )
    user = User(
        username=payload.username,
        full_name=payload.full_name,
        email=f"{payload.username}@philfida.local",
        role=payload.role,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _audit(
        db,
        user=current_user,
        action="CREATE_USER",
        request=request,
        entity_type="user",
        entity_id=str(user.id),
        details={"username": user.username, "role": user.role.value},
    )
    return _to_out(db, user)


@router.put("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    request: Request,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
) -> UserOut:
    """Update a user's role and/or active status (admin only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    main_id = _main_admin_id(db)
    if user.id == main_id:
        if payload.role is not None and payload.role != UserRole.admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The primary administrator's role cannot be changed.",
            )
        if payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="The primary administrator cannot be deactivated.",
            )

    changes: dict = {}
    if payload.role is not None:
        user.role = payload.role
        changes["role"] = payload.role.value
    if payload.is_active is not None:
        user.is_active = payload.is_active
        changes["is_active"] = payload.is_active
    db.add(user)
    db.commit()
    db.refresh(user)
    _audit(
        db,
        user=current_user,
        action="UPDATE_USER",
        request=request,
        entity_type="user",
        entity_id=str(user.id),
        details=changes,
    )
    return _to_out(db, user, main_id)


@router.delete("/users/{user_id}")
def delete_user(
    user_id: uuid.UUID,
    payload: DeleteUserRequest,
    request: Request,
    current_user: User = Depends(require_role(UserRole.admin)),
    db: Session = Depends(get_db),
) -> dict:
    """Permanently delete a user account (admin only).

    This is a true hard-delete — the account vanishes from the system
    and cannot be recovered (that's the distinction from *deactivating*,
    which is reversible). Guarded four ways: an admin cannot delete their
    own account, the original system-seeded admin can never be deleted by
    anyone, the deletion must be confirmed with the *acting* admin's own
    password, and a user who has recorded transactions is blocked (their
    authorship must stay intact — deactivate them instead).

    Audit-log rows created by the deleted user are kept but anonymized
    (user_id set to NULL) so the history survives without a dangling
    foreign key.
    """
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    if user.id == _main_admin_id(db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The primary administrator account cannot be deleted.",
        )

    if not verify_password(payload.password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect password.",
        )

    txn_count = (
        db.query(Transaction).filter(Transaction.created_by == user.id).count()
    )
    if txn_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"This user has recorded {txn_count} transaction(s) and "
                "cannot be permanently deleted. Deactivate them instead."
            ),
        )

    username = user.username

    # Anonymize audit rows this user authored, then remove the account.
    db.query(AuditLog).filter(AuditLog.user_id == user.id).update(
        {AuditLog.user_id: None}, synchronize_session=False
    )
    db.delete(user)
    db.commit()

    _audit(
        db,
        user=current_user,
        action="DELETE_USER",
        request=request,
        entity_type="user",
        entity_id=str(user_id),
        details={"username": username},
    )
    return {"message": "User deleted"}
