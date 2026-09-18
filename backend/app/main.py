"""FastAPI application entrypoint."""

import logging
import time
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import SessionLocal, engine
from app.models import Base, User, UserRole
from app.routers import (
    analytics,
    audit,
    auth,
    backup,
    categories,
    items,
    reports,
    signatories,
    transactions,
)
from app.utils.security import hash_password

logger = logging.getLogger("gov_inventory")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(message)s",
)

app = FastAPI(title=settings.APP_NAME, version="1.0.0")

WEB_ROOT = Path(__file__).resolve().parent.parent / "static"
WEB_INDEX = WEB_ROOT / "index.html"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers, all mounted under /api (each router carries its own sub-prefix).
for _router in (
    auth.router,
    items.router,
    categories.router,
    transactions.router,
    analytics.router,
    reports.router,
    audit.router,
    backup.router,
    signatories.router,
):
    app.include_router(_router, prefix="/api")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log method, path, status, and duration for every request."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    logger.info(
        "%s %s -> %s (%.1f ms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Return HTTP errors as {"detail": ...} preserving their status code."""
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(
    request: Request, exc: Exception
) -> JSONResponse:
    """Return any unhandled error as a 500 with its message."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": str(exc)})


def _ensure_schema(db) -> None:
    """Additive SQLite migrations — create_all never ALTERs existing tables.

    Adds columns introduced after a table was first created so existing
    databases stay compatible without dropping any data.
    """
    additive = {
        "signatories": {"unit": "VARCHAR(200)"},
        "users": {"position": "VARCHAR(200)"},
    }
    for table, columns in additive.items():
        existing = {row[1] for row in db.execute(text(f"PRAGMA table_info({table})")).all()}
        if not existing:
            continue  # table not created yet; create_all handles it
        for col, decl in columns.items():
            if col not in existing:
                db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {decl}"))
                logger.info("Added missing column %s.%s", table, col)
    db.commit()


@app.on_event("startup")
def on_startup() -> None:
    """Create tables, verify integrity, and seed a default admin user if none exist."""
    Base.metadata.create_all(bind=engine)  # additive only — never drops existing tables

    db = SessionLocal()
    try:
        _ensure_schema(db)

        # Integrity check — runs after WAL/FK pragmas are applied by the connect event.
        result = db.execute(text("PRAGMA integrity_check")).scalar()
        if result != "ok":
            logger.error("SQLite integrity_check returned: %s", result)
        else:
            logger.info("Database integrity OK.")

        if db.query(User).count() == 0:
            # Blank password on purpose: first login is username "admin" with
            # the password left empty; the UI then forces setting a real one.
            admin = User(
                username="admin",
                full_name="System Administrator",
                email="admin@gov.local",
                hashed_password=hash_password(""),
                role=UserRole.admin,
            )
            db.add(admin)
            db.commit()
            logger.info("Seeded default admin user (username='admin', blank password).")
    finally:
        db.close()


@app.get("/health")
def health() -> dict:
    """Liveness/health probe."""
    return {"status": "ok", "app": settings.APP_NAME}


@app.api_route("/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
def serve_web_app(path: str) -> FileResponse:
    """Serve the compiled SPA and fall back to index.html for client routes."""
    if path == "api" or path.startswith("api/"):
        raise StarletteHTTPException(status_code=404, detail="API route not found")
    requested = (WEB_ROOT / path).resolve()
    if WEB_ROOT in requested.parents and requested.is_file():
        return FileResponse(requested)
    if WEB_INDEX.is_file():
        return FileResponse(WEB_INDEX)
    raise StarletteHTTPException(
        status_code=404,
        detail="Frontend build not found. Run ./start-local.sh to build it.",
    )


if __name__ == "__main__":
    import os

    import uvicorn

    port = int(os.environ.get("BACKEND_PORT", "8000"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
