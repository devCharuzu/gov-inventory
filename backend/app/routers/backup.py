"""Database backup routes (admin only)."""

from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse

from app.config import settings
from app.models import UserRole
from app.utils.security import require_role

router = APIRouter(prefix="/backup", tags=["backup"])

admin_only = require_role(UserRole.admin)


def _sqlite_path() -> Path | None:
    """Resolve the on-disk path of the SQLite database, if applicable."""
    url = settings.DATABASE_URL
    if not url.startswith("sqlite"):
        return None
    # sqlite:///./gov_inventory.db  ->  ./gov_inventory.db
    raw = url.split("///", 1)[-1]
    return Path(raw).resolve()


@router.get("/download", dependencies=[Depends(admin_only)])
def download_backup() -> FileResponse:
    """Download a copy of the SQLite database file."""
    path = _sqlite_path()
    if path is None or not path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Database file not available for backup",
        )
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    return FileResponse(
        path,
        media_type="application/octet-stream",
        filename=f"gov_inventory-backup-{stamp}.db",
    )
