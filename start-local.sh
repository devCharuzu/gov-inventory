#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
BACKEND_DIR="$ROOT_DIR/backend"
PYTHON_BIN="$BACKEND_DIR/venv/bin/python"
PYTHON_COMMAND=""

for candidate in python3.14 python3.13 python3.12 python3.11 python3.10; do
  if command -v "$candidate" >/dev/null 2>&1; then
    PYTHON_COMMAND="$candidate"
    break
  fi
done

NEEDS_FRONTEND_BUILD=0
if [ ! -f "$BACKEND_DIR/static/index.html" ]; then
  NEEDS_FRONTEND_BUILD=1
elif find "$FRONTEND_DIR/src" "$FRONTEND_DIR/public" "$FRONTEND_DIR/index.html" "$FRONTEND_DIR/vite.config.ts" -type f -newer "$BACKEND_DIR/static/index.html" -print -quit | grep -q .; then
  NEEDS_FRONTEND_BUILD=1
fi

if [ "$NEEDS_FRONTEND_BUILD" -eq 1 ]; then
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Node.js and npm are required to build the local web app." >&2
    exit 1
  fi
  if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
    npm --prefix "$FRONTEND_DIR" ci
  fi
  npm --prefix "$FRONTEND_DIR" run build
fi

if [ ! -x "$PYTHON_BIN" ]; then
  [ -n "$PYTHON_COMMAND" ] || {
    echo "Python 3.10 or newer is required to run the local API." >&2
    exit 1
  }
  "$PYTHON_COMMAND" -m venv "$BACKEND_DIR/venv"
fi

if ! "$PYTHON_BIN" -c "import fastapi, uvicorn" >/dev/null 2>&1; then
  "$BACKEND_DIR/venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
fi

echo "Philfida Inventory System is running at http://127.0.0.1:${PORT:-8000}"
cd "$BACKEND_DIR"
exec "$PYTHON_BIN" -m uvicorn app.main:app --host 127.0.0.1 --port "${PORT:-8000}"
