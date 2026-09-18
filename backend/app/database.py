"""Database engine, session, and base setup."""

from collections.abc import Generator
import uuid

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import (
    Session,
    declarative_base,
    sessionmaker,
    with_loader_criteria,
)
from sqlalchemy.pool import NullPool

from app.config import settings
from app.models import RegionScopedMixin

_is_sqlite = settings.DATABASE_URL.startswith("sqlite")

# SQLite requires disabling the same-thread check for use with FastAPI.
_connect_args = {"check_same_thread": False} if _is_sqlite else {}
_engine_options = {"connect_args": _connect_args, "pool_pre_ping": True}

if not _is_sqlite:
    # Supabase's transaction pooler is designed for short-lived/serverless
    # workloads. Disable psycopg named prepared statements and avoid keeping
    # a process-local pool that can multiply across Vercel workers.
    _engine_options["connect_args"] = {"prepare_threshold": None}
    if settings.ENVIRONMENT.lower() in {"production", "prod"}:
        _engine_options["poolclass"] = NullPool

engine = create_engine(settings.DATABASE_URL, **_engine_options)

if _is_sqlite:
    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_conn, _connection_record):
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA journal_mode=WAL")       # crash-safe write-ahead log
        cursor.execute("PRAGMA foreign_keys=ON")        # enforce referential integrity
        cursor.execute("PRAGMA synchronous=NORMAL")     # safe + faster with WAL
        cursor.close()

SessionLocal = sessionmaker(
    bind=engine, autocommit=False, autoflush=False
)

Base = declarative_base()


@event.listens_for(Session, "do_orm_execute")
def _apply_region_scope(execute_state) -> None:
    """Add the authenticated region predicate to every ORM read/write."""
    region_id = execute_state.session.info.get("region_id")
    if not region_id or execute_state.is_column_load:
        return
    execute_state.statement = execute_state.statement.options(
        with_loader_criteria(
            RegionScopedMixin,
            lambda cls: cls.region_id == region_id,
            include_aliases=True,
        )
    )


@event.listens_for(Session, "before_flush")
def _assign_region_on_insert(session: Session, _flush_context, _instances) -> None:
    """Stamp all new regional rows with the authenticated tenant key."""
    region_id = session.info.get("region_id")
    if not region_id:
        return
    for obj in session.new:
        if isinstance(obj, RegionScopedMixin) and getattr(obj, "region_id", None) is None:
            obj.region_id = uuid.UUID(str(region_id))


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a database session and closes it."""
    db = SessionLocal()
    try:
        yield db
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def clear_region_context(db: Session) -> None:
    """Clear a previous request's tenant context before username lookup."""
    db.info.pop("region_id", None)
    if settings.DATABASE_URL.startswith("sqlite"):
        return
    db.execute(text("select set_config('app.region_id', '', false)"))


def set_region_context(db: Session, region_id) -> None:
    """Set the tenant context for ORM scoping and PostgreSQL RLS."""
    value = uuid.UUID(str(region_id))
    db.info["region_id"] = value
    if settings.DATABASE_URL.startswith("sqlite"):
        return
    db.execute(
        text("select set_config('app.region_id', :region_id, false)"),
        {"region_id": str(value)},
    )
