"""Persisted transaction report storage.

Every stock-in/out transaction has its official slip rendered to a PDF and
stored on disk so it can be retrieved later from the Reports section.
"""

import os
import re
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import AppSetting, Item, Signatory, Transaction, TransactionType
from app.services.pdf_service import render_template_to_pdf


def _get_signatory(db: Session, key: str) -> "Signatory | None":
    import uuid as _uuid
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row or not row.value:
        return None
    try:
        sid = _uuid.UUID(row.value)
    except ValueError:
        return None
    return db.query(Signatory).filter(Signatory.id == sid, Signatory.is_active == True).first()  # noqa: E712


def _get_region(db: Session) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == "region").first()
    return row.value if (row and row.value) else "Regional Office XIII"


def _reports_dir() -> Path:
    """Directory where generated transaction PDFs are stored.

    Lives next to the database file when DATABASE_PATH is provided, otherwise
    under the backend working directory.
    """
    db_path = os.environ.get("DATABASE_PATH")
    base = Path(db_path).resolve().parent if db_path else Path("./generated_reports")
    target = base / "reports" if db_path else base
    target.mkdir(parents=True, exist_ok=True)
    return target


def _safe_name(reference_number: str) -> str:
    """Sanitize a reference number into a safe filename."""
    return re.sub(r"[^A-Za-z0-9._-]", "_", reference_number) + ".pdf"


def build_transaction_pdf(db: Session, txn: Transaction) -> bytes:
    """Render the official slip PDF for a transaction."""
    item = db.query(Item).filter(Item.id == txn.item_id).first()
    fmt_date = txn.transaction_date.strftime("%B %d, %Y")

    region = _get_region(db)

    if txn.transaction_type == TransactionType.OUT:
        return render_template_to_pdf(
            "request_form.html",
            {
                "transaction": txn,
                "item": item,
                "issue_date": fmt_date,
                "certifier": _get_signatory(db, "certifier_id"),
                "issuer": _get_signatory(db, "issuer_id"),
                "region": region,
            },
        )

    return render_template_to_pdf(
        "received_form.html",
        {
            "transaction": txn,
            "item": item,
            "received_date": fmt_date,
            "region": region,
        },
    )


def save_transaction_report(db: Session, txn: Transaction) -> str | None:
    """Render and persist the transaction PDF. Returns the stored filename.

    Never raises — a reporting failure must not roll back the transaction.
    """
    try:
        pdf = build_transaction_pdf(db, txn)
        name = _safe_name(txn.reference_number)
        (_reports_dir() / name).write_bytes(pdf)
        return name
    except Exception:  # pragma: no cover - best-effort persistence
        return None


def regenerate_all_reports(db: Session) -> int:
    """Re-render every transaction's stored slip with current settings.

    Called when document settings (region, signatories) change so the stored
    archive reflects the new header/signatories instead of the values that were
    in effect when each slip was first generated. Returns the number rebuilt.
    """
    count = 0
    for txn in db.query(Transaction).filter(Transaction.voided.is_(False)).all():
        if save_transaction_report(db, txn):
            count += 1
    return count


def list_reports() -> list[dict]:
    """List stored report files, newest first."""
    out: list[dict] = []
    for p in _reports_dir().glob("*.pdf"):
        stat = p.stat()
        out.append(
            {
                "name": p.name,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(
                    stat.st_mtime, tz=timezone.utc
                ),
            }
        )
    out.sort(key=lambda r: r["modified"], reverse=True)
    return out


def report_path(name: str) -> Path | None:
    """Resolve a stored report path, guarding against path traversal."""
    safe = Path(name).name
    candidate = _reports_dir() / safe
    return candidate if candidate.exists() else None


def delete_report(name: str) -> bool:
    """Delete a single stored report. Returns True if deleted, False if not found."""
    path = report_path(name)
    if path is None:
        return False
    path.unlink()
    return True


def delete_reports(names: list[str]) -> int:
    """Delete multiple stored reports. Returns count of deleted files."""
    count = 0
    for name in names:
        if delete_report(name):
            count += 1
    return count
