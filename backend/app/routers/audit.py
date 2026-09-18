"""Audit log routes (admin only)."""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AuditLog, User, UserRole
from app.schemas.audit import AuditLogOut, PaginatedAuditLogs
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
