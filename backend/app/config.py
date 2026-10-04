"""Application configuration and settings."""

import os
from pathlib import Path

from pydantic_settings import BaseSettings

# Anchor the default DB next to this file (backend/app/ → backend/) so the
# path is stable regardless of the working directory the process starts from.
_DEFAULT_DB = str(Path(__file__).resolve().parent.parent / "gov_inventory.db")
_DEFAULT_SECRET_KEY = "local-development-only-change-me"


class Settings(BaseSettings):
    """Environment-driven application settings."""

    DATABASE_URL: str = f"sqlite:///{_DEFAULT_DB}"
    SECRET_KEY: str = _DEFAULT_SECRET_KEY
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    APP_NAME: str = "Philfida Inventory System"
    ENVIRONMENT: str = "development"
    AUTO_CREATE_SCHEMA: bool = True
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    INITIAL_ADMIN_USERNAME: str = "admin_r13"
    INITIAL_ADMIN_FULL_NAME: str = "Regional Office XIII Administrator"
    INITIAL_ADMIN_EMAIL: str = "admin_r13@philfida.local"
    INITIAL_ADMIN_PASSWORD: str = ""
    SUPABASE_URL: str = ""
    SUPABASE_SECRET_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()


def _contains_placeholder(value: str) -> bool:
    """Return True when a configuration value is still an example template."""

    normalized = value.lower()
    return any(
        marker in normalized
        for marker in (
            "<project_ref>",
            "<url_encoded_database_password>",
            "<your-password>",
            "<generate-",
            "<set-a-",
        )
    )


_is_production = settings.ENVIRONMENT.lower() in {"production", "prod"}
if os.environ.get("VERCEL") == "1":
    _vercel_env = os.environ.get("VERCEL_ENV", "").lower()
    if _vercel_env == "preview":
        # Preview deployments are ephemeral: boot with local defaults instead
        # of crashing when production secrets aren't scoped to previews.
        # The strict gate below still applies to the real production deploy.
        settings.ENVIRONMENT = "preview"
    else:
        # Never let the production deployment silently fall back to an
        # ephemeral local SQLite file when env vars were not configured.
        _is_production = True
        settings.ENVIRONMENT = "production"
if _contains_placeholder(settings.DATABASE_URL):
    if _is_production:
        raise RuntimeError(
            "Production DATABASE_URL still contains an example placeholder. "
            "Set the Supabase Transaction pooler URL before starting the app."
        )
    # A copied production example must never make local development fail at
    # import time. Keep the local-first SQLite default until a real URL is set.
    settings.DATABASE_URL = f"sqlite:///{_DEFAULT_DB}"

# A deployment can override the database location with DATABASE_PATH. This is
# useful when the local server should keep its data outside the source tree.
_db_path = os.environ.get("DATABASE_PATH")
if _db_path:
    if settings.DATABASE_URL.startswith("sqlite"):
        settings.DATABASE_URL = f"sqlite:///{_db_path}"

if _is_production:
    if settings.DATABASE_URL.startswith("sqlite"):
        raise RuntimeError("Production requires a persistent PostgreSQL DATABASE_URL.")
    if settings.SECRET_KEY == _DEFAULT_SECRET_KEY or len(settings.SECRET_KEY) < 32:
        raise RuntimeError(
            "Production requires a SECRET_KEY with at least 32 characters."
        )
    settings.AUTO_CREATE_SCHEMA = False
