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

    class Config:
        env_file = ".env"


settings = Settings()

# A deployment can override the database location with DATABASE_PATH. This is
# useful when the local server should keep its data outside the source tree.
_db_path = os.environ.get("DATABASE_PATH")
if _db_path:
    settings.DATABASE_URL = f"sqlite:///{_db_path}"

if settings.ENVIRONMENT.lower() in {"production", "prod"}:
    if settings.SECRET_KEY == _DEFAULT_SECRET_KEY or len(settings.SECRET_KEY) < 32:
        raise RuntimeError(
            "Production requires a SECRET_KEY with at least 32 characters."
        )
