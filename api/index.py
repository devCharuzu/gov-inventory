"""Vercel FastAPI entrypoint.

Vercel expects an ASGI application named ``app`` in a root-level API entry
point. The application itself keeps its existing ``/api`` route prefix so the
browser and local development use the same URLs.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app  # noqa: E402

__all__ = ["app"]
