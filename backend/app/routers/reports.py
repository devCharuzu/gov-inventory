"""Report routes.

Each endpoint returns a ``StreamingResponse`` of ``application/pdf`` produced
by WeasyPrint. The two slip endpoints render the project HTML templates; the
tabular reports build HTML inline.
"""

import html
import uuid
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import AppSetting, Item, Signatory, Transaction, TransactionType, User, UserRole
from app.routers.analytics import summary as analytics_summary
from app.routers.analytics import top_items as analytics_top_items
from app.routers.analytics import trends as analytics_trends
from app.services import report_files
from app.services.pdf_service import render_html_to_pdf, render_template_to_pdf
from app.utils.security import get_current_user, require_role


class StoredReport(BaseModel):
    """Metadata for a persisted transaction report file."""

    name: str
    size: int
    modified: datetime

router = APIRouter(prefix="/reports", tags=["reports"])


def _pdf_response(pdf: bytes, filename: str) -> StreamingResponse:
    """Wrap PDF bytes in a streaming response shown inline in the browser."""
    return StreamingResponse(
        BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


def _fmt(dt: datetime | None) -> str:
    return dt.strftime("%B %d, %Y") if dt else ""


def _e(value) -> str:
    """HTML-escape a value for safe inline interpolation."""
    return html.escape(str(value)) if value is not None else ""


def _get_signatory(db: Session, key: str) -> Signatory | None:
    """Look up a signatory by the saved setting key."""
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


@router.get("/request-form/{transaction_id}")
def request_form(
    transaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> StreamingResponse:
    """Render the requisition/issue slip for an OUT transaction."""
    txn = (
        db.query(Transaction).filter(Transaction.id == transaction_id).first()
    )
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    if txn.transaction_type != TransactionType.OUT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request form is only available for OUT transactions",
        )
    item = db.query(Item).filter(Item.id == txn.item_id).first()
    certifier = _get_signatory(db, "certifier_id")
    issuer = _get_signatory(db, "issuer_id")
    region = _get_region(db)

    pdf = render_template_to_pdf(
        "request_form.html",
        {
            "transaction": txn,
            "item": item,
            "issue_date": _fmt(txn.transaction_date),
            "certifier": certifier,
            "issuer": issuer,
            "region": region,
        },
    )
    return _pdf_response(pdf, f"request-form-{txn.reference_number}.pdf")


@router.get("/received-form/{transaction_id}")
def received_form(
    transaction_id: uuid.UUID,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> StreamingResponse:
    """Render the receiving report for an IN transaction."""
    txn = (
        db.query(Transaction).filter(Transaction.id == transaction_id).first()
    )
    if not txn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    if txn.transaction_type != TransactionType.IN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Received form is only available for IN transactions",
        )
    item = db.query(Item).filter(Item.id == txn.item_id).first()

    region = _get_region(db)
    pdf = render_template_to_pdf(
        "received_form.html",
        {
            "transaction": txn,
            "item": item,
            "received_date": _fmt(txn.transaction_date),
            "region": region,
            "prepared_by": None,
            "prepared_by_position": None,
        },
    )
    return _pdf_response(pdf, f"received-form-{txn.reference_number}.pdf")


_REPORT_CSS = """
  @page { size: A4 landscape; margin: 1.4cm; }
  body { font-family: "Times New Roman", Georgia, serif; color:#000; font-size:11px; }
  .letterhead { display:flex; align-items:center; justify-content:center; gap:12px; border-bottom:2px solid #000; padding-bottom:8px; margin-bottom:10px; }
  .letterhead img.seal { height:60px; width:60px; object-fit:contain; flex-shrink:0; }
  .letterhead-text { text-align:center; }
  .letterhead .republic { font-size:11px; }
  .letterhead .dept { font-size:11px; }
  .letterhead .agency { font-size:14px; font-weight:bold; text-transform:uppercase; margin-top:2px; }
  .letterhead .office { font-size:11px; }
  .doc-title { text-align:center; font-size:14px; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin:8px 0; }
  .range { text-align:center; font-size:10px; margin-bottom:12px; }
  table { width:100%; border-collapse:collapse; margin-top:6px; }
  th, td { border:1px solid #000; padding:4px 6px; text-align:left; }
  th { background:#000; color:#fff; text-transform:uppercase; font-size:9px; }
  tbody tr:nth-child(even) { background:#ececec; }
  td.num { text-align:right; }
  .empty { text-align:center; font-style:italic; padding:14px; }
  .generated { margin-top:14px; font-size:9px; text-align:right; color:#333; }
  .section-title { font-size:12px; font-weight:bold; text-transform:uppercase; margin:16px 0 4px; border-bottom:1px solid #000; }
"""


def _letterhead(region: str) -> str:
    return (
        '<div class="letterhead">'
        '<img class="seal" src="philfida-logo.png" alt="PhilFIDA">'
        '<div class="letterhead-text">'
        '<div class="republic">Republic of the Philippines</div>'
        '<div class="dept">Department of Agriculture</div>'
        '<div class="agency">Philippine Fiber Industry Development Authority (PhilFIDA)</div>'
        f'<div class="office">{html.escape(region)}</div>'
        "</div>"
        "</div>"
    )


@router.get("/transaction-history")
def transaction_history(
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    type: TransactionType | None = None,
    item_id: uuid.UUID | None = None,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
) -> StreamingResponse:
    """Render a filtered transaction history table as PDF."""
    query = db.query(Transaction)
    if start_date is not None:
        query = query.filter(Transaction.transaction_date >= start_date)
    if end_date is not None:
        query = query.filter(Transaction.transaction_date <= end_date)
    if type is not None:
        query = query.filter(Transaction.transaction_type == type)
    if item_id is not None:
        query = query.filter(Transaction.item_id == item_id)
    txns = query.order_by(Transaction.transaction_date.desc()).all()

    item_codes = {
        i.id: (i.code, i.name)
        for i in db.query(Item.id, Item.code, Item.name).all()
    }

    rows = ""
    for t in txns:
        code, name = item_codes.get(t.item_id, ("", ""))
        rows += (
            "<tr>"
            f"<td>{_fmt(t.transaction_date)}</td>"
            f"<td>{_e(t.reference_number)}</td>"
            f"<td>{_e(t.transaction_type.value)}</td>"
            f"<td>{_e(code)}</td>"
            f"<td>{_e(name)}</td>"
            f'<td class="num">{t.quantity}</td>'
            f"<td>{_e(t.recipient_name or '')}</td>"
            f"<td>{'VOID' if t.voided else 'Posted'}</td>"
            "</tr>"
        )
    if not rows:
        rows = '<tr><td class="empty" colspan="8">No transactions found.</td></tr>'

    parts = []
    if start_date or end_date:
        parts.append(
            f"Period: {_fmt(start_date) or '...'} to {_fmt(end_date) or '...'}"
        )
    if type:
        parts.append(f"Type: {type.value}")
    range_line = " &nbsp;|&nbsp; ".join(parts) or "All transactions"
    region = _get_region(db)

    body = (
        f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{_REPORT_CSS}</style></head><body>"
        f"{_letterhead(region)}"
        f'<div class="doc-title">Transaction History Report</div>'
        f'<div class="range">{range_line}</div>'
        "<table><thead><tr>"
        "<th>Date</th><th>Reference</th><th>Type</th><th>Item Code</th>"
        "<th>Item Name</th><th>Qty</th><th>Party</th><th>Status</th>"
        "</tr></thead><tbody>"
        f"{rows}"
        "</tbody></table>"
        f'<div class="generated">Generated: {_fmt(datetime.now(timezone.utc))} '
        f"&middot; {len(txns)} record(s)</div>"
        "</body></html>"
    )
    return _pdf_response(render_html_to_pdf(body), "transaction-history.pdf")


@router.get("/analytics-report")
def analytics_report(
    period: str = "monthly",
    year: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Render a combined analytics report (summary + trends + top items)."""
    summary = analytics_summary(db=db, _=current_user)
    trends = analytics_trends(
        period=period, year=year, start_date=None, end_date=None,
        db=db, _=current_user,
    )
    tops = analytics_top_items(
        type=None, limit=10, start_date=None, end_date=None,
        db=db, _=current_user,
    )

    region = _get_region(db)
    summary_rows = "".join(
        f"<tr><td>{label}</td><td class='num'>{value}</td></tr>"
        for label, value in [
            ("Total Items", summary.total_items),
            ("Stock-In Today", summary.total_in_today),
            ("Stock-Out Today", summary.total_out_today),
            ("Low-Stock Items", summary.low_stock_count),
        ]
    )

    trend_rows = "".join(
        f"<tr><td>{_e(p.period_label)}</td><td class='num'>{p.total_in}</td>"
        f"<td class='num'>{p.total_out}</td><td class='num'>{p.net}</td></tr>"
        for p in trends
    ) or '<tr><td class="empty" colspan="4">No data.</td></tr>'

    top_rows = "".join(
        f"<tr><td>{_e(t.item_code)}</td><td>{_e(t.item_name)}</td>"
        f"<td class='num'>{t.total_quantity}</td>"
        f"<td class='num'>{t.transaction_count}</td></tr>"
        for t in tops
    ) or '<tr><td class="empty" colspan="4">No data.</td></tr>'

    body = (
        f"<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{_REPORT_CSS}</style></head><body>"
        f"{_letterhead(region)}"
        f'<div class="doc-title">Inventory Analytics Report</div>'
        f'<div class="range">Period grouping: {_e(period)}'
        f"{(' &middot; Year ' + str(year)) if year else ''}</div>"
        '<div class="section-title">Summary</div>'
        "<table><thead><tr><th>Metric</th><th>Value</th></tr></thead>"
        f"<tbody>{summary_rows}</tbody></table>"
        '<div class="section-title">Movement Trends</div>'
        "<table><thead><tr><th>Period</th><th>Total In</th>"
        "<th>Total Out</th><th>Net</th></tr></thead>"
        f"<tbody>{trend_rows}</tbody></table>"
        '<div class="section-title">Top Items</div>'
        "<table><thead><tr><th>Code</th><th>Item</th>"
        "<th>Total Qty</th><th>Txn Count</th></tr></thead>"
        f"<tbody>{top_rows}</tbody></table>"
        f'<div class="generated">Generated: {_fmt(datetime.now(timezone.utc))}</div>'
        "</body></html>"
    )
    return _pdf_response(render_html_to_pdf(body), "analytics-report.pdf")


@router.get("/files", response_model=list[StoredReport])
def list_stored_reports(
    _: User = Depends(get_current_user),
) -> list[StoredReport]:
    """List persisted transaction report PDFs (newest first)."""
    return [StoredReport(**r) for r in report_files.list_reports()]


@router.get("/files/{name}")
def get_stored_report(
    name: str,
    _: User = Depends(get_current_user),
) -> FileResponse:
    """Download a previously stored transaction report PDF."""
    path = report_files.report_path(name)
    if path is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )
    return FileResponse(
        path,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{path.name}"'},
    )


class DeleteReportsRequest(BaseModel):
    names: list[str]


@router.delete("/files", response_model=dict)
def delete_stored_reports(
    body: DeleteReportsRequest,
    _: User = Depends(require_role(UserRole.admin, UserRole.encoder)),
) -> dict:
    """Delete one or more stored report files by name."""
    count = report_files.delete_reports(body.names)
    return {"deleted": count}


@router.delete("/files/{name}", response_model=dict)
def delete_stored_report(
    name: str,
    _: User = Depends(require_role(UserRole.admin, UserRole.encoder)),
) -> dict:
    """Delete a single stored report file."""
    if not report_files.delete_report(name):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Report not found"
        )
    return {"deleted": 1}
