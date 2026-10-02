"""Transaction routes."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AuditLog,
    Item,
    Transaction,
    TransactionType,
    User,
    UserRole,
)
from app.schemas.transaction import (
    PaginatedTransactions,
    StockInCreate,
    StockOutCreate,
    TransactionOut,
)
from app.services.report_files import save_transaction_report
from app.services.numbering import next_number
from app.utils.security import get_current_user, require_role

router = APIRouter(prefix="/transactions", tags=["transactions"])

encoder_or_admin = require_role(UserRole.encoder, UserRole.admin)
admin_only = require_role(UserRole.admin)

_REF_PREFIX = {TransactionType.IN: "RCV", TransactionType.OUT: "REL"}


def _audit(
    db: Session,
    *,
    user: User,
    action: str,
    request: Request | None = None,
    entity_id: str | None = None,
    details: dict | None = None,
) -> None:
    """Persist an audit log entry for a transaction action."""
    db.add(
        AuditLog(
            user_id=user.id,
            action=action,
            entity_type="transaction",
            entity_id=entity_id,
            details=details,
            ip_address=request.client.host if request and request.client else None,
        )
    )
    db.commit()


def _next_reference(db: Session, txn_type: TransactionType) -> str:
    """Generate the next reference number, e.g. RCV-2026-0001 / REL-2026-0001.

    Sequence resets per year and is scoped to the transaction type's prefix.
    """
    prefix = _REF_PREFIX[txn_type]
    year = datetime.now(timezone.utc).year
    seq = next_number(db, f"transaction:{prefix}:{year}")
    return f"{prefix}-{year}-{seq:04d}"


def _get_item_or_404(
    db: Session, item_id: uuid.UUID, *, lock: bool = False
) -> Item:
    query = db.query(Item).filter(Item.id == item_id)
    if lock:
        query = query.with_for_update(of=Item)
    item = query.first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Item not found"
        )
    return item


@router.get("/", response_model=PaginatedTransactions)
def list_transactions(
    type: TransactionType | None = None,
    item_id: uuid.UUID | None = None,
    reference_number: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    created_by: uuid.UUID | None = None,
    recipient_name: str | None = None,
    recipient_unit: str | None = None,
    item_search: str | None = None,
    page: int = 1,
    size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> PaginatedTransactions:
    """List transactions with optional filters."""
    if start_date is not None:
        start_date = start_date.replace(tzinfo=timezone.utc) if start_date.tzinfo is None else start_date.astimezone(timezone.utc)
    if end_date is not None:
        end_date = end_date.replace(tzinfo=timezone.utc) if end_date.tzinfo is None else end_date.astimezone(timezone.utc)
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")
    page = max(page, 1)
    size = min(max(size, 1), 100)

    query = db.query(Transaction)
    if type is not None:
        query = query.filter(Transaction.transaction_type == type)
    if item_id is not None:
        query = query.filter(Transaction.item_id == item_id)
    if reference_number and reference_number.strip():
        query = query.filter(Transaction.reference_number == reference_number.strip())
    if start_date is not None:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date is not None:
        query = query.filter(Transaction.transaction_date <= end_date)
    if created_by is not None:
        query = query.filter(Transaction.created_by == created_by)
    if recipient_name and recipient_name.strip():
        query = query.filter(
            Transaction.recipient_name.ilike(f"%{recipient_name.strip()}%")
        )
    if recipient_unit and recipient_unit.strip():
        query = query.filter(
            Transaction.recipient_department == recipient_unit.strip()
        )
    if item_search and item_search.strip():
        pattern = f"%{item_search.strip()}%"
        query = query.filter(
            Transaction.item.has(
                or_(Item.name.ilike(pattern), Item.code.ilike(pattern))
            )
        )

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


@router.post(
    "/in", response_model=TransactionOut, status_code=status.HTTP_201_CREATED
)
def stock_in(
    payload: StockInCreate,
    request: Request,
    current_user: User = Depends(encoder_or_admin),
    db: Session = Depends(get_db),
) -> Transaction:
    """Record a stock-in transaction and increase item quantity."""
    item = _get_item_or_404(db, payload.item_id, lock=True)

    txn = Transaction(
        transaction_type=TransactionType.IN,
        reference_number=payload.reference_number,
        item_id=item.id,
        quantity=payload.quantity,
        condition=payload.condition,
        purpose=payload.purpose,
        remarks=payload.remarks,
        transaction_date=payload.transaction_date
        or datetime.now(timezone.utc),
        created_by=current_user.id,
    )
    item.quantity += payload.quantity
    db.add_all([txn, item])
    db.commit()
    db.refresh(txn)
    _audit(
        db,
        user=current_user,
        action="STOCK_IN",
        request=request,
        entity_id=str(txn.id),
        details={
            "reference_number": txn.reference_number,
            "item_id": str(item.id),
            "quantity": payload.quantity,
        },
    )
    save_transaction_report(db, txn)
    return txn


@router.post(
    "/out", response_model=TransactionOut, status_code=status.HTTP_201_CREATED
)
def stock_out(
    payload: StockOutCreate,
    request: Request,
    current_user: User = Depends(encoder_or_admin),
    db: Session = Depends(get_db),
) -> Transaction:
    """Record a stock-out transaction and decrease item quantity."""
    item = _get_item_or_404(db, payload.item_id, lock=True)

    if item.quantity < payload.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Insufficient stock",
        )

    txn = Transaction(
        transaction_type=TransactionType.OUT,
        reference_number=_next_reference(db, TransactionType.OUT),
        item_id=item.id,
        quantity=payload.quantity,
        recipient_name=payload.recipient_name,
        recipient_department=payload.recipient_department,
        condition=payload.condition,
        purpose=payload.purpose,
        remarks=payload.remarks,
        transaction_date=payload.transaction_date
        or datetime.now(timezone.utc),
        created_by=current_user.id,
    )
    item.quantity -= payload.quantity
    db.add_all([txn, item])
    db.commit()
    db.refresh(txn)
    _audit(
        db,
        user=current_user,
        action="STOCK_OUT",
        request=request,
        entity_id=str(txn.id),
        details={
            "reference_number": txn.reference_number,
            "item_id": str(item.id),
            "quantity": payload.quantity,
        },
    )
    save_transaction_report(db, txn)
    return txn


@router.get("/{transaction_id}", response_model=TransactionOut)
def get_transaction(
    transaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> Transaction:
    """Return a single transaction."""
    txn = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return txn


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]


# NOTE: static-path DELETE routes (/bulk) must be declared BEFORE the
# parametrized /{transaction_id} route, or FastAPI matches "bulk" as an id
# and fails to parse it as a UUID.
@router.delete("/bulk", response_model=dict)
def bulk_delete_transactions(
    body: BulkDeleteRequest,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Hard-delete multiple transactions (admin only). Reverses stock for non-voided rows."""
    from app.services import report_files

    count = 0
    for txn_id in body.ids:
        txn = db.query(Transaction).filter(Transaction.id == txn_id).first()
        if not txn:
            continue
        if not txn.voided:
            item = db.query(Item).filter(Item.id == txn.item_id).first()
            if item:
                if txn.transaction_type == TransactionType.IN:
                    item.quantity = max(0, item.quantity - txn.quantity)
                else:
                    item.quantity += txn.quantity
                db.add(item)
        # Remove the stored PDF slip so it doesn't orphan in Reports > Documents.
        report_files.delete_transaction_report(
            db, txn.reference_number, txn.id
        )
        db.delete(txn)
        count += 1
    db.commit()
    _audit(db, user=current_user, action="DELETE_TRANSACTIONS", request=request,
           details={"count": count, "ids": [str(i) for i in body.ids]})
    return {"deleted": count}


