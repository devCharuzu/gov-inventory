"""Database engine, session, and base setup."""

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import NullPool

from app.config import settings

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
