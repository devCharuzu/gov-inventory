"""Persisted transaction report storage.

Reports are stored as bytea in Postgres so they survive Vercel function
restarts. The same path works with local SQLite for development.
"""

import re
import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AppSetting,
    Item,
    ReportDocument,
    Signatory,
    Transaction,
    TransactionType,
)
from app.services.pdf_service import render_template_to_pdf


def _get_signatory(db: Session, key: str) -> "Signatory | None":
    row = db.query(AppSetting).filter(AppSetting.key == key).first()
    if not row or not row.value:
        return None
    try:
        sid = _uuid.UUID(row.value)
    except ValueError:
        return None
    return db.query(Signatory).filter(
        Signatory.id == sid, Signatory.is_active.is_(True)
    ).first()


def _get_region(db: Session) -> str:
    row = db.query(AppSetting).filter(AppSetting.key == "region").first()
    return row.value if row and row.value else "Regional Office XIII"


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
    """Render and upsert a transaction PDF without affecting the transaction."""
    try:
        pdf = build_transaction_pdf(db, txn)
        name = _safe_name(txn.reference_number)
        existing = db.get(ReportDocument, name)
        if existing:
            existing.content = pdf
            existing.size = len(pdf)
            existing.modified = datetime.now(timezone.utc)
        else:
            db.add(ReportDocument(name=name, content=pdf, size=len(pdf)))
        db.commit()
        return name
    except Exception:  # pragma: no cover - report generation is best effort
        db.rollback()
        return None


def regenerate_all_reports(db: Session) -> int:
    """Re-render every active transaction report with current settings."""
    count = 0
    for txn in db.query(Transaction).filter(Transaction.voided.is_(False)).all():
        if save_transaction_report(db, txn):
            count += 1
    return count


def list_reports(db: Session) -> list[dict]:
    """List stored report metadata, newest first."""
    rows = db.execute(
        select(
            ReportDocument.name,
            ReportDocument.size,
            ReportDocument.modified,
        ).order_by(ReportDocument.modified.desc())
    ).all()
    return [
        {"name": row.name, "size": row.size, "modified": row.modified}
        for row in rows
    ]


def get_report(db: Session, name: str) -> ReportDocument | None:
    """Fetch a report by safe filename."""
    return db.get(ReportDocument, name)


def delete_report(db: Session, name: str) -> bool:
    """Delete one report and return whether it existed."""
    report = get_report(db, name)
    if report is None:
        return False
    db.delete(report)
    db.commit()
    return True


def delete_reports(db: Session, names: list[str]) -> int:
    """Delete multiple reports and return the number deleted."""
    if not names:
        return 0
    count = db.query(ReportDocument).filter(ReportDocument.name.in_(names)).delete(
        synchronize_session=False
    )
    db.commit()
    return count
