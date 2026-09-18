"""Item routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, Item, Transaction, User, UserRole
from app.schemas.item import (
    ItemCreate,
    ItemDetail,
    ItemOut,
    ItemUpdate,
    PaginatedItems,
)
from app.schemas.transaction import PaginatedTransactions, TransactionOut
from app.services.numbering import next_item_code
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/items", tags=["items"])

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
    """Persist an audit log entry for an item action."""
    db.add(
        AuditLog(
            user_id=user.id,
            action=action,
            entity_type="item",
            entity_id=entity_id,
            details=details,
            ip_address=request.client.host if request and request.client else None,
        )
    )
    db.commit()


def _is_low_stock(item: Item) -> bool:
    return item.quantity <= item.minimum_quantity


@router.get("/", response_model=PaginatedItems)
def list_items(
    search: str | None = None,
    category_id: uuid.UUID | None = None,
    is_active: bool | None = None,
    low_stock: bool = False,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PaginatedItems:
    """List items with optional search and filters."""
    page = max(page, 1)
    size = min(max(size, 1), 100)

    query = db.query(Item)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Item.name.ilike(pattern), Item.code.ilike(pattern))
        )
    if category_id is not None:
        query = query.filter(Item.category_id == category_id)
    if is_active is not None:
        query = query.filter(Item.is_active.is_(is_active))
    if low_stock:
        query = query.filter(Item.quantity <= Item.minimum_quantity)

    total = query.count()
    items = (
        query.order_by(Item.code)
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return PaginatedItems(
        total=total,
        page=page,
        size=size,
        items=[ItemOut.model_validate(i) for i in items],
    )


@router.post("/", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: ItemCreate,
    request: Request,
    current_user: User = Depends(encoder_or_admin),
    db: Session = Depends(get_db),
) -> Item:
    """Create an item; its code is auto-generated as ITM-XXXX."""
    item = Item(code=next_item_code(db), **payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    _audit(
        db,
        user=current_user,
        action="CREATE_ITEM",
        request=request,
        entity_id=str(item.id),
        details={"code": item.code, "name": item.name},
    )
    return item


@router.get("/low-stock", response_model=list[ItemOut])
def low_stock_items(
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[Item]:
    """Return active items at or below their minimum quantity."""
    return (
        db.query(Item)
        .filter(
            Item.is_active.is_(True),
            Item.quantity <= Item.minimum_quantity,
        )
        .order_by(Item.code)
        .all()
    )


@router.get("/{item_id}", response_model=ItemDetail)
def get_item(
    item_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> ItemDetail:
    """Return a single item with its current stock status."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    return ItemDetail(
        **ItemOut.model_validate(item).model_dump(),
        is_low_stock=_is_low_stock(item),
    )


@router.put("/{item_id}", response_model=ItemOut)
def update_item(
    item_id: uuid.UUID,
    payload: ItemUpdate,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> Item:
    """Update an item's fields (admin only — encoders may only create)."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    changes = payload.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(item, field, value)
    db.add(item)
    db.commit()
    db.refresh(item)
    _audit(
        db,
        user=current_user,
        action="UPDATE_ITEM",
        request=request,
        entity_id=str(item.id),
        details={"changed": list(changes.keys())},
    )
    return item


@router.delete("/{item_id}")
def deactivate_item(
    item_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Soft-delete an item by setting is_active=False (admin only)."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    item.is_active = False
    db.add(item)
    db.commit()
    _audit(
        db,
        user=current_user,
        action="DEACTIVATE_ITEM",
        request=request,
        entity_id=str(item.id),
    )
    return {"message": "Item deactivated"}


@router.delete("/{item_id}/hard")
def hard_delete_item(
    item_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Permanently delete an item (admin only).

    Blocked when the item has transaction history, to preserve audit
    integrity — deactivate it instead in that case.
    """
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    txn_count = (
        db.query(Transaction).filter(Transaction.item_id == item_id).count()
    )
    if txn_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Cannot delete: item has {txn_count} transaction record(s). "
                "Deactivate it instead."
            ),
        )
    code = item.code
    db.delete(item)
    db.commit()
    _audit(
        db,
        user=current_user,
        action="DELETE_ITEM",
        request=request,
        entity_id=str(item_id),
        details={"code": code},
    )
    return {"deleted": 1}


@router.get("/{item_id}/transactions", response_model=PaginatedTransactions)
def item_transactions(
    item_id: uuid.UUID,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PaginatedTransactions:
    """Return paginated transaction history for an item."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    page = max(page, 1)
    size = min(max(size, 1), 100)

    query = db.query(Transaction).filter(Transaction.item_id == item_id)
    total = query.count()
    txns = (
        query.order_by(Transaction.transaction_date.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )
    return PaginatedTransactions(
        total=total,
        page=page,
        size=size,
        items=[TransactionOut.model_validate(t) for t in txns],
    )
