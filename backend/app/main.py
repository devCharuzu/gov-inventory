"""FastAPI application entrypoint."""

import logging
import time
from pathlib import Path

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config import settings
from app.database import SessionLocal, engine, get_db
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
        origin.strip()
        for origin in settings.CORS_ORIGINS.split(",")
        if origin.strip()
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


_collection_paths = {
    route.path.rstrip("/")
    for route in app.routes
    if route.path.startswith("/api/") and route.path.endswith("/")
}


@app.middleware("http")
async def normalize_collection_paths(request: Request, call_next):
    """Accept Vercel's slash-free URLs without redirecting POST requests."""
    if request.scope["path"] in _collection_paths:
        request.scope["path"] += "/"
    return await call_next(request)


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
    """Return a generic 500 without exposing database or configuration details."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


def _ensure_schema(db) -> None:
    """Additive SQLite migrations — create_all never ALTERs existing tables.

    Adds columns introduced after a table was first created so existing
    databases stay compatible without dropping any data.
    """
    if db.get_bind().dialect.name != "sqlite":
        return

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
    """Prepare local development and verify the deployed schema.

    Production schema changes are applied through reviewed Supabase migrations,
    never during a Vercel cold start.
    """
    if settings.AUTO_CREATE_SCHEMA:
        Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        if settings.AUTO_CREATE_SCHEMA:
            _ensure_schema(db)

        if db.get_bind().dialect.name == "sqlite":
            result = db.execute(text("PRAGMA integrity_check")).scalar()
            if result != "ok":
                logger.error("SQLite integrity_check returned: %s", result)
            else:
                logger.info("Database integrity OK.")
        else:
            db.execute(text("SELECT 1"))
            logger.info("PostgreSQL connectivity OK.")

        if db.query(User).count() == 0:
            if settings.ENVIRONMENT.lower() in {"production", "prod"}:
                if not settings.INITIAL_ADMIN_PASSWORD:
                    logger.error(
                        "No users exist. Set INITIAL_ADMIN_PASSWORD before first login."
                    )
                else:
                    admin = User(
                        username=settings.INITIAL_ADMIN_USERNAME,
                        full_name=settings.INITIAL_ADMIN_FULL_NAME,
                        email=settings.INITIAL_ADMIN_EMAIL,
                        hashed_password=hash_password(settings.INITIAL_ADMIN_PASSWORD),
                        role=UserRole.admin,
                    )
                    db.add(admin)
                    db.commit()
                    logger.info("Seeded the configured initial administrator.")
            else:
                admin = User(
                    username="admin",
                    full_name="System Administrator",
                    email="admin@gov.local",
                    hashed_password=hash_password(""),
                    role=UserRole.admin,
                )
                db.add(admin)
                db.commit()
                logger.info("Seeded local development administrator.")
    finally:
        db.close()


@app.get("/health")
def health() -> dict:
    """Liveness/health probe."""
    return {"status": "ok", "app": settings.APP_NAME}


@app.get("/api/health")
def api_health(db=Depends(get_db)) -> dict:
    """Health probe under the Vercel function's /api path."""
    db.execute(text("SELECT 1"))
    return {**health(), "database": "connected", "environment": settings.ENVIRONMENT}


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
