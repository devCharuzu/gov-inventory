"""Portable admin backup export.

The old route downloaded a SQLite file, which is not meaningful for the
Supabase deployment. This route exports application rows as JSON instead.
"""

import json
from datetime import date, datetime, timezone
from enum import Enum

from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import (
    AppSetting,
    AuditLog,
    Category,
    Item,
    NumberCounter,
    ReportDocument,
    Signatory,
    Transaction,
    User,
    UserRole,
)
from app.utils.security import require_role

router = APIRouter(prefix="/backup", tags=["backup"])
admin_only = require_role(UserRole.admin)


def _json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Enum):
        return value.value
    return str(value)


def _rows(db: Session, model) -> list[dict]:
    result = []
    for row in db.execute(select(model)).scalars().all():
        result.append(
            {
                column.name: getattr(row, column.name)
                for column in model.__table__.columns
                if column.name != "content"
            }
        )
    return result


@router.get("/download", dependencies=[Depends(admin_only)])
def download_backup(db: Session = Depends(get_db)) -> Response:
    """Download a portable JSON export of application data."""
    payload = {
        "format": "philfida-inventory-json",
        "version": 1,
        "generated_at": datetime.now(timezone.utc),
        "tables": {
            "users": _rows(db, User),
            "categories": _rows(db, Category),
            "items": _rows(db, Item),
            "transactions": _rows(db, Transaction),
            "audit_logs": _rows(db, AuditLog),
            "signatories": _rows(db, Signatory),
            "app_settings": _rows(db, AppSetting),
            "number_counters": _rows(db, NumberCounter),
            "report_documents": _rows(db, ReportDocument),
        },
    }
    body = json.dumps(payload, default=_json_default, indent=2).encode("utf-8")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return Response(
        content=body,
        media_type="application/json",
        headers={
            "Content-Disposition": f'attachment; filename="gov_inventory-backup-{stamp}.json"'
        },
    )
