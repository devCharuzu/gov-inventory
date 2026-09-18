"""Database-backed generated PDF reports.

Vercel function filesystems are ephemeral, so generated reports belong in
Postgres instead of a local directory.
"""

from datetime import datetime

from sqlalchemy import DateTime, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import Base


class ReportDocument(Base):
    """A persisted PDF report keyed by its safe download filename."""

    __tablename__ = "report_documents"

    name: Mapped[str] = mapped_column(String(255), primary_key=True)
    content: Mapped[bytes] = mapped_column(LargeBinary, nullable=False)
    size: Mapped[int] = mapped_column(Integer, nullable=False)
    modified: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
