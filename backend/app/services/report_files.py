"""Persisted transaction report storage.

Reports are stored as bytea in Postgres so they survive Vercel function
restarts. The same path works with local SQLite for development.
"""

import re
import hashlib
import logging
import uuid as _uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import (
    AppSetting,
    Item,
    Region,
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


def _get_region(db: Session, region_id) -> str:
    region = db.query(Region).filter(Region.id == region_id).first()
    return region.name if region else "Regional Office XIII"


def _safe_name(reference_number: str | None, transaction_id=None) -> str:
    """Sanitize a reference number into a safe filename."""
    if not reference_number:
        suffix = f"-{transaction_id}" if transaction_id else "-no-reference"
        return f"transaction{suffix}.pdf"
    safe = re.sub(r"[^A-Za-z0-9._-]", "_", reference_number)
    # Manual references can contain spaces, slashes, or Unicode; distinguish
    # references that sanitize alike. IDs keep repeated batch refs separate.
    if not re.fullmatch(r"(?:RCV|REL)-[0-9]{4}-[0-9]+", reference_number):
        safe += "-" + hashlib.sha256(reference_number.encode()).hexdigest()[:16]
    if transaction_id:
        safe += f"-{transaction_id}"
    return safe + ".pdf"


def build_transaction_pdf(db: Session, txn: Transaction) -> bytes:
    """Render the official slip PDF for a transaction."""
    item = db.query(Item).filter(Item.id == txn.item_id).first()
    fmt_date = txn.transaction_date.strftime("%B %d, %Y")
    region = _get_region(db, txn.region_id)

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
        # Transaction IDs keep reports distinct when stock-in references repeat.
        name = _safe_name(txn.reference_number, txn.id)
        existing = db.get(ReportDocument, (db.info["region_id"], name))
        if existing:
            existing.content = pdf
            existing.size = len(pdf)
            existing.modified = datetime.now(timezone.utc)
        else:
            db.add(ReportDocument(name=name, content=pdf, size=len(pdf)))
        legacy_name = _owned_legacy_report_name(db, txn.reference_number, txn.id)
        if legacy_name and legacy_name != name:
            legacy = get_report(db, legacy_name)
            if legacy is not None:
                db.delete(legacy)
        db.commit()
        return name
    except Exception:  # pragma: no cover - report generation is best effort
        logging.getLogger(__name__).exception("Could not generate transaction PDF")
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
    return db.get(ReportDocument, (db.info["region_id"], name))


def delete_report(db: Session, name: str) -> bool:
    """Delete one report and return whether it existed."""
    report = get_report(db, name)
    if report is None:
        return False
    db.delete(report)
    db.commit()
    return True


def _owned_legacy_report_name(
    db: Session, reference_number: str | None, transaction_id
) -> str | None:
    """Only the earliest receipt can own a pre-migration reference-only PDF."""
    if not reference_number:
        return None
    first = (
        db.query(Transaction.id)
        .filter(Transaction.reference_number == reference_number)
        .order_by(Transaction.created_at, Transaction.id)
        .first()
    )
    if first and first.id == transaction_id:
        return _safe_name(reference_number)
    return None


def delete_transaction_report(
    db: Session, reference_number: str | None, transaction_id
) -> bool:
    """Stage only this transaction's PDFs for deletion in the caller's commit."""
    names = {_safe_name(reference_number, transaction_id)}
    legacy_name = _owned_legacy_report_name(db, reference_number, transaction_id)
    if legacy_name:
        names.add(legacy_name)
    deleted = False
    for name in names:
        report = get_report(db, name)
        if report is not None:
            db.delete(report)
            deleted = True
    return deleted


def delete_reports(db: Session, names: list[str]) -> int:
    """Delete multiple reports and return the number deleted."""
    if not names:
        return 0
    count = db.query(ReportDocument).filter(ReportDocument.name.in_(names)).delete(
        synchronize_session=False
    )
    db.commit()
    return count