@router.delete("/{transaction_id}")
def void_transaction(
    transaction_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Void a transaction, reversing its effect on item quantity (admin only)."""
    txn = (
        db.query(Transaction)
        .filter(Transaction.id == transaction_id)
        .first()
    )
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    if txn.voided:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Transaction already voided",
        )

    item = db.query(Item).filter(Item.id == txn.item_id).first()
    if item:
        if txn.transaction_type == TransactionType.IN:
            # Reversing a receipt removes the stock it added.
            if item.quantity < txn.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot void: would result in negative stock",
                )
            item.quantity -= txn.quantity
        else:
            # Reversing a release returns the stock.
            item.quantity += txn.quantity
        db.add(item)

    txn.voided = True
    db.add(txn)
    db.commit()
    _audit(
        db,
        user=current_user,
        action="VOID_TRANSACTION",
        request=request,
        entity_id=str(txn.id),
        details={
            "reference_number": txn.reference_number,
            "reversed_quantity": txn.quantity,
        },
    )
    return {"message": "Transaction voided"}


@router.delete("/hard/{transaction_id}", response_model=dict)
def hard_delete_transaction(
    transaction_id: uuid.UUID,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Hard-delete a single transaction (admin only). Reverses stock if not already voided."""
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if not txn.voided:
        item = db.query(Item).filter(Item.id == txn.item_id).first()
        if item:
            if txn.transaction_type == TransactionType.IN:
                item.quantity = max(0, item.quantity - txn.quantity)
            else:
                item.quantity += txn.quantity
            db.add(item)
    ref = txn.reference_number
    # Remove the stored PDF slip so it doesn't orphan in Reports > Documents.
    from app.services import report_files

    report_files.delete_transaction_report(db, ref, txn.id)
    db.delete(txn)
    db.commit()
    _audit(db, user=current_user, action="DELETE_TRANSACTION", request=request,
           details={"reference_number": ref})
    return {"deleted": 1}
