"""Stock-card balances reconstructed from one consistent inventory snapshot."""

import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from app.models import Item, Transaction, TransactionType

_OFFICE_TIMEZONE = ZoneInfo("Asia/Manila")


def _utc(value: datetime) -> datetime:
    # SQLite fixtures return naive timestamps; production stores UTC-aware ones.
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _date(value: datetime) -> str:
    local = _utc(value).astimezone(_OFFICE_TIMEZONE)
    return f"{local.month}/{local.day}/{local.year % 100:02d}"


def build_stock_card(
    db: Session,
    item_id: uuid.UUID,
    *,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
) -> dict:
    start = _utc(start_date) if start_date else None
    end = _utc(end_date) if end_date else None
    if start and end and start > end:
        raise HTTPException(status_code=422, detail="Start date must be on or before end date.")

    # Read quantity and movements in the same SQL statement. Concurrent receipts
    # cannot leave us with an old quantity paired with newer transactions.
    snapshot = db.execute(
        select(Item, Transaction)
        .outerjoin(Transaction, and_(
            Transaction.item_id == Item.id,
            Transaction.region_id == Item.region_id,
            Transaction.voided.is_(False),
        ))
        .where(Item.id == item_id)
        .order_by(Transaction.transaction_date, Transaction.created_at, Transaction.id)
    ).all()
    if not snapshot:
        raise HTTPException(status_code=404, detail="Item not found")

    item = snapshot[0][0]
    transactions = [txn for _, txn in snapshot if txn is not None]

    def movement(txn: Transaction) -> int:
        return txn.quantity if txn.transaction_type == TransactionType.IN else -txn.quantity

    # Existing items may have initial quantities without receipt transactions.
    # Anchor the ledger to on-hand stock, then replay every surviving movement.
    balance = item.quantity - sum(movement(txn) for txn in transactions)
    opening_balance = balance
    rows = []
    for txn in transactions:
        date = _utc(txn.transaction_date)
        if end and date > end:
            break
        balance += movement(txn)
        if start and date < start:
            opening_balance = balance
            continue
        is_receipt = txn.transaction_type == TransactionType.IN
        rows.append({
            "date": _date(date),
            "reference": (txn.reference_number or "") if is_receipt else "",
            "receipt": txn.quantity if is_receipt else "",
            "issue": "" if is_receipt else txn.quantity,
            "office": "" if is_receipt else (txn.recipient_department or txn.recipient_name or ""),
            "balance": balance,
        })

    period = ""
    if start or end:
        period = f"Period: {_date(start) if start else 'Beginning'} to {_date(end) if end else 'Latest transaction'}"
    return {
        "item": item,
        "rows": rows,
        # No activity in the selected period means a completely blank card:
        # do not expose the item's seed quantity as a transaction or balance.
        "opening_balance": opening_balance if rows else None,
        "closing_balance": balance if rows else None,
        "period": period,
        "blank_rows": max(0, 32 - len(rows)),
    }
