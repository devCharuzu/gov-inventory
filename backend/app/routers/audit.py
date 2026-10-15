"""Audit log routes (admin only)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, Item, Transaction, TransactionType, User, UserRole
from app.schemas.audit import AuditLogOut, PaginatedAuditLogs
from app.services.report_files import (
    is_batch_line,
    save_batch_slip,
    save_transaction_report,
)
from app.utils.security import require_role

router = APIRouter(prefix="/audit", tags=["audit"])

admin_only = require_role(UserRole.admin)


@router.get(
    "/",
    response_model=PaginatedAuditLogs,
    dependencies=[Depends(admin_only)],
)
def list_audit_logs(
    user_id: uuid.UUID | None = None,
    action: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    page: int = 1,
    size: int = 25,
    db: Session = Depends(get_db),
) -> PaginatedAuditLogs:
    """List audit log entries with optional filters."""
    page = max(page, 1)
    size = min(max(size, 1), 100)

    query = db.query(AuditLog)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if action is not None:
        query = query.filter(AuditLog.action == action)
    if start_date is not None:
        query = query.filter(AuditLog.created_at >= start_date)
    if end_date is not None:
        query = query.filter(AuditLog.created_at <= end_date)

    total = query.count()
    logs = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    items = [
        AuditLogOut(
            id=log.id,
            user_id=log.user_id,
            user_name=log.user.full_name if log.user else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            details=log.details,
            ip_address=log.ip_address,
            created_at=log.created_at,
        )
        for log in logs
    ]
    return PaginatedAuditLogs(total=total, page=page, size=size, items=items)


@router.get(
    "/actions",
    response_model=list[str],
    dependencies=[Depends(admin_only)],
)
def list_actions(db: Session = Depends(get_db)) -> list[str]:
    """Return the distinct set of audit actions for filtering."""
    rows = db.query(AuditLog.action).distinct().order_by(AuditLog.action).all()
    return [r[0] for r in rows]


class RestoreTransactionsRequest(BaseModel):
    audit_log_ids: list[uuid.UUID] = Field(min_length=1, max_length=100)


def _datetime_from_snapshot(value: object) -> datetime:
    if not isinstance(value, str):
        raise ValueError("Expected a timestamp string")
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _transaction_from_snapshot(
    snapshot: object, *, region_id: uuid.UUID
) -> dict:
    """Validate a stored deletion snapshot before using it to create a row."""
    if not isinstance(snapshot, dict):
        raise ValueError("The deletion snapshot is missing or invalid")

    required = {
        "id",
        "region_id",
        "transaction_type",
        "reference_number",
        "item_id",
        "quantity",
        "recipient_name",
        "recipient_department",
        "purpose",
        "condition",
        "remarks",
        "transaction_date",
        "created_by",
        "voided",
        "restore_stock_delta",
        "created_at",
        "updated_at",
    }
    if not required.issubset(snapshot):
        raise ValueError("This older deletion record has no complete restore snapshot")

    try:
        snapshot_region_id = uuid.UUID(str(snapshot["region_id"]))
        if snapshot_region_id != region_id:
            raise ValueError("The deletion snapshot belongs to another region")
        transaction_type = TransactionType(snapshot["transaction_type"])
        quantity = snapshot["quantity"]
        if not isinstance(quantity, int) or isinstance(quantity, bool) or quantity <= 0:
            raise ValueError("The transaction quantity is invalid")
        if not isinstance(snapshot["voided"], bool):
            raise ValueError("The transaction voided state is invalid")
        restore_stock_delta = snapshot["restore_stock_delta"]
        if not isinstance(restore_stock_delta, int) or isinstance(restore_stock_delta, bool):
            raise ValueError("The transaction stock adjustment is invalid")
        if abs(restore_stock_delta) > quantity:
            raise ValueError("The transaction stock adjustment is invalid")
        if snapshot["voided"] and restore_stock_delta != 0:
            raise ValueError("A voided transaction cannot change stock")
        if transaction_type == TransactionType.IN and restore_stock_delta < 0:
            raise ValueError("The stock-in adjustment is invalid")
        if transaction_type == TransactionType.OUT and restore_stock_delta > 0:
            raise ValueError("The stock-out adjustment is invalid")
        reference_number = snapshot["reference_number"]
        if reference_number is not None and not isinstance(reference_number, str):
            raise ValueError("The transaction reference is invalid")

        return {
            "id": uuid.UUID(str(snapshot["id"])),
            "region_id": region_id,
            "transaction_type": transaction_type,
            "reference_number": reference_number,
            "item_id": uuid.UUID(str(snapshot["item_id"])),
            "quantity": quantity,
            "recipient_name": snapshot["recipient_name"],
            "recipient_department": snapshot["recipient_department"],
            "purpose": snapshot["purpose"],
            "condition": snapshot["condition"],
            "remarks": snapshot["remarks"],
            "transaction_date": _datetime_from_snapshot(snapshot["transaction_date"]),
            "created_by": uuid.UUID(str(snapshot["created_by"])),
            "voided": snapshot["voided"],
            "restore_stock_delta": restore_stock_delta,
            "created_at": _datetime_from_snapshot(snapshot["created_at"]),
            "updated_at": _datetime_from_snapshot(snapshot["updated_at"]),
        }
    except (KeyError, TypeError, ValueError) as exc:
        raise ValueError(f"The transaction restore snapshot is invalid: {exc}") from exc


@router.post(
    "/restore-transactions",
    response_model=dict,
)
def restore_deleted_transactions(
    body: RestoreTransactionsRequest,
    request: Request,
    current_user: User = Depends(admin_only),
    db: Session = Depends(get_db),
) -> dict:
    """Restore transactions only from the selected deletion audit entries."""
    region_id = db.info.get("region_id")
    if not region_id:
        raise HTTPException(status_code=409, detail="Region context is unavailable")
    region_id = uuid.UUID(str(region_id))

    logs = (
        db.query(AuditLog)
        .filter(AuditLog.id.in_(body.audit_log_ids))
        .all()
    )
    logs_by_id = {log.id: log for log in logs}
    if len(logs_by_id) != len(set(body.audit_log_ids)):
        raise HTTPException(status_code=404, detail="One or more audit entries were not found")

    snapshots: list[dict] = []
    source_log_ids: list[str] = []
    for log_id in body.audit_log_ids:
        log = logs_by_id[log_id]
        if log.entity_type != "transaction":
            raise HTTPException(
                status_code=400,
                detail="Select only transaction deletion entries to restore",
            )
        details = log.details if isinstance(log.details, dict) else {}
        if details.get("snapshot_version") != 1:
            details = {}
        if log.action == "DELETE_TRANSACTION":
            entries = [details.get("transaction")] if details else []
        elif log.action == "DELETE_TRANSACTIONS":
            entries = details.get("transactions", []) if details else []
        else:
            raise HTTPException(
                status_code=400,
                detail="Select only transaction deletion entries to restore",
            )
        if not isinstance(entries, list) or not entries:
            raise HTTPException(
                status_code=409,
                detail=(
                    "This deletion entry predates restore snapshots and cannot be "
                    "restored from the audit log. Use a pre-deletion database backup if available."
                ),
            )
        source_log_ids.append(str(log.id))
        try:
            snapshots.extend(
                _transaction_from_snapshot(entry, region_id=region_id)
                for entry in entries
            )
        except ValueError as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc

    snapshot_ids = [snapshot["id"] for snapshot in snapshots]
    if len(snapshot_ids) != len(set(snapshot_ids)):
        raise HTTPException(
            status_code=409,
            detail="The selected audit entries contain the same transaction more than once. Select one deletion entry for it.",
        )

    existing_ids = {
        row[0]
        for row in db.query(Transaction.id)
        .filter(Transaction.id.in_(snapshot_ids))
        .all()
    }
    to_restore = [snapshot for snapshot in snapshots if snapshot["id"] not in existing_ids]
    already_present = len(snapshots) - len(to_restore)
    if not to_restore:
        return {
            "restored": 0,
            "already_present": already_present,
            "transaction_ids": [],
        }

    item_ids = sorted({snapshot["item_id"] for snapshot in to_restore}, key=str)
    items = {
        item.id: item
        for item in (
            db.query(Item)
            .filter(Item.id.in_(item_ids))
            .order_by(Item.id)
            .with_for_update(of=Item)
            .all()
        )
    }
    missing_item_ids = set(item_ids) - set(items)
    if missing_item_ids:
        raise HTTPException(
            status_code=409,
            detail="Cannot restore because one or more linked inventory items no longer exist.",
        )

    outbound_references = {
        snapshot["reference_number"]
        for snapshot in to_restore
        if snapshot["transaction_type"] == TransactionType.OUT
        and snapshot["reference_number"]
    }
    if outbound_references:
        conflicts = (
            db.query(Transaction.reference_number)
            .filter(
                Transaction.transaction_type == TransactionType.OUT,
                Transaction.reference_number.in_(outbound_references),
            )
            .all()
        )
        if conflicts:
            raise HTTPException(
                status_code=409,
                detail="Cannot restore because a stock-out reference number is already in use.",
            )

    stock_deltas: dict[uuid.UUID, int] = {item_id: 0 for item_id in item_ids}
    for snapshot in to_restore:
        stock_deltas[snapshot["item_id"]] += snapshot["restore_stock_delta"]

    for item_id, delta in stock_deltas.items():
        if items[item_id].quantity + delta < 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Cannot restore because {items[item_id].name} does not have "
                    "enough stock for the deleted stock-out transaction."
                ),
            )

    restored_rows = [
        Transaction(
            **{
                key: value
                for key, value in snapshot.items()
                if key != "restore_stock_delta"
            }
        )
        for snapshot in to_restore
    ]
    for item_id, delta in stock_deltas.items():
        if delta:
            items[item_id].quantity += delta
            db.add(items[item_id])
    db.add_all(restored_rows)
    db.add(
        AuditLog(
            user_id=current_user.id,
            action="RESTORE_TRANSACTIONS",
            entity_type="transaction",
            entity_id=str(restored_rows[0].id) if len(restored_rows) == 1 else None,
            details={
                "count": len(restored_rows),
                "transaction_ids": [str(row.id) for row in restored_rows],
                "source_audit_log_ids": source_log_ids,
            },
            ip_address=request.client.host if request.client else None,
        )
    )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="The selected transaction could not be restored because its original ID or reference is already in use.",
        ) from exc

    batch_references: set[str] = set()
    for row in restored_rows:
        master_reference = (
            row.reference_number.rsplit("-", 1)[0]
            if is_batch_line(row.reference_number)
            else row.reference_number
        )
        if (
            row.transaction_type == TransactionType.OUT
            and master_reference
            and (
                is_batch_line(row.reference_number)
                or db.query(Transaction.id)
                .filter(Transaction.reference_number.like(master_reference + "-%"))
                .first()
            )
        ):
            batch_references.add(master_reference)
            continue
        save_transaction_report(db, row)
    for master_reference in batch_references:
        batch_rows = (
            db.query(Transaction)
            .filter(
                or_(
                    Transaction.reference_number == master_reference,
                    Transaction.reference_number.like(master_reference + "-%"),
                )
            )
            .all()
        )
        if batch_rows:
            save_batch_slip(db, master_reference, batch_rows)

    return {
        "restored": len(restored_rows),
        "already_present": already_present,
        "transaction_ids": [str(row.id) for row in restored_rows],
    }


class BulkDeleteAuditRequest(BaseModel):
    ids: list[uuid.UUID]


@router.delete(
    "/bulk",
    response_model=dict,
    dependencies=[Depends(admin_only)],
)
def bulk_delete_audit_logs(
    body: BulkDeleteAuditRequest,
    db: Session = Depends(get_db),
) -> dict:
    """Hard-delete multiple audit log entries (admin only)."""
    count = (
        db.query(AuditLog)
        .filter(AuditLog.id.in_(body.ids))
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": count}


@router.delete(
    "/{log_id}",
    response_model=dict,
    dependencies=[Depends(admin_only)],
)
def delete_audit_log(
    log_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> dict:
    """Hard-delete a single audit log entry (admin only)."""
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Audit log not found")
    db.delete(log)
    db.commit()
    return {"deleted": 1}
