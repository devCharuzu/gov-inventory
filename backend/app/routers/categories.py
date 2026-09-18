"""Category routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, Category, User, UserRole
from app.schemas.category import CategoryCreate, CategoryOut, CategoryUpdate
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/categories", tags=["categories"])

encoder_or_admin = require_role(UserRole.encoder, UserRole.admin)
admin_only = require_role(UserRole.admin)


def _audit(
    db: Session,
    *,
    user: User,
    action: str,
    request: Request | None = None,
    entity_id: str | None = None,
    details: dict | None = None,
) -> None:
    """Persist an audit log entry for a category action."""
    db.add(
        AuditLog(
            user_id=user.id,
            action=action,
            entity_type="category",
            entity_id=entity_id,
            details=details,
            ip_address=request.client.host if request and request.client else None,
        )
    )
    db.commit()


@router.get("/", response_model=list[CategoryOut])
def list_categories(
    is_active: bool | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Category]:
    """List categories, optionally filtered by active status."""
    query = db.query(Category)
    if is_active is not None:
        query = query.filter(Category.is_active.is_(is_active))
    return query.order_by(Category.name).all()


@router.post(
    "/", response_model=CategoryOut, status_code=status.HTTP_201_CREATED
)
def create_category(
    payload: CategoryCreate,
    request: Request,
    current_user: User = Depends(encoder_or_admin),
    db: Session = Depends(get_db),
) -> Category:
    """Create a category."""
    exists = (
        db.query(Category).filter(Category.name == payload.name).first()
    )
    if exists:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Category name already exists",
        )
    category = Category(**payload.model_dump())
    db.add(category)
    db.commit()
    db.refresh(category)
    _audit(
        db,
        user=current_user,
        action="CREATE_CATEGORY",
        request=request,
        entity_id=str(category.id),
        details={"name": category.name},
    )
    return category


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: uuid.UUID,
    payload: CategoryUpdate,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> Category:
    """Update a category (admin only — encoders may only create)."""
    category = (
        db.query(Category).filter(Category.id == category_id).first()
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(category, field, value)
    db.add(category)
    db.commit()
    db.refresh(category)
    _audit(
        db,
        user=current_user,
        action="UPDATE_CATEGORY",
        request=request,
        entity_id=str(category.id),
        details={"changed": list(changes.keys())},
    )
    return category


@router.delete("/{category_id}")
def deactivate_category(
    category_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Soft-delete a category by setting is_active=False (admin only)."""
    category = (
        db.query(Category).filter(Category.id == category_id).first()
    )
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )
    category.is_active = False
    db.add(category)
    db.commit()
    _audit(
        db,
        user=current_user,
        action="DEACTIVATE_CATEGORY",
        request=request,
        entity_id=str(category.id),
    )
    return {"message": "Category deactivated"}
